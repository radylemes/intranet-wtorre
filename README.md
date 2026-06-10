# Intranet Corporativa · Grupo WTorre

Monorepo fullstack com **Angular 21** (frontend) e **Express + MySQL + JWT** (backend) para a intranet do Grupo WTorre (WTorre, Nubank Parque, Base Coworking e Novo Anhangabaú).

## Estrutura

```
intranet-wtorre/
├── frontend/          # Angular standalone, SCSS WTorre, MSAL v5
├── backend/           # API Express /api/v1
├── docs/reference/    # Notas sobre referência visual (componentes Angular)
└── README.md
```

## Pré-requisitos

- Node.js 20.19+ ou 22.12+ (recomendado: Node 24 no aaPanel)
- MySQL (aaPanel)
- App registration Azure AD **multitenant**

## Portas de desenvolvimento

| Serviço   | Porta |
|-----------|-------|
| API Node  | **3001** |
| Angular   | **4201** |

## 1. Registro no Azure (Entra ID)

1. Crie uma app **multitenant**: *Accounts in any organizational directory*.
2. **Redirect URIs (SPA):**
   - `http://localhost:4201`
   - `http://127.0.0.1:4201`
   - URL HTTPS de produção (ex.: `https://intranet.seudominio.com`)
3. Permissões delegadas: `User.Read`, `openid`, `profile`.
4. Permissão de aplicação: `User.Read.All` — requer **consentimento de administrador** em cada tenant do grupo.
5. O `tid` (tenant ID) de cada empresa deve ser cadastrado em `azure_tenants` com `ativo=1`.

## 2. Backend

```bash
cd backend
cp .env.example .env
# Edite: JWT_SECRET (mín. 32 chars), ENCRYPTION_KEY (openssl rand -hex 32), DB_*, ADMIN_PASSWORD
npm install --cache /tmp/npm-cache-intranet
mkdir -p storage/documentos
chown -R www:www storage/
npm run db:migrate
npm run db:seed
npm run dev
```

API: `http://127.0.0.1:3001`

### Variáveis `.env`

| Variável | Descrição |
|----------|-----------|
| `PORT` | `3001` |
| `DB_*` | Conexão MySQL |
| `JWT_SECRET` | Segredo JWT (≥32 caracteres) |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — criptografa client secrets |
| `CORS_ORIGINS` | `http://localhost:4201,http://127.0.0.1:4201` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap do admin local |
| `STORAGE_DIR` | Diretório **fora da pasta pública** para arquivos de documentos |
| `MAX_UPLOAD_MB` | Limite de upload em MB (padrão: `50`) |

Exemplo:

```env
STORAGE_DIR=/www/wwwroot/IntranetWTorre/intranet-wtorre/backend/storage/documentos
MAX_UPLOAD_MB=50
```

> Os arquivos **nunca** ficam em `dist/` ou em pasta servida pelo Nginx. O acesso é sempre via API autenticada (`/api/v1/documentos/:id/view` ou `/download`).

### Rotas principais (`/api/v1`)

| Método | Rota | Auth |
|--------|------|------|
| POST | `/auth/login` | Público (admin local) |
| POST | `/auth/login-microsoft` | Bearer id_token Azure |
| POST | `/auth/refresh` | Público |
| POST | `/auth/logout` | Público |
| GET | `/auth/me` | JWT |
| GET | `/auth/profile-photo` | JWT |
| GET | `/tenants/msal-config` | Público |
| CRUD | `/tenants` | ADMIN |
| GET | `/menu` | JWT |
| CRUD | `/menu`, `/menu/admin`, `/menu/reorder` | ADMIN |
| GET | `/doc-categorias` | JWT |
| CRUD | `/doc-categorias`, `/doc-categorias/admin`, `/doc-categorias/reorder` | ADMIN |
| GET | `/documentos?categoria=<id\|slug>` | JWT |
| GET | `/documentos/:id/view`, `/documentos/:id/download` | JWT |
| POST/PUT/DELETE | `/documentos` | ADMIN (upload multipart) |

