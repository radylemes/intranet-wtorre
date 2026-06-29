const nodemailer = require('nodemailer');

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

async function sendMail(config, { to, subject, html, text, attachments }) {
  const transporter = createTransporter(config);
  try {
    const mailOptions = {
      from: formatFrom(config),
      to,
      subject,
      html,
      text,
    };
    if (attachments?.length) {
      mailOptions.attachments = attachments;
    }
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    const mapped = new Error(mapSmtpError(err));
    mapped.status = 400;
    throw mapped;
  } finally {
    transporter.close();
  }
}

async function sendMailBatched(config, { recipients, subject, html, text, attachments }) {
  const list = [...new Set(recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return { enviados: 0, erros: [] };

  const erros = [];
  let enviados = 0;

  for (const to of list) {
    try {
      await sendMail(config, { to, subject, html, text, attachments });
      enviados += 1;
    } catch (err) {
      erros.push({ email: to, mensagem: err.message });
    }
  }

  return { enviados, erros };
}

async function verifyStoredConnection() {
  const emailConfigService = require('../email-config.service');
  const cfg = await emailConfigService.getEmailProviderConfig({ requireActive: false });
  if (cfg.provider !== 'smtp') {
    const err = new Error('Verificação de conexão disponível apenas para o provedor SMTP.');
    err.status = 400;
    throw err;
  }
  const config = {
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_secure,
    user: cfg.smtp_user,
    password: cfg.smtp_pass,
    from_email: cfg.smtp_from,
    from_name: cfg.smtp_from_name,
  };
  return verifyConnection(config);
}

async function sendWithStoredConfig(payload) {
  const emailSender = require('../utils/emailSender');
  await emailSender.sendEmail(payload);
}

module.exports = {
  createTransporter,
  verifyConnection,
  sendMail,
  sendMailBatched,
  verifyStoredConnection,
  sendWithStoredConfig,
  formatFrom,
  mapSmtpError,
};
