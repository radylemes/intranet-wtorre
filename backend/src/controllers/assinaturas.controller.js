const https = require('https');
const graphService = require('../services/assinatura-graph.service');
const scriptService = require('../services/assinatura-script.service');
const configService = require('../services/assinatura-config.service');

const BLOB_BASE = 'https://nubankparqueassets.blob.core.windows.net/email-assets';
const FONTES_PERMITIDAS = new Set(['NuSansDisplay-Medium.otf', 'NuSansDisplay-Regular.otf']);

function publicBaseUrl(req) {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}`;
}

async function me(req, res) {
  try {
    const profile = await graphService.fetchMeProfile(req.graphToken);
    return res.json(profile);
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ mensagem: err.message });
  }
}

async function gerarScript(req, res) {
  try {
    const { assinaturas, emailPadrao } = req.body || {};
    const launcher = scriptService.gerarLauncher(assinaturas, emailPadrao, publicBaseUrl(req));
    res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Instalar-Assinaturas.bat"'
    );
    return res.send(launcher);
  } catch (err) {
    return res.status(400).json({ mensagem: err.message });
  }
}

async function obterConfig(req, res) {
  const config = configService.get(req.params.token);
  if (!config) {
    return res.status(404).json({ mensagem: 'Configuração não encontrada ou expirada.' });
  }
  return res.json(configService.toResponsePayload(config));
}

async function obterScriptBase(_req, res) {
  try {
    const scriptPath = scriptService.caminhoTemplateBase();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="Instalar-Assinaturas-Base.ps1"'
    );
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.sendFile(scriptPath);
  } catch (err) {
    return res.status(500).json({ mensagem: err.message });
  }
}

function servirFonte(req, res) {
  const { filename } = req.params;
  if (!FONTES_PERMITIDAS.has(filename)) {
    return res.status(404).json({ mensagem: 'Fonte não encontrada.' });
  }

  const url = `${BLOB_BASE}/${filename}`;
  https
    .get(url, (upstream) => {
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return res.status(502).json({ mensagem: 'Fonte indisponível.' });
      }
      res.setHeader('Content-Type', 'font/otf');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return upstream.pipe(res);
    })
    .on('error', () => res.status(502).json({ mensagem: 'Erro ao obter fonte.' }));
}

module.exports = { me, gerarScript, obterConfig, obterScriptBase, servirFonte };
