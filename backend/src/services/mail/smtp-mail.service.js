const nodemailer = require('nodemailer');
const smtpConfigService = require('../smtp-config.service');

function formatFrom(config) {
  if (config.from_name) {
    return `"${config.from_name}" <${config.from_email}>`;
  }
  return config.from_email;
}

function mapSmtpError(err) {
  const code = err?.code || '';
  const response = String(err?.response || err?.message || '');

  if (code === 'EAUTH' || /authentication/i.test(response)) {
    return 'Falha na autenticação SMTP. Verifique usuário e senha.';
  }
  if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return 'Não foi possível conectar ao servidor SMTP. Verifique host, porta e firewall.';
  }
  if (code === 'ECERT' || /certificate/i.test(response)) {
    return 'Erro de certificado TLS no servidor SMTP.';
  }

  return err?.message || 'Falha ao enviar e-mail via SMTP.';
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

async function verifyConnection(config) {
  const transporter = createTransporter(config);
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    const mapped = new Error(mapSmtpError(err));
    mapped.status = 400;
    throw mapped;
  } finally {
    transporter.close();
  }
}

async function sendMail(config, { to, subject, html, text }) {
  const transporter = createTransporter(config);
  try {
    await transporter.sendMail({
      from: formatFrom(config),
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    const mapped = new Error(mapSmtpError(err));
    mapped.status = 400;
    throw mapped;
  } finally {
    transporter.close();
  }
}

async function sendMailBatched(config, { recipients, subject, html, text }) {
  const list = [...new Set(recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return { enviados: 0, erros: [] };

  const erros = [];
  let enviados = 0;

  for (const to of list) {
    try {
      await sendMail(config, { to, subject, html, text });
      enviados += 1;
    } catch (err) {
      erros.push({ email: to, mensagem: err.message });
    }
  }

  return { enviados, erros };
}

async function verifyStoredConnection() {
  const config = await smtpConfigService.getDecrypted({ requireActive: false });
  return verifyConnection(config);
}

async function sendWithStoredConfig(payload) {
  const config = await smtpConfigService.getDecrypted();
  await sendMail(config, payload);
}

module.exports = {
  createTransporter,
  verifyConnection,
  sendMail,
  sendMailBatched,
  verifyStoredConnection,
  sendWithStoredConfig,
  formatFrom,
};
