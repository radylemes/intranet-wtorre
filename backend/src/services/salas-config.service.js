const salasConfigRepo = require('../repositories/salas-config.repository');
const { encrypt, decrypt } = require('./crypto.service');

const URL_RE = /^https?:\/\/.+/i;

function normalizeBaseUrl(url) {
  return String(url || '')
    .trim()
    .replace(/\/+$/, '');
}

function normalizeLocalidades(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const label = String(item?.label || '').trim();
    const localidade = String(item?.localidade || item?.value || '').trim();
    if (!label || !localidade) continue;
    const key = localidade.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label, localidade });
  }
  return result;
}

async function getPublicConfig() {
  const row = await salasConfigRepo.get();
  if (!row) {
    return {
      ativo: false,
      api_base_url: '',
      localidade_padrao: 'wtorre',
      localidades: [],
      atualizado_em: null,
    };
  }
  const { admin_api_key_ciphertext: _c, ui_config_json: _u, ...pub } = row;
  return {
    ...pub,
    api_base_url: normalizeBaseUrl(pub.api_base_url),
    localidades: normalizeLocalidades(pub.localidades),
  };
}

async function getInternalConfig({ requireActive = false } = {}) {
  const row = await salasConfigRepo.get();
  if (!row) {
    if (requireActive) {
      const err = new Error('Integração de salas não configurada no servidor.');
      err.status = 503;
      throw err;
    }
    return null;
  }

  const config = {
    ativo: !!row.ativo,
    api_base_url: normalizeBaseUrl(row.api_base_url),
    localidade_padrao: row.localidade_padrao || 'wtorre',
    localidades: normalizeLocalidades(row.localidades),
    admin_api_key: row.admin_api_key_ciphertext ? decrypt(row.admin_api_key_ciphertext) : '',
    ui_config_json: row.ui_config_json,
  };

  if (requireActive && !config.ativo) {
    const err = new Error('Integração de salas desativada.');
    err.status = 503;
    throw err;
  }

  if (requireActive && !config.api_base_url?.trim()) {
    const err = new Error('Integração de salas não configurada no servidor.');
    err.status = 503;
    throw err;
  }

  return config;
}

function validateConnectionSave(body, { existing } = {}) {
  const ativo = body.ativo === true || body.ativo === 1 || body.ativo === '1';
  const apiBaseUrl = normalizeBaseUrl(body.api_base_url);
  const localidadePadrao = String(
    body.localidade_padrao || existing?.localidade_padrao || 'wtorre'
  ).trim();

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
  }

  return { ativo, api_base_url: apiBaseUrl, localidade_padrao: localidadePadrao || 'wtorre' };
}

async function save(body) {
  const existing = await salasConfigRepo.get();
  const validated = validateConnectionSave(body, { existing });

  let adminKeyCiphertext = existing?.admin_api_key_ciphertext ?? null;
  let adminKeyHint = existing?.admin_api_key_hint ?? null;
  const adminKey = body.admin_api_key?.trim();
  if (adminKey) {
    adminKeyCiphertext = encrypt(adminKey);
    adminKeyHint = adminKey.slice(-4);
  }

  await salasConfigRepo.upsert({
    ativo: validated.ativo,
    api_base_url: validated.api_base_url,
    localidade_padrao: validated.localidade_padrao,
    localidades: existing?.localidades || [],
    admin_api_key_ciphertext: adminKeyCiphertext,
    admin_api_key_hint: adminKeyHint,
    ui_config_json: existing?.ui_config_json ?? null,
  });

  require('./salas.service').invalidarCache();
  return getPublicConfig();
}

async function testConnection(body) {
  const existing = await salasConfigRepo.get();
  const validated = validateConnectionSave(
    {
      ativo: true,
      api_base_url: body.api_base_url ?? existing?.api_base_url,
      localidade_padrao: body.localidade_padrao ?? existing?.localidade_padrao,
    },
    { existing }
  );

  const baseUrl = validated.api_base_url;
  const healthUrl = `${baseUrl.replace(/\/api\/?$/, '')}/health`;
  const roomsUrl = `${baseUrl}/rooms?localidade=WTorre`;

  let lastError = null;
  for (const url of [roomsUrl, healthUrl]) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'x-localidade': 'WTorre' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        return { ok: true, mensagem: 'Conexão com a API de salas estabelecida com sucesso.' };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
  }

  const err = new Error(`Não foi possível conectar à API de salas (${lastError}).`);
  err.status = 502;
  throw err;
}

module.exports = {
  getPublicConfig,
  getInternalConfig,
  save,
  testConnection,
  normalizeBaseUrl,
  normalizeLocalidades,
};
