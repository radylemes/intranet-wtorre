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
const JOB_TTL_MS = 10 * 60 * 1000;

/** @type {Map<string, { status: string, startedAt: number, resultado?: object, mensagem?: string }>} */
const enviosJobs = new Map();

function buildEnvioJobKey({ unidadeId, gatilhoDias } = {}) {
  return `${unidadeId ?? 'lote'}-${gatilhoDias ?? 'all'}`;
}

function buildFilaItemId(unidadeId, gatilhoDias, destinatario) {
  const email = String(destinatario || '').trim().toLowerCase();
  return `${unidadeId}-${gatilhoDias}-${email}`;
}

function calcularResumoFila(fila) {
  const resumo = {
    total: fila.length,
    pendente: 0,
    na_fila: 0,
    enviando: 0,
    enviado: 0,
    falha: 0,
  };
  for (const item of fila) {
    if (Object.prototype.hasOwnProperty.call(resumo, item.status)) {
      resumo[item.status] += 1;
    }
  }
  return resumo;
}

function atualizarItemFila(jobKey, itemId, patch) {
  if (!jobKey || !itemId) return;
  const job = enviosJobs.get(jobKey);
  if (!job?.fila?.length) return;

  job.fila = job.fila.map((item) =>
    item.id === itemId ? { ...item, ...patch } : item
  );
}

function jobStatusExtras(job) {
  if (!job?.fila?.length) return {};
  return {
    fila: job.fila,
    fila_resumo: calcularResumoFila(job.fila),
  };
}

function scheduleJobCleanup(jobKey) {
  setTimeout(() => {
    enviosJobs.delete(jobKey);
  }, JOB_TTL_MS);
}

function getEnvioJobStatus(jobKey) {
  const job = enviosJobs.get(jobKey);
  if (!job) {
    return { status: 'desconhecido', job_key: jobKey };
  }
  const extras = jobStatusExtras(job);
  if (job.status === 'em_andamento') {
    return { status: 'em_andamento', job_key: jobKey, ...extras };
  }
  if (job.status === 'erro') {
    return { status: 'erro', job_key: jobKey, mensagem: job.mensagem, ...extras };
  }
  return {
    status: 'concluido',
    job_key: jobKey,
    ...(job.resultado || {}),
    ...extras,
  };
}

async function listarUnidadesPendentesEnvio(gatilho, { forcar = false, unidadeId } = {}) {
  if (!gatilho.ativo && !forcar) return [];

  let unidades = forcar
    ? await camarotesRepo.listUnidadesPorLimiteGatilho(gatilho.dias)
    : await camarotesRepo.listUnidadesPendentesGatilho(gatilho.dias);
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
  return pendentes;
}

function resolverGatilhosParaEnvio(config, { gatilhoDias, unidadeId } = {}) {
  if (unidadeId != null && gatilhoDias != null) {
    const g = (config.gatilhos || []).find((item) => item.dias === Number(gatilhoDias));
    return g ? [g] : [];
  }

  let gatilhos = (config.gatilhos || []).filter((g) => g.ativo);
  if (gatilhoDias != null) {
    gatilhos = gatilhos.filter((g) => g.dias === Number(gatilhoDias));
  }
  return gatilhos;
}

async function montarFilaInicial(params) {
  const { forcar = false, gatilhoDias, unidadeId } = params;
  const config = await camarotesRepo.getConfig();
  if (!config?.emails_alerta?.length) return [];

  const listaGatilhos = resolverGatilhosParaEnvio(config, { gatilhoDias, unidadeId });
  const fila = [];

  for (const gatilho of listaGatilhos) {
    const pendentes = await listarUnidadesPendentesEnvio(gatilho, { forcar, unidadeId });
    for (const unidade of pendentes) {
      for (const destinatario of config.emails_alerta) {
        const email = String(destinatario).trim().toLowerCase();
        fila.push({
          id: buildFilaItemId(unidade.id, gatilho.dias, email),
          unidade_id: unidade.id,
          numero: unidade.numero,
          gatilho_dias: gatilho.dias,
          final_locacao: unidade.final_locacao,
          destinatario: email,
          status: 'pendente',
          enviar_em: null,
          enviado_em: null,
          erro: null,
          motivo_fila: null,
        });
      }
    }
  }

  return fila;
}

async function persistirFilaInicialNoBanco(fila, tentativaEm, provider) {
  if (!fila.length) return;
  await camarotesRepo.registrarDestinosPendentes({
    tentativaEm,
    provider,
    items: fila.map((item) => ({
      unidadeId: item.unidade_id,
      gatilhoDias: item.gatilho_dias,
      finalLocacao: item.final_locacao,
      destinatario: item.destinatario,
    })),
  });
}

