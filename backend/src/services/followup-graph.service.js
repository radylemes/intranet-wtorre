const graphService = require('./graph.service');

function encodePathSegments(path) {
  return String(path || '')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeSitePath(sitePath) {
  let p = String(sitePath || '').trim();
  if (!p) return '';
  if (!p.startsWith('/')) p = `/${p}`;
  return p.replace(/\/+$/, '') || '/';
}

async function graphGet(token, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Falha Graph (${res.status})`);
    err.status = res.status === 404 ? 404 : res.status === 403 ? 403 : 502;
    err.graphCode = data.error?.code || null;
    throw err;
  }
  return data;
}

async function resolveSite(token, hostname, sitePath) {
  const host = String(hostname || '').trim();
  const path = normalizeSitePath(sitePath);
  if (!host) {
    const err = new Error('Hostname do SharePoint não configurado.');
    err.status = 400;
    throw err;
  }
  if (!path || path === '/') {
    const err = new Error('Caminho do site não configurado (ex.: /sites/Suprimentos).');
    err.status = 400;
    throw err;
  }

  // Graph: GET /sites/{hostname}:/{server-relative-path}
  // Ex.: .../sites/wtorre.sharepoint.com:/sites/Suprimentos
  const url = `https://graph.microsoft.com/v1.0/sites/${host}:${path}`;
  try {
    return await graphGet(token, url);
  } catch (err) {
    if (err.status === 404) {
      const e = new Error(`Site não encontrado: ${host}${path}`);
      e.status = 404;
      throw e;
    }
    if (err.status === 403) {
      const e = new Error(
        'Permissão negada ao site SharePoint. Verifique Sites.Selected / consentimento do App Registration.'
      );
      e.status = 403;
      throw e;
    }
    throw err;
  }
}

async function resolveDrive(token, siteId, biblioteca) {
  const drives = await graphGet(token, `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`);
  const list = Array.isArray(drives.value) ? drives.value : [];
  if (!list.length) {
    const err = new Error('Nenhuma biblioteca encontrada no site.');
    err.status = 404;
    throw err;
  }

  const wanted = String(biblioteca || '').trim().toLowerCase();
  if (!wanted) {
    return list[0];
  }

  const aliases = {
    documentos: ['documentos', 'documents', 'shared documents', 'documentos compartilhados'],
  };

  const drive =
    list.find((d) => String(d.name || '').trim().toLowerCase() === wanted) ||
    list.find((d) => {
      const n = String(d.name || '').trim().toLowerCase();
      const alts = aliases[wanted] || [];
      return alts.includes(n) || n.includes(wanted);
    });

  if (!drive) {
    const names = list.map((d) => d.name).join(', ');
    const err = new Error(`Biblioteca "${biblioteca}" não encontrada. Disponíveis: ${names}`);
    err.status = 404;
    throw err;
  }
  return drive;
}

async function downloadByConfig(token, config) {
  const itemId = String(config.item_id || '').trim();
  const arquivo = String(config.arquivo_caminho || '').trim();

  if (!itemId && !arquivo) {
    const err = new Error('Informe o caminho do arquivo ou o Item ID.');
    err.status = 400;
    throw err;
  }

  const site = await resolveSite(token, config.hostname, config.site_path);
  const drive = await resolveDrive(token, site.id, config.biblioteca);

  let buffer;
  try {
    if (itemId) {
      buffer = await graphService.downloadDriveItemContent(token, drive.id, itemId);
    } else {
      buffer = await graphService.downloadDriveItemContent(token, drive.id, arquivo);
    }
  } catch (err) {
    if (/404|not found|itemNotFound/i.test(err.message) || err.status === 404) {
      const e = new Error(
        itemId
          ? `Arquivo não encontrado (Item ID: ${itemId}).`
          : `Arquivo não encontrado no caminho: ${arquivo}`
      );
      e.status = 404;
      throw e;
    }
    if (/403|accessDenied|forbidden/i.test(err.message) || err.status === 403) {
      const e = new Error('Permissão negada ao baixar o arquivo no SharePoint.');
      e.status = 403;
      throw e;
    }
    throw err;
  }

  return {
    buffer,
    siteId: site.id,
    siteName: site.displayName || site.name || null,
    driveId: drive.id,
    driveName: drive.name || null,
  };
}

async function testarConexao(token, config) {
  const passos = [];
  try {
    passos.push({ passo: 'autenticacao', ok: true, detalhe: 'Token Graph obtido.' });

    const site = await resolveSite(token, config.hostname, config.site_path);
    passos.push({
      passo: 'site',
      ok: true,
      detalhe: `Site: ${site.displayName || site.name || site.id}`,
    });

    const drive = await resolveDrive(token, site.id, config.biblioteca);
    passos.push({
      passo: 'biblioteca',
      ok: true,
      detalhe: `Biblioteca: ${drive.name}`,
    });

    const itemId = String(config.item_id || '').trim();
    const arquivo = String(config.arquivo_caminho || '').trim();
    if (!itemId && !arquivo) {
      const err = new Error('Informe o caminho do arquivo ou o Item ID.');
      err.status = 400;
      throw err;
    }

    const { buffer } = await downloadByConfig(token, config);
    passos.push({
      passo: 'arquivo',
      ok: true,
      detalhe: `Arquivo localizado (${buffer.length} bytes).`,
    });

    return { ok: true, passos, buffer, site, drive };
  } catch (err) {
    passos.push({
      passo: 'erro',
      ok: false,
      detalhe: err.message,
    });
    return { ok: false, passos, erro: err.message, status: err.status || 502 };
  }
}

module.exports = {
  resolveSite,
  resolveDrive,
  downloadByConfig,
  testarConexao,
  encodePathSegments,
  normalizeSitePath,
};
