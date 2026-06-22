const { getCampo, listarCampos } = require('../config/solicitacao-campos');
const { formatDateBr } = require('./parse-date.util');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TIPO_LABELS = {
  novo: 'Novo colaborador',
  reposicao: 'Reposição',
  mudanca: 'Mudança',
};

const EQUIPAMENTO_LABELS = {
  desktop: 'Desktop',
  notebook: 'Notebook',
  nao: 'Não',
};

const CAMPO_COL_MAP = {
  foto: 'foto_url',
  boas_vindas: 'boas_vindas_url',
  credencial_veiculo: 'credencial_veiculo_url',
};

function formatValor(chave, solicitacao) {
  const campo = getCampo(chave);
  if (!campo) return '—';

  const col = CAMPO_COL_MAP[chave] || chave;
  const raw = solicitacao[col];

  if (campo.tipo === 'file') {
    return raw ? 'Anexo incluído neste e-mail' : '—';
  }
  if (campo.tipo === 'bool') {
    return raw ? 'Sim' : 'Não';
  }
  if (campo.tipo === 'date') {
    return formatDateBr(raw);
  }
  if (chave === 'tipo') {
    return TIPO_LABELS[raw] || raw || '—';
  }
  if (chave === 'equipamento') {
    return EQUIPAMENTO_LABELS[raw] || raw || '—';
  }
  if (raw == null || raw === '') return '—';
  return String(raw);
}

function buildGrupoHtml(solicitacao, campos) {
  const rows = campos
    .map((chave) => {
      const campo = getCampo(chave);
      if (!campo) return '';
      const label = escapeHtml(campo.label);
      const valor = escapeHtml(formatValor(chave, solicitacao));
      return `<tr>
        <td style="padding:8px 12px;border:1px solid #e2e6ee;background:#f4f5f8;font-family:Arial,sans-serif;color:#48536a;width:40%;">${label}</td>
        <td style="padding:8px 12px;border:1px solid #e2e6ee;font-family:Arial,sans-serif;color:#10151f;">${valor}</td>
      </tr>`;
    })
    .join('');

  const nomeCompleto = escapeHtml(`${solicitacao.nome} ${solicitacao.sobrenome}`.trim());
  const tipoLabel = escapeHtml(TIPO_LABELS[solicitacao.tipo] || solicitacao.tipo);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f8;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#0d1424;padding:20px 24px;border-radius:12px 12px 0 0;">
      <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#7b88a3;letter-spacing:0.05em;">GRUPO WTORRE · INTRANET</p>
      <h1 style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:20px;color:#e8edf6;">Nova solicitação de colaborador</h1>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e2e6ee;border-top:none;border-radius:0 0 12px 12px;">
      <p style="font-family:Arial,sans-serif;color:#48536a;margin:0 0 16px;">
        Solicitação para <strong style="color:#10151f;">${nomeCompleto}</strong> (${tipoLabel}).
      </p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="font-family:Arial,sans-serif;font-size:12px;color:#8a93a8;margin:24px 0 0;">
        Mensagem automática da Intranet WTorre. Não compartilhe dados pessoais fora dos canais autorizados.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildTextoPlano(solicitacao, campos) {
  const linhas = campos.map((chave) => {
    const campo = getCampo(chave);
    if (!campo) return null;
    return `${campo.label}: ${formatValor(chave, solicitacao)}`;
  }).filter(Boolean);
  return [
    'Nova solicitação de colaborador',
    '',
    ...linhas,
  ].join('\n');
}

module.exports = {
  escapeHtml,
  buildGrupoHtml,
  buildTextoPlano,
  formatValor,
  CAMPO_COL_MAP,
};
