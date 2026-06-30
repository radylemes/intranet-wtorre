const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const rateLimitPowerbiEmbed = rateLimit({
  windowMs: env.pbiEmbedRateLimitWindowMs,
  max: env.pbiEmbedRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id || 'anon'),
  message: { mensagem: 'Muitas solicitações de embed. Tente novamente mais tarde.' },
});

module.exports = rateLimitPowerbiEmbed;
