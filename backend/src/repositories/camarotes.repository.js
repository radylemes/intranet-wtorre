const { getPool } = require('../db/pool');
const { sqlSituacaoExpr } = require('../utils/camarotes-situacao.util');
const { sqlCessionarioVagoExpr } = require('../utils/camarotes-cessionario.util');

const TIPO_CAMAROTE = 'camarote';
const OCUPADO = `NOT ${sqlCessionarioVagoExpr('')}`;

const MESES_LABEL = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function toNum(val, fallback = 0) {
  if (val == null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(val) {
  return Math.round(toNum(val) * 100) / 100;
}

function addMonthsYm(ym, offset) {
  let [y, m] = ym.split('-').map(Number);
  m += offset;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function labelMesFromYm(ym) {
  const m = Number(ym.split('-')[1]);
  return MESES_LABEL[m - 1] || ym;
}

function parseEmails(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return raw;
}

function mapUnidade(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo_unidade: row.tipo_unidade,
    andar: row.andar,
    setor: row.setor,
    numero: row.numero,
    capacidade: row.capacidade,
    cessionario: row.cessionario,
    tipo_cessionario: row.tipo_cessionario,
    primeira_locacao: row.primeira_locacao,
    inicio_locacao: row.inicio_locacao,
    final_locacao: row.final_locacao,
    tempo_anos: row.tempo_anos,
    tempo_meses: row.tempo_meses,
    valor_total: row.valor_total != null ? Number(row.valor_total) : null,
    valor_cessao: row.valor_cessao != null ? Number(row.valor_cessao) : null,
    valor_anual: row.valor_anual != null ? Number(row.valor_anual) : null,
    entrada: row.entrada != null ? Number(row.entrada) : null,
    valor_parcelado: row.valor_parcelado != null ? Number(row.valor_parcelado) : null,
    valor_vagas: row.valor_vagas != null ? Number(row.valor_vagas) : null,
    qtd_parcelas: row.qtd_parcelas,
    vagas_vvip: row.vagas_vvip,
    credencial_staff: row.credencial_staff,
    categorias_staff: row.categorias_staff,
    pack30: !!row.pack30,
    status_contrato: row.status_contrato,
    situacao: row.situacao,
    atualizado_em: row.atualizado_em,
  };
}

const SYNC_FREQUENCIAS = new Set(['1h', '6h', '12h', '24h', 'semanal']);

function normalizeSyncFrequencia(value) {
  return SYNC_FREQUENCIAS.has(value) ? value : '24h';
}

function mapConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    emails_alerta: parseEmails(row.emails_alerta),
    dias_vence_breve: row.dias_vence_breve,
    cadencia: row.cadencia,
    envio_ativo: !!row.envio_ativo,
    sync_automatica: row.sync_automatica != null ? !!row.sync_automatica : true,
    sync_frequencia: normalizeSyncFrequencia(row.sync_frequencia),
    ultimo_envio: row.ultimo_envio,
    ultima_sync: row.ultima_sync,
  };
}

function mapSyncLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo_unidade: row.tipo_unidade,
    executado_em: row.executado_em,
    linhas_lidas: row.linhas_lidas,
    linhas_gravadas: row.linhas_gravadas,
    status: row.status,
    erro: row.erro,
    duracao_ms: row.duracao_ms,
  };
}

async function getConfig() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM camarotes_config WHERE id = 1 LIMIT 1');
  return mapConfig(rows[0]);
}

async function updateConfig(data) {
  const pool = getPool();
  await pool.execute(
    `UPDATE camarotes_config SET
      emails_alerta = ?,
      dias_vence_breve = ?,
      cadencia = ?,
      envio_ativo = ?,
      sync_automatica = ?,
      sync_frequencia = ?
     WHERE id = 1`,
    [
      JSON.stringify(data.emails_alerta || []),
      data.dias_vence_breve ?? 90,
      data.cadencia === 'semanal' ? 'semanal' : 'diaria',
      data.envio_ativo ? 1 : 0,
      data.sync_automatica !== false ? 1 : 0,
      normalizeSyncFrequencia(data.sync_frequencia),
    ]
  );
  return getConfig();
}

