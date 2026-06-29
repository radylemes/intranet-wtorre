const { env } = require('../config/env');
const { getAppToken } = require('./graph.service');
const { getExtensionSelectFields } = require('../utils/colaboradores.directory-extension');

const registeredByClientId = new Map();

function schemaExtensionId() {
  return env.graphSchemaExtensionId;
}

async function graphJson(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || 'Falha na API Graph (schema extension).');
    error.status = res.status;
    error.graph = data.error;
    throw error;
  }
  return data;
}

async function findExistingExtension(token, id) {
  const filter = encodeURIComponent(`id eq '${id}'`);
  const data = await graphJson(
    token,
    `https://graph.microsoft.com/v1.0/schemaExtensions?$filter=${filter}`
  );
  return data?.value?.[0] || null;
}

async function createExtension(token, id) {
  return graphJson(token, 'https://graph.microsoft.com/v1.0/schemaExtensions', {
    method: 'POST',
    body: JSON.stringify({
      id,
      description: 'Campos intranet WTorre (ramal e data de nascimento)',
      targetTypes: ['User'],
      properties: [
        { name: 'ramal', type: 'String' },
        { name: 'dataNascimento', type: 'String' },
      ],
    }),
  });
}

async function publishExtension(token, fullId) {
  return graphJson(token, `https://graph.microsoft.com/v1.0/schemaExtensions/${fullId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Available' }),
  });
}

async function ensureRegistered(tenant) {
  const clientId = tenant?.client_id;
  if (!clientId) {
    throw new Error('Tenant sem client_id para schema extension.');
  }

  if (registeredByClientId.has(clientId)) {
    return registeredByClientId.get(clientId);
  }

  const token = await getAppToken(tenant);
  const id = schemaExtensionId();
  let ext = await findExistingExtension(token, id);

  if (!ext) {
    ext = await createExtension(token, id);
  }

  if (ext.status !== 'Available') {
    ext = await publishExtension(token, ext.id);
  }

  const meta = {
    clientId,
    schemaExtensionId: id,
    fullId: ext.id,
    status: ext.status,
    selectFields: getExtensionSelectFields(clientId),
  };

  registeredByClientId.set(clientId, meta);
  return meta;
}

module.exports = {
  schemaExtensionId,
  ensureRegistered,
  registeredByClientId,
};
