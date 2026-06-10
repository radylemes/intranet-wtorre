const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { env, validateEnv } = require('./config/env');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const authRoutes = require('./routes/auth.routes');
const tenantsRoutes = require('./routes/tenants.routes');
const menuRoutes = require('./routes/menu.routes');
const docCategoriasRoutes = require('./routes/doc-categorias.routes');
const documentosRoutes = require('./routes/documentos.routes');

try {
  validateEnv();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = express();

app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(requestIdMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', servico: 'intranet-wtorre-api', version: 'v1' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantsRoutes);
app.use('/api/v1/menu', menuRoutes);
app.use('/api/v1/doc-categorias', docCategoriasRoutes);
app.use('/api/v1/documentos', documentosRoutes);

app.use((_req, res) => {
  res.status(404).json({ mensagem: 'Rota não encontrada.' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ mensagem: 'Erro interno do servidor.' });
});

app.listen(env.port, () => {
  console.log(`API Intranet WTorre rodando em http://127.0.0.1:${env.port}`);
});
