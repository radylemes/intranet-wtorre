const bidConfigService = require('./bid-config.service');
const bidSyncRepo = require('../repositories/bid-sync.repository');
const { fetchBidJson } = require('./bid-api.client');

let syncEmAndamento = false;

async function sincronizarBid({ forcar = false } = {}) {
  if (syncEmAndamento) {
    const err = new Error('Sincronização BID já em andamento.');
    err.status = 409;
    throw err;
  }

  syncEmAndamento = true;
  const inicio = Date.now();

  try {
    const config = await bidConfigService.getInternalConfig({ requireActive: true });

    const [eventosPayload, usuariosPayload] = await Promise.all([
      fetchBidJson(config, '/api/integracao/eventos'),
      fetchBidJson(config, '/api/integracao/usuarios'),
    ]);

    const snapshot = await bidSyncRepo.saveSnapshot({
      payloadEventos: eventosPayload,
      payloadUsuarios: usuariosPayload,
      geradoEmEventos: eventosPayload?.gerado_em || null,
      geradoEmUsuarios: usuariosPayload?.gerado_em || null,
      status: 'ok',
      ultimoErro: null,
    });

    await bidSyncRepo.touchUltimaSync({ erro: null });

    const abertos = Array.isArray(eventosPayload?.bids?.abertos) ? eventosPayload.bids.abertos : [];
    const totalUsuarios = Number(usuariosPayload?.total) || usuariosPayload?.usuarios?.length || 0;
    const duracao_ms = Date.now() - inicio;

    console.log(
      `[bid.sync] OK em ${duracao_ms}ms — ${abertos.length} BID(s) aberto(s), ${totalUsuarios} usuário(s).`
    );

    return {
      ok: true,
      mensagem: `Sincronização concluída. ${abertos.length} BID(s) aberto(s), ${totalUsuarios} usuário(s).`,
      bids_abertos: abertos.length,
      usuarios_ativos: totalUsuarios,
      gerado_em_eventos: snapshot.gerado_em_eventos,
      gerado_em_usuarios: snapshot.gerado_em_usuarios,
      sincronizado_em: snapshot.sincronizado_em,
      duracao_ms,
    };
  } catch (err) {
    const msg = err.message || 'Erro ao sincronizar dados BID.';
    await bidSyncRepo.markSnapshotErro(msg).catch(() => {});
    await bidSyncRepo.touchUltimaSync({ erro: msg }).catch(() => {});
    console.error('[bid.sync] Falha:', msg);
    throw err;
  } finally {
    syncEmAndamento = false;
  }
}

module.exports = {
  sincronizarBid,
};
