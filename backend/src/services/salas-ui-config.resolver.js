const DEFAULT_DOMAIN_TO_API_LOCALIDADE = {
  'nubankparque.com': 'Allianz',
  'nubankparque.com.br': 'Allianz',
  'allianzparque.com.br': 'Allianz',
  'basecoworking.space': 'Allianz',
  'bravolive.com.br': 'Allianz',
  'novoanhangabau.com.br': 'Allianz',
  'wtentretenimento.com.br': 'Allianz',
  'wtorre.com.br': 'WTorre',
  'sendcooliving.com.br': 'WTorre',
  'waltertorre.com.br': 'WTorre',
};

const DEFAULT_UI_CONFIG = {
  tabs: [
    {
      id: 'nubankparque',
      label: 'Nubank Parque',
      domains: ['nubankparque.com', 'nubankparque.com.br', 'allianzparque.com.br'],
      logoKey: 'nubankparque',
      logoFile: null,
    },
    {
      id: 'wtorre',
      label: 'Wtorre',
      domains: ['wtorre.com.br'],
      logoKey: 'wtorre',
      logoFile: null,
    },
    {
      id: 'novoanhangabau',
      label: 'Novo Anhangabau',
      domains: ['novoanhangabau.com.br'],
      logoKey: 'novoanhangabau',
      logoFile: null,
    },
  ],
  domainToApiLocalidade: { ...DEFAULT_DOMAIN_TO_API_LOCALIDADE },
  roomTabOverrides: {},
  roomOrderByTab: {},
  roomDisplayNames: {},
};

function normalizeDomain(domain) {
  return String(domain || '')
    .trim()
    .toLowerCase();
}

function extractEmailDomain(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

function normalizeTab(tab) {
  const logoFileRaw = tab?.logoFile?.trim?.() || tab?.logoFile;
  const id = String(tab?.id || '')
    .trim()
    .toLowerCase();
  return {
    id,
    label: String(tab?.label || '').trim(),
    domains: Array.from(
      new Set((tab?.domains || []).map(normalizeDomain).filter(Boolean))
    ),
    logoKey: String(tab?.logoKey || id).trim().toLowerCase() || id,
    logoFile: logoFileRaw ? String(logoFileRaw) : null,
  };
}

function normalizeDomainMap(map) {
  const normalized = {};
  for (const [domain, localidade] of Object.entries(map || {})) {
    const key = normalizeDomain(domain);
    if (!key) continue;
    normalized[key] = String(localidade || '').trim();
  }
  return normalized;
}

function normalizeOverrides(map) {
  const normalized = {};
  for (const [email, tabId] of Object.entries(map || {})) {
    const key = String(email || '')
      .trim()
      .toLowerCase();
    const value = String(tabId || '')
      .trim()
      .toLowerCase();
    if (!key.includes('@') || !value) continue;
    normalized[key] = value;
  }
  return normalized;
}

function normalizeRoomDisplayNames(map) {
  const normalized = {};
  for (const [email, name] of Object.entries(map || {})) {
    const key = String(email || '')
      .trim()
      .toLowerCase();
    const value = String(name || '').trim();
    if (!key.includes('@') || !value) continue;
    normalized[key] = value.slice(0, 120);
  }
  return normalized;
}

function normalizeRoomOrderByTab(map, tabs) {
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const normalized = {};
  for (const [tabId, emails] of Object.entries(map || {})) {
    const key = String(tabId || '')
      .trim()
      .toLowerCase();
    if (!tabIds.has(key)) continue;
    const seen = new Set();
    const ordered = [];
    for (const email of emails || []) {
      const normalizedEmail = String(email || '')
        .trim()
        .toLowerCase();
      if (!normalizedEmail.includes('@') || seen.has(normalizedEmail)) continue;
      seen.add(normalizedEmail);
      ordered.push(normalizedEmail);
    }
    normalized[key] = ordered;
  }
  return normalized;
}

function normalizeUiConfig(input) {
  const tabs = (input?.tabs ?? DEFAULT_UI_CONFIG.tabs).map(normalizeTab);
  const domainToApiLocalidade = normalizeDomainMap(
    input?.domainToApiLocalidade ?? DEFAULT_UI_CONFIG.domainToApiLocalidade
  );
  const roomTabOverrides = normalizeOverrides(input?.roomTabOverrides ?? {});
  const roomOrderByTab = normalizeRoomOrderByTab(input?.roomOrderByTab ?? {}, tabs);
  const roomDisplayNames = normalizeRoomDisplayNames(input?.roomDisplayNames ?? {});

  return {
    tabs,
    domainToApiLocalidade,
    roomTabOverrides,
    roomOrderByTab,
    roomDisplayNames,
  };
}

function resolveApiLocalidade(emailOrDomain, config) {
  const domain = String(emailOrDomain || '').includes('@')
    ? extractEmailDomain(emailOrDomain)
    : normalizeDomain(emailOrDomain);
  if (!domain) return null;
  return config.domainToApiLocalidade[domain] ?? null;
}

function getDomainsForApiLocalidade(config, localidade) {
  const key = String(localidade || '')
    .trim()
    .toLowerCase();
  return Object.entries(config.domainToApiLocalidade)
    .filter(([, value]) => String(value).trim().toLowerCase() === key)
    .map(([domain]) => domain);
}

function belongsToApiLocalidade(email, localidade, config) {
  const allowed = getDomainsForApiLocalidade(config, localidade);
  if (!allowed.length) return true;
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return allowed.includes(domain);
}

function resolveRoomTab(email, config) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const override = config.roomTabOverrides[normalizedEmail];
  if (override) {
    const tabExists = config.tabs.some((tab) => tab.id === override);
    return { tabId: tabExists ? override : null, source: 'override' };
  }

  const domain = extractEmailDomain(normalizedEmail);
  if (!domain) return { tabId: null, source: 'unassigned' };

  const tab = config.tabs.find((entry) => entry.domains.includes(domain));
  if (!tab) return { tabId: null, source: 'unassigned' };
  return { tabId: tab.id, source: 'domain' };
}

