const camarotesRepo = require('../repositories/camarotes.repository');
const {
  buildCamaroteAlertHtml,
  buildSubject,
  renderPreview,
  templateCodigoFromDias,
  UNIDADE_EXEMPLO,
} = require('../utils/camarotes-template.util');
const emailSender = require('../utils/emailSender');
const { sleep } = require('../utils/email-sender.helpers');

const SEND_DELAY_MS = 500;

function deveEnviarPorCadencia(config) {
  if (!config.envio_ativo) return false;
  if (!config.emails_alerta?.length) return false;
  if (config.cadencia !== 'semanal') return true;

  if (!config.ultimo_envio) return true;
  const ultimo = new Date(config.ultimo_envio);
  const agora = new Date();
  const diffDias = (agora - ultimo) / (1000 * 60 * 60 * 24);
  return diffDias >= 7;
}

function parseHorario(horario) {
  const match = String(horario || '08:00').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function dentroDoHorarioEnvio(horarioEnvio) {
  const { hour, minute } = parseHorario(horarioEnvio);
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h === hour && m === minute;
}

async function isCanalEmailConfigurado() {
  const sender = await emailSender.getMailSender();
  return sender != null;
}

function canalIndisponivelMotivo() {
  return 'Provedor de e-mail não configurado.';
}

async function enviarParaDestinatarios({
  recipients,
  subject,
  html,
  contexto,
}) {
  const erros = [];
  let enviados = 0;
  const tentativaEm = new Date();
  const sender = await emailSender.getMailSender();
  const providerDefault = sender?.provider || 'smtp';

  for (const to of recipients) {
    try {
      const resultado = await emailSender.sendEmail({ to, subject, html });
      enviados += 1;

      if (contexto) {
        await camarotesRepo.registrarDestinoEnvio({
          unidadeId: contexto.unidadeId,
          gatilhoDias: contexto.gatilhoDias,
          finalLocacao: contexto.finalLocacao,
          tentativaEm,
          destinatario: to,
          messageId: resultado?.messageId || null,
          provider: resultado?.provider || providerDefault,
          status: 'enviado',
        });
      }

      await sleep(SEND_DELAY_MS);
    } catch (err) {
      erros.push({ email: to, mensagem: err.message });

      if (contexto) {
        await camarotesRepo.registrarDestinoEnvio({
          unidadeId: contexto.unidadeId,
          gatilhoDias: contexto.gatilhoDias,
          finalLocacao: contexto.finalLocacao,
          tentativaEm,
          destinatario: to,
          messageId: null,
          provider: providerDefault,
          status: 'falha',
          erro: err.message,
        });
      }
    }
  }

  return { enviados, erros };
}

async function processarGatilho(gatilho, config, { preview = false, forcar = false, unidadeId } = {}) {
  if (!gatilho.ativo && !forcar) {
    return { gatilho_dias: gatilho.dias, processados: 0, enviados: 0, erros: [], ignorados: 0 };
  }

  let unidades = await camarotesRepo.listUnidadesPorDiasRestantes(gatilho.dias);
  if (unidadeId != null) {
    unidades = unidades.filter((u) => u.id === Number(unidadeId));
  }
  const pendentes = [];

  for (const unidade of unidades) {
    const jaEnviou = await camarotesRepo.jaEnviouAlerta(
      unidade.id,
      gatilho.dias,
      unidade.final_locacao
    );
    if (!jaEnviou || forcar) {
      pendentes.push(unidade);
    }
  }

  if (preview) {
    return {
      gatilho_dias: gatilho.dias,
      processados: pendentes.length,
      itens: pendentes.map((u) => ({
        unidade_id: u.id,
        numero: u.numero,
        assunto: buildSubject(gatilho.assunto, u),
        html: buildCamaroteAlertHtml(gatilho.template_codigo, u),
      })),
    };
  }

  const erros = [];
  let enviados = 0;
  let ignorados = unidades.length - pendentes.length;

  for (const unidade of pendentes) {
    const html = buildCamaroteAlertHtml(gatilho.template_codigo, unidade);
    const subject = buildSubject(gatilho.assunto, unidade);

    const resultado = await enviarParaDestinatarios({
      recipients: config.emails_alerta,
      subject,
      html,
      contexto: {
        unidadeId: unidade.id,
        gatilhoDias: gatilho.dias,
        finalLocacao: unidade.final_locacao,
      },
    });

    if (resultado.enviados > 0) {
      await camarotesRepo.registrarEnvioAlerta(
        unidade.id,
        gatilho.dias,
        unidade.final_locacao
      );
      enviados += 1;
    }
    if (resultado.erros.length) {
      erros.push(...resultado.erros.map((e) => ({ ...e, numero: unidade.numero })));
    }
  }

  return {
    gatilho_dias: gatilho.dias,
    processados: pendentes.length,
    enviados,
    ignorados,
    erros,
  };
}

async function processarAlertas({ preview = false, forcar = false, gatilhoDias, unidadeId } = {}) {
  const config = await camarotesRepo.getConfig();
  if (!config) {
    const err = new Error('Configuração de camarotes não encontrada.');
    err.status = 503;
    throw err;
  }

  if (!forcar && !preview && !deveEnviarPorCadencia(config)) {
    return { enviado: false, motivo: 'Cadência ou envio desativado.' };
  }

  let gatilhos;
  if (unidadeId != null && gatilhoDias != null) {
    const g = (config.gatilhos || []).find((item) => item.dias === Number(gatilhoDias));
    gatilhos = g ? [g] : [];
  } else {
    gatilhos = (config.gatilhos || []).filter((g) => g.ativo);
    if (gatilhoDias != null) {
      gatilhos = gatilhos.filter((g) => g.dias === Number(gatilhoDias));
    }
  }

  if (preview) {
    const previews = [];
    for (const gatilho of gatilhos.length ? gatilhos : config.gatilhos || []) {
      const res = await processarGatilho(gatilho, config, { preview: true, forcar: true });
      if (res.itens?.length) previews.push(res);
    }
    return {
      preview: true,
      destinatarios: config.emails_alerta,
      gatilhos: previews,
      html: previews[0]?.itens?.[0]?.html || renderPreview('90dias'),
    };
  }

  if (!config.emails_alerta.length) {
    const err = new Error('Nenhum e-mail de alerta configurado.');
    err.status = 400;
    throw err;
  }

  if (!(await isCanalEmailConfigurado())) {
    const err = new Error(canalIndisponivelMotivo());
    err.status = 503;
    throw err;
  }

  const resultados = [];
  let totalEnviados = 0;
  const todosErros = [];

  const listaGatilhos = gatilhos.length ? gatilhos : (config.gatilhos || []).filter((g) => g.ativo);

  for (const gatilho of listaGatilhos) {
    const res = await processarGatilho(gatilho, config, { forcar: true, unidadeId });
    resultados.push(res);
    totalEnviados += res.enviados || 0;
    if (res.erros?.length) todosErros.push(...res.erros);
  }

  if (totalEnviados > 0) {
    await camarotesRepo.touchUltimoEnvio();
  }

  return {
    enviado: totalEnviados > 0,
    enviados: totalEnviados,
    erros: todosErros,
    gatilhos: resultados,
    motivo:
      totalEnviados === 0
        ? 'Nenhum alerta pendente para os gatilhos configurados.'
        : undefined,
  };
}

async function previewGatilho(dias, unidadeId) {
  const config = await camarotesRepo.getConfig();
  const gatilho = (config?.gatilhos || []).find((g) => g.dias === Number(dias));
  if (!gatilho) {
    const err = new Error('Gatilho não encontrado.');
    err.status = 404;
    throw err;
  }

  let unidade = UNIDADE_EXEMPLO;
  if (unidadeId) {
    const found = await camarotesRepo.findUnidadeById(Number(unidadeId));
    if (found) unidade = found;
  }

  const templateCodigo = gatilho.template_codigo || templateCodigoFromDias(gatilho.dias);
  const html = buildCamaroteAlertHtml(templateCodigo, unidade);
  const subject = buildSubject(gatilho.assunto, unidade);

  return { html, subject, gatilho_dias: gatilho.dias, unidade };
}

async function tentarEnvioCron() {
  const config = await camarotesRepo.getConfig();
  if (!config?.envio_ativo) {
    return { enviado: false, motivo: 'Envio desativado.' };
  }
  if (!(await isCanalEmailConfigurado())) {
    console.log('[camarotes.cron] Provedor de e-mail não configurado, ignorando alertas.');
    return { enviado: false, motivo: 'Provedor de e-mail não configurado.' };
  }
  if (!dentroDoHorarioEnvio(config.horario_envio)) {
    return { enviado: false, motivo: 'Fora do horário de envio.' };
  }
  return processarAlertas();
}

async function enviarAposSync() {
  const settings = await camarotesRepo.getAlertasSettings();
  if (!settings.envio_apos_sync) {
    return { enviado: false, motivo: 'Envio após sync desativado.' };
  }
  return processarAlertas({ forcar: true });
}

async function enviarTesteGatilho(dias, destinatario) {
  const to = String(destinatario || '').trim().toLowerCase();
  if (!to) {
    const err = new Error('Informe um destinatário para o e-mail de teste.');
    err.status = 400;
    throw err;
  }

  if (!(await isCanalEmailConfigurado())) {
    const err = new Error(canalIndisponivelMotivo());
    err.status = 503;
    throw err;
  }

  const { html, subject } = await previewGatilho(dias);
  await emailSender.sendEmail({
    to,
    subject: `[Teste] ${subject}`,
    html,
  });

  return { ok: true, mensagem: `E-mail de teste enviado para ${to}.` };
}

/** @deprecated Use processarAlertas */
async function enviarResumo(opts) {
  return processarAlertas(opts);
}

module.exports = {
  processarAlertas,
  previewGatilho,
  enviarTesteGatilho,
  tentarEnvioCron,
  enviarAposSync,
  enviarResumo,
  deveEnviarPorCadencia,
  canalIndisponivelMotivo,
  isCanalEmailConfigurado,
  dentroDoHorarioEnvio,
};
