const crypto = require('crypto');

/**
 * Valida o header aeg-signature do Azure Event Grid (HMAC-SHA256, base64).
 * @param {Buffer|string} rawBody
 * @param {string|undefined} signatureHeader
 * @param {string} secret
 */
function validateAegSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    return { valid: false, reason: 'secret_not_configured' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'missing_signature_header' };
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');

  const parts = signatureHeader.split(',').map((s) => s.trim());
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const algo = part.slice(0, eq).toLowerCase();
    const value = part.slice(eq + 1);
    if (algo !== 'sha256' || !value) continue;

    try {
      const received = Buffer.from(value, 'base64');
      const computed = Buffer.from(expected, 'base64');
      if (received.length === computed.length && crypto.timingSafeEqual(received, computed)) {
        return { valid: true };
      }
    } catch {
      /* comprimento inválido */
    }
  }

  return { valid: false, reason: 'signature_mismatch' };
}

function isSubscriptionValidationPayload(body) {
  const events = Array.isArray(body) ? body : body ? [body] : [];
  return events.some((event) => {
    const type = event?.eventType || event?.['aeg-event-type'];
    return (
      type === 'Microsoft.EventGrid.SubscriptionValidationEvent' ||
      type === 'SubscriptionValidation'
    );
  });
}

module.exports = {
  validateAegSignature,
  isSubscriptionValidationPayload,
};
