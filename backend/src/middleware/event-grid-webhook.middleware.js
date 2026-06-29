const express = require('express');
const { env } = require('../config/env');
const {
  validateAegSignature,
  isSubscriptionValidationPayload,
} = require('../utils/event-grid-signature.util');

function parseWebhookJsonBody(req, res, next) {
  try {
    const raw = req.rawBody;
    if (Buffer.isBuffer(raw)) {
      req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    }
  } catch {
    return res.status(400).json({ mensagem: 'JSON inválido no payload do webhook.' });
  }
  return next();
}

function requireEventGridSignature(req, res, next) {
  parseWebhookJsonBody(req, res, () => {
    if (isSubscriptionValidationPayload(req.body)) {
      return next();
    }

    const secret = env.eventGridWebhookSecret;
    if (!secret) {
      console.error('[acs-email-webhook] EVENT_GRID_WEBHOOK_SECRET não configurado.');
      return res.status(503).json({ mensagem: 'Webhook de e-mail não configurado.' });
    }

    const result = validateAegSignature(req.rawBody, req.get('aeg-signature'), secret);
    if (!result.valid) {
      console.warn('[acs-email-webhook] Assinatura inválida:', result.reason);
      return res.status(401).json({ mensagem: 'Assinatura do webhook inválida.' });
    }

    return next();
  });
}

const rawJson = express.raw({
  type: ['application/json', 'application/cloudevents+json'],
});

module.exports = {
  rawJson,
  requireEventGridSignature,
};
