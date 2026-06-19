const camarotesRepo = require('../repositories/camarotes.repository');
const { buildDigestHtml } = require('../utils/camarotes-email-html.util');
const mailer = require('./mail/camarotes-mailer.service');

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

function canalIndisponivelMotivo() {
  if (!mailer.isCanalEmailConfigurado()) {
    return 'Canal de e-mail não configurado.';
  }
  return null;
}

async function enviarResumo({ preview = false, forcar = false } = {}) {
  const config = await camarotesRepo.getConfig();
  if (!config) {
    const err = new Error('Configuração de camarotes não encontrada.');
    err.status = 503;
    throw err;
  }

  if (!forcar && !deveEnviarPorCadencia(config)) {
    return { enviado: false, motivo: 'Cadência ou envio desativado.' };
  }

  const unidades = await camarotesRepo.listUnidadesParaAlerta(config.dias_vence_breve);
  const html = buildDigestHtml(unidades, { diasVenceBreve: config.dias_vence_breve });

  if (preview) {
    return {
      preview: true,
      html,
      total_itens: unidades.length,
      destinatarios: config.emails_alerta,
    };
  }

  if (!config.emails_alerta.length) {
    const err = new Error('Nenhum e-mail de alerta configurado.');
    err.status = 400;
    throw err;
  }

  const canalMotivo = canalIndisponivelMotivo();
  if (canalMotivo) {
    const err = new Error(canalMotivo);
    err.status = 503;
    throw err;
  }

  if (!unidades.length) {
    return { enviado: false, motivo: 'Nenhum contrato vencido ou a vencer no período.' };
  }

  const subject = `[Intranet] Camarotes — ${unidades.length} contrato(s) requerem atenção`;
  const resultado = await mailer.sendDigest({
    recipients: config.emails_alerta,
    subject,
    html,
  });

  if (resultado.enviados > 0) {
    await camarotesRepo.touchUltimoEnvio();
  }

  return {
    enviado: resultado.enviados > 0,
    enviados: resultado.enviados,
    erros: resultado.erros,
    total_itens: unidades.length,
  };
}

async function tentarEnvioCron() {
  const config = await camarotesRepo.getConfig();
  if (!config?.envio_ativo) {
    console.log('[camarotes.cron] Canal de e-mail não configurado, ignorando alertas.');
    return { enviado: false, motivo: 'Envio desativado.' };
  }
  if (!mailer.isCanalEmailConfigurado()) {
    console.log('[camarotes.cron] Canal de e-mail não configurado, ignorando alertas.');
    return { enviado: false, motivo: 'Canal de e-mail não configurado.' };
  }
  return enviarResumo();
}

module.exports = {
  enviarResumo,
  deveEnviarPorCadencia,
  tentarEnvioCron,
  canalIndisponivelMotivo,
};
