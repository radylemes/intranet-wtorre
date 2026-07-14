function buildUrl(baseUrl, path, query = {}) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}${qs ? `?${qs}` : ''}`;
}

async function salasRequest(baseUrl, localidade, path, options = {}) {
  const url = buildUrl(baseUrl, path, options.query);
  const headers = {
    Accept: 'application/json',
    'x-localidade': localidade,
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 204) return null;

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message = body?.message || `Falha ao consultar API de salas (${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.code = body?.code || null;
    throw err;
  }

  return body;
}

module.exports = {
  salasRequest,
  buildUrl,
};
