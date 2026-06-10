const tenantsRepo = require('../repositories/tenants.repository');
const { encrypt } = require('../services/crypto.service');
const graphService = require('../services/graph.service');
const { env } = require('../config/env');

function msalRedirectUris() {
  const raw = process.env.MSAL_REDIRECT_URI_WEB || env.msalRedirectUriWeb || '';
  const uris = raw
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  return uris.length ? uris : ['http://localhost:4201'];
}

async function msalConfig(_req, res) {
  try {
    const principal = await tenantsRepo.findPrincipal();
    const redirectUris = msalRedirectUris();
    const redirectUri = redirectUris[0];

    if (!principal) {
      return res.json({
        clientId: '',
        authority: 'https://login.microsoftonline.com/common',
        redirectUris,
        redirectUri,
        configured: false,
      });
    }

    return res.json({
      clientId: principal.client_id,
      authority: 'https://login.microsoftonline.com/common',
      redirectUris: [...new Set([...redirectUris, 'http://localhost:4201', 'http://127.0.0.1:4201'])],
      redirectUri,
      configured: true,
    });
  } catch (err) {
    console.error('msalConfig:', err.message);
    return res.status(500).json({ mensagem: 'Erro ao carregar configuração MSAL.' });
  }
}

async function list(_req, res) {
  const tenants = await tenantsRepo.findAll();
  return res.json(
    tenants.map((t) => ({
      id: t.id,
      nome: t.nome,
      azure_tenant_id: t.azure_tenant_id,
      client_id: t.client_id,
      has_secret: !!t.client_secret_ciphertext,
      ativo: t.ativo,
      eh_principal: t.eh_principal,
    }))
  );
}

async function create(req, res) {
  try {
    const { nome, azure_tenant_id, client_id, client_secret, ativo, eh_principal } = req.body;
    if (!nome || !azure_tenant_id || !client_id) {
      return res.status(400).json({ mensagem: 'nome, azure_tenant_id e client_id são obrigatórios.' });
    }
    const tenant = await tenantsRepo.create({
      nome,
      azure_tenant_id,
      client_id,
      client_secret_ciphertext: client_secret ? encrypt(client_secret) : null,
      ativo: ativo !== false,
      eh_principal: !!eh_principal,
    });
    return res.status(201).json(tenant);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensagem: 'azure_tenant_id já cadastrado.' });
    }
    return res.status(500).json({ mensagem: err.message });
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const existing = await tenantsRepo.findById(id);
    if (!existing) {
      return res.status(404).json({ mensagem: 'Tenant não encontrado.' });
    }

    const data = { ...req.body };
    if (data.client_secret) {
      data.client_secret_ciphertext = encrypt(data.client_secret);
      delete data.client_secret;
    }

    const tenant = await tenantsRepo.update(id, data);
    return res.json(tenant);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message });
  }
}

async function remove(req, res) {
  const id = Number(req.params.id);
  const existing = await tenantsRepo.findById(id);
  if (!existing) {
    return res.status(404).json({ mensagem: 'Tenant não encontrado.' });
  }
  await tenantsRepo.remove(id);
  return res.json({ ok: true });
}

async function testConnection(req, res) {
  try {
    const id = Number(req.params.id);
    const tenant = await tenantsRepo.findById(id);
    if (!tenant) {
      return res.status(404).json({ mensagem: 'Tenant não encontrado.' });
    }
    await graphService.testConnection(tenant);
    return res.json({ ok: true, mensagem: 'Conexão com Microsoft Graph OK.' });
  } catch (err) {
    return res.status(400).json({ mensagem: err.message });
  }
}

module.exports = { msalConfig, list, create, update, remove, testConnection };
