/* global Office, ASSINATURA_ADDIN_CONFIG */

Office.onReady(() => {
  Office.actions.associate('onNewMessageCompose', onNewMessageComposeHandler);
  Office.actions.associate('onMessageFromChanged', onMessageFromChangedHandler);
});

function getApiBaseUrl() {
  return (window.ASSINATURA_ADDIN_CONFIG && window.ASSINATURA_ADDIN_CONFIG.apiBaseUrl) || '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getFromEmail(item) {
  return new Promise((resolve, reject) => {
    item.from.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        reject(new Error(result.error.message));
        return;
      }
      resolve(normalizeEmail(result.value && result.value.emailAddress));
    });
  });
}

async function fetchSignatureHtml(email, accessToken) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('apiBaseUrl não configurada em config.js');
  }

  const url = `${base}/assinaturas/para-email/${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.mensagem || `Falha ao obter assinatura (${res.status})`);
  }

  const data = await res.json();
  return data.html;
}

function getAccessToken() {
  return new Promise((resolve, reject) => {
    Office.auth.getAccessToken({ allowSignInPrompt: true, allowConsentPrompt: true }, (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        reject(new Error(result.error.message));
        return;
      }
      resolve(result.value);
    });
  });
}

function setSignature(html, event) {
  Office.context.mailbox.item.body.setSignatureAsync(
    html,
    { asyncContext: event, coercionType: Office.CoercionType.Html },
    (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        console.warn('[Assinaturas WTorre]', result.error.message);
      }
      const evt = result.asyncContext;
      if (evt && typeof evt.completed === 'function') {
        evt.completed();
      }
    }
  );
}

async function insertSignatureForCurrentFrom(event) {
  try {
    const item = Office.context.mailbox.item;
    if (!item) {
      event.completed();
      return;
    }

    const fromEmail = await getFromEmail(item);
    if (!fromEmail) {
      event.completed();
      return;
    }

    const token = await getAccessToken();
    const html = await fetchSignatureHtml(fromEmail, token);
    setSignature(html, event);
  } catch (err) {
    console.warn('[Assinaturas WTorre]', err.message || err);
    event.completed();
  }
}

function onNewMessageComposeHandler(event) {
  insertSignatureForCurrentFrom(event);
}

function onMessageFromChangedHandler(event) {
  insertSignatureForCurrentFrom(event);
}
