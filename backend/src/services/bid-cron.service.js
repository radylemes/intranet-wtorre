const bidIntegracaoConfigRepo = require('../repositories/bid-integracao-config.repository');
const bidSyncService = require('./bid-sync.service');

let syncIntervalHandle = null;

function isCronLeader() {
  const instance = process.env.NODE_APP_INSTANCE;
  return instance == null || instance === '0' || instance === 0;
}

function intervaloParaMs(minutos) {
  return Math.max(5, Math.min(60, Number(minutos) || 15)) * 60 * 1000;
}

function runSyncSafe() {
  bidSyncService.sincronizarBid().catch((err) => {
    if (err.status !== 409) {
      console.error('[bid.cron] Erro na sync agendada:', err.message);
    }
  });
}

async function refreshSyncSchedule() {
  if (!isCronLeader()) return;

  if (syncIntervalHandle) {
    clearInterval(syncIntervalHandle);
    syncIntervalHandle = null;
  }

  const config = await bidIntegracaoConfigRepo.get();
  if (!config?.ativo || !config?.sync_automatica) {
    console.log('[bid.cron] Sync automática desativada ou integração inativa.');
    return;
  }

  if (!config.api_base_url?.trim() || !config.api_key_ciphertext) {
    console.log('[bid.cron] Config BID incompleta — sync automática ignorada.');
    return;
  }

  const ms = intervaloParaMs(config.sync_intervalo_min);
  syncIntervalHandle = setInterval(runSyncSafe, ms);
  console.log(`[bid.cron] Sync agendada a cada ${config.sync_intervalo_min ?? 15} min`);

  const ultima = config.ultima_sync ? new Date(config.ultima_sync).getTime() : 0;
  if (!ultima || Date.now() - ultima >= ms) {
    setTimeout(runSyncSafe, 5000);
  }
}

function agendarJobsBid() {
  if (!isCronLeader()) {
    console.log('[bid.cron] Instância secundária PM2 — jobs BID não agendados.');
    return;
  }

  refreshSyncSchedule().catch((err) => {
    console.error('[bid.cron] Falha ao agendar sync BID:', err.message);
  });
}

module.exports = {
  agendarJobsBid,
  reagendarSyncBid: refreshSyncSchedule,
  isCronLeader,
  intervaloParaMs,
};
