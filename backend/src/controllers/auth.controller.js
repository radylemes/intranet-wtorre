const authService = require('../services/auth.service');
const usersRepo = require('../repositories/users.repository');
const tenantsRepo = require('../repositories/tenants.repository');
const { fetchUserPhotoBufferFromTenant } = require('../services/microsoftGraph');
const auditRepo = require('../repositories/auditLog.repository');

function meta(req) {
  return { requestId: req.requestId, ip: req.ip, deviceInfo: req.headers['user-agent'] };
}

async function login(req, res) {
  try {
    const { email, senha, usuario } = req.body;
    const loginEmail = email || usuario;
    if (!loginEmail || !senha) {
      return res.status(400).json({ mensagem: 'Email e senha são obrigatórios.' });
    }
    const result = await authService.loginLocal(loginEmail.trim(), senha, meta(req));
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function loginMicrosoft(req, res) {
  try {
    const result = await authService.loginMicrosoft(req.azureUser, meta(req));
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ mensagem: 'refreshToken é obrigatório.' });
    }
    const result = await authService.refresh(refreshToken);
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    if (req.user) {
      await auditRepo.log({
        userId: req.user.id,
        action: 'LOGOUT',
        provider: req.user.is_ad_user ? 'microsoft' : 'local',
        email: req.user.email,
        requestId: req.requestId,
        ip: req.ip,
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function me(req, res) {
  return res.json(authService.toPublicUser(req.user));
}

async function profilePhoto(req, res) {
  try {
    if (!req.user.microsoft_id) {
      return res.status(404).json({ mensagem: 'Foto não disponível.' });
    }

    const tenants = (await tenantsRepo.findAll()).filter((t) => t.ativo);
    if (!tenants.length) {
      return res.status(404).json({ mensagem: 'Tenant não configurado.' });
    }

    for (const tenant of tenants) {
      try {
        const photo = await fetchUserPhotoBufferFromTenant(tenant, req.user.microsoft_id);
        if (photo) {
          res.set('Cache-Control', 'private, max-age=3600');
          res.type(photo.contentType);
          return res.send(photo.buffer);
        }
      } catch {
        /* tenta próximo tenant */
      }
    }

    return res.status(404).json({ mensagem: 'Foto não encontrada.' });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = { login, loginMicrosoft, refresh, logout, me, profilePhoto };
