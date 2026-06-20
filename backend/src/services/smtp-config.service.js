const smtpConfigRepo = require('../repositories/smtp-config.repository');
const { encrypt, decrypt } = require('./crypto.service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPublic(row) {
  return smtpConfigRepo.mapSmtpConfigPublic(row);
}

function validateConfig(body, { existing, requirePassword = false } = {}) {
  const ativo = body.ativo !== false && body.ativo !== 0 ? !!body.ativo : false;
  const port = Number(body.port ?? existing?.port ?? 587);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const err = new Error('Porta SMTP deve estar entre 1 e 65535.');
    err.status = 400;
    throw err;
  }

  const host = String(body.host ?? existing?.host ?? '').trim();
  const user = String(body.user ?? existing?.user ?? '').trim();
  const fromEmail = String(body.from_email ?? existing?.from_email ?? '').trim();
  const fromName = String(body.from_name ?? existing?.from_name ?? '').trim() || null;

  if (fromEmail && !EMAIL_RE.test(fromEmail)) {
    const err = new Error('E-mail remetente inválido.');
    err.status = 400;
    throw err;
  }

  if (ativo) {
    if (!host) {
      const err = new Error('Host SMTP é obrigatório quando o envio está ativo.');
      err.status = 400;
      throw err;
    }
    if (!user) {
      const err = new Error('Usuário SMTP é obrigatório quando o envio está ativo.');
      err.status = 400;
      throw err;
    }
    if (!fromEmail) {
      const err = new Error('E-mail remetente é obrigatório quando o envio está ativo.');
      err.status = 400;
      throw err;
    }

    const hasPassword = Boolean(body.password?.trim()) || Boolean(existing?.password_ciphertext);
    if (requirePassword && !hasPassword) {
      const err = new Error('Senha SMTP é obrigatória quando o envio está ativo.');
      err.status = 400;
      throw err;
    }
  }

  return {
    host,
    port,
    secure: body.secure === true || body.secure === 1 || body.secure === '1',
    user,
    from_email: fromEmail,
    from_name: fromName,
    ativo,
  };
}

async function getPublicConfig() {
  const row = await smtpConfigRepo.get();
  return getPublic(row);
}

async function save(body) {
  const existing = await smtpConfigRepo.get();
  const validated = validateConfig(body, { existing, requirePassword: true });

  let passwordCiphertext = existing?.password_ciphertext ?? null;
  const password = body.password?.trim();
  if (password) {
    passwordCiphertext = encrypt(password);
  }

  const updated = await smtpConfigRepo.upsert({
    ...validated,
    password_ciphertext: passwordCiphertext,
  });

  return getPublic(updated);
}

async function getDecrypted({ requireActive = true } = {}) {
  const row = await smtpConfigRepo.get();
  if (!row) {
    const err = new Error('Configuração SMTP não encontrada.');
    err.status = 503;
    throw err;
  }

  if (requireActive && !row.ativo) {
    const err = new Error('Envio SMTP está desativado.');
    err.status = 503;
    throw err;
  }

  if (!row.host?.trim() || !row.user?.trim() || !row.from_email?.trim()) {
    const err = new Error('Configuração SMTP incompleta.');
    err.status = 503;
    throw err;
  }

  if (!row.password_ciphertext) {
    const err = new Error('Senha SMTP não configurada.');
    err.status = 503;
    throw err;
  }

  const password = decrypt(row.password_ciphertext);
  if (!password) {
    const err = new Error('Não foi possível descriptografar a senha SMTP.');
    err.status = 503;
    throw err;
  }

  return {
    host: row.host.trim(),
    port: row.port ?? 587,
    secure: !!row.secure,
    user: row.user.trim(),
    password,
    from_email: row.from_email.trim(),
    from_name: row.from_name?.trim() || null,
    ativo: !!row.ativo,
  };
}

module.exports = {
  getPublicConfig,
  save,
  getDecrypted,
  validateConfig,
};