async function syncDestinoStatus({
  jobKey,
  filaItemId,
  contexto,
  destinatario,
  patch,
}) {
  if (jobKey && filaItemId) {
    atualizarItemFila(jobKey, filaItemId, patch);
  }

  if (!contexto?.persistido || !contexto.tentativaEm) return;

  const enviarEm =
    patch.enviar_em === null
      ? null
      : patch.enviar_em != null
        ? new Date(patch.enviar_em)
        : undefined;

  await camarotesRepo.atualizarDestinoEnvio({
    unidadeId: contexto.unidadeId,
    gatilhoDias: contexto.gatilhoDias,
    finalLocacao: contexto.finalLocacao,
    tentativaEm: contexto.tentativaEm,
    destinatario: destinatario ?? contexto.destinatario,
    status: patch.status,
    messageId: patch.messageId,
    provider: patch.provider,
    erro: patch.erro,
    enviarEm,
  });
}

async function validarEnvioBackground(params) {
  const config = await camarotesRepo.getConfig();
  if (!config) {
    const err = new Error('Configuração de camarotes não encontrada.');
    err.status = 503;
    throw err;
  }

  const { forcar = false } = params;
  if (!forcar && !deveEnviarPorCadencia(config)) {
    const err = new Error('Cadência ou envio desativado.');
    err.status = 400;
    throw err;
  }
  if (!config.emails_alerta?.length) {
    const err = new Error('Nenhum e-mail de alerta configurado.');
    err.status = 400;
    throw err;
  }
  if (!(await isCanalEmailConfigurado())) {
    const err = new Error(canalIndisponivelMotivo());
    err.status = 503;
    throw err;
  }

  return config;
}

