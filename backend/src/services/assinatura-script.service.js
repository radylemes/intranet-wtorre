const fs = require('fs');
const path = require('path');
const { isDominioMapeado, isEmailPermitido } = require('../utils/assinatura-domains');
const configService = require('./assinatura-config.service');

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'instalar-assinaturas-base.ps1.template'
);

function validarAssinaturas(assinaturas) {
  if (!Array.isArray(assinaturas) || assinaturas.length === 0) {
    throw new Error('Informe ao menos uma assinatura.');
  }

  for (const sig of assinaturas) {
    if (!sig?.email || typeof sig.email !== 'string') {
      throw new Error('Cada assinatura deve ter um e-mail válido.');
    }
    if (!isEmailPermitido(sig.email)) {
      throw new Error(`E-mail não permitido para assinatura: ${sig.email}`);
    }
    const tipo = sig.tipo === 'compartilhada' ? 'compartilhada' : 'pessoal';
    if (!isDominioMapeado(sig.email)) {
      throw new Error(`Domínio não mapeado para o e-mail: ${sig.email}`);
    }
    if (tipo === 'pessoal' && !sig.nome?.trim()) {
      throw new Error(`Nome obrigatório para assinatura pessoal: ${sig.email}`);
    }
  }
}

function caminhoTemplateBase() {
  return TEMPLATE_PATH;
}

function lerTemplateBaseBytes() {
  const raw = fs.readFileSync(TEMPLATE_PATH);
  const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  if (hasBom) return raw;
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw]);
}

function lerTemplateBase() {
  return lerTemplateBaseBytes().toString('utf8');
}

function embutirScriptBase64(scriptBytes) {
  const b64 = scriptBytes.toString('base64');
  const linhas = b64.match(/.{1,76}/g) || [];
  return linhas.map((linha) => `::B64::${linha}`).join('\r\n');
}

function validarEmailPadrao(assinaturas, emailPadrao) {
  if (!emailPadrao || typeof emailPadrao !== 'string') {
    throw new Error('Selecione a assinatura padrao do Outlook.');
  }
  const alvo = emailPadrao.trim().toLowerCase();
  const ok = assinaturas.some((sig) => sig.email?.trim().toLowerCase() === alvo);
  if (!ok) {
    throw new Error('A assinatura padrao deve estar entre as selecionadas.');
  }
}

function gerarLauncher(assinaturas, emailPadrao, publicBaseUrl) {
  validarAssinaturas(assinaturas);
  validarEmailPadrao(assinaturas, emailPadrao);

  const token = configService.create(assinaturas, emailPadrao.trim().toLowerCase());
  const configUrl = `${publicBaseUrl}/api/v1/assinaturas/config/${token}`;
  const scriptEmbutido = embutirScriptBase64(lerTemplateBaseBytes());

  // O script .ps1 é embutido no .bat (base64) para evitar bloqueio do WAF/nginx em URLs *.ps1
  return `@echo off
chcp 65001 >nul
setlocal
set "CONFIG_URL=${configUrl}"
echo.
echo  Instalador de Assinaturas
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dst = Join-Path $env:TEMP 'Instalar-Assinaturas.ps1'; $b64 = (Select-String -LiteralPath '%~f0' -Pattern '^::B64::(.*)$' | ForEach-Object { $_.Matches.Groups[1].Value }) -join ''; $bytes = [Convert]::FromBase64String($b64); $utf8 = New-Object System.Text.UTF8Encoding $true; [IO.File]::WriteAllText($dst, $utf8.GetString($bytes).TrimStart([char]0xFEFF), $utf8); & $dst -ConfigUrl $env:CONFIG_URL"
if errorlevel 1 (
  echo.
  echo  ERRO na instalacao. Verifique sua conexao e tente novamente.
  pause
  exit /b 1
)
echo.
pause
goto :eof
${scriptEmbutido}
`;
}

module.exports = {
  gerarLauncher,
  caminhoTemplateBase,
  lerTemplateBase,
  validarAssinaturas,
};
