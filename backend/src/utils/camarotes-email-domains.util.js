const { DOMINIOS } = require('./assinatura-domains');

/** Domínios permitidos para destinatários de alerta (dados sensíveis). */
const DOMINIOS_ALERTA_EXTRA = ['grupowtorre.com', 'grupowtorre.com.br'];

const DOMINIOS_PERMITIDOS = new Set([
  ...Object.keys(DOMINIOS),
  ...DOMINIOS_ALERTA_EXTRA,
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function extrairDominio(email) {
  if (!email || typeof email !== 'string') return null;
  const idx = email.lastIndexOf('@');
  if (idx < 0) return null;
  return email.slice(idx + 1).toLowerCase();
}

function isDominioAlertaPermitido(email) {
  const dominio = extrairDominio(email);
  if (!dominio) return false;
  return DOMINIOS_PERMITIDOS.has(dominio);
}

function validarEmailsAlerta(emails) {
  if (!Array.isArray(emails)) {
    const err = new Error('Lista de e-mails inválida.');
    err.status = 400;
    throw err;
  }

  const normalizados = [];
  const vistos = new Set();

  for (const raw of emails) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      const err = new Error(`E-mail inválido: ${raw}`);
      err.status = 400;
      throw err;
    }
    if (!isDominioAlertaPermitido(email)) {
      const err = new Error(
        `E-mail fora dos domínios permitidos: ${email}. Use apenas endereços internos da organização.`
      );
      err.status = 400;
      throw err;
    }
    if (vistos.has(email)) continue;
    vistos.add(email);
    normalizados.push(email);
  }

  return normalizados;
}

module.exports = {
  DOMINIOS_PERMITIDOS,
  isDominioAlertaPermitido,
  validarEmailsAlerta,
};
