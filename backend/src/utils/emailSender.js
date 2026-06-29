const nodemailer = require('nodemailer');
const { EmailClient } = require('@azure/communication-email');
const emailConfigService = require('../services/email-config.service');
const smtpMailService = require('../services/mail/smtp-mail.service');
const {
  stripHtml,
  inferContentType,
  toBase64Content,
  acsRateLimit,
  isSmtpConnectionError,
  applyHiddenToRecipients,
  normalizeRecipients,
  BATCH_THROTTLE,
  sleep,
} = require('./email-sender.helpers');

const NOT_CONFIGURED_MSG = 'Provedor de e-mail não configurado.';

let cachedSmtpTransporter = null;
let cachedSmtpConfigKey = null;

function smtpConfigKey(cfg) {
  return [cfg.smtp_host, cfg.smtp_port, cfg.smtp_secure, cfg.smtp_user, cfg.smtp_pass].join('|');
}

function getSmtpTransporter(cfg) {
  const key = smtpConfigKey(cfg);
  if (cachedSmtpTransporter && cachedSmtpConfigKey === key) {
    return cachedSmtpTransporter;
  }

  cachedSmtpTransporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    secure: cfg.smtp_secure,
    auth: {
      user: cfg.smtp_user,
      pass: cfg.smtp_pass,
    },
  });
  cachedSmtpConfigKey = key;
  return cachedSmtpTransporter;
}

function refreshSmtpMailSender() {
  if (cachedSmtpTransporter) {
    try {
      cachedSmtpTransporter.close();
    } catch {
      /* ignore */
    }
  }
  cachedSmtpTransporter = null;
  cachedSmtpConfigKey = null;
}

function formatSmtpFrom(cfg) {
  return smtpMailService.formatFrom({
    from_email: cfg.smtp_from,
    from_name: cfg.smtp_from_name,
  });
}

function buildAcsAttachments(attachments) {
  if (!attachments?.length) return undefined;
  return attachments.map((att) => ({
    name: att.filename,
    contentType: att.contentType || inferContentType(att.filename),
    contentInBase64: toBase64Content(att.content),
  }));
}

function buildAcsRecipients({ to, bcc }) {
  const recipients = {
    to: [{ address: to }],
  };

  if (bcc) {
    const bccList = Array.isArray(bcc) ? bcc : [bcc];
    recipients.bcc = bccList.filter(Boolean).map((address) => ({ address }));
  }

  return recipients;
}

function buildSmtpSender(cfg) {
  const from = formatSmtpFrom(cfg);

  return {
    provider: 'smtp',
    from,
    sendMail: async (opts) => {
      const mailOpts = applyHiddenToRecipients(opts, cfg);
      const transporter = getSmtpTransporter(cfg);

      const mailOptions = {
        from,
        to: mailOpts.to,
        subject: mailOpts.subject,
        html: mailOpts.html,
        text: mailOpts.text,
      };

      if (mailOpts.bcc) {
        mailOptions.bcc = mailOpts.bcc;
      }
      if (mailOpts.attachments?.length) {
        mailOptions.attachments = mailOpts.attachments;
      }

      try {
        const info = await transporter.sendMail(mailOptions);
        return {
          provider: 'smtp',
          messageId: info?.messageId || null,
          raw: info,
        };
      } catch (err) {
        if (isSmtpConnectionError(err)) {
          refreshSmtpMailSender();
          const retryTransporter = getSmtpTransporter(cfg);
          try {
            const info = await retryTransporter.sendMail(mailOptions);
            return {
              provider: 'smtp',
              messageId: info?.messageId || null,
              raw: info,
            };
          } catch (retryErr) {
            const mapped = new Error(smtpMailService.mapSmtpError(retryErr));
            mapped.status = 400;
            throw mapped;
          }
        }
        const mapped = new Error(smtpMailService.mapSmtpError(err));
        mapped.status = 400;
        throw mapped;
      }
    },
  };
}

function buildAcsSender(cfg) {
  const from = cfg.acs_sender;

  return {
    provider: 'acs',
    from,
    sendMail: async (opts) => {
      const mailOpts = applyHiddenToRecipients(opts, cfg);
      const client = new EmailClient(cfg.acs_connection_string);

      const message = {
        senderAddress: cfg.acs_sender,
        content: {
          subject: mailOpts.subject,
          html: mailOpts.html,
          plainText: mailOpts.text || stripHtml(mailOpts.html) || mailOpts.subject,
        },
        recipients: buildAcsRecipients(mailOpts),
      };

      const acsAttachments = buildAcsAttachments(mailOpts.attachments);
      if (acsAttachments?.length) {
        message.attachments = acsAttachments;
      }

      await acsRateLimit();

      const poller = await client.beginSend(message);
      const result = await poller.pollUntilDone();

      if (result?.status !== 'Succeeded') {
        const detail = result?.error?.message || result?.status || 'desconhecido';
        const err = new Error(`Falha ao enviar e-mail via Azure ACS: ${detail}`);
        err.status = 400;
        throw err;
      }

      return {
        provider: 'acs',
        messageId: result?.id || null,
        raw: result,
      };
    },
  };
}

async function getEmailProviderConfig(options) {
  return emailConfigService.getEmailProviderConfig(options);
}

async function getMailSender() {
  let cfg;
  try {
    cfg = await getEmailProviderConfig({ requireActive: true });
  } catch {
    return null;
  }

  if (!emailConfigService.isConfigured(cfg)) {
    return null;
  }

  if (cfg.provider === 'acs') {
    return buildAcsSender(cfg);
  }

  return buildSmtpSender(cfg);
}

async function sendEmail(opts) {
  const sender = await getMailSender();
  if (!sender) {
    const err = new Error(NOT_CONFIGURED_MSG);
    err.status = 400;
    throw err;
  }
  return sender.sendMail(opts);
}

async function sendMailBatched({ recipients, subject, html, text, attachments }) {
  const list = normalizeRecipients(recipients || []);
  if (!list.length) return { enviados: 0, erros: [] };

  const cfg = await getEmailProviderConfig({ requireActive: true });
  if (!emailConfigService.isConfigured(cfg)) {
    const err = new Error(NOT_CONFIGURED_MSG);
    err.status = 400;
    throw err;
  }

  const throttle = BATCH_THROTTLE[cfg.provider] || BATCH_THROTTLE.smtp;
  const erros = [];
  let enviados = 0;

  for (let i = 0; i < list.length; i += 1) {
    const to = list[i];

    if (i > 0) {
      if (i % throttle.batchSize === 0) {
        await sleep(throttle.delayBatch);
      } else {
        await sleep(throttle.delayItem);
      }
    }

    try {
      await sendEmail({ to, subject, html, text, attachments });
      enviados += 1;
    } catch (err) {
      erros.push({ email: to, mensagem: err.message });
    }
  }

  return { enviados, erros };
}

module.exports = {
  getEmailProviderConfig,
  getMailSender,
  sendEmail,
  refreshSmtpMailSender,
  sendMailBatched,
  NOT_CONFIGURED_MSG,
};
