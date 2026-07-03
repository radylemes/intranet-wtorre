const EXT_PROPERTIES = ['ramal', 'dataNascimento'];

function normalizeClientId(clientId) {
  return String(clientId || '').replace(/-/g, '').toLowerCase();
}

function extensionFieldKey(clientId, propertyName) {
  return `extension_${normalizeClientId(clientId)}_${propertyName}`;
}

function getExtensionSelectFields(clientId) {
  return EXT_PROPERTIES.map((prop) => extensionFieldKey(clientId, prop));
}

function extractDirectoryExtension(user, clientId) {
  if (!user || !clientId) {
    return { ramal: null, dataNascimento: null };
  }

  const ramalKey = extensionFieldKey(clientId, 'ramal');
  const nascKey = extensionFieldKey(clientId, 'dataNascimento');

  const ramalRaw = user[ramalKey];
  const nascRaw = user[nascKey];

  return {
    ramal: ramalRaw != null && String(ramalRaw).trim() ? String(ramalRaw).trim() : null,
    dataNascimento:
      nascRaw != null && String(nascRaw).trim() ? String(nascRaw).trim() : null,
  };
}

function formatNascimentoForExtension(dia, mes, ano) {
  if (dia == null || mes == null) return null;
  const d = String(dia).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  if (ano != null && Number(ano) > 0) {
    return `${d}/${m}/${Number(ano)}`;
  }
  return `${d}/${m}`;
}

function formatNascimentoFromColaborador(c) {
  if (!c) return null;
  return formatNascimentoForExtension(c.nasc_dia, c.nasc_mes, c.nasc_ano);
}

function parseAniversarioInput(value) {
  if (value == null || String(value).trim() === '') {
    return { dia: null, mes: null, ano: null, dataNascimento: null };
  }

  const trimmed = String(value).trim().split(/\s+/)[0];
  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) {
    return { error: 'Aniversário inválido. Use DD/MM ou DD/MM/AAAA.' };
  }

  let dia = Number(m[1]);
  let mes = Number(m[2]);
  // Excel costuma exportar MM/DD/AAAA; se o "mês" passar de 12, interpretar como formato US.
  if (mes > 12 && dia <= 12) {
    [dia, mes] = [mes, dia];
  }
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    return { error: 'Aniversário inválido. Dia ou mês fora do intervalo.' };
  }

  let ano = m[3] ? Number(m[3]) : null;
  if (ano != null && m[3].length === 2) {
    ano = null;
  }

  return {
    dia,
    mes,
    ano,
    dataNascimento: formatNascimentoForExtension(dia, mes, ano),
  };
}

function buildExtensionPatch(clientId, { ramal, dataNascimento } = {}) {
  const patch = {};
  if (!clientId) return patch;

  if (ramal !== undefined) {
    patch[extensionFieldKey(clientId, 'ramal')] = ramal || null;
  }
  if (dataNascimento !== undefined) {
    patch[extensionFieldKey(clientId, 'dataNascimento')] = dataNascimento || null;
  }

  return patch;
}

function extractOnPremLegacy(user) {
  const oea = user?.onPremisesExtensionAttributes || {};
  return {
    extensionAttribute5: (oea.extensionAttribute5 || '').trim() || null,
    extensionAttribute6: (oea.extensionAttribute6 || '').trim() || null,
  };
}

function buildUserSelect(clientId) {
  const base =
    'id,displayName,givenName,surname,employeeId,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones,companyName,accountEnabled,userType,onPremisesExtensionAttributes';
  const extFields = getExtensionSelectFields(clientId);
  if (!extFields.length) return base;
  return `${base},${extFields.join(',')}`;
}

module.exports = {
  EXT_PROPERTIES,
  extensionFieldKey,
  getExtensionSelectFields,
  buildUserSelect,
  extractDirectoryExtension,
  formatNascimentoForExtension,
  formatNascimentoFromColaborador,
  parseAniversarioInput,
  buildExtensionPatch,
  extractOnPremLegacy,
};
