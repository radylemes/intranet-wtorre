const { diasRestantes } = require('./camarotes-situacao.util');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return s;
}

function renderTabela(unidades, titulo) {
  if (!unidades.length) {
    return `<h3 style="font-family:Arial,sans-serif;color:#10151f;">${escapeHtml(titulo)}</h3>
<p style="font-family:Arial,sans-serif;color:#48536a;">Nenhum item nesta categoria.</p>`;
  }

  const rows = unidades
    .map((u) => {
      const dias = diasRestantes(u.final_locacao);
      return `<tr>
        <td style="padding:8px;border:1px solid #e2e6ee;">${escapeHtml(u.numero)}</td>
        <td style="padding:8px;border:1px solid #e2e6ee;">${escapeHtml(u.setor || '—')}</td>
        <td style="padding:8px;border:1px solid #e2e6ee;">${escapeHtml(u.cessionario)}</td>
        <td style="padding:8px;border:1px solid #e2e6ee;">${formatDate(u.final_locacao)}</td>
        <td style="padding:8px;border:1px solid #e2e6ee;">${dias != null ? dias : '—'}</td>
        <td style="padding:8px;border:1px solid #e2e6ee;">${escapeHtml(u.situacao)}</td>
      </tr>`;
    })
    .join('');

  return `<h3 style="font-family:Arial,sans-serif;color:#10151f;margin-top:24px;">${escapeHtml(titulo)}</h3>
<table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px;">
  <thead>
    <tr style="background:#f4f5f8;">
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Número</th>
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Setor</th>
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Cessionário</th>
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Vencimento</th>
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Dias restantes</th>
      <th style="padding:8px;border:1px solid #e2e6ee;text-align:left;">Situação</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function buildDigestHtml(unidades, { diasVenceBreve } = {}) {
  const vencidos = unidades.filter((u) => u.situacao === 'vencido');
  const venceBreve = unidades.filter((u) => u.situacao === 'vence_breve');
  const hoje = new Date().toLocaleDateString('pt-BR');

  const intro = `<p style="font-family:Arial,sans-serif;color:#48536a;">
    Resumo de contratos de Camarotes — ${escapeHtml(hoje)}.
    Janela "vence em breve": ${escapeHtml(diasVenceBreve ?? 90)} dias.
  </p>`;

  return `<div style="max-width:960px;margin:0 auto;">
    <h2 style="font-family:Arial,sans-serif;color:#1d54e6;">Gestão de Camarotes — Alertas</h2>
    ${intro}
    ${renderTabela(vencidos, 'Camarotes vencidos')}
    ${renderTabela(venceBreve, 'Camarotes — vence em breve')}
    <p style="font-family:Arial,sans-serif;color:#8a93a8;font-size:12px;margin-top:24px;">
      Mensagem automática da Intranet Grupo WTorre. Não responda a este e-mail.
    </p>
  </div>`;
}

module.exports = { buildDigestHtml, escapeHtml, formatDate };
