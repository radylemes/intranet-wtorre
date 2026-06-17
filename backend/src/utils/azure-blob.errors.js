const RBAC_HINT =
  'A identidade gerenciada da VM precisa da role "Storage Blob Data Contributor" na conta de storage ' +
  '(ou no container de treinamentos). No portal Azure: Storage account → IAM → Add role assignment → ' +
  'Managed identity da VM. Aguarde alguns minutos após atribuir.';

function mapAzureBlobError(err) {
  const code = err?.code || err?.name;
  const status = err?.statusCode;
  const mapped = new Error();
  mapped.cause = err;

  if (
    status === 403 ||
    code === 'AuthorizationFailure' ||
    code === 'AuthorizationPermissionMismatch'
  ) {
    mapped.status = 503;
    mapped.message = `Sem permissão no Azure Blob Storage. ${RBAC_HINT}`;
    return mapped;
  }

  if (status === 404 || code === 'ContainerNotFound' || code === 'BlobNotFound') {
    mapped.status = 404;
    mapped.message = 'Container ou arquivo não encontrado no Azure Blob Storage.';
    return mapped;
  }

  mapped.status = err?.status || 500;
  mapped.message = err?.message || 'Erro ao acessar o Azure Blob Storage.';
  return mapped;
}

module.exports = { mapAzureBlobError, RBAC_HINT };
