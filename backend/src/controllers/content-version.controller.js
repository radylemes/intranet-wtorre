const contentVersionService = require('../services/content-version.service');

async function getVersions(_req, res) {
  try {
    const versions = await contentVersionService.getAll();
    return res.json(versions);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message || 'Erro ao obter versões de conteúdo.' });
  }
}

module.exports = { getVersions };
