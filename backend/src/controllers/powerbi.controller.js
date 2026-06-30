const { env } = require('../config/env');
const powerbiEmbedService = require('../services/powerbi/powerbi-embed.service');

function handleError(res, err) {
  if (err.status === 403) {
    return res.status(403).json({
      mensagem: err.message || 'Relatório ou permissão inválida.',
    });
  }
  if (err.status === 401 || err.status === 502) {
    return res.status(503).json({
      mensagem: 'Serviço Power BI temporariamente indisponível. Tente novamente.',
    });
  }
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar Power BI.',
  });
}

function ensurePbiEnabled(_req, res, next) {
  if (!env.pbiEnabled) {
    return res.status(503).json({
      mensagem: 'Power BI não está habilitado neste ambiente.',
    });
  }
  return next();
}

async function listarReports(req, res) {
  try {
    const items = await powerbiEmbedService.listReportsForSetor(req.setorId);
    return res.json(items);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obterEmbedToken(req, res) {
  try {
    const reportId = String(req.params.reportId || '').trim();
    if (!reportId) {
      return res.status(400).json({ mensagem: 'reportId inválido.' });
    }

    const payload = await powerbiEmbedService.createEmbedToken({
      user: req.user,
      setorId: req.setorId,
      reportId,
    });
    return res.json(payload);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  ensurePbiEnabled,
  listarReports,
  obterEmbedToken,
};
