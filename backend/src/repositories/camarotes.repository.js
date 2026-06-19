const { getPool } = require('../db/pool');
const { sqlSituacaoExpr } = require('../utils/camarotes-situacao.util');

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

function mapConfig(row) {
  if (!row) return null;
  return {
    id: row.id,
    emails_alerta: parseEmails(row.emails_alerta),
    dias_vence_breve: row.dias_vence_breve,
    cadencia: row.cadencia,
    envio_ativo: !!row.envio_ativo,
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
      envio_ativo = ?
     WHERE id = 1`,
    [
      JSON.stringify(data.emails_alerta || []),
      data.dias_vence_breve ?? 90,
      data.cadencia === 'semanal' ? 'semanal' : 'diaria',
      data.envio_ativo ? 1 : 0,
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
  const [rows] = await pool.execute(
    'SELECT * FROM camarotes_sync ORDER BY executado_em DESC LIMIT ?',
    [lim]
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

async function buildDashboard() {
  const config = await getConfig();
  const dias = config?.dias_vence_breve ?? 90;
  const unidades = await fetchAllUnidades(dias);
  const camarotes = unidades.filter((u) => u.tipo_unidade === 'camarote');

  return {
    ultima_sync: config?.ultima_sync || null,
    dias_vence_breve: dias,
    camarotes: {
      disponiveis_por_setor: agruparPorSetor(camarotes, 'camarote'),
      alertas: resumoAlertas(camarotes, 'camarote'),
      metricas: metricasFinanceiras(camarotes, 'camarote'),
      tipo_cessionario: tipoCessionarioBreakdown(camarotes, 'camarote'),
      pack30: pack30Resumo(camarotes, 'camarote'),
      vagas_vvip: vagasVvipResumo(camarotes, 'camarote'),
    },
  };
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
};
