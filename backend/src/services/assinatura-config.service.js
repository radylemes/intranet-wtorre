const crypto = require('crypto');

const TTL_MS = 60 * 60 * 1000;
const store = new Map();

function toPsAssinatura(sig) {
  const tipo = sig.tipo === 'compartilhada' ? 'compartilhada' : 'pessoal';
  const entry = {
    Email: sig.email,
    Tipo: tipo,
  };

  if (tipo === 'pessoal') {
    entry.Nome = sig.nome || '';
    entry.Cargo = sig.cargo || '';
    entry.Telefone = sig.telefone || '';
    entry.Celular = sig.celular || '';
  } else {
    entry.Nome = sig.nome || '';
    entry.Cargo = sig.cargo || '';
    entry.Telefone = sig.telefone || '';
    entry.Celular = sig.celular || '';
  }

  return entry;
}

function create(assinaturas, emailPadrao) {
  const token = crypto.randomBytes(24).toString('hex');
  store.set(token, {
    assinaturas,
    emailPadrao,
    expires: Date.now() + TTL_MS,
  });
  return token;
}

function get(token) {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(token);
    return null;
  }
  return entry;
}

function toResponsePayload(config) {
  return {
    assinaturas: config.assinaturas.map(toPsAssinatura),
    EmailPadrao: config.emailPadrao || '',
  };
}

module.exports = {
  create,
  get,
  toResponsePayload,
};
