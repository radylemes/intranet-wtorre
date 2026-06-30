const crypto = require('crypto');
const { env } = require('../../config/env');
const powerbiRepo = require('../../repositories/powerbi.repository');
const powerbiApi = require('./powerbi-api.service');
const powerbiRls = require('./powerbi-rls.service');
const powerbiThrottle = require('./powerbi-throttle');
const powerbiAccessLogRepo = require('../../repositories/powerbi-access-log.repository');

const embedCache = new Map();

function rolesHashFromSetorId(setorId) {
  // rolesHash derivado EXCLUSIVAMENTE do setor_id resolvido no servidor — nunca da request.
  return crypto.createHash('sha256').update(`setor:${setorId}`).digest('hex').slice(0, 16);
}

function cacheKey(reportId, userId, setorId) {
  return `${reportId}:${userId}:${rolesHashFromSetorId(setorId)}`;
}

function getCachedEmbed(key) {
  const entry = embedCache.get(key);
  if (!entry) return null;
  const renewBeforeMs = 5 * 60 * 1000;
  if (Date.now() >= entry.expiresAt - renewBeforeMs) {
    embedCache.delete(key);
    return null;
  }
  return entry.payload;
}

function setCachedEmbed(key, payload, tokenExpiration) {
  const expiresAt = tokenExpiration ? new Date(tokenExpiration).getTime() : Date.now() + 55 * 60 * 1000;
  embedCache.set(key, { payload, expiresAt });
}

async function listReportsForSetor(setorId) {
  const locais = await powerbiRepo.listRelatoriosPorSetor(setorId);
  if (!locais.length) return [];

  let remotos = [];
  if (env.pbiEnabled) {
    try {
      remotos = await powerbiApi.listReports();
      for (const r of remotos) {
        await powerbiRepo.upsertDatasetIdFromApi(r.id, r.datasetId);
      }
    } catch (err) {
      console.warn('[powerbi] Falha ao listar relatórios remotos:', err.message);
    }
  }

  const remoteById = new Map(remotos.map((r) => [r.id, r]));

  return locais.map((item) => {
    const remote = remoteById.get(item.reportId);
    return {
      reportId: item.reportId,
      titulo: item.titulo,
      descricao: item.descricao,
      datasetId: item.datasetId || remote?.datasetId || null,
      ordem: item.ordem,
    };
  });
}

async function createEmbedToken({ user, setorId, reportId }) {
  const autorizado = await powerbiRepo.isRelatorioAutorizado(reportId, setorId);
  if (!autorizado) {
    const err = new Error('Relatório não autorizado para o seu setor.');
    err.status = 403;
    throw err;
  }

  const relatorio = await powerbiRepo.findRelatorioByReportId(reportId);
  let datasetId = relatorio?.datasetId;

  if (!datasetId && env.pbiEnabled) {
    const remotos = await powerbiApi.listReports();
    const remote = remotos.find((r) => r.id === reportId);
    datasetId = remote?.datasetId || null;
    if (datasetId) {
      await powerbiRepo.upsertDatasetIdFromApi(reportId, datasetId);
    }
  }

  const key = cacheKey(reportId, user.id, setorId);
  const cached = getCachedEmbed(key);
  if (cached) return cached;

  const identities = await powerbiRls.buildIdentities({ user, setorId, datasetId });

  await powerbiThrottle.throttleGenerateToken();

  const tokenResponse = await powerbiApi.generateEmbedToken(reportId, {
    accessLevel: 'View',
    identities,
  });

  let embedUrl = relatorio?.embedUrl || null;
  if (!embedUrl && env.pbiEnabled) {
    const remotos = await powerbiApi.listReports();
    embedUrl = remotos.find((r) => r.id === reportId)?.embedUrl || null;
  }
  if (!embedUrl) {
    embedUrl = `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${env.pbiWorkspaceId}`;
  }

  const payload = {
    embedUrl,
    embedToken: tokenResponse.token,
    tokenExpiration: tokenResponse.expiration,
    reportId,
  };

  setCachedEmbed(key, payload, tokenResponse.expiration);

  await powerbiAccessLogRepo.logEmbedToken({
    userId: user.id,
    email: user.email,
    reportId,
    setorId,
  });

  return payload;
}

module.exports = {
  listReportsForSetor,
  createEmbedToken,
};
