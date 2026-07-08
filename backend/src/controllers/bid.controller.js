const bidIntegracaoService = require('../services/bid-integracao.service');

async function getEventosAbertos(req, res) {
  try {
    const dados = await bidIntegracaoService.getEventosAbertosParaUsuario(req.user);
    return res.json(dados);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getMeusPremios(req, res) {
  try {
    const dados = await bidIntegracaoService.getMeusPremiosParaUsuario(req.user);
    return res.json(dados);
  } catch (err) {
    console.error('[bid] meus-premios:', err.message);
    return res.json({ premios: [], gerado_em: new Date().toISOString() });
  }
}

module.exports = {
  getEventosAbertos,
  getMeusPremios,
};
