const { familiaStatus } = require('../utils/followup-status.util');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtData(value) {
  if (value == null || value === '') return '—';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${pad2(br[1])}/${pad2(br[2])}/${br[3]}`;
  return s || '—';
}

function fmtMoeda(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNumero(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function normalizePlaceholderKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Após normalizePlaceholderKey, variações da planilha caem nas mesmas chaves
 * (ex.: "Pedido/Contrato", "DatadeEmissaoPedido", "Mapa de cotação").
 */
const FIELD_BY_NORM = {
  pedidocontrato: 'pedido_contrato',
  datadeemissaopedido: 'data_emissao_pedido',
  datadeemissao: 'data_emissao_pedido',
  dataemissaopedido: 'data_emissao_pedido',
  valortotalpedido: 'valor_total_pedido',
  fornecedor: 'fornecedor',
  saldopedido: 'saldo_pedido',
  dataaprovacaorm: 'data_aprovacao_rm',
  mapadecotacao: 'mapa_cotacao',
  numeroapprovo: 'numero_approvo',
};

function valorPlaceholder(field, row) {
  switch (field) {
    case 'pedido_contrato':
      return fmtNumero(row.pedido_contrato);
    case 'data_emissao_pedido':
      return fmtData(row.data_emissao_pedido);
    case 'valor_total_pedido':
      return fmtMoeda(row.valor_total_pedido);
    case 'fornecedor':
      return row.fornecedor != null && String(row.fornecedor).trim() ? String(row.fornecedor) : '—';
    case 'saldo_pedido':
      return fmtMoeda(row.saldo_pedido);
    case 'data_aprovacao_rm':
      return fmtData(row.data_aprovacao_rm);
    case 'mapa_cotacao':
      return fmtNumero(row.mapa_cotacao);
    case 'numero_approvo':
      return fmtNumero(row.numero_approvo);
    default:
      return '—';
  }
}

function renderMensagem(template, row) {
  let msg = template || `Status: ${row.status_geral || '—'}`;
  msg = msg.replace(/"([^"]+)"/g, (full, rawKey) => {
    const field = FIELD_BY_NORM[normalizePlaceholderKey(rawKey)];
    if (!field) return full;
    return valorPlaceholder(field, row);
  });
  return msg;
}

function enriquecerSolicitacao(row, matrizByStatus) {
  const status = row.status_geral || '';
  let template = null;
  if (matrizByStatus instanceof Map) {
    template = matrizByStatus.get(status) || null;
  } else if (matrizByStatus && typeof matrizByStatus === 'object') {
    template = matrizByStatus[status] || null;
  }
  return {
    ...row,
    mensagem: renderMensagem(template, row),
    familia: familiaStatus(status),
  };
}

module.exports = {
  fmtData,
  fmtMoeda,
  renderMensagem,
  enriquecerSolicitacao,
};