async function touchUltimaSync() {
  const pool = getPool();
  await pool.execute('UPDATE camarotes_config SET ultima_sync = CURRENT_TIMESTAMP WHERE id = 1');
}

async function touchUltimoEnvio() {
  const pool = getPool();
  await pool.execute('UPDATE camarotes_config SET ultimo_envio = CURRENT_TIMESTAMP WHERE id = 1');
}

async function replaceUnidadesByTipo(tipoUnidade, unidades) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM camarotes_unidades WHERE tipo_unidade = ?', [tipoUnidade]);

    if (unidades.length) {
      const cols = [
        'tipo_unidade', 'andar', 'setor', 'numero', 'capacidade', 'cessionario',
        'tipo_cessionario', 'primeira_locacao', 'inicio_locacao', 'final_locacao',
        'tempo_anos', 'tempo_meses', 'valor_total', 'valor_cessao', 'valor_anual',
        'entrada', 'valor_parcelado', 'valor_vagas', 'qtd_parcelas', 'vagas_vvip',
        'credencial_staff', 'categorias_staff', 'pack30', 'status_contrato',
      ];
      const placeholders = unidades
        .map(() => `(${cols.map(() => '?').join(',')})`)
        .join(',');
      const params = [];
      for (const u of unidades) {
        params.push(
          u.tipo_unidade,
          u.andar,
          u.setor,
          u.numero,
          u.capacidade,
          u.cessionario,
          u.tipo_cessionario,
          u.primeira_locacao,
          u.inicio_locacao,
          u.final_locacao,
          u.tempo_anos,
          u.tempo_meses,
          u.valor_total,
          u.valor_cessao,
          u.valor_anual,
          u.entrada,
          u.valor_parcelado,
          u.valor_vagas,
          u.qtd_parcelas,
          u.vagas_vvip,
          u.credencial_staff,
          u.categorias_staff,
          u.pack30 ? 1 : 0,
          u.status_contrato
        );
      }
      await conn.execute(
        `INSERT INTO camarotes_unidades (${cols.join(',')}) VALUES ${placeholders}`,
        params
      );
    }

    await conn.commit();
    return unidades.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function insertSyncLog(entry) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO camarotes_sync
      (tipo_unidade, linhas_lidas, linhas_gravadas, status, erro, duracao_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      entry.tipo_unidade,
      entry.linhas_lidas,
      entry.linhas_gravadas,
      entry.status,
      entry.erro || null,
      entry.duracao_ms,
    ]
  );
  return result.insertId;
}

async function listSyncLog(limit = 20) {
  const pool = getPool();
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await pool.query(
    `SELECT * FROM camarotes_sync ORDER BY executado_em DESC LIMIT ${lim}`
  );
  return rows.map(mapSyncLog);
}

