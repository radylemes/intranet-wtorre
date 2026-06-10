function extractEmailDomain(email) {
  if (!email) return null;
  const at = String(email).lastIndexOf('@');
  if (at < 0) return null;
  const domain = String(email)
    .slice(at + 1)
    .toLowerCase()
    .trim();
  return domain || null;
}

function resolveEmpresaFromEmail(email, dominioMap) {
  const domain = extractEmailDomain(email);
  if (!domain || !dominioMap) return null;
  const entry = dominioMap.get(domain);
  return entry ? entry.empresa : null;
}

function isPersonUser(user) {
  if (!user || user.accountEnabled !== true) return false;
  if (user.userType === 'Guest') return false;

  const nome = user.displayName && String(user.displayName).trim();
  if (!nome) return false;

  const mail = user.mail && String(user.mail).trim();
  const upn = user.userPrincipalName && String(user.userPrincipalName).trim();
  if (!mail && !upn) return false;

  const dept = user.department && String(user.department).trim();
  if (!dept) return false;

  return true;
}

function parseNascimento(s) {
  if (!s) return { dia: null, mes: null, ano: null };
  const m = String(s).match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (!m) return { dia: null, mes: null, ano: null };
  const dia = +m[1];
  const mes = +m[2];
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return { dia: null, mes: null, ano: null };
  let ano = m[3] ? +m[3] : null;
  if (ano && String(m[3]).length !== 4) ano = null;
  return { dia, mes, ano };
}

function resolveContatosFixos(user) {
  const oea = user.onPremisesExtensionAttributes || {};
  const ext5 = (oea.extensionAttribute5 || '').trim();
  const bp =
    user.businessPhones && user.businessPhones[0]
      ? String(user.businessPhones[0]).trim()
      : '';
  const bpDigits = bp.replace(/\D/g, '');
  const bpEhCurto = /^\d{3,6}$/.test(bp);
  const bpEhCompleto = /[ \-+().]/.test(bp) || bpDigits.length >= 8;

  const ramal = ext5 || (bpEhCurto ? bp : null);
  const telefone_fixo = bpEhCompleto ? bp : null;
  const nasc = parseNascimento(oea.extensionAttribute6);

  return {
    ramal: ramal || null,
    telefone_fixo,
    nasc_dia: nasc.dia,
    nasc_mes: nasc.mes,
    nasc_ano: nasc.ano,
  };
}

function mapUserToColaborador(user, tenant, dominioMap) {
  const mail = user.mail && String(user.mail).trim();
  const upn = user.userPrincipalName && String(user.userPrincipalName).trim();
  const email = mail || upn || null;
  const contatos = resolveContatosFixos(user);

  return {
    ad_id: user.id,
    tenant_id: tenant.id,
    empresa: resolveEmpresaFromEmail(email, dominioMap),
    nome: String(user.displayName).trim(),
    cargo: user.jobTitle ? String(user.jobTitle).trim() : null,
    departamento: String(user.department).trim(),
    email,
    celular: user.mobilePhone ? String(user.mobilePhone).trim() : null,
    ramal: contatos.ramal,
    telefone_fixo: contatos.telefone_fixo,
    nasc_dia: contatos.nasc_dia,
    nasc_mes: contatos.nasc_mes,
    nasc_ano: contatos.nasc_ano,
    tem_foto: null,
    ativo: 1,
  };
}

function filterAndMapUsers(users, tenant, dominioMap) {
  let ignorados = 0;
  const mapped = [];

  for (const user of users) {
    if (!isPersonUser(user)) {
      ignorados += 1;
      continue;
    }
    mapped.push(mapUserToColaborador(user, tenant, dominioMap));
  }

  return { mapped, ignorados };
}

module.exports = {
  extractEmailDomain,
  resolveEmpresaFromEmail,
  isPersonUser,
  parseNascimento,
  resolveContatosFixos,
  mapUserToColaborador,
  filterAndMapUsers,
};
