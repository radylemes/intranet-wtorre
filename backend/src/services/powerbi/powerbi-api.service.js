const { env } = require('../../config/env');
const { getPbiApiBase } = require('./powerbi-config');
const pbiAuth = require('./powerbi-auth.service');

async function pbiFetch(path, options = {}, retried = false) {
  const token = await pbiAuth.getAccessToken({ forceRefresh: options.forceRefresh });
  const res = await fetch(`${getPbiApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && !retried) {
    pbiAuth.invalidateCache();
    return pbiFetch(path, { ...options, forceRefresh: true }, true);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(
      data?.error?.message || data?.error?.code || `Erro na API Power BI (${res.status}).`
    );
    err.status = res.status;
    err.pbi = data;
    throw err;
  }

  return data;
}

async function listReports(workspaceId = env.pbiWorkspaceId) {
  const data = await pbiFetch(`/groups/${workspaceId}/reports`);
  return data?.value || [];
}

async function generateEmbedToken(reportId, body, workspaceId = env.pbiWorkspaceId) {
  return pbiFetch(`/groups/${workspaceId}/reports/${reportId}/GenerateToken`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

module.exports = {
  listReports,
  generateEmbedToken,
};