async function listUnidades({ tipo, setor, situacao } = {}, diasVenceBreve = 90) {
  const pool = getPool();
  const conditions = [];
  const params = [diasVenceBreve];

  if (tipo === 'camarote' || tipo === 'lounge') {
    conditions.push('tipo_unidade = ?');
    params.push(tipo);
  }
  if (setor?.trim()) {
    conditions.push('setor = ?');
    params.push(setor.trim());
  }
  if (situacao) {
    conditions.push(`${sqlSituacaoExpr('')} = ?`);
    params.push(diasVenceBreve, situacao);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.execute(
    `SELECT *, ${sqlSituacaoExpr('')} AS situacao
     FROM camarotes_unidades ${where}
     ORDER BY tipo_unidade, setor, numero`,
    params
  );

  return rows.map((r) => mapUnidade(r));
}

async function fetchAllUnidades(diasVenceBreve = 90) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT *, ${sqlSituacaoExpr('')} AS situacao
     FROM camarotes_unidades
     ORDER BY tipo_unidade, numero`,
    [diasVenceBreve]
  );
  return rows.map((r) => mapUnidade(r));
}

function agruparPorSetor(unidades, tipo) {
  const setores = ['Oeste', 'Norte', 'Leste', 'Sul'];
  const filtradas = unidades.filter((u) => u.tipo_unidade === tipo && u.situacao === 'vago');
  const porSetor = {};
  for (const s of setores) {
    const nums = filtradas
      .filter((u) => String(u.setor || '').toLowerCase() === s.toLowerCase())
      .map((u) => u.numero)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    porSetor[s] = { numeros: nums, total: nums.length };
  }
  return porSetor;
}

function resumoAlertas(unidades, tipo) {
  const list = unidades.filter((u) => u.tipo_unidade === tipo);
  const counts = {
    vencidos: 0,
    vence_breve: 0,
    vagos: 0,
    ativos: 0,
    sem_data: 0,
  };
  for (const u of list) {
    if (u.situacao === 'vencido') counts.vencidos += 1;
    else if (u.situacao === 'vence_breve') counts.vence_breve += 1;
    else if (u.situacao === 'vago') counts.vagos += 1;
    else if (u.situacao === 'ativo') counts.ativos += 1;
    if (!u.final_locacao && u.cessionario) counts.sem_data += 1;
  }
  return counts;
}

function metricasFinanceiras(unidades, tipo) {
  const ativos = unidades.filter(
    (u) => u.tipo_unidade === tipo && u.situacao === 'ativo' && u.cessionario
  );
  const receitaAnual = ativos.reduce((s, u) => s + (u.valor_anual || 0), 0);
  const valorTotalContratos = ativos.reduce((s, u) => s + (u.valor_total || 0), 0);
  const capacidadeTotal = ativos.reduce((s, u) => s + (u.capacidade || 0), 0);
  const qtd = ativos.length || 0;
  return {
    receita_anual: Math.round(receitaAnual * 100) / 100,
    ticket_medio_anual: qtd ? Math.round((receitaAnual / qtd) * 100) / 100 : 0,
    valor_medio_contrato: qtd ? Math.round((valorTotalContratos / qtd) * 100) / 100 : 0,
    capacidade_total: capacidadeTotal,
    media_por_unidade: qtd && capacidadeTotal ? Math.round((capacidadeTotal / qtd) * 10) / 10 : 0,
    qtd_ativos: qtd,
  };
}

function normalizarTipoCessionario(valor) {
  const s = String(valor || '').toLowerCase();
  if (s.includes('patroc')) return 'Patrocinador';
  if (s.includes('sep')) return 'SEP';
  if (s.includes('cess')) return 'Cessionário';
  return null;
}

function tipoCessionarioBreakdown(unidades, tipo) {
  const list = unidades.filter((u) => u.tipo_unidade === tipo && u.cessionario);
  const tipos = ['Cessionário', 'Patrocinador', 'SEP'];
  const resumo = {};
  for (const t of tipos) {
    resumo[t] = { quantidade: 0, valor_total: 0 };
  }
  for (const u of list) {
    const key = normalizarTipoCessionario(u.tipo_cessionario) || 'Outros';
    if (!resumo[key]) resumo[key] = { quantidade: 0, valor_total: 0 };
    resumo[key].quantidade += 1;
    resumo[key].valor_total += u.valor_total || 0;
  }
  for (const k of Object.keys(resumo)) {
    resumo[k].valor_total = Math.round(resumo[k].valor_total * 100) / 100;
  }
  const porAndar = {};
  for (const u of list) {
    const andar = u.andar || 'Sem andar';
    if (!porAndar[andar]) porAndar[andar] = {};
    const key = u.tipo_cessionario || 'Outros';
    if (!porAndar[andar][key]) porAndar[andar][key] = 0;
    porAndar[andar][key] += 1;
  }
  return { resumo, por_andar: porAndar };
}

function pack30Resumo(unidades, tipo) {
  const list = unidades.filter((u) => u.tipo_unidade === tipo && u.cessionario);
  return {
    com_pack30: list.filter((u) => u.pack30).length,
    sem_pack30: list.filter((u) => !u.pack30).length,
  };
}

function vagasVvipResumo(unidades, tipo) {
  const list = unidades.filter((u) => u.tipo_unidade === tipo && u.cessionario);
  return {
    total_vagas: list.reduce((s, u) => s + (u.vagas_vvip || 0), 0),
    valor_total: Math.round(list.reduce((s, u) => s + (u.valor_vagas || 0), 0) * 100) / 100,
  };
}

async function fetchVencimentosMensais() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(final_locacao, '%Y-%m') AS ym, COUNT(*) AS qtd
     FROM camarotes_unidades
     WHERE tipo_unidade = ?
       AND ${OCUPADO}
       AND final_locacao IS NOT NULL
       AND final_locacao >= CURDATE()
       AND final_locacao < DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY ym
     ORDER BY ym`,
    [TIPO_CAMAROTE]
  );
  return rows;
}

