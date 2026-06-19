const { env } = require('../config/env');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMail(token, fromMailbox, to, subject, htmlBody) {
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromMailbox)}/sendMail`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Falha ao enviar e-mail para ${to}.`);
  }
}

async function sendMailBatched(token, fromMailbox, recipients, subject, htmlBody) {
  const list = [...new Set(recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return { enviados: 0, erros: [] };

  const batchSize = env.camarotesMailBatchSize || 10;
  const delayMs = env.camarotesMailBatchDelayMs || 2000;
  const erros = [];
  let enviados = 0;

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    for (const to of batch) {
      try {
        await sendMail(token, fromMailbox, to, subject, htmlBody);
        enviados += 1;
      } catch (err) {
        erros.push({ email: to, mensagem: err.message });
      }
    }
    if (i + batchSize < list.length) {
      await sleep(delayMs);
    }
  }

  return { enviados, erros };
}

module.exports = { sendMail, sendMailBatched };
