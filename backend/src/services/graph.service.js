const { decrypt } = require('./crypto.service');

async function getAppToken(tenant) {
  const clientSecret = decrypt(tenant.client_secret_ciphertext);
  if (!clientSecret) {
    throw new Error('Client secret não configurado para este tenant.');
  }

  const url = `https://login.microsoftonline.com/${tenant.azure_tenant_id}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: tenant.client_id,
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

async function getUserProfile(tenant, oid) {
  const token = await getAppToken(tenant);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${oid}?$select=displayName,department,companyName,officeLocation,jobTitle`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao consultar perfil no Graph');
  }
  return res.json();
}

function extractDepartment(profile) {
  const candidates = [
    profile.department,
    profile.companyName,
    profile.officeLocation,
    profile.jobTitle,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return null;
}

async function getUserPhoto(tenant, oid) {
  const token = await getAppToken(tenant);
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${oid}/photo/$value`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get('content-type') || 'image/jpeg' };
}

async function testConnection(tenant) {
  const token = await getAppToken(tenant);
  const res = await fetch('https://graph.microsoft.com/v1.0/users?$top=1', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha na conexão com Microsoft Graph');
  }
  return true;
}

module.exports = { getAppToken, getUserProfile, extractDepartment, getUserPhoto, testConnection };