async function fetchVencimentosEscalares() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       COALESCE(SUM(final_locacao < CURDATE()), 0) AS vencidos,
       COALESCE(SUM(final_locacao >= DATE_ADD(CURDATE(), INTERVAL 12 MONTH)), 0) AS apos_12m,
       DATE_FORMAT(CURDATE(), '%Y-%m') AS ym_atual,
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS ref_hoje,
       DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 12 MONTH), '%Y-%m-%d') AS ref_limite_12m,
       DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 90 DAY), '%Y-%m-%d') AS limite_breve
     FROM camarotes_unidades
     WHERE tipo_unidade = ?
       AND ${OCUPADO}
       AND final_locacao IS NOT NULL`,
    [TIPO_CAMAROTE]
  );
  return rows[0] || {};
}

async function fetchReceitaRenovarTrimestres() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT YEAR(final_locacao) AS ano, QUARTER(final_locacao) AS tri,
            SUM(valor_anual) AS valor
     FROM camarotes_unidades
     WHERE tipo_unidade = ?
       AND ${OCUPADO}
       AND valor_anual IS NOT NULL
       AND final_locacao IS NOT NULL
       AND final_locacao >= CURDATE()
       AND final_locacao < DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
     GROUP BY ano, tri
     ORDER BY ano, tri`,
    [TIPO_CAMAROTE]
  );
  return rows;
}

async function fetchReceitaRenovarTotais() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN final_locacao >= CURDATE()
                          AND final_locacao < DATE_ADD(CURDATE(), INTERVAL 12 MONTH)
                         THEN valor_anual ELSE 0 END), 0) AS total_12m,
       COALESCE(SUM(CASE WHEN final_locacao < CURDATE() THEN valor_anual ELSE 0 END), 0) AS vencida
     FROM camarotes_unidades
     WHERE tipo_unidade = ?
       AND ${OCUPADO}
       AND valor_anual IS NOT NULL
       AND final_locacao IS NOT NULL`,
    [TIPO_CAMAROTE]
  );
  return rows[0] || {};
}

function montarVencimentos(rowsMensais, escalares) {
  const ymAtual = escalares.ym_atual;
  const limiteBreve = escalares.limite_breve;
  const porYm = {};
  for (const row of rowsMensais) {
    porYm[row.ym] = toNum(row.qtd);
  }

  const meses = [];
  for (let i = 0; i < 12; i += 1) {
    const ym = addMonthsYm(ymAtual, i);
    meses.push({
      ym,
      label: labelMesFromYm(ym),
      qtd: porYm[ym] ?? 0,
      venceBreve: `${ym}-01` <= limiteBreve,
    });
  }

  return {
    vencidos: toNum(escalares.vencidos),
    apos12m: toNum(escalares.apos_12m),
    refHoje: escalares.ref_hoje,
    refLimite12m: escalares.ref_limite_12m,
    meses,
  };
}

function montarReceitaRenovar(rowsTri, totais) {
  const trimestres = rowsTri
    .map((row) => {
      const ano = toNum(row.ano);
      const tri = toNum(row.tri);
      const valor = roundMoney(row.valor);
      if (valor <= 0) return null;
      const anoCurto = String(ano % 100).padStart(2, '0');
      return { label: `${tri}T/${anoCurto}`, ano, tri, valor };
    })
    .filter(Boolean);

  return {
    total12m: roundMoney(totais.total_12m),
    vencida: roundMoney(totais.vencida),
    trimestres,
  };
}

async function buildDashboard() {
  const config = await getConfig();
  const dias = config?.dias_vence_breve ?? 90;

  const [unidades, rowsMensais, escalares, rowsTri, totais] = await Promise.all([
    fetchAllUnidades(dias),
    fetchVencimentosMensais(),
    fetchVencimentosEscalares(),
    fetchReceitaRenovarTrimestres(),
    fetchReceitaRenovarTotais(),
  ]);

  const camarotes = unidades.filter((u) => u.tipo_unidade === TIPO_CAMAROTE);
  const alertas = resumoAlertas(camarotes, TIPO_CAMAROTE);
  const vencimentos = montarVencimentos(rowsMensais, escalares);
  const receitaRenovar = montarReceitaRenovar(rowsTri, totais);

  if (vencimentos.vencidos !== alertas.vencidos) {
    throw new Error(
      `Inconsistência vencimentos: timeline=${vencimentos.vencidos}, alertas=${alertas.vencidos}`
    );
  }

  return {
    ultima_sync: config?.ultima_sync || null,
    dias_vence_breve: dias,
    camarotes: {
      disponiveis_por_setor: agruparPorSetor(camarotes, TIPO_CAMAROTE),
      alertas,
      metricas: metricasFinanceiras(camarotes, TIPO_CAMAROTE),
      tipo_cessionario: tipoCessionarioBreakdown(camarotes, TIPO_CAMAROTE),
      pack30: pack30Resumo(camarotes, TIPO_CAMAROTE),
      vagas_vvip: vagasVvipResumo(camarotes, TIPO_CAMAROTE),
    },
    vencimentos,
    receitaRenovar,
  };
}

async function isVisualizador(usuarioId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT 1 FROM camarotes_visualizadores WHERE usuario_id = ? LIMIT 1',
    [usuarioId]
  );
  return rows.length > 0;
}

async function listVisualizadores() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT v.usuario_id, v.criado_em, u.nome_completo, u.email, u.departamento
     FROM camarotes_visualizadores v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     ORDER BY u.nome_completo`
  );
  return rows.map((row) => ({
    usuario_id: row.usuario_id,
    nome_completo: row.nome_completo,
    email: row.email,
    departamento: row.departamento,
    criado_em: row.criado_em,
  }));
}

