const { env } = require('../config/env');
const { getAppToken } = require('./graph.service');
const {
  getExtensionSelectFields,
  EXT_PROPERTIES,
  extensionFieldKey,
} = require('../utils/colaboradores.directory-extension');

const registeredByClientId = new Map();

const PERMISSION_HINT =
  'Permissões de aplicação para registrar directory extensions: Application.Read.All + Application.ReadWrite.All ' +
  '(ou Application.ReadWrite.OwnedBy). Alternativa: defina GRAPH_SCHEMA_EXTENSION_SKIP_REGISTER=1 se já registradas no portal.';

const PROPAGATION_WAIT_MS = Number(process.env.GRAPH_EXTENSION_PROPAGATION_MS) || 12000;
const PATCH_RETRY_DELAYS_MS = [0, 8000, 12000, 15000];

function schemaExtensionId() {
  return env.graphSchemaExtensionId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  if (res.status === 204) return { ok: true, status: res.status, data: null };

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error?.message || 'Falha na API Graph (directory extension).');
    error.status = res.status;
    error.graph = data.error;
    error.operation = options.operation || null;
    throw error;
  }

  return { ok: true, status: res.status, data };
}

function wrapGraphError(err, operation) {
  if (err?.status !== 403 && err?.graph?.code !== 'Authorization_RequestDenied') {
    return err;
  }

  const wrapped = new Error(`${err.message} (${operation}). ${PERMISSION_HINT}`);
  wrapped.status = err.status;
  wrapped.graph = err.graph;
  wrapped.operation = operation;
  return wrapped;
}

async function getApplicationObjectId(token, clientId) {
  const filter = encodeURIComponent(`appId eq '${clientId}'`);
  const { data } = await graphJson(
    token,
    `https://graph.microsoft.com/v1.0/applications?$filter=${filter}&$select=id,appId,displayName`,
    { operation: 'GET applications (by appId)' }
  );
  return data?.value?.[0] || null;
}

async function listExtensionProperties(token, appObjectId) {
  const { data } = await graphJson(
    token,
    `https://graph.microsoft.com/v1.0/applications/${appObjectId}/extensionProperties`,
    { operation: 'GET applications/extensionProperties' }
  );
  return data?.value || [];
}

function hasExtensionProperty(existing, clientId, propertyName) {
  const fullName = extensionFieldKey(clientId, propertyName);
  return existing.some((prop) => prop.name === fullName || prop.name?.endsWith(`_${propertyName}`));
}

async function createExtensionProperty(token, appObjectId, propertyName) {
  try {
    const { data } = await graphJson(
      token,
      `https://graph.microsoft.com/v1.0/applications/${appObjectId}/extensionProperties`,
      {
        method: 'POST',
        operation: `POST extensionProperties (${propertyName})`,
        body: JSON.stringify({
          name: propertyName,
          dataType: 'String',
          targetObjects: ['User'],
        }),
      }
    );
    return data;
  } catch (err) {
    throw wrapGraphError(err, `criar directory extension (${propertyName})`);
  }
}

async function ensureDirectoryExtensionProperties(token, clientId) {
  const app = await getApplicationObjectId(token, clientId);
  if (!app?.id) {
    throw new Error(`Application não encontrada para client_id ${clientId}.`);
  }

  const existing = await listExtensionProperties(token, app.id);
  let created = 0;

  for (const propertyName of EXT_PROPERTIES) {
    if (hasExtensionProperty(existing, clientId, propertyName)) continue;
    await createExtensionProperty(token, app.id, propertyName);
    created += 1;
  }

  if (created > 0) {
    await sleep(PROPAGATION_WAIT_MS);
  }

  return { appObjectId: app.id, appDisplayName: app.displayName, created };
}

function buildCachedMeta(clientId, registration) {
  return {
    clientId,
    schemaExtensionId: schemaExtensionId(),
    appObjectId: registration?.appObjectId || null,
    status: 'Registered',
    selectFields: getExtensionSelectFields(clientId),
    skipRegister: false,
    propagationMs: registration?.created > 0 ? PROPAGATION_WAIT_MS : 0,
  };
}

function buildSkipRegisterMeta(clientId) {
  return {
    clientId,
    schemaExtensionId: schemaExtensionId(),
    status: 'Skipped',
    selectFields: getExtensionSelectFields(clientId),
    skipRegister: true,
  };
}

async function ensureRegistered(tenant) {
  const clientId = tenant?.client_id;
  if (!clientId) {
    throw new Error('Tenant sem client_id para directory extension.');
  }

  if (registeredByClientId.has(clientId)) {
    return registeredByClientId.get(clientId);
  }

  if (env.graphSchemaExtensionSkipRegister) {
    const meta = buildSkipRegisterMeta(clientId);
    registeredByClientId.set(clientId, meta);
    return meta;
  }

  const token = await getAppToken(tenant);
  const registration = await ensureDirectoryExtensionProperties(token, clientId);
  const meta = buildCachedMeta(clientId, registration);
  registeredByClientId.set(clientId, meta);
  return meta;
}

function isExtensionNotAvailableError(err) {
  const msg = String(err?.message || '');
  return msg.includes('extension properties are not available');
}

async function updateUserExtensionWithRetry(tenant, userId, patch) {
  let lastError = null;

  for (const delayMs of PATCH_RETRY_DELAYS_MS) {
    if (delayMs) await sleep(delayMs);
    try {
      const graphService = require('./graph.service');
      await graphService.updateUser(tenant, userId, patch);
      return;
    } catch (err) {
      lastError = err;
      if (!isExtensionNotAvailableError(err)) throw err;
    }
  }

  throw lastError || new Error('Falha ao gravar directory extension no usuário.');
}

module.exports = {
  schemaExtensionId,
  ensureRegistered,
  registeredByClientId,
  updateUserExtensionWithRetry,
  isExtensionNotAvailableError,
  PERMISSION_HINT,
};
