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

    const todos = await camarotesRepo.listContratosEmAlerta({
      gatilho_dias: gatilhoDias,
    });

    let itens = todos;
    if (notificado === true) {
      itens = todos.filter((i) => i.notificado);
    } else if (notificado === false) {
      itens = todos.filter((i) => !i.notificado);
    }

    const pendentes = todos.filter((i) => !i.notificado && i.gatilho_ativo).length;

    return res.json({
      total: itens.length,
      pendentes,
      itens,
    });
  } catch (err) {
    return handleError(res, err);
  }
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
    const diasMax = req.query.dias_max != null ? Number(req.query.dias_max) : undefined;
    const lista = await camarotesRepo.listUnidades(
      {
        tipo: req.query.tipo,
        setor: req.query.setor,
        situacao: req.query.situacao,
        dias_max: Number.isFinite(diasMax) ? diasMax : undefined,
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
    } = req.body || {};

    const emails = validarEmailsAlerta(emails_alerta ?? []);
    const dias = Number(dias_vence_breve ?? 90);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
      return res.status(400).json({ mensagem: 'Dias "vence em breve" deve estar entre 1 e 365.' });
    }

    await camarotesRepo.updateConfig({
      emails_alerta: emails,
      dias_vence_breve: dias,
      cadencia: cadencia === 'semanal' ? 'semanal' : 'diaria',
      envio_ativo: !!envio_ativo,
      sync_automatica: sync_automatica !== false,
      sync_frequencia,
      sharepoint_url: sharepoint_url !== undefined ? (sharepoint_url?.trim() || null) : undefined,
      sharepoint_sheet: sharepoint_sheet !== undefined ? (sharepoint_sheet?.trim() || 'Camarotes') : undefined,
    });

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
    const resultado = await alertasService.processarAlertas({
      preview,
      forcar: true,
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
