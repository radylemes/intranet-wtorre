const bidIntegracaoConfigRepo = require('../repositories/bid-integracao-config.repository');
const { encrypt, decrypt } = require('./crypto.service');

const URL_RE = /^https?:\/\/.+/i;
const API_KEY_RE = /^[a-f0-9]{64}$/i;
const DEFAULT_APP_URL = 'https://bid.nubankparque.com';
const DEFAULT_API_BASE_URL = 'https://bid.nubankparque.com';

function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/api\/integracao\/?$/i, '')
    .replace(/\/+$/, '');
}

function normalizeAppUrl(url) {
  const trimmed = String(url || '').trim();
  return trimmed.replace(/\/+$/, '') || DEFAULT_APP_URL;
}

async function getPublicConfig() {
  const row = await bidIntegracaoConfigRepo.get();
  if (!row) {
    return {
      ativo: false,
      api_base_url: '',
      has_api_key: false,
      api_key_hint: null,
      app_url: DEFAULT_APP_URL,
      cache_ttl_min: 3,
      sync_automatica: true,
      sync_intervalo_min: 15,
      ultima_sync: null,
      ultima_sync_erro: null,
    };
  }
  const { api_key_ciphertext: _c, ...pub } = row;
  return {
    ...pub,
    api_base_url: normalizeBaseUrl(pub.api_base_url),
  };
}

async function getInternalConfig({ requireActive = false } = {}) {
  const row = await bidIntegracaoConfigRepo.get();
  if (!row) {
    const err = new Error('Integração BID não configurada.');
    err.status = 503;
    throw err;
  }

  if (requireActive && !row.ativo) {
    const err = new Error('Integração BID desativada.');
    err.status = 503;
    throw err;
  }

  let apiKey = null;
  if (row.api_key_ciphertext) {
    apiKey = decrypt(row.api_key_ciphertext);
  }

  if (requireActive) {
    if (!row.api_base_url?.trim()) {
      const err = new Error('URL da API BID não configurada.');
      err.status = 503;
      throw err;
    }
    if (!apiKey) {
      const err = new Error('Chave de API BID não configurada.');
      err.status = 503;
      throw err;
    }
  }

  return {
    ativo: !!row.ativo,
    api_base_url: normalizeBaseUrl(row.api_base_url),
    api_key: apiKey || '',
    app_url: normalizeAppUrl(row.app_url),
    cache_ttl_min: Math.max(1, Math.min(15, Number(row.cache_ttl_min) || 3)),
    sync_automatica: row.sync_automatica != null ? !!row.sync_automatica : true,
    sync_intervalo_min: Math.max(5, Math.min(60, Number(row.sync_intervalo_min) || 15)),
  };
}

function validateSave(body, { existing } = {}) {
  const ativo = body.ativo === true || body.ativo === 1 || body.ativo === '1';
  const apiBaseUrl = normalizeBaseUrl(body.api_base_url);
  const appUrl = normalizeAppUrl(body.app_url);
  const cacheTtlMin = Number(body.cache_ttl_min ?? existing?.cache_ttl_min ?? 3);
  const syncAutomatica =
    body.sync_automatica === true ||
    body.sync_automatica === 1 ||
    body.sync_automatica === '1' ||
    (body.sync_automatica == null && existing?.sync_automatica != null
      ? !!existing.sync_automatica
      : true);
  const syncIntervaloMin = Number(body.sync_intervalo_min ?? existing?.sync_intervalo_min ?? 15);

  if (ativo) {
    if (!apiBaseUrl) {
      const err = new Error('URL da API é obrigatória quando a integração está ativa.');
      err.status = 400;
      throw err;
    }
    if (!URL_RE.test(apiBaseUrl)) {
      const err = new Error('URL da API deve começar com http:// ou https://.');
      err.status = 400;
      throw err;
    }
    if (!URL_RE.test(appUrl)) {
      const err = new Error('URL do app BID deve começar com http:// ou https://.');
      err.status = 400;
      throw err;
    }
    const hasExistingKey = Boolean(existing?.api_key_ciphertext);
    const newKey = body.api_key?.trim();
    if (!hasExistingKey && !newKey) {
      const err = new Error('Chave de API é obrigatória quando a integração está ativa.');
      err.status = 400;
      throw err;
    }
    if (newKey && !API_KEY_RE.test(newKey)) {
      const err = new Error('Chave de API deve ser hexadecimal de 64 caracteres.');
      err.status = 400;
      throw err;
    }
  }

  if (!Number.isInteger(cacheTtlMin) || cacheTtlMin < 1 || cacheTtlMin > 15) {
    const err = new Error('Cache deve estar entre 1 e 15 minutos.');
    err.status = 400;
    throw err;
  }

  if (!Number.isInteger(syncIntervaloMin) || syncIntervaloMin < 5 || syncIntervaloMin > 60) {
    const err = new Error('Intervalo de sync deve estar entre 5 e 60 minutos.');
    err.status = 400;
    throw err;
  }

  return {
    ativo,
    api_base_url: apiBaseUrl,
    app_url: appUrl,
    cache_ttl_min: cacheTtlMin,
    sync_automatica: syncAutomatica,
    sync_intervalo_min: syncIntervaloMin,
  };
}

async function save(body) {
  const existing = await bidIntegracaoConfigRepo.get();
  const validated = validateSave(body, { existing });

  let apiKeyCiphertext = existing?.api_key_ciphertext ?? null;
  let apiKeyHint = existing?.api_key_hint ?? null;
  const apiKey = body.api_key?.trim();
  if (apiKey) {
    apiKeyCiphertext = encrypt(apiKey);
    apiKeyHint = apiKey.slice(-4);
  }

  await bidIntegracaoConfigRepo.upsert({
    ativo: validated.ativo,
    api_base_url: validated.api_base_url,
    api_key_ciphertext: apiKeyCiphertext,
    api_key_hint: apiKeyHint,
    app_url: validated.app_url,
    cache_ttl_min: validated.cache_ttl_min,
    sync_automatica: validated.sync_automatica,
    sync_intervalo_min: validated.sync_intervalo_min,
  });

  // require tardio evita dependência circular com bid-integracao.service
  require('./bid-integracao.service').invalidarCache();

  return getPublicConfig();
}

module.exports = {
  getPublicConfig,
  getInternalConfig,
  save,
  normalizeBaseUrl,
  DEFAULT_API_BASE_URL,
  DEFAULT_APP_URL,
};
