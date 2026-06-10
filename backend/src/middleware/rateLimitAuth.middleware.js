const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

const rateLimitAuth = rateLimit({
  windowMs: env.rateLimitAuthWindowMs,
  max: env.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: 'Muitas tentativas. Tente novamente mais tarde.' },
});

module.exports = rateLimitAuth;
