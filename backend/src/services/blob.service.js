const { DefaultAzureCredential } = require('@azure/identity');
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} = require('@azure/storage-blob');
const crypto = require('crypto');
const path = require('path');
const { env } = require('../config/env');
const { validarNomeContainer } = require('../utils/container-nome.validation');
const { mapAzureBlobError } = require('../utils/azure-blob.errors');

const account = env.azureStorageAccount;
const credential = new DefaultAzureCredential();
const svc = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);

function getExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return ext || '';
}

function novoBlobName(originalName) {
  return `${crypto.randomUUID()}${getExtension(originalName)}`;
}

async function withBlobError(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.status) throw err;
    throw mapAzureBlobError(err);
  }
}

async function garantirContainer(nome) {
  const v = validarNomeContainer(nome);
  if (!v.ok) {
    const err = new Error(v.mensagem);
    err.status = 400;
    throw err;
  }
  return withBlobError(async () => {
    await svc.getContainerClient(v.nome).createIfNotExists();
    return v.nome;
  });
}

async function containerExiste(nome) {
  const v = validarNomeContainer(nome);
  if (!v.ok) return false;
  return withBlobError(() => svc.getContainerClient(v.nome).exists());
}

async function listarContainersDaConta() {
  return withBlobError(async () => {
    const names = [];
    for await (const item of svc.listContainers()) {
      names.push(item.name);
    }
    return names;
  });
}

async function enviarArquivo(container, caminhoTmp, blobName, contentType) {
  return withBlobError(async () => {
    const client = svc.getContainerClient(container).getBlockBlobClient(blobName);
    await client.uploadFile(caminhoTmp, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return blobName;
  });
}

async function removerBlob(container, blobName) {
  if (!blobName) return;
  return withBlobError(() =>
    svc.getContainerClient(container).getBlockBlobClient(blobName).deleteIfExists()
  );
}

async function gerarSasLeitura(container, blobName) {
  return withBlobError(async () => {
    const now = new Date();
    const startsOn = new Date(now.getTime() - 5 * 60 * 1000);
    const expiresOn = new Date(now.getTime() + env.treinamentosSasTtlMin * 60 * 1000);
    const udk = await svc.getUserDelegationKey(startsOn, expiresOn);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: container,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
      },
      udk,
      account
    ).toString();
    const baseUrl = svc.getContainerClient(container).getBlockBlobClient(blobName).url;
    return { url: `${baseUrl}?${sas}`, expiraEm: expiresOn.toISOString() };
  });
}

module.exports = {
  garantirContainer,
  containerExiste,
  listarContainersDaConta,
  enviarArquivo,
  removerBlob,
  gerarSasLeitura,
  novoBlobName,
};
