const cron = require('node-cron');
const syncService = require('./camarotes-sync.service');
const alertasService = require('./camarotes-alertas.service');

const TZ = 'America/Sao_Paulo';

function isCronLeader() {
  const instance = process.env.NODE_APP_INSTANCE;
  return instance == null || instance === '0' || instance === 0;
}

function agendarJobsCamarotes() {
  if (!isCronLeader()) {
    console.log('[camarotes.cron] Instância secundária PM2 — jobs não agendados.');
    return;
  }

  cron.schedule(
    '0 6 * * *',
    () => {
      syncService.sincronizarCamarotes().catch((err) => {
        if (err.status !== 409) {
          console.error('[camarotes.cron] Erro na sync agendada:', err.message);
        }
      });
    },
    { timezone: TZ }
  );

  cron.schedule(
    '15 6 * * *',
    () => {
      alertasService.tentarEnvioCron().catch((err) => {
        console.error('[camarotes.cron] Erro no envio de alertas:', err.message);
      });
    },
    { timezone: TZ }
  );

  console.log('[camarotes.cron] Sync diário 06:00 e alertas 06:15 (' + TZ + ')');
}

module.exports = { agendarJobsCamarotes, isCronLeader };
