require('dotenv').config();
const os = require('os');
const path = require('path');

function requireEnv(name, minLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`Variável de ambiente obrigatória: ${name}`);
  }
  return value;
}

function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || 'http://localhost:4201';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

const env = {
  port: Number(process.env.PORT) || 3001,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'intranet',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'intranet_wtorre',
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '30m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY,
  corsOrigins: getCorsOrigins(),
  msalRedirectUriWeb: process.env.MSAL_REDIRECT_URI_WEB || 'http://localhost:4201',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@grupowtorre.com',
  adminPassword: process.env.ADMIN_PASSWORD,
  rateLimitAuthMax: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30,
  rateLimitAuthWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 900000,
  storageDir:
    process.env.STORAGE_DIR ||
    path.join(__dirname, '..', '..', 'storage', 'documentos'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 50,
  ramalAdField: process.env.RAMAL_AD_FIELD || 'businessPhones',
  syncColaboradoresMin: Number(process.env.SYNC_COLABORADORES_MIN) || 60,
  colaboradoresFotosDir:
    process.env.COLABORADORES_FOTOS_DIR ||
    path.join(__dirname, '..', '..', 'storage', 'colaboradores-fotos'),
  azureStorageAccount: process.env.AZURE_STORAGE_ACCOUNT,
  treinamentosContainer: process.env.TREINAMENTOS_CONTAINER || 'treinamentos',
  treinamentosSasTtlMin: Number(process.env.TREINAMENTOS_SAS_TTL_MIN) || 120,
  treinamentosMaxMb: Number(process.env.TREINAMENTOS_MAX_MB) || 1024,
  treinamentosTmpDir: process.env.TREINAMENTOS_TMP_DIR || os.tmpdir(),
};

function validateEnv() {
  requireEnv('JWT_SECRET', 32);
  requireEnv('ENCRYPTION_KEY', 64);
  requireEnv('AZURE_STORAGE_ACCOUNT');
}

module.exports = { env, validateEnv, requireEnv };
