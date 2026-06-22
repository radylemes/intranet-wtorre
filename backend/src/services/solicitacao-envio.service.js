const repo = require('../repositories/solicitacao-colaborador.repository');
const blobService = require('./blob.service');
const smtpConfigService = require('./smtp-config.service');
const smtpMailService = require('./mail/smtp-mail.service');
const { CHAVES_ANEXO } = require('../config/solicitacao-campos');
const { buildGrupoHtml, buildTextoPlano, CAMPO_COL_MAP } = require('../utils/solicitacao-email-html.util');
const { decodeBlobRef, validarGrupoSensivel } = require('../utils/solicitacao-validation.util');
const { validarEmailsAlerta } = require('../utils/camarotes-email-domains.util');
const { env } = require('../config/env');

const TIPO_LABELS = {
  novo: 'Novo',
  reposicao: 'Reposição',
  mudanca: 'Mudança',
};

async function montarAnexos(solicitacao, campos) {
  const attachments = [];
  let totalBytes = 0;
  const maxBytes = env.solicitacaoColaboradorSmtpAnexoMaxMb * 1024 * 1024;

  for (const chave of campos) {
    if (!CHAVES_ANEXO.has(chave)) continue;
    const col = CAMPO_COL_MAP[chave] || `${chave}_url`;
    const ref = solicitacao[col];
    if (!ref) continue;

    const parsed = decodeBlobRef(ref);
    if (!parsed) continue;

    const { buffer, contentType, filename } = await blobService.baixarBuffer(
      parsed.container,
      parsed.blobName
    );
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      const err = new Error(
        `Anexos excedem o limite de ${env.solicitacaoColaboradorSmtpAnexoMaxMb} MB para envio SMTP.`
      );
      err.status = 400;
      throw err;
    }

    attachments.push({
      filename: filename || `${chave}.bin`,
      content: buffer,
      contentType,
    });
  }

  return attachments;
}

async function enviarGrupo(solicitacao, grupo) {
  const destinatarios = validarEmailsAlerta(grupo.destinatarios || []);
  if (!destinatarios.length) {
    const err = new Error(`Grupo "${grupo.nome}" não possui destinatários válidos.`);
    err.status = 400;
    throw err;
  }

  validarGrupoSensivel(grupo.campos, destinatarios);

  const html = buildGrupoHtml(solicitacao, grupo.campos);
  const text = buildTextoPlano(solicitacao, grupo.campos);
  const attachments = await montarAnexos(solicitacao, grupo.campos);

  const tipoLabel = TIPO_LABELS[solicitacao.tipo] || solicitacao.tipo;
  const subject = `Nova solicitação de colaborador — ${solicitacao.nome} (${tipoLabel})`;

  const config = await smtpConfigService.getDecrypted();
  const { enviados, erros } = await smtpMailService.sendMailBatched(config, {
    recipients: destinatarios,
    subject,
    html,
    text,
    attachments,
  });

  if (enviados === 0) {
    const msg = erros.map((e) => `${e.email}: ${e.mensagem}`).join('; ') || 'Falha no envio.';
    return {
      ok: false,
      erro: msg,
      destinatarios,
    };
  }

  if (erros.length) {
    return {
      ok: true,
      parcial: true,
      erro: erros.map((e) => `${e.email}: ${e.mensagem}`).join('; '),
      destinatarios,
    };
  }

  return { ok: true, destinatarios };
}

async function enviarParaGrupos(solicitacaoId) {
  const solicitacao = await repo.findSolicitacaoById(solicitacaoId);
  if (!solicitacao) {
    const err = new Error('Solicitação não encontrada.');
    err.status = 404;
    throw err;
  }

  const grupos = await repo.listGruposAtivos();
  if (!grupos.length) {
    return { grupos: [], status: solicitacao.status, aviso: 'Nenhum grupo de e-mail ativo.' };
  }

  const resultados = [];
  let okCount = 0;
  let errCount = 0;

  for (const grupo of grupos) {
    let status = 'ok';
    let erro = null;

    try {
      const res = await enviarGrupo(solicitacao, grupo);
      if (!res.ok) {
        status = 'erro';
        erro = res.erro;
        errCount += 1;
      } else {
        okCount += 1;
        if (res.parcial) erro = res.erro;
      }

      await repo.createEnvio({
        solicitacao_id: solicitacaoId,
        grupo_id: grupo.id,
        grupo_nome: grupo.nome,
        destinatarios: res.destinatarios || grupo.destinatarios,
        status,
        erro,
      });

      resultados.push({ grupo_id: grupo.id, grupo_nome: grupo.nome, status, erro });
    } catch (err) {
      errCount += 1;
      erro = err.message;
      await repo.createEnvio({
        solicitacao_id: solicitacaoId,
        grupo_id: grupo.id,
        grupo_nome: grupo.nome,
        destinatarios: grupo.destinatarios,
        status: 'erro',
        erro,
      });
      resultados.push({ grupo_id: grupo.id, grupo_nome: grupo.nome, status: 'erro', erro });
    }
  }

  let statusFinal = 'erro';
  if (okCount === grupos.length) statusFinal = 'enviada';
  else if (okCount > 0) statusFinal = 'parcial';

  await repo.updateSolicitacaoStatus(solicitacaoId, statusFinal);

  return { grupos: resultados, status: statusFinal };
}

async function previewGrupo(solicitacaoId, grupoId) {
  const solicitacao = await repo.findSolicitacaoById(solicitacaoId);
  if (!solicitacao) {
    const err = new Error('Solicitação não encontrada.');
    err.status = 404;
    throw err;
  }
  const grupo = await repo.findGrupoById(grupoId);
  if (!grupo) {
    const err = new Error('Grupo não encontrado.');
    err.status = 404;
    throw err;
  }
  return { html: buildGrupoHtml(solicitacao, grupo.campos) };
}

async function reenviarGrupo(solicitacaoId, grupoId) {
  const solicitacao = await repo.findSolicitacaoById(solicitacaoId);
  if (!solicitacao) {
    const err = new Error('Solicitação não encontrada.');
    err.status = 404;
    throw err;
  }
  const grupo = await repo.findGrupoById(grupoId);
  if (!grupo) {
    const err = new Error('Grupo não encontrado.');
    err.status = 404;
    throw err;
  }

  let status = 'ok';
  let erro = null;
  let destinatarios = grupo.destinatarios;

  try {
    const res = await enviarGrupo(solicitacao, grupo);
    destinatarios = res.destinatarios || destinatarios;
    if (!res.ok) {
      status = 'erro';
      erro = res.erro;
    } else if (res.parcial) {
      erro = res.erro;
    }
  } catch (err) {
    status = 'erro';
    erro = err.message;
  }

  const envio = await repo.createEnvio({
    solicitacao_id: solicitacaoId,
    grupo_id: grupo.id,
    grupo_nome: grupo.nome,
    destinatarios,
    status,
    erro,
  });

  return { envio, status, erro };
}

module.exports = {
  enviarParaGrupos,
  previewGrupo,
  reenviarGrupo,
  buildGrupoHtml,
};
