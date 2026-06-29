const ACS_LIMITS = {
  perMinute: 30,
  perHour: 100,
  perDay: 2400,
};

const acsSendTimestamps = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function inferContentType(filename) {
  const ext = String(filename || '')
    .toLowerCase()
    .split('.')
    .pop();
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    html: 'text/html',
    htm: 'text/html',
    txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function toBase64Content(content) {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  return Buffer.from(String(content), 'utf8').toString('base64');
}

function pruneTimestamps(now) {
  const dayAgo = now - 24 * 60 * 60 * 1000;
  while (acsSendTimestamps.length && acsSendTimestamps[0] < dayAgo) {
    acsSendTimestamps.shift();
  }
}

function countInWindow(now, windowMs) {
  const cutoff = now - windowMs;
  let count = 0;
  for (let i = acsSendTimestamps.length - 1; i >= 0; i -= 1) {
    if (acsSendTimestamps[i] >= cutoff) count += 1;
    else break;
  }
  return count;
}

function oldestInWindow(now, windowMs) {
  const cutoff = now - windowMs;
  for (let i = 0; i < acsSendTimestamps.length; i += 1) {
    if (acsSendTimestamps[i] >= cutoff) return acsSendTimestamps[i];
  }
  return null;
}

async function acsRateLimit() {
  const windows = [
    { limit: ACS_LIMITS.perMinute, ms: 60 * 1000 },
    { limit: ACS_LIMITS.perHour, ms: 60 * 60 * 1000 },
    { limit: ACS_LIMITS.perDay, ms: 24 * 60 * 60 * 1000 },
  ];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    pruneTimestamps(now);

    let waitMs = 0;
    for (const { limit, ms } of windows) {
      const count = countInWindow(now, ms);
      if (count >= limit) {
        const oldest = oldestInWindow(now, ms);
        if (oldest != null) {
          const needed = oldest + ms - now + 50;
          if (needed > waitMs) waitMs = needed;
        }
      }
    }

    if (waitMs <= 0) {
      acsSendTimestamps.push(Date.now());
      return;
    }

    await sleep(waitMs);
  }
}

function isSmtpConnectionError(err) {
  const code = err?.code || '';
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EPIPE'].includes(code);
}

function applyHiddenToRecipients(opts, cfg) {
  if (!cfg.email_ocultar_para || !opts?.to) return opts;

  const realTo = opts.to;
  const envelopeTo = cfg.provider === 'acs' ? cfg.acs_sender : cfg.smtp_from;
  const bccList = [];

  if (opts.bcc) {
    const existing = Array.isArray(opts.bcc) ? opts.bcc : [opts.bcc];
    bccList.push(...existing);
  }
  bccList.push(realTo);

  return {
    ...opts,
    to: envelopeTo,
    bcc: bccList.length === 1 ? bccList[0] : bccList,
  };
}

function normalizeRecipients(recipients) {
  return [...new Set(recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
}

const BATCH_THROTTLE = {
  acs: { batchSize: 10, delayItem: 2000, delayBatch: 40000 },
  smtp: { batchSize: 10, delayItem: 1000, delayBatch: 5000 },
};

module.exports = {
  stripHtml,
  inferContentType,
  toBase64Content,
  acsRateLimit,
  isSmtpConnectionError,
  applyHiddenToRecipients,
  normalizeRecipients,
  BATCH_THROTTLE,
  sleep,
};
