const { env } = require('../../config/env');
const { getPbiAuthority, getPbiScope } = require('./powerbi-config');

let cached = null;

function isCacheValid() {
  if (!cached?.accessToken || !cached?.expiresAt) return false;
  const marginMs = 60 * 1000;
  return Date.now() < cached.expiresAt - marginMs;
}

async function fetchAccessToken() {
  const url = `${getPbiAuthority()}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.pbiClientId,
    client_secret: env.pbiClientSecret,
    scope: getPbiScope(),
    grant_type: 'client_credentials',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || 'Falha ao obter token Power BI.');
    err.status = res.status === 401 ? 401 : 502;
    throw err;
  }

  const ttlMs = (env.pbiSpTokenCacheMin || 50) * 60 * 1000;
  cached = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.min((data.expires_in || 3600) * 1000, ttlMs),
  };
  return cached.accessToken;
}

function invalidateCache() {
  cached = null;
}

async function getAccessToken({ forceRefresh = false } = {}) {
  if (!forceRefresh && isCacheValid()) {
    return cached.accessToken;
  }
  return fetchAccessToken();
}

module.exports = {
  getAccessToken,
  invalidateCache,
};
