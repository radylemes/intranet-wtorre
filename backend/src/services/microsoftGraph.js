const { decrypt } = require('./crypto.service');

async function getAppTokenFromCredentials(azureTenantId, clientId, clientSecret) {
  const url = `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Falha ao obter token Graph');
  }
  return data.access_token;
}

async function fetchUserPhotoBuffer(azureTenantId, clientId, clientSecret, microsoftUserId) {
  if (!azureTenantId || !clientId || !clientSecret || !microsoftUserId) {
    return null;
  }

  let token;
  try {
    token = await getAppTokenFromCredentials(azureTenantId, clientId, clientSecret);
  } catch {
    return null;
  }

  const urls = [
    `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/photos/48x48/$value`,
    `https://graph.microsoft.com/v1.0/users/${microsoftUserId}/photo/$value`,
  ];

  for (const photoUrl of urls) {
    try {
      const res = await fetch(photoUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) continue;

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      return { buffer, contentType };
    } catch {
      /* tenta próxima URL */
    }
  }

  return null;
}

async function fetchUserPhotoBufferFromTenant(tenant, microsoftUserId) {
  const clientSecret = decrypt(tenant.client_secret_ciphertext);
  if (!clientSecret) return null;
  return fetchUserPhotoBuffer(
    tenant.azure_tenant_id,
    tenant.client_id,
    clientSecret,
    microsoftUserId
  );
}

module.exports = {
  getAppTokenFromCredentials,
  fetchUserPhotoBuffer,
  fetchUserPhotoBufferFromTenant,
};
