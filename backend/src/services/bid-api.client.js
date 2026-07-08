async function fetchBidJson(config, path) {
  const url = `${config.api_base_url}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-API-Key': config.api_key,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(30000),
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      body?.error ||
      (res.status === 503
        ? 'Integração externa desativada no sistema BID.'
        : `Falha ao consultar API BID (${res.status}).`);
    const err = new Error(msg);
    err.status = res.status === 401 || res.status === 503 ? res.status : 502;
    throw err;
  }

  return body;
}

module.exports = {
  fetchBidJson,
};
