const camarotesRepo = require('../repositories/camarotes.repository');

function isSubscriptionValidation(event) {
  const type = event?.eventType || event?.['aeg-event-type'];
  return (
    type === 'Microsoft.EventGrid.SubscriptionValidationEvent' ||
    type === 'SubscriptionValidation'
  );
}

function isDeliveryReport(event) {
  return event?.eventType === 'Microsoft.Communication.EmailDeliveryReportReceived';
}

async function processarEventoAcsEmail(event) {
  if (isSubscriptionValidation(event)) {
    const code = event?.data?.validationCode;
    if (!code) return { handled: false };
    return { handled: true, validationResponse: code };
  }

  if (!isDeliveryReport(event)) {
    return { handled: false };
  }

  const { messageId, status, deliveryStatusDetails } = event.data || {};
  if (!messageId) {
    return { handled: true, updated: 0 };
  }

  const mappedStatus = camarotesRepo.mapAcsDeliveryStatus(status);
  const detalhe =
    deliveryStatusDetails?.statusMessage ||
    (mappedStatus === 'bounce' ? status : null);

  const updated = await camarotesRepo.atualizarStatusEntregaPorMessageId({
    messageId,
    status: mappedStatus,
    erro: detalhe,
  });

  if (updated === 0) {
    console.warn(
      '[acs-email-webhook] Nenhum registro para messageId=%s status=%s',
      messageId,
      status
    );
  }

  return { handled: true, updated };
}

async function receberEventosAcsEmail(req, res) {
  const events = Array.isArray(req.body) ? req.body : req.body ? [req.body] : [];

  if (!events.length) {
    return res.status(400).json({ mensagem: 'Payload vazio.' });
  }

  const validation = events.find(isSubscriptionValidation);
  if (validation) {
    const code = validation?.data?.validationCode;
    if (!code) {
      return res.status(400).json({ mensagem: 'validationCode ausente.' });
    }
    return res.status(200).json({ validationResponse: code });
  }

  let updated = 0;
  for (const event of events) {
    const result = await processarEventoAcsEmail(event);
    if (result.validationResponse) {
      return res.status(200).json({ validationResponse: result.validationResponse });
    }
    if (result.handled) {
      updated += result.updated || 0;
    }
  }

  return res.status(200).json({ ok: true, updated });
}

module.exports = {
  receberEventosAcsEmail,
  processarEventoAcsEmail,
};
