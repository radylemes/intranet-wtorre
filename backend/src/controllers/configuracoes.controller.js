const siteConfigRepo = require('../repositories/site-config.repository');
const auditRepo = require('../repositories/auditLog.repository');
const emailConfigService = require('../services/email-config.service');
const bidConfigService = require('../services/bid-config.service');
const bidIntegracaoService = require('../services/bid-integracao.service');
const smtpMailService = require('../services/mail/smtp-mail.service');
const emailSender = require('../utils/emailSender');
const contentVersionService = require('../services/content-version.service');
const { isPaginaInterna } = require('../config/paginas-internas');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function auditMeta(req) {
  return {
    userId: req.user?.id,
    requestId: req.requestId,
    ip: req.ip,
  };
}

function validarUrl(url, tipo_destino) {
  if (!url?.trim()) {
    const err = new Error('URL é obrigatória quando o botão está ativo.');
    err.status = 400;
    throw err;
  }

  const trimmed = url.trim();

  if (tipo_destino === 'interna') {
    if (!trimmed.startsWith('/')) {
      const err = new Error('Página interna deve começar com /.');
      err.status = 400;
      throw err;
    }
    if (!isPaginaInterna(trimmed)) {
      const err = new Error('Página interna não reconhecida.');
      err.status = 400;
      throw err;
    }
    return trimmed;
  }

  if (tipo_destino === 'externa') {
    if (!/^https?:\/\//i.test(trimmed)) {
      const err = new Error('URL externa deve começar com http:// ou https://.');
      err.status = 400;
      throw err;
    }
    return trimmed;
  }

  const err = new Error('tipo_destino inválido.');
  err.status = 400;
  throw err;
}

function buildTestEmailHtml(providerLabel) {
  return `
    <div style="font-family: Arial, sans-serif; color: #10151f; line-height: 1.5;">
      <h2 style="color: #1d54e6;">Teste de e-mail — Intranet WTorre</h2>
      <p>Este é um e-mail de teste enviado pelo painel de configurações da intranet.</p>
      <p>Provedor ativo: <strong>${providerLabel}</strong></p>
      <p>Se você recebeu esta mensagem, o envio de e-mail está configurado corretamente.</p>
      <p style="color: #8a93a8; font-size: 12px;">Enviado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
  `.trim();
}

async function getHeaderChamadoPublic(_req, res) {
  try {
    const config = await siteConfigRepo.getHeaderChamado();
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getConfiguracoes(_req, res) {
  try {
    const header_chamado = await siteConfigRepo.getHeaderChamado();
    return res.json({ header_chamado });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putHeaderChamado(req, res) {
  try {
    const { label, url, ativo, abrir_nova_aba, tipo_destino } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ mensagem: 'Rótulo é obrigatório.' });
    }

    let urlFinal = url?.trim() || null;

    if (ativo) {
      urlFinal = validarUrl(urlFinal, tipo_destino);
    } else if (urlFinal && tipo_destino) {
      urlFinal = validarUrl(urlFinal, tipo_destino);
    }

    const config = await siteConfigRepo.setHeaderChamado({
      label: label.trim(),
      url: urlFinal,
      ativo: !!ativo,
      abrir_nova_aba: abrir_nova_aba !== false,
    });

    await contentVersionService.bump('menu');
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getEmailConfig(_req, res) {
  try {
    const email = await emailConfigService.getPublicConfig();
    return res.json(email);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putEmailConfig(req, res) {
  try {
    const email = await emailConfigService.save(req.body);
    emailSender.refreshSmtpMailSender();
    await auditRepo.log({
      ...auditMeta(req),
      action: 'EMAIL_CONFIG_SALVA',
      email: req.user?.email,
    });
    return res.json(email);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function verificarEmail(_req, res) {
  try {
    const cfg = await emailConfigService.getEmailProviderConfig({ requireActive: false });
    if (cfg.provider !== 'smtp') {
      return res.status(400).json({
        mensagem: 'Verificação de conexão disponível apenas para o provedor SMTP.',
      });
    }

    const smtpConfig = {
      host: cfg.smtp_host,
      port: cfg.smtp_port,
      secure: cfg.smtp_secure,
      user: cfg.smtp_user,
      password: cfg.smtp_pass,
      from_email: cfg.smtp_from,
      from_name: cfg.smtp_from_name,
    };

    await smtpMailService.verifyConnection(smtpConfig);
    return res.json({ ok: true, mensagem: 'Conexão SMTP verificada com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function testarEmail(req, res) {
  try {
    const sender = await emailSender.getMailSender();
    if (!sender) {
      return res.status(400).json({ mensagem: emailSender.NOT_CONFIGURED_MSG });
    }

    const destinatario = (req.body?.to || req.body?.destinatario || req.user?.email || '')
      .trim()
      .toLowerCase();
    if (!destinatario) {
      return res.status(400).json({ mensagem: 'Informe um destinatário para o e-mail de teste.' });
    }
    if (!EMAIL_RE.test(destinatario)) {
      return res.status(400).json({ mensagem: 'E-mail do destinatário inválido.' });
    }

    const providerLabel = sender.provider === 'acs' ? 'Azure ACS' : 'SMTP';
    const subject = `[Intranet] E-mail de teste (${providerLabel})`;
    const html = buildTestEmailHtml(providerLabel);
    const text = `Teste de e-mail — Intranet WTorre (${providerLabel}). Se você recebeu esta mensagem, o envio está configurado corretamente.`;

    await emailSender.sendEmail({
      to: destinatario,
      subject,
      html,
      text,
    });

    await auditRepo.log({
      ...auditMeta(req),
      action: 'EMAIL_TESTE_ENVIADO',
      email: destinatario,
    });

    return res.json({ ok: true, mensagem: `E-mail de teste enviado para ${destinatario}.` });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getSmtpConfig(_req, res) {
  return getEmailConfig(_req, res);
}

async function putSmtpConfig(req, res) {
  return putEmailConfig(req, res);
}

async function verificarSmtp(_req, res) {
  return verificarEmail(_req, res);
}

async function testarSmtp(req, res) {
  return testarEmail(req, res);
}

async function getBidConfig(_req, res) {
  try {
    const bid = {
      ...(await bidConfigService.getPublicConfig()),
      ...(await bidIntegracaoService.getSyncStatusPublico()),
    };
    return res.json(bid);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putBidConfig(req, res) {
  try {
    const bid = await bidConfigService.save(req.body);
    await auditRepo.log({
      ...auditMeta(req),
      action: 'BID_CONFIG_SALVA',
      email: req.user?.email,
    });
    return res.json(bid);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}


async function sincronizarBidConfig(req, res) {
  try {
    const bidSyncService = require('../services/bid-sync.service');
    const result = await bidSyncService.sincronizarBid();
    await auditRepo.log({
      ...auditMeta(req),
      action: 'BID_SYNC_MANUAL',
      email: req.user?.email,
    });
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function testarBidConfig(req, res) {
  try {
    const result = await bidIntegracaoService.testarConexao({ ignorarCache: true });
    await auditRepo.log({
      ...auditMeta(req),
      action: 'BID_CONFIG_TESTADA',
      email: req.user?.email,
    });
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getHeaderChamadoPublic,
  getConfiguracoes,
  putHeaderChamado,
  getEmailConfig,
  putEmailConfig,
  verificarEmail,
  testarEmail,
  getSmtpConfig,
  putSmtpConfig,
  verificarSmtp,
  testarSmtp,
  getBidConfig,
  putBidConfig,
  testarBidConfig,
  sincronizarBidConfig,
};