function extractApiLocalidades(config) {
  return Array.from(
    new Set(
      Object.values(config.domainToApiLocalidade || {})
        .map((v) => String(v).trim())
        .filter(Boolean)
    )
  );
}

function inferApiLocalidadeForTab(tab, domainToApiLocalidade) {
  for (const domain of tab?.domains || []) {
    const loc = domainToApiLocalidade?.[domain];
    if (loc) return loc;
  }
  return null;
}

function buildPublicTabs(config) {
  return (config.tabs || []).map((tab) => ({
    id: tab.id,
    label: tab.label,
    localidade: inferApiLocalidadeForTab(tab, config.domainToApiLocalidade) || tab.id,
    value: tab.id,
    logoKey: tab.logoKey,
    logoFile: tab.logoFile ?? null,
    domains: tab.domains || [],
  }));
}

function validateUiConfigForSave(config) {
  const normalized = normalizeUiConfig(config);
  const tabIds = new Set();
  for (const tab of normalized.tabs) {
    if (!tab.id || !tab.label) {
      const err = new Error('Cada aba deve ter id e nome.');
      err.status = 400;
      throw err;
    }
    if (tabIds.has(tab.id)) {
      const err = new Error(`Id de aba duplicado: ${tab.id}`);
      err.status = 400;
      throw err;
    }
    tabIds.add(tab.id);
  }
  for (const tabId of Object.values(normalized.roomTabOverrides)) {
    if (!tabIds.has(tabId)) {
      const err = new Error(`Override de sala referencia aba inexistente: ${tabId}`);
      err.status = 400;
      throw err;
    }
  }
  return normalized;
}

module.exports = {
  DEFAULT_UI_CONFIG,
  normalizeUiConfig,
  resolveApiLocalidade,
  belongsToApiLocalidade,
  resolveRoomTab,
  extractApiLocalidades,
  buildPublicTabs,
  validateUiConfigForSave,
  extractEmailDomain,
};
