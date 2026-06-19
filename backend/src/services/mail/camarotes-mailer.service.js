const tenantsRepo = require('../../repositories/tenants.repository');
const graphService = require('../graph.service');
const graphMailService = require('../graph-mail.service');
const { env } = require('../../config/env');

function isCanalEmailConfigurado() {
  const mailer = (env.camarotesMailer || 'microservice').toLowerCase();
  if (mailer === 'graph') {
    return Boolean(env.camarotesMailFrom?.trim());
  }
  return Boolean(env.camarotesMailServiceUrl?.trim());
}

async function sendViaGraph({ recipients, subject, html }) {
  if (!env.camarotesMailFrom?.trim()) {
    throw new Error('CAMAROTES_MAIL_FROM não configurado no ambiente.');
  }

  const tenant = await tenantsRepo.findPrincipal();
  if (!tenant?.client_secret_ciphertext) {
    throw new Error('Tenant principal não configurado para envio de e-mail.');
  }

  const token = await graphService.getAppToken(tenant);
  return graphMailService.sendMailBatched(
    token,
    env.camarotesMailFrom,
    recipients,
    subject,
    html
  );
}

async function sendViaMicroservice({ recipients, subject, html }) {
  if (!env.camarotesMailServiceUrl?.trim()) {
    throw new Error('CAMAROTES_MAIL_SERVICE_URL não configurado no ambiente.');
  }

  const res = await fetch(env.camarotesMailServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipients,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Microserviço de e-mail retornou HTTP ${res.status}.`);
  }

  const data = await res.json().catch(() => ({}));
  return {
    enviados: data.enviados ?? recipients.length,
    erros: data.erros ?? [],
  };
}

async function sendDigest({ recipients, subject, html }) {
  const mailer = (env.camarotesMailer || 'microservice').toLowerCase();
  if (mailer === 'graph') {
    return sendViaGraph({ recipients, subject, html });
  }
  return sendViaMicroservice({ recipients, subject, html });
}

module.exports = {
  isCanalEmailConfigurado,
  sendDigest,
};
