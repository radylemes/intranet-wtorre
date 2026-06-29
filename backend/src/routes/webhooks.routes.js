const express = require('express');
const controller = require('../controllers/acs-email-webhook.controller');
const { rawJson, requireEventGridSignature } = require('../middleware/event-grid-webhook.middleware');

const router = express.Router();

router.post(
  '/acs-email',
  rawJson,
  (req, _res, next) => {
    req.rawBody = req.body;
    next();
  },
  requireEventGridSignature,
  controller.receberEventosAcsEmail
);

module.exports = router;
