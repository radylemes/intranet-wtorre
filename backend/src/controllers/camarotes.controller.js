const camarotesRepo = require('../repositories/camarotes.repository');
const syncService = require('../services/camarotes-sync.service');
const alertasService = require('../services/camarotes-alertas.service');
const {
  reagendarSyncCamarotes,
  reagendarAlertasCamarotes,
} = require('../services/camarotes-cron.service');
const { validarEmailsAlerta } = require('../utils/camarotes-email-domains.util');
const { usuarioPodeVisualizar } = require('../services/camarotes-acesso.service');
const permissoesService = require('../services/permissoes.service');
const usersRepo = require('../repositories/users.repository');
const auditRepo = require('../repositories/auditLog.repository');

const GATILHOS_VALIDOS = new Set([90, 30, 0]);
const TEMPLATES_VALIDOS = new Set(['90dias', '30dias', 'hoje']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function auditMeta(req) {
  return {
    userId: req.user?.id,
    requestId: req.requestId,
    ip: req.ip,
  };
}

function handleError(res, err) {
  if (err.resumo) {
    return res.status(err.status || 502).json({
      mensagem: err.message,
      ...err.resumo,
    });
  }
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar solicitação de camarotes.',
  });
}

function validarGatilhos(gatilhos) {
  if (!Array.isArray(gatilhos)) return [];
  const out = [];
  for (const g of gatilhos) {
    const dias = Number(g.dias);
    if (!GATILHOS_VALIDOS.has(dias)) {
      const err = new Error('Gatilhos devem ter antecedência de 90, 30 ou 0 dias.');
      err.status = 400;
      throw err;
    }
    const template_codigo = g.template_codigo;
    if (!TEMPLATES_VALIDOS.has(template_codigo)) {
      const err = new Error('Template de gatilho inválido.');
      err.status = 400;
      throw err;
    }
    const assunto = String(g.assunto || '').trim();
    if (g.ativo && !assunto) {
      const err = new Error(`Assunto obrigatório para o gatilho de ${dias} dias.`);
      err.status = 400;
      throw err;
    }
    out.push({
      dias,
      template_codigo,
      assunto: assunto || `Camarote Nº [XXX] — Alerta ${dias} dias`,
      ativo: !!g.ativo,
    });
  }
  return out;
}

