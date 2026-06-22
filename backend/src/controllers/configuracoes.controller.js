const siteConfigRepo = require('../repositories/site-config.repository');
const auditRepo = require('../repositories/auditLog.repository');
const smtpConfigService = require('../services/smtp-config.service');
const smtpMailService = require('../services/mail/smtp-mail.service');
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

    await contentVersionService.bump('configuracoes');
    return res.json(config);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function getSmtpConfig(_req, res) {
  try {
    const smtp = await smtpConfigService.getPublicConfig();
    return res.json(smtp);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function putSmtpConfig(req, res) {
  try {
    const smtp = await smtpConfigService.save(req.body);
    await auditRepo.log({
      ...auditMeta(req),
      action: 'SMTP_CONFIG_SALVA',
      email: req.user?.email,
    });
    return res.json(smtp);
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function verificarSmtp(_req, res) {
  try {
    await smtpMailService.verifyStoredConnection();
    return res.json({ ok: true, mensagem: 'Conexão SMTP verificada com sucesso.' });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

async function testarSmtp(req, res) {
  try {
    const destinatario = (req.body?.destinatario || req.user?.email || '').trim().toLowerCase();
    if (!destinatario) {
      return res.status(400).json({ mensagem: 'Informe um destinatário para o e-mail de teste.' });
    }
    if (!EMAIL_RE.test(destinatario)) {
      return res.status(400).json({ mensagem: 'E-mail do destinatário inválido.' });
    }

    const config = await smtpConfigService.getDecrypted();
    const subject = '[Intranet] E-mail de teste SMTP';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #10151f; line-height: 1.5;">
        <h2 style="color: #1d54e6;">Teste SMTP — Intranet WTorre</h2>
        <p>Este é um e-mail de teste enviado pelo painel de configurações da intranet.</p>
        <p>Se você recebeu esta mensagem, o servidor SMTP está configurado corretamente.</p>
        <p style="color: #8a93a8; font-size: 12px;">Enviado em ${new Date().toLocaleString('pt-BR')}</p>
      </div>
    `.trim();

    await smtpMailService.sendMail(config, {
      to: destinatario,
      subject,
      html,
      text: 'Teste SMTP — Intranet WTorre. Se você recebeu esta mensagem, o servidor SMTP está configurado corretamente.',
    });

    await auditRepo.log({
      ...auditMeta(req),
      action: 'SMTP_TESTE_ENVIADO',
      email: destinatario,
    });

    return res.json({ ok: true, mensagem: `E-mail de teste enviado para ${destinatario}.` });
  } catch (err) {
    return res.status(err.status || 500).json({ mensagem: err.message });
  }
}

module.exports = {
  getHeaderChamadoPublic,
  getConfiguracoes,
  putHeaderChamado,
  getSmtpConfig,
  putSmtpConfig,
  verificarSmtp,
  testarSmtp,
};
