const followupRepo = require('../repositories/followup.repository');
const syncService = require('./followup-sync.service');

let syncIntervalHandle = null;

function isCronLeader() {
  const instance = process.env.NODE_APP_INSTANCE;
  return instance == null || instance === '0' || instance === 0;
}

function runSyncSafe() {
  syncService.sincronizar().catch((err) => {
    if (err.status !== 409) {
      console.error('[followup.cron] Erro na sync agendada:', err.message);
    }
  });
}

async function refreshSyncSchedule() {
  if (!isCronLeader()) return;

  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
    syncIntervalHandle = null;
  }

  const config = await followupRepo.getConfig();
  if (!config?.sync_automatica) {
    console.log('[followup.cron] Sync automática desativada.');
    return;
  }

  try {
    syncService.validarConfigLocalizacao(config);
  } catch {
    console.log('[followup.cron] Localização SharePoint incompleta — sync automática ignorada.');
    return;
  }

  const minutos = Math.max(5, Number(config.sync_intervalo_min) || 60);
  const ms = minutos * 60 * 1000;
  syncIntervalHandle = setInterval(runSyncSafe, ms);
  console.log(`[followup.cron] Sync agendada a cada ${minutos} min`);

  const ultima = config.ultima_sync ? new Date(config.ultima_sync).getTime() : 0;
  if (!ultima || Date.now() - ultima >= ms) {
    setTimeout(runSyncSafe, 8000);
  }
}

function agendarJobsFollowup() {
  if (!isCronLeader()) {
    console.log('[followup.cron] Instância secundária PM2 — jobs não agendados.');
    return;
  }

  refreshSyncSchedule().catch((err) => {
    console.error('[followup.cron] Falha ao agendar sync:', err.message);
  });
}

module.exports = {
  agendarJobsFollowup,
  reagendarSyncFollowup: refreshSyncSchedule,
  isCronLeader,
};
