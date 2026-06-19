const camarotesRepo = require('../repositories/camarotes.repository');
const syncService = require('../services/camarotes-sync.service');
const alertasService = require('../services/camarotes-alertas.service');
const { validarEmailsAlerta } = require('../utils/camarotes-email-domains.util');

function handleError(res, err) {
  if (err.resumo) {
    return res.status(err.status || 502).json({
      mensagem: err.message,
      ...err.resumo,
    });
  }
  return res.status(err.status || 500).json({
    mensagem: err.message || 'Erro ao processar solicitação de camarotes.',
  });
}

async function sincronizar(req, res) {
  try {
    const resumo = await syncService.sincronizarCamarotes();
    return res.json(resumo);
  } catch (err) {
    return handleError(res, err);
  }
}

async function syncLog(req, res) {
  try {
    const limit = req.query.limit;
    const logs = await camarotesRepo.listSyncLog(limit);
    return res.json(logs);
  } catch (err) {
    return handleError(res, err);
  }
}

async function dashboard(req, res) {
  try {
    const data = await camarotesRepo.buildDashboard();
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
}

async function unidades(req, res) {
  try {
    const config = await camarotesRepo.getConfig();
    const dias = config?.dias_vence_breve ?? 90;
    const lista = await camarotesRepo.listUnidades(
      {
        tipo: req.query.tipo,
        setor: req.query.setor,
        situacao: req.query.situacao,
      },
      dias
    );
    return res.json(lista);
  } catch (err) {
    return handleError(res, err);
  }
}

async function obterConfig(req, res) {
  try {
    const config = await camarotesRepo.getConfig();
    return res.json(config);
  } catch (err) {
    return handleError(res, err);
  }
}

async function atualizarConfig(req, res) {
  try {
    const { emails_alerta, dias_vence_breve, cadencia, envio_ativo } = req.body || {};
    const emails = validarEmailsAlerta(emails_alerta ?? []);
    const dias = Number(dias_vence_breve);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
      return res.status(400).json({ mensagem: 'Dias "vence em breve" deve estar entre 1 e 365.' });
    }
    const config = await camarotesRepo.updateConfig({
      emails_alerta: emails,
      dias_vence_breve: dias,
      cadencia: cadencia === 'semanal' ? 'semanal' : 'diaria',
      envio_ativo: !!envio_ativo,
    });
    return res.json(config);
  } catch (err) {
    return handleError(res, err);
  }
}

async function enviarResumo(req, res) {
  try {
    const preview = req.query.preview === '1' || req.query.preview === 'true';
    const resultado = await alertasService.enviarResumo({ preview, forcar: true });
    return res.json(resultado);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  sincronizar,
  syncLog,
  dashboard,
  unidades,
  obterConfig,
  atualizarConfig,
  enviarResumo,
};
