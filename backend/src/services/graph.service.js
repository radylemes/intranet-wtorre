const { decrypt } = require('./crypto.service');
const { fetchUserPhotoBufferFromTenant } = require('./microsoftGraph');

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
  return fetchUserPhotoBufferFromTenant(tenant, oid);
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

const USER_LIST_SELECT =
  'id,displayName,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones,companyName,accountEnabled,userType,onPremisesExtensionAttributes';

async function listAllUsers(tenant) {
  const token = await getAppToken(tenant);
  const users = [];
  let url =
    `https://graph.microsoft.com/v1.0/users?$select=${USER_LIST_SELECT}&$top=999`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Falha ao listar usuários no Graph');
    }
    const data = await res.json();
    if (Array.isArray(data.value)) {
      users.push(...data.value);
    }
    url = data['@odata.nextLink'] || null;
  }

  return users;
}

function encodeDrivePath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeShareUrl(shareUrl) {
  const trimmed = String(shareUrl || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    url.searchParams.delete('rtime');
    return url.toString();
  } catch {
    return trimmed.replace(/([?&])rtime=[^&]*&?/g, '$1').replace(/[?&]$/, '');
  }
}

function encodeShareUrl(shareUrl) {
  const normalized = normalizeShareUrl(shareUrl);
  if (!normalized) {
    throw new Error('URL de compartilhamento vazia.');
  }
  return `u!${Buffer.from(normalized, 'utf8').toString('base64url')}`;
}

async function downloadSharedDriveItemContent(token, shareUrl) {
  const shareId = encodeShareUrl(shareUrl);
  const metaUrl = `https://graph.microsoft.com/v1.0/shares/${encodeURIComponent(shareId)}/driveItem`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao resolver URL de compartilhamento via Graph.');
  }

  const meta = await metaRes.json();
  const driveId = meta.parentReference?.driveId || meta.driveId;
  const itemId = meta.id;
  if (!driveId || !itemId) {
    const err = new Error('Metadados do arquivo incompletos na resposta Graph (/shares).');
    err.status = 502;
    throw err;
  }
  return downloadDriveItemContent(token, driveId, itemId);
}

async function downloadDriveItemContent(token, driveId, fileRef) {
  const ref = String(fileRef || '').trim();
  if (!ref) {
    throw new Error('Referência do arquivo SharePoint não configurada.');
  }

  const isPath = ref.includes('/') || ref.includes('\\');
  const url = isPath
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeDrivePath(ref.replace(/\\/g, '/'))}:/content`
    : `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${encodeURIComponent(ref)}/content`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao baixar arquivo do SharePoint via Graph.');
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = {
  getAppToken,
  getUserProfile,
  extractDepartment,
  getUserPhoto,
  testConnection,
  listAllUsers,
  normalizeShareUrl,
  encodeShareUrl,
  downloadSharedDriveItemContent,
  downloadDriveItemContent,
};