function validarHorario(horario) {
  const h = String(horario || '08:00').trim();
  if (!/^\d{1,2}:\d{2}$/.test(h)) {
    const err = new Error('Horário de envio inválido. Use o formato HH:MM.');
    err.status = 400;
    throw err;
  }
  const [hh, mm] = h.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    const err = new Error('Horário de envio inválido.');
    err.status = 400;
    throw err;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

async function sincronizar(req, res) {
  try {
    const resumo = await syncService.sincronizarCamarotes();
    return res.json(resumo);
  } catch (err) {
    return handleError(res, err);
  }
}

async function syncLog(req, res) {
  try {
    const limit = req.query.limit;
    const logs = await camarotesRepo.listSyncLog(limit);
    return res.json(logs);
  } catch (err) {
    return handleError(res, err);
  }
}

async function alertasEnvioLog(req, res) {
  try {
    const limit = req.query.limit;
    const logs = await camarotesRepo.listAlertasEnvioLog(limit);
    return res.json(logs);
  } catch (err) {
    return handleError(res, err);
  }
}

async function listarContratosEmAlerta(req, res) {
  try {
    const gatilhoDias = req.query.gatilho_dias;
    const notificadoRaw = req.query.notificado;

    let notificado;
    if (notificadoRaw === 'true') notificado = true;
    else if (notificadoRaw === 'false') notificado = false;

    const todos = await camarotesRepo.listContratosEmAlerta({});

    const resumo = buildResumoContratosAlerta(todos);

    let itens = todos;
    if (gatilhoDias != null && gatilhoDias !== '') {
      const g = Number(gatilhoDias);
      itens = itens.filter((i) => i.gatilho_dias === g);
    }
    if (notificado === true) {
      itens = itens.filter((i) => i.notificado);
    } else if (notificado === false) {
      itens = itens.filter((i) => !i.notificado);
    }

    return res.json({
      total: itens.length,
      pendentes: resumo.pendentes,
      resumo,
      itens,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

function buildResumoContratosAlerta(itens) {
  const pendentesDe = (lista) =>
    lista.filter((i) => !i.notificado && i.gatilho_ativo).length;
  const porGatilho = (dias) => itens.filter((i) => i.gatilho_dias === dias);
  const g90 = porGatilho(90);
  const g30 = porGatilho(30);
  const g0 = porGatilho(0);

  return {
    total: itens.length,
    pendentes: pendentesDe(itens),
    g90: { total: g90.length, pendentes: pendentesDe(g90) },
    g30: { total: g30.length, pendentes: pendentesDe(g30) },
    g0: { total: g0.length, pendentes: pendentesDe(g0) },
    vence_hoje: itens.filter((i) => i.dias_restantes === 0).length,
    vencidos: g0.filter((i) => i.dias_restantes < 0).length,
  };
}

async function dashboard(req, res) {
  try {
    const data = await camarotesRepo.buildDashboard();
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

async function unidades(req, res) {
  try {
    const config = await camarotesRepo.getConfig();
    const dias = config?.dias_vence_breve ?? 90;
    const diasRestantesMin =
      req.query.dias_restantes_min != null ? Number(req.query.dias_restantes_min) : undefined;
    const diasRestantesMax =
      req.query.dias_restantes_max != null ? Number(req.query.dias_restantes_max) : undefined;
    const lista = await camarotesRepo.listUnidades(
      {
        tipo: req.query.tipo,
        setor: req.query.setor,
        situacao: req.query.situacao,
        dias_restantes_min: Number.isFinite(diasRestantesMin) ? diasRestantesMin : undefined,
        dias_restantes_max: Number.isFinite(diasRestantesMax) ? diasRestantesMax : undefined,
      },
      dias
    );
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obterConfig(_req, res) {
  try {
    const config = await camarotesRepo.getConfig();
    return res.json(config);
  } catch (err) {
    return handleError(res, err);
  }
}

async function atualizarConfig(req, res) {
  try {
    const body = req.body || {};
    const {
      emails_alerta,
      dias_vence_breve,
      cadencia,
      envio_ativo,
      sync_automatica,
      sync_frequencia,
      gatilhos,
      horario_envio,
      envio_apos_sync,
      sharepoint_url,
      sharepoint_sheet,
    } = body;

    const updateData = {};

    if (emails_alerta !== undefined) {
      updateData.emails_alerta = validarEmailsAlerta(emails_alerta);
    }

    if (dias_vence_breve !== undefined) {
      const dias = Number(dias_vence_breve);
      if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
        return res.status(400).json({ mensagem: 'Dias "vence em breve" deve estar entre 1 e 365.' });
      }
      updateData.dias_vence_breve = dias;
    }

    if (cadencia !== undefined) {
      updateData.cadencia = cadencia === 'semanal' ? 'semanal' : 'diaria';
    }

    if (envio_ativo !== undefined) {
      updateData.envio_ativo = !!envio_ativo;
    }

    if (sync_automatica !== undefined) {
      updateData.sync_automatica = sync_automatica !== false;
    }

    if (sync_frequencia !== undefined) {
      updateData.sync_frequencia = sync_frequencia;
    }

    if (sharepoint_url !== undefined) {
      updateData.sharepoint_url = sharepoint_url?.trim() || null;
    }

    if (sharepoint_sheet !== undefined) {
      updateData.sharepoint_sheet = sharepoint_sheet?.trim() || 'Camarotes';
    }

    if (Object.keys(updateData).length > 0) {
      await camarotesRepo.updateConfig(updateData);
    }

    if (Array.isArray(gatilhos)) {
      await camarotesRepo.upsertGatilhos(validarGatilhos(gatilhos));
    }

    if (horario_envio != null || envio_apos_sync != null) {
      const current = await camarotesRepo.getAlertasSettings();
      await camarotesRepo.updateAlertasSettings({
        horario_envio:
          horario_envio != null ? validarHorario(horario_envio) : current.horario_envio,
        envio_apos_sync:
          envio_apos_sync != null ? !!envio_apos_sync : current.envio_apos_sync,
      });
    }

    await reagendarSyncCamarotes();
    await reagendarAlertasCamarotes();

    await auditRepo.log({
      ...auditMeta(req),
      action: 'CAMAROTES_GATILHOS_SALVOS',
      email: req.user?.email,
    });

    const config = await camarotesRepo.getConfig();
    return res.json(config);
  } catch (err) {
    return handleError(res, err);
  }
}

async function previewGatilho(req, res) {
  try {
    const dias = Number(req.params.dias);
    const unidadeId = req.query.unidade_id ? Number(req.query.unidade_id) : undefined;
    const resultado = await alertasService.previewGatilho(dias, unidadeId);
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
}

async function testarGatilho(req, res) {
  try {
    const dias = Number(req.params.dias);
    const destinatario = (req.body?.to || req.user?.email || '').trim().toLowerCase();
    if (!destinatario) {
      return res.status(400).json({ mensagem: 'Informe um destinatário para o e-mail de teste.' });
    }
    if (!EMAIL_RE.test(destinatario)) {
      return res.status(400).json({ mensagem: 'E-mail do destinatário inválido.' });
    }

    const resultado = await alertasService.enviarTesteGatilho(dias, destinatario);

    await auditRepo.log({
      ...auditMeta(req),
      action: 'CAMAROTES_GATILHO_TESTE_ENVIADO',
      email: destinatario,
    });

    return res.json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
}

async function enviarAlertas(req, res) {
  try {
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const gatilhoDias = req.query.gatilho_dias != null ? Number(req.query.gatilho_dias) : undefined;
    const unidadeId = req.query.unidade_id != null ? Number(req.query.unidade_id) : undefined;
    const forcar = req.query.forcar === '1' || req.query.forcar === 'true';
    const resultado = await alertasService.processarAlertas({
      preview,
      forcar,
      gatilhoDias,
      unidadeId,
    });

    if (!preview && resultado.enviado) {
      await auditRepo.log({
        ...auditMeta(req),
        action: 'CAMAROTES_ALERTAS_ENVIADOS',
        email: req.user?.email,
      });
    }

    return res.json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
}

async function enviarResumo(req, res) {
  return enviarAlertas(req, res);
}

async function acesso(req, res) {
  try {
    const pode_visualizar = await usuarioPodeVisualizar(req.user, req.userModulos || []);
    return res.json({ pode_visualizar });
  } catch (err) {
    return handleError(res, err);
  }
}

async function listarVisualizadores(_req, res) {
  try {
    const lista = await camarotesRepo.listVisualizadores();
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function adicionarVisualizador(req, res) {
  try {
    let usuarioId = Number(req.body?.usuario_id);
    if (!usuarioId && req.body?.colaborador_id) {
      const user = await permissoesService.provisionarUsuarioDeColaborador(
        Number(req.body.colaborador_id)
      );
      usuarioId = user.id;
    }

    if (!usuarioId) {
      return res.status(400).json({ mensagem: 'Informe usuario_id ou colaborador_id.' });
    }

    const user = await usersRepo.findById(usuarioId);
    if (!user || !user.ativo) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado ou inativo.' });
    }

    const visualizador = await camarotesRepo.addVisualizador(usuarioId, req.user.id);
    return res.status(201).json(visualizador);
  } catch (err) {
    return handleError(res, err);
  }
}

async function removerVisualizador(req, res) {
  try {
    const usuarioId = Number(req.params.usuarioId);
    const removido = await camarotesRepo.removeVisualizador(usuarioId);
    if (!removido) {
      return res.status(404).json({ mensagem: 'Visualizador não encontrado.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  sincronizar,
  syncLog,
  alertasEnvioLog,
  listarContratosEmAlerta,
  dashboard,
  unidades,
  obterConfig,
  atualizarConfig,
  previewGatilho,
  testarGatilho,
  enviarAlertas,
  enviarResumo,
  acesso,
  listarVisualizadores,
  adicionarVisualizador,
  removerVisualizador,
};
