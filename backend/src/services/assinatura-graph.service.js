const { isEmailPermitido } = require('../utils/assinatura-domains');

const GRAPH_ME_SELECT =
  'displayName,jobTitle,mail,mobilePhone,businessPhones,proxyAddresses';

function parseSmtpAliases(proxyAddresses) {
  if (!Array.isArray(proxyAddresses)) return [];
  const aliases = [];
  for (const entry of proxyAddresses) {
    if (typeof entry !== 'string') continue;
    const match = entry.match(/^smtp:(.+)$/i);
    if (match?.[1]) {
      const email = match[1].toLowerCase();
      if (isEmailPermitido(email)) {
        aliases.push(email);
      }
    }
  }
  return [...new Set(aliases)];
}

async function fetchMeProfile(graphToken) {
  const url = `https://graph.microsoft.com/v1.0/me?$select=${GRAPH_ME_SELECT}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${graphToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || 'Falha ao consultar perfil no Microsoft Graph.';
    const error = new Error(msg);
    error.status = res.status === 401 || res.status === 403 ? 401 : 400;
    throw error;
  }

  const data = await res.json();
  const emailBruto = (data.mail || '').toLowerCase();
  const emailPrincipal = isEmailPermitido(emailBruto) ? emailBruto : '';
  let aliases = parseSmtpAliases(data.proxyAddresses);

  if (emailPrincipal && !aliases.includes(emailPrincipal)) {
    aliases = [emailPrincipal, ...aliases];
  }

  aliases = aliases.filter(isEmailPermitido);

  return {
    nome: data.displayName || '',
    cargo: data.jobTitle || '',
    emailPrincipal,
    aliases,
    telefone: Array.isArray(data.businessPhones) ? data.businessPhones[0] || '' : '',
    celular: data.mobilePhone || '',
  };
}

module.exports = { fetchMeProfile, parseSmtpAliases };