## 3. Frontend

```bash
cd frontend
npm install --cache /tmp/npm-cache-intranet
ng serve
# ou: PATH=/www/server/nodejs/v24.16.0/bin:$PATH ng serve
```

Acesse: **http://localhost:4201** (proxy `/api` → `3001`)

### Páginas de documentos

| Rota | Descrição |
|------|-----------|
| `/documentos` | Repositório de documentos (sidebar + lista) |
| `/documentos/:slug` | Deep-link por categoria (ex.: `/documentos/compliance`) |
| `/admin/documentos` | Gestão de categorias e upload (ADMIN) |

## 4. Bootstrap (primeira vez)

1. `npm run db:migrate` + `npm run db:seed` (cria admin local + categorias de documentos).
2. Login em `/login` → toggle **Login sem Microsoft (admin)**.
3. Acesse `/admin/tenants` → cadastre os 4 tenants → marque um como **Principal**.
4. Teste **Entrar com Microsoft** com conta de tenant cadastrado.
5. Acesse `/admin/documentos` → faça upload de um PDF de teste.

Credencial seed (se `ADMIN_PASSWORD` no `.env`): `admin@grupowtorre.com`

## 5. Deploy no aaPanel

### Frontend

```bash
cd frontend
PATH=/www/server/nodejs/v24.16.0/bin:$PATH npm run build
# Copiar dist/frontend/browser/ para a pasta pública do site
```

### Backend (PM2 / Projeto Node)

```bash
cd backend
npm install --cache /tmp/npm-cache-intranet
mkdir -p storage/documentos
chown -R www:www storage/
npm run db:migrate
npm run db:seed
pm2 restart intranet-api   # ou o nome do processo PM2
```

- Diretório: `backend/`
- Comando: `node src/server.js`
- `PORT=3001`
- PM2 roda como usuário **www** — o `STORAGE_DIR` deve pertencer a `www:www`

### Nginx

```nginx
client_max_body_size 50M;

location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

> `client_max_body_size` deve ser igual ou maior que `MAX_UPLOAD_MB` (padrão 50M). Sem isso, uploads maiores que 1 MB retornam **413** do Nginx antes de chegar à API.

> Use `proxy_pass http://127.0.0.1:3001/api/;` (com `/api/`) para preservar o prefixo `/api/v1` nas rotas.

### SSL

- Let's Encrypt no aaPanel.
- Cadastre a URL HTTPS de produção como Redirect URI no Azure.

## 6. Troubleshooting

| Problema | Solução |
|----------|---------|
| 404 ao recarregar rota Angular | Falta `try_files ... /index.html` |
| CORS | Confira `CORS_ORIGINS` com a origem exata do browser |
| "Tenant Azure não autorizado" | Cadastre o `tid` em `/admin/tenants` |
| MSAL não configurado (âmbar) | Defina um tenant **Principal** ativo |
| 403 sem departamento AD | Preencha `department` (ou company/office/job) no Azure AD |
| `Access denied` MySQL | Ajuste `DB_USER`/`DB_PASS` no aaPanel |
| Upload retorna 413 | Ajuste `client_max_body_size` no Nginx e `MAX_UPLOAD_MB` no `.env` |
| Erro de permissão no upload | `chown -R www:www backend/storage/` |
| Tipo de arquivo rejeitado | Apenas pdf, docx, xlsx, pptx, png, jpg, jpeg, zip |

## 7. Fluxo de autenticação

1. Front carrega `GET /api/v1/tenants/msal-config` → `clientId` do tenant principal.
2. MSAL `loginRedirect` (authority `common`).
3. `POST /api/v1/auth/login-microsoft` com id_token → validação JWKS + allow-list `tid`.
4. Graph (client credentials) → departamento obrigatório → provisionamento MySQL.
5. API emite **accessToken + refreshToken** JWT próprios (não substituídos pelo token Microsoft).

## Referência visual

Ver [`docs/reference/README.md`](docs/reference/README.md).