async function iniciarEnvioBackground(params, { onSucesso } = {}) {
  const jobKey = buildEnvioJobKey(params);
  const existing = enviosJobs.get(jobKey);
  if (existing?.status === 'em_andamento') {
    return {
      aceito: true,
      status: 'em_andamento',
      job_key: jobKey,
      total_enfileirados: existing.fila?.length ?? 0,
      tentativa_em: existing.tentativaEm ?? null,
    };
  }

  await validarEnvioBackground(params);

  const fila = await montarFilaInicial(params);
  const tentativaEm = new Date();
  const sender = await emailSender.getMailSender();
  const provider = sender?.provider || 'smtp';

  if (fila.length) {
    await persistirFilaInicialNoBanco(fila, tentativaEm, provider);
  }

  enviosJobs.set(jobKey, {
    status: 'em_andamento',
    startedAt: Date.now(),
    fila,
    tentativaEm,
  });

  (async () => {
    try {
      const resultado = await processarAlertas({ ...params, jobKey, tentativaEm, persistido: !!fila.length });
      const filaAtual = enviosJobs.get(jobKey)?.fila ?? fila;

      enviosJobs.set(jobKey, {
        status: 'concluido',
        startedAt: enviosJobs.get(jobKey)?.startedAt ?? Date.now(),
        resultado,
        fila: filaAtual,
        tentativaEm,
      });

      if (resultado.enviado && typeof onSucesso === 'function') {
        await onSucesso(resultado);
      }
      scheduleJobCleanup(jobKey);
    } catch (err) {
      enviosJobs.set(jobKey, {
        status: 'erro',
        startedAt: enviosJobs.get(jobKey)?.startedAt ?? Date.now(),
        mensagem: err.message || 'Erro ao enviar alertas.',
        fila: enviosJobs.get(jobKey)?.fila ?? fila,
        tentativaEm,
      });
      scheduleJobCleanup(jobKey);
    }
  })();

  return {
    aceito: true,
    status: 'iniciado',
    job_key: jobKey,
    total_enfileirados: fila.length,
    tentativa_em: tentativaEm.toISOString(),
  };
}

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
  const tentativaEm = contexto?.tentativaEm ?? new Date();
  const sender = await emailSender.getMailSender();
  const providerDefault = sender?.provider || 'smtp';
  const jobKey = contexto?.jobKey;
  const isAcs = providerDefault === 'acs';
  const persistido = !!contexto?.persistido;

  for (let i = 0; i < recipients.length; i += 1) {
    const to = recipients[i];
    const filaItemId = contexto
      ? buildFilaItemId(contexto.unidadeId, contexto.gatilhoDias, to)
      : null;

    const ctxDestino = contexto
      ? { ...contexto, tentativaEm, persistido, destinatario: to }
      : null;

    if (jobKey && filaItemId) {
      await syncDestinoStatus({
        jobKey,
        filaItemId,
        contexto: ctxDestino,
        destinatario: to,
        patch: { status: 'enviando', enviar_em: null, motivo_fila: null },
      });
    }

    try {
      const mailOpts = { to, subject, html };

      if (isAcs && jobKey && filaItemId) {
        mailOpts.onAcsWait = (enviarEm, _waitMs, motivoFila) => {
          void syncDestinoStatus({
            jobKey,
            filaItemId,
            contexto: ctxDestino,
            destinatario: to,
            patch: {
              status: 'na_fila',
              enviar_em: new Date(enviarEm).toISOString(),
              motivo_fila: motivoFila || 'Limite ACS: aguardando janela de envio',
            },
          });
        };
      } else if (!isAcs && i > 0 && jobKey && filaItemId) {
        const enviarEm = Date.now() + SEND_DELAY_MS;
        await syncDestinoStatus({
          jobKey,
          filaItemId,
          contexto: ctxDestino,
          destinatario: to,
          patch: {
            status: 'na_fila',
            enviar_em: new Date(enviarEm).toISOString(),
            motivo_fila: 'Intervalo entre destinatários',
          },
        });
        await sleep(SEND_DELAY_MS);
        await syncDestinoStatus({
          jobKey,
          filaItemId,
          contexto: ctxDestino,
          destinatario: to,
          patch: { status: 'enviando', enviar_em: null, motivo_fila: null },
        });
      }

      const resultado = await emailSender.sendEmail(mailOpts);
      enviados += 1;

      if (jobKey && filaItemId) {
        await syncDestinoStatus({
          jobKey,
          filaItemId,
          contexto: ctxDestino,
          destinatario: to,
          patch: {
            status: 'enviado',
            enviado_em: new Date().toISOString(),
            enviar_em: null,
            motivo_fila: null,
            erro: null,
            messageId: resultado?.messageId || null,
            provider: resultado?.provider || providerDefault,
          },
        });
      } else if (contexto && !persistido) {
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

      if (isAcs && i < recipients.length - 1) {
        await sleep(SEND_DELAY_MS);
      }
    } catch (err) {
      erros.push({ email: to, mensagem: err.message });

      if (jobKey && filaItemId) {
        await syncDestinoStatus({
          jobKey,
          filaItemId,
          contexto: ctxDestino,
          destinatario: to,
          patch: {
            status: 'falha',
            erro: err.message,
            enviar_em: null,
            motivo_fila: null,
            provider: providerDefault,
          },
        });
      } else if (contexto && !persistido) {
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

async function processarGatilho(gatilho, config, { preview = false, forcar = false, unidadeId, jobKey, tentativaEm, persistido } = {}) {
  if (!gatilho.ativo && !forcar) {
    return { gatilho_dias: gatilho.dias, processados: 0, enviados: 0, erros: [], ignorados: 0 };
  }

  const pendentes = await listarUnidadesPendentesEnvio(gatilho, { forcar, unidadeId });
  const unidadesTotal = forcar
    ? await camarotesRepo.listUnidadesPorLimiteGatilho(gatilho.dias)
    : await camarotesRepo.listUnidadesPendentesGatilho(gatilho.dias);
  const unidadesFiltradas =
    unidadeId != null ? unidadesTotal.filter((u) => u.id === Number(unidadeId)) : unidadesTotal;

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
  let ignorados = unidadesFiltradas.length - pendentes.length;

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
        jobKey,
        tentativaEm,
        persistido,
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

async function processarAlertas({ preview = false, forcar = false, gatilhoDias, unidadeId, jobKey, tentativaEm, persistido } = {}) {
  const config = await camarotesRepo.getConfig();
  if (!config) {
    const err = new Error('Configuração de camarotes não encontrada.');
    err.status = 503;
    throw err;
  }

  if (!forcar && !preview && !deveEnviarPorCadencia(config)) {
    return { enviado: false, motivo: 'Cadência ou envio desativado.' };
  }

  const gatilhos = resolverGatilhosParaEnvio(config, { gatilhoDias, unidadeId });
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
    const res = await processarGatilho(gatilho, config, { forcar, unidadeId, jobKey, tentativaEm, persistido });
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
  return processarAlertas();
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
  buildEnvioJobKey,
  getEnvioJobStatus,
  iniciarEnvioBackground,
};