async function addVisualizador(usuarioId, criadoPor = null) {
  const pool = getPool();
  await pool.execute(
    `INSERT IGNORE INTO camarotes_visualizadores (usuario_id, criado_por) VALUES (?, ?)`,
    [usuarioId, criadoPor]
  );
  const [rows] = await pool.execute(
    `SELECT v.usuario_id, v.criado_em, u.nome_completo, u.email, u.departamento
     FROM camarotes_visualizadores v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.usuario_id = ?`,
    [usuarioId]
  );
  return rows[0]
    ? {
        usuario_id: rows[0].usuario_id,
        nome_completo: rows[0].nome_completo,
        email: rows[0].email,
        departamento: rows[0].departamento,
        criado_em: rows[0].criado_em,
      }
    : null;
}

async function removeVisualizador(usuarioId) {
  const pool = getPool();
  const [result] = await pool.execute(
    'DELETE FROM camarotes_visualizadores WHERE usuario_id = ?',
    [usuarioId]
  );
  return result.affectedRows > 0;
}

async function listUnidadesParaAlerta(diasVenceBreve) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT *, ${sqlSituacaoExpr('')} AS situacao
     FROM camarotes_unidades
     WHERE tipo_unidade = 'camarote'
       AND TRIM(COALESCE(cessionario, '')) <> ''
       AND ${sqlSituacaoExpr('')} IN ('vencido', 'vence_breve')
     ORDER BY final_locacao, numero`,
    [diasVenceBreve, diasVenceBreve]
  );
  return rows.map((r) => mapUnidade(r));
}

module.exports = {
  getConfig,
  updateConfig,
  touchUltimaSync,
  touchUltimoEnvio,
  replaceUnidadesByTipo,
  insertSyncLog,
  listSyncLog,
  listUnidades,
  buildDashboard,
  listUnidadesParaAlerta,
  fetchAllUnidades,
  isVisualizador,
  listVisualizadores,
  addVisualizador,
  removeVisualizador,
};
