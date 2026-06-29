const fs = require('fs');
const path = require('path');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const tenantsRepo = require('../repositories/tenants.repository');
const usersRepo = require('../repositories/users.repository');
const syncService = require('../services/colaboradores.sync');
const { decrypt } = require('../services/crypto.service');
const { fetchUserPhotoBuffer } = require('../services/microsoftGraph');
const { env } = require('../config/env');

function ensureFotosDir() {
  try {
    fs.mkdirSync(env.colaboradoresFotosDir, { recursive: true });
  } catch {
    /* ignore */
  }
}

function fotoCachePath(adId) {
  return path.join(env.colaboradoresFotosDir, `${adId}.jpg`);
}

function tryWriteCache(adId, buffer) {
  try {
    if (!fs.existsSync(env.colaboradoresFotosDir)) return;
    fs.writeFileSync(fotoCachePath(adId), buffer);
  } catch {
    /* falha de cache não derruba a resposta */
  }
}

function tryReadCache(adId) {
  try {
    const cachePath = fotoCachePath(adId);
    if (!fs.existsSync(cachePath)) return null;
    return { buffer: fs.readFileSync(cachePath), contentType: 'image/jpeg' };
  } catch {
    return null;
  }
}

function sendPhoto(res, buffer, contentType) {
  res.set('Cache-Control', 'private, max-age=3600');
  res.type(contentType);
  return res.send(buffer);
}

function toPublicColaborador(c) {
  const { sincronizado_em, ativo, ...rest } = c;
  return rest;
}

async function resolveIntranetLink(adId) {
  if (!adId) {
    return { cadastrado: false, usuario_id: null };
  }
  const user = await usersRepo.findByMicrosoftId(adId);
  if (!user) {
    return { cadastrado: false, usuario_id: null };
  }
  return { cadastrado: true, usuario_id: user.id };
}

async function toAdminColaborador(c) {
  const intranet = await resolveIntranetLink(c.ad_id);
  return { ...c, intranet };
}

function parseAtivoFilter(value) {
  const v = String(value || '1').trim().toLowerCase();
  if (v === '0' || v === 'false') return '0';
  if (v === 'todos' || v === 'all') return 'todos';
  return '1';
}

async function list(req, res) {
  try {
    const { busca, empresa, departamento } = req.query;
    const colaboradores = await colaboradoresRepo.findAll({
      busca: busca?.trim() || undefined,
      empresa: empresa?.trim() || undefined,
      departamento: departamento?.trim() || undefined,
      ativoOnly: true,
    });
    const sincronizado_em = await colaboradoresRepo.getUltimaSincronizacao();
    return res.json({
      colaboradores: colaboradores.map(toPublicColaborador),
      sincronizado_em,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function departamentos(req, res) {
  try {
    const lista = await colaboradoresRepo.findDistinctDepartamentos();
    return res.json(lista);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function sync(req, res) {
  try {
    const resumo = await syncService.sincronizarColaboradores();
    return res.json(resumo);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function adminList(req, res) {
  try {
    const { busca, empresa, departamento, ativo, page, limit } = req.query;
    const result = await colaboradoresRepo.findAllPaginated({
      busca: busca?.trim() || undefined,
      empresa: empresa?.trim() || undefined,
      departamento: departamento?.trim() || undefined,
      ativoFilter: parseAtivoFilter(ativo),
      page,
      limit,
    });

    const colaboradores = await Promise.all(result.rows.map((c) => toAdminColaborador(c)));

    return res.json({
      colaboradores,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function adminStats(req, res) {
  try {
    const stats = await colaboradoresRepo.countStats();
    return res.json({
      ...stats,
      sync_em_andamento: syncService.isSyncEmAndamento(),
    });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function adminDetail(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ mensagem: 'ID inválido.' });
    }

    const colaborador = await colaboradoresRepo.findAdminById(id);
    if (!colaborador) {
      return res.status(404).json({ mensagem: 'Colaborador não encontrado.' });
    }

    return res.json(await toAdminColaborador(colaborador));
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function foto(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ mensagem: 'ID inválido.' });
    }

    const colaborador = await colaboradoresRepo.findById(id);
    if (!colaborador || !colaborador.ativo || !colaborador.ad_id) {
      return res.status(404).json({ mensagem: 'Colaborador não encontrado.' });
    }

    if (colaborador.tem_foto === false) {
      return res.status(404).json({ mensagem: 'Foto não disponível.' });
    }

    const cached = tryReadCache(colaborador.ad_id);
    if (cached) {
      if (colaborador.tem_foto == null) {
        await colaboradoresRepo.updateTemFoto(id, true);
      }
      return sendPhoto(res, cached.buffer, cached.contentType);
    }

    const tenant = await tenantsRepo.findActiveWithSecret(colaborador.tenant_id);
    if (!tenant) {
      await colaboradoresRepo.updateTemFoto(id, false);
      return res.status(404).json({ mensagem: 'Tenant não configurado.' });
    }

    const clientSecret = decrypt(tenant.client_secret_ciphertext);
    const photo = await fetchUserPhotoBuffer(
      tenant.azure_tenant_id,
      tenant.client_id,
      clientSecret,
      colaborador.ad_id
    );

    if (!photo) {
      await colaboradoresRepo.updateTemFoto(id, false);
      return res.status(404).json({ mensagem: 'Foto não encontrada.' });
    }

    tryWriteCache(colaborador.ad_id, photo.buffer);
    await colaboradoresRepo.updateTemFoto(id, true);
    return sendPhoto(res, photo.buffer, photo.contentType);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  list,
  departamentos,
  sync,
  adminList,
  adminStats,
  adminDetail,
  foto,
  ensureFotosDir,
};
