const bidConfigService = require('./bid-config.service');
const colaboradoresRepo = require('../repositories/colaboradores.repository');
const bidSyncRepo = require('../repositories/bid-sync.repository');
const { fetchBidJson } = require('./bid-api.client');

function invalidarCache() {
  const { reagendarSyncBid } = require('./bid-cron.service');
  reagendarSyncBid().catch((err) => {
    console.error('[bid] Falha ao reagendar sync:', err.message);
  });
}

function normalizeOid(oid) {
  return String(oid || '').trim().toLowerCase();
}

async function carregarSnapshot({ ignorarCache = false } = {}) {
  const snapshot = await bidSyncRepo.getSnapshot();

  if (snapshot?.payload_eventos && snapshot?.payload_usuarios) {
    return snapshot;
  }

  if (ignorarCache) {
    const err = new Error('Nenhum snapshot BID disponível. Execute a sincronização.');
    err.status = 503;
    throw err;
  }

  const err = new Error('Dados BID ainda não sincronizados. Aguarde alguns instantes.');
  err.status = 503;
  throw err;
}

function listarUsuarios(usuariosPayload) {
  return Array.isArray(usuariosPayload?.usuarios) ? usuariosPayload.usuarios : [];
}

function resolverUsuarioBidPorIdentidade(user, usuariosPayload, emailsCandidatos) {
  const usuarios = listarUsuarios(usuariosPayload);
  const oid = normalizeOid(user?.microsoft_id);

  if (oid) {
    const porOid = usuarios.find((u) => normalizeOid(u.microsoft_id) === oid);
    if (porOid) return porOid;
  }

  const candidatos = [
    ...new Set(
      (Array.isArray(emailsCandidatos) ? emailsCandidatos : [emailsCandidatos])
        .map(normalizeEmail)
        .filter(Boolean)
    ),
  ];
  if (!candidatos.length) return null;

  for (const email of candidatos) {
    const usuario = usuarios.find((u) => normalizeEmail(u.email) === email);
    if (usuario) return usuario;
  }

  const localParts = new Set(candidatos.map(localPartEmail).filter(Boolean));
  for (const usuario of usuarios) {
    const lp = localPartEmail(usuario.email);
    if (lp && localParts.has(lp)) {
      return usuario;
    }
  }

  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function localPartEmail(email) {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf('@');
  return at > 0 ? normalized.slice(0, at) : normalized;
}

async function coletarEmailsCandidatos(user) {
  const emails = new Set();
  const principal = normalizeEmail(user?.email);
  if (principal) emails.add(principal);

  if (user?.microsoft_id) {
    const colab = await colaboradoresRepo.findAdminByAdId(user.microsoft_id);
    if (colab?.email) emails.add(normalizeEmail(colab.email));
  }

  if (principal) {
    const colab = await colaboradoresRepo.findAdminByEmail(principal);
    if (colab?.email) emails.add(normalizeEmail(colab.email));
  }

  return [...emails].filter(Boolean);
}

function resolverGrupoIdUsuario(usuariosPayload, emailsCandidatos) {
  const candidatos = [
    ...new Set(
      (Array.isArray(emailsCandidatos) ? emailsCandidatos : [emailsCandidatos])
        .map(normalizeEmail)
        .filter(Boolean)
    ),
  ];
  if (!candidatos.length) return null;

  const usuarios = Array.isArray(usuariosPayload?.usuarios) ? usuariosPayload.usuarios : [];

  for (const email of candidatos) {
    const usuario = usuarios.find((u) => normalizeEmail(u.email) === email);
    if (usuario) return usuario.grupo_id ?? null;
  }

  const localParts = new Set(candidatos.map(localPartEmail).filter(Boolean));
  for (const usuario of usuarios) {
    const lp = localPartEmail(usuario.email);
    if (lp && localParts.has(lp)) {
      return usuario.grupo_id ?? null;
    }
  }

  return null;
}

function eventoVisivelParaUsuario(evento, grupoIdUsuario) {
  if (evento.grupo_id == null) return true;
  if (grupoIdUsuario == null) return false;
  return evento.grupo_id === grupoIdUsuario;
}

function buildCtaUrl(appUrl) {
  const base = String(appUrl || 'https://bid.nubankparque.com').replace(/\/+$/, '');
  return `${base}/`;
}

const TZ_SAO_PAULO = 'America/Sao_Paulo';

function diaEmSaoPaulo(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_SAO_PAULO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isMesCorrente(iso) {
  if (!iso) return false;
  const opts = { timeZone: TZ_SAO_PAULO, year: 'numeric', month: '2-digit' };
  const alvo = new Intl.DateTimeFormat('en-CA', opts).format(new Date(iso));
  const hoje = new Intl.DateTimeFormat('en-CA', opts).format(new Date());
  return alvo === hoje;
}

function isUltimos30Dias(iso) {
  if (!iso) return false;
  const eventoDia = diaEmSaoPaulo(iso);
  if (!eventoDia) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  const limiteDia = diaEmSaoPaulo(limite);
  return eventoDia >= limiteDia;
}

/** Mês corrente OU últimos 30 dias (fuso SP). */
function eventoNoPeriodoVisivel(iso) {
  return isMesCorrente(iso) || isUltimos30Dias(iso);
}

/** Encerrados visíveis: data_jogo no mês corrente OU nos últimos 30 dias (fuso SP). */
function eventoNoPeriodoCarrossel(iso) {
  return eventoNoPeriodoVisivel(iso);
}

function mapEventoParaCarrossel(evento, appUrl, situacao) {
  const base = {
    id: evento.id,
    titulo: evento.titulo,
    subtitulo: evento.subtitulo ?? null,
    local: evento.local ?? null,
    imagem_url: evento.imagem_url ?? null,
    data_jogo: evento.data_jogo ?? null,
    data_limite_aposta: evento.data_limite_aposta ?? null,
    quantidade_premios: evento.quantidade_premios ?? 0,
    setor_evento_nome: evento.setor_evento_nome ?? null,
    grupo_id: evento.grupo_id ?? null,
    nome_grupo: evento.nome_grupo ?? null,
    situacao,
    cta_url: buildCtaUrl(appUrl),
  };

  if (situacao === 'encerrada') {
    return {
      ...base,
      total_apostas: evento.total_apostas ?? 0,
      total_participantes: evento.total_participantes ?? 0,
    };
  }

  return base;
}

function prioridadeSituacaoCarrossel(situacao) {
  if (situacao === 'vencedor') return 0;
  if (situacao === 'aberta') return 1;
  return 2;
}

function ordenarEventosCarrossel(a, b) {
  const pa = prioridadeSituacaoCarrossel(a.situacao);
  const pb = prioridadeSituacaoCarrossel(b.situacao);
  if (pa !== pb) return pa - pb;

  if (a.situacao === 'vencedor' && b.situacao === 'vencedor') {
    const da = a.data_apuracao ? Date.parse(a.data_apuracao) : 0;
    const db = b.data_apuracao ? Date.parse(b.data_apuracao) : 0;
    return db - da;
  }

  const da = a.data_jogo ? Date.parse(a.data_jogo) : 0;
  const db = b.data_jogo ? Date.parse(b.data_jogo) : 0;
  return da - db;
}

function mesclarEventosVencedorNoCarrossel(eventos, eventosVencedor) {
  const porId = new Map(eventos.map((ev) => [ev.id, ev]));
  for (const ev of eventosVencedor) {
    porId.set(ev.id, ev);
  }
  return [...porId.values()].sort(ordenarEventosCarrossel);
}

async function getEventosAbertosParaUsuario(user, { ignorarCache = false } = {}) {
  const config = await bidConfigService.getInternalConfig({ requireActive: true });
  const emailsCandidatos = await coletarEmailsCandidatos(user);

  if (!emailsCandidatos.length) {
    return { gerado_em: new Date().toISOString(), eventos: [] };
  }

  const snapshot = await carregarSnapshot({ ignorarCache });
  const eventosPayload = snapshot.payload_eventos;
  const usuariosPayload = snapshot.payload_usuarios;

  const usuarioBid = resolverUsuarioBidPorIdentidade(user, usuariosPayload, emailsCandidatos);
  const grupoIdUsuario = usuarioBid?.grupo_id ?? resolverGrupoIdUsuario(usuariosPayload, emailsCandidatos);
  const abertos = Array.isArray(eventosPayload?.bids?.abertos) ? eventosPayload.bids.abertos : [];
  const encerrados = Array.isArray(eventosPayload?.bids?.encerrados)
    ? eventosPayload.bids.encerrados
    : [];

  const eventosAbertos = abertos
    .filter((ev) => eventoVisivelParaUsuario(ev, grupoIdUsuario))
    .map((ev) => mapEventoParaCarrossel(ev, config.app_url, 'aberta'));

  const eventosEncerrados = encerrados
    .filter((ev) => eventoVisivelParaUsuario(ev, grupoIdUsuario) && eventoNoPeriodoCarrossel(ev.data_jogo))
    .map((ev) => mapEventoParaCarrossel(ev, config.app_url, 'encerrada'));

  let eventos = [...eventosAbertos, ...eventosEncerrados];

  if (usuarioBid || emailsCandidatos.length) {
    const nomesCandidatos = await coletarNomesCandidatos(user);
    const paresVencedor = resolverVencedoresDoUsuario({
      eventosPayload,
      usuariosPayload,
      user,
      usuarioBid,
      emailsCandidatos,
      nomesCandidatos,
    });
    const eventosVencedor = paresVencedor.map(({ evento, vencedor }) =>
      mapEventoVencedorParaCarrossel(evento, vencedor, config.app_url)
    );
    eventos = mesclarEventosVencedorNoCarrossel(eventos, eventosVencedor);
  } else {
    eventos = eventos.sort(ordenarEventosCarrossel);
  }

  return {
    gerado_em: eventosPayload?.gerado_em || new Date().toISOString(),
    eventos,
  };
}

function normalizeNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

async function coletarNomesCandidatos(user) {
  const nomes = new Set();
  const principal = normalizeNome(user?.nome_completo);
  if (principal) nomes.add(principal);

  if (user?.microsoft_id) {
    const colab = await colaboradoresRepo.findAdminByAdId(user.microsoft_id);
    const nomeColab = normalizeNome(colab?.nome);
    if (nomeColab) nomes.add(nomeColab);
  }

  const emailPrincipal = normalizeEmail(user?.email);
  if (emailPrincipal) {
    const colab = await colaboradoresRepo.findAdminByEmail(emailPrincipal);
    const nomeColab = normalizeNome(colab?.nome);
    if (nomeColab) nomes.add(nomeColab);
  }

  return [...nomes].filter(Boolean);
}

function resolverUsuarioBid(usuariosPayload, emailsCandidatos) {
  return resolverUsuarioBidPorIdentidade({ microsoft_id: null }, usuariosPayload, emailsCandidatos);
}

function detectarNomesAmbiguos(usuarios) {
  const contagem = new Map();
  for (const usuario of usuarios) {
    const nomeNorm = normalizeNome(usuario?.nome_completo);
    if (!nomeNorm) continue;
    contagem.set(nomeNorm, (contagem.get(nomeNorm) || 0) + 1);
  }

  const ambiguos = new Set();
  for (const [nome, count] of contagem) {
    if (count > 1) ambiguos.add(nome);
  }
  return ambiguos;
}

function nomeAmbiguoEmUsuarios(usuarios, nomeNorm) {
  if (!nomeNorm) return false;
  let count = 0;
  for (const usuario of usuarios) {
    if (normalizeNome(usuario?.nome_completo) === nomeNorm) {
      count += 1;
      if (count > 1) return true;
    }
  }
  return false;
}

function vencedorPertenceAoUsuario(vencedor, ctx) {
  const { user, usuarioBid, emailsCandidatos, nomesCandidatos, usuarios } = ctx;

  const oidUsuario = normalizeOid(user?.microsoft_id);
  const oidVencedor = normalizeOid(vencedor?.microsoft_id);
  if (oidUsuario && oidVencedor && oidUsuario === oidVencedor) {
    return true;
  }

  if (usuarioBid?.id != null && vencedor?.usuario_id != null && usuarioBid.id === vencedor.usuario_id) {
    return true;
  }

  const emailVencedor = normalizeEmail(vencedor?.email);
  if (emailVencedor && emailsCandidatos.some((e) => normalizeEmail(e) === emailVencedor)) {
    return true;
  }

  const nomeVencedor = normalizeNome(vencedor?.nome);
  if (!nomeVencedor) return false;
  if (nomeAmbiguoEmUsuarios(usuarios, nomeVencedor)) {
    console.warn('[bid] Nome ambíguo em /usuarios (evento):', nomeVencedor);
    return false;
  }
  return nomesCandidatos.includes(nomeVencedor);
}

function encontrarVencedorDoUsuario(listaVencedores, ctx) {
  return listaVencedores.find((v) => vencedorPertenceAoUsuario(v, ctx)) || null;
}

function resolverVencedoresDoUsuario({
  eventosPayload,
  usuariosPayload,
  user,
  usuarioBid,
  emailsCandidatos,
  nomesCandidatos = [],
}) {
  const usuarios = listarUsuarios(usuariosPayload);
  const vencedores = Array.isArray(eventosPayload?.bids?.vencedores)
    ? eventosPayload.bids.vencedores
    : [];

  const ctx = { user, usuarioBid, emailsCandidatos, nomesCandidatos, usuarios };

  return vencedores
    .filter((ev) => eventoNoPeriodoVisivel(ev.data_apuracao))
    .map((ev) => {
      const lista = Array.isArray(ev.vencedores) ? ev.vencedores : [];
      const vencedor = encontrarVencedorDoUsuario(lista, ctx);
      return vencedor ? { evento: ev, vencedor } : null;
    })
    .filter(Boolean);
}

function mapEventoVencedorParaCarrossel(evento, vencedor, appUrl) {
  const vencedores = Array.isArray(evento.vencedores) ? evento.vencedores : [];
  const item = {
    id: evento.id,
    titulo: evento.titulo,
    subtitulo: evento.subtitulo ?? null,
    local: evento.local ?? null,
    imagem_url: evento.imagem_url ?? null,
    data_jogo: evento.data_jogo ?? null,
    data_limite_aposta: evento.data_limite_aposta ?? null,
    data_apuracao: evento.data_apuracao ?? null,
    quantidade_premios: evento.quantidade_premios ?? 0,
    setor_evento_nome: evento.setor_evento_nome ?? null,
    grupo_id: evento.grupo_id ?? null,
    nome_grupo: evento.nome_grupo ?? null,
    situacao: 'vencedor',
    lance_vencedor: vencedor.lance,
    data_aposta: vencedor.data_aposta ?? null,
    total_apostas: evento.total_apostas ?? 0,
    total_participantes: evento.total_participantes ?? 0,
    cta_url: buildCtaUrl(appUrl),
  };

  if (vencedores.length === 1 && evento.quantidade_premios != null) {
    item.quantidade_ingressos = evento.quantidade_premios;
  }

  return item;
}

function mapPremioParaUsuario(evento, vencedor, appUrl) {
  const vencedores = Array.isArray(evento.vencedores) ? evento.vencedores : [];
  const premio = {
    partida_id: evento.id,
    titulo: evento.titulo,
    subtitulo: evento.subtitulo ?? null,
    local: evento.local ?? null,
    setor_evento_nome: evento.setor_evento_nome ?? null,
    imagem_url: evento.imagem_url ?? null,
    data_jogo: evento.data_jogo ?? null,
    data_apuracao: evento.data_apuracao ?? null,
    lance: vencedor.lance,
    data_aposta: vencedor.data_aposta ?? null,
    cta_url: buildCtaUrl(appUrl),
  };

  if (vencedores.length === 1 && evento.quantidade_premios != null) {
    premio.quantidade_ingressos = evento.quantidade_premios;
  }

  return premio;
}

function ordenarPremiosPorApuracao(a, b) {
  const da = a.data_apuracao ? Date.parse(a.data_apuracao) : 0;
  const db = b.data_apuracao ? Date.parse(b.data_apuracao) : 0;
  return db - da;
}

function respostaPremiosVazia() {
  return { premios: [], gerado_em: new Date().toISOString() };
}

async function getMeusPremiosParaUsuario(user, { ignorarCache = false } = {}) {
  try {
    const config = await bidConfigService.getInternalConfig({ requireActive: true });
    if (!config.api_base_url || !config.api_key) {
      return respostaPremiosVazia();
    }

    const emailsCandidatos = await coletarEmailsCandidatos(user);
    if (!emailsCandidatos.length) {
      return respostaPremiosVazia();
    }

    let snapshot;
    try {
      snapshot = await carregarSnapshot({ ignorarCache });
    } catch (err) {
      console.error('[bid] Falha ao carregar snapshot para meus-premios:', err.message);
      return respostaPremiosVazia();
    }

    const eventosPayload = snapshot.payload_eventos;
    const usuariosPayload = snapshot.payload_usuarios;
    const usuarioBid = resolverUsuarioBidPorIdentidade(user, usuariosPayload, emailsCandidatos);

    if (!usuarioBid) {
      return {
        premios: [],
        gerado_em: eventosPayload?.gerado_em || new Date().toISOString(),
      };
    }

    const nomesCandidatos = await coletarNomesCandidatos(user);
    const paresVencedor = resolverVencedoresDoUsuario({
      eventosPayload,
      usuariosPayload,
      user,
      usuarioBid,
      emailsCandidatos,
      nomesCandidatos,
    });

    const premios = paresVencedor
      .map(({ evento, vencedor }) => mapPremioParaUsuario(evento, vencedor, config.app_url))
      .sort(ordenarPremiosPorApuracao);

    return {
      premios,
      gerado_em: eventosPayload?.gerado_em || new Date().toISOString(),
    };
  } catch (err) {
    console.error('[bid] Erro em getMeusPremiosParaUsuario:', err.message);
    return respostaPremiosVazia();
  }
}

async function testarConexao({ ignorarCache = true } = {}) {
  const config = await bidConfigService.getInternalConfig({ requireActive: false });

  if (!config.api_base_url || !config.api_key) {
    const err = new Error('Configure URL da API e chave antes de testar.');
    err.status = 400;
    throw err;
  }

  const [eventosPayload, usuariosPayload] = await Promise.all([
    fetchBidJson(config, '/api/integracao/eventos'),
    fetchBidJson(config, '/api/integracao/usuarios'),
  ]);

  const abertos = Array.isArray(eventosPayload?.bids?.abertos) ? eventosPayload.bids.abertos : [];
  const totalUsuarios = Number(usuariosPayload?.total) || usuariosPayload?.usuarios?.length || 0;

  return {
    ok: true,
    mensagem: `Conexão OK. ${abertos.length} BID(s) aberto(s), ${totalUsuarios} usuário(s) ativo(s).`,
    bids_abertos: abertos.length,
    usuarios_ativos: totalUsuarios,
    gerado_em_eventos: eventosPayload?.gerado_em || null,
    gerado_em_usuarios: usuariosPayload?.gerado_em || null,
  };
}


async function getSyncStatusPublico() {
  const snapshot = await bidSyncRepo.getSnapshot();
  const config = await bidConfigService.getPublicConfig();
  return {
    sync_automatica: config.sync_automatica ?? true,
    sync_intervalo_min: config.sync_intervalo_min ?? 15,
    ultima_sync: config.ultima_sync ?? null,
    ultima_sync_erro: config.ultima_sync_erro ?? null,
    snapshot_status: snapshot?.status ?? null,
    snapshot_sincronizado_em: snapshot?.sincronizado_em ?? null,
    gerado_em_eventos: snapshot?.gerado_em_eventos ?? null,
    gerado_em_usuarios: snapshot?.gerado_em_usuarios ?? null,
  };
}

module.exports = {
  invalidarCache,
  getEventosAbertosParaUsuario,
  getMeusPremiosParaUsuario,
  testarConexao,
  coletarEmailsCandidatos,
  coletarNomesCandidatos,
  resolverGrupoIdUsuario,
  resolverUsuarioBid,
  resolverUsuarioBidPorIdentidade,
  normalizeOid,
  vencedorPertenceAoUsuario,
  getSyncStatusPublico,
  eventoVisivelParaUsuario,
  normalizeNome,
  detectarNomesAmbiguos,
  nomeAmbiguoEmUsuarios,
  resolverVencedoresDoUsuario,
  mapEventoVencedorParaCarrossel,
  eventoNoPeriodoVisivel,
};
