# Módulo Treinamentos — Admin (`/admin/treinamentos`)

Documentação do módulo de vídeos de capacitação na intranet WTorre, integrado às **entidades** e **árvore de categorias de Documentos**.

---

## Visão geral

O módulo **Treinamentos** é uma biblioteca de vídeos corporativos por **entidade** (WTorre, Nubank Parque, etc.). Usuários autenticados assistem **na página de Documentos** (`/documentos/:paginaSlug?cat=...`), na mesma tela que arquivos PDF; a gestão exige o módulo RBAC `treinamentos` (ou perfil `ADMIN`).

| Aspecto | Implementação |
|---------|---------------|
| Entidade | FK `pagina_id` → `documentos_paginas` (reuso, fonte única) |
| Categoria | FK `categoria_id` → `categorias_documentos` (opcional; mesma árvore de Documentos) |
| Consumo público | Unificado em `/documentos/:paginaSlug` — seções **Treinamentos** e **Documentos** |
| Armazenamento | Azure Blob (privado, SAS de leitura) — inalterado |
| Categorias fixas | **Descontinuadas** (`onboarding`, `compliance`, etc.) |
| Menu | Links `/documentos/{slug}?cat=treinamentos` (label `Treinamentos — {nome}`) |

---

## Autorização e rotas

### Frontend

| Rota | Guard | Descrição |
|------|-------|-----------|
| `/documentos/:slug?cat=...` | `authGuard` | Biblioteca unificada (documentos + vídeos por categoria) |
| `/treinamentos` | `authGuard` | **Legado** — redireciona para `/documentos/wtorre?cat=treinamentos` |
| `/treinamentos/:paginaSlug` | `authGuard` | **Legado** — redireciona para `/documentos/:slug?cat=treinamentos` |
| `/admin/treinamentos` | `moduloGuardFromRoute` | Gestão administrativa |

### Backend — `/api/v1/treinamentos`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/` | JWT | Lista pública: `?pagina=slug&categoria=slug` ou `?sem_categoria=1` |
| `GET` | `/por-pagina/:paginaSlug` | JWT | Alias da listagem pública |
| `GET` | `/admin` | JWT + módulo | Lista admin; `?pagina_id=` opcional |
| `GET` | `/:id/playback` | JWT | SAS do vídeo |
| `GET` | `/:id/thumb` | JWT | SAS da thumbnail |
| `GET` | `/:id` | JWT | Detalhe |
| `POST` | `/` | JWT + módulo | Criar (multipart) |
| `PUT` | `/:id` | JWT + módulo | Atualizar |
| `DELETE` | `/:id` | JWT + módulo | Excluir registro + blobs |

**Categorias na sidebar:** reusar `GET /doc-categorias/por-pagina/:paginaSlug` (sem endpoint próprio). Vídeos são filtrados pela categoria selecionada via `GET /treinamentos?pagina=slug&categoria=slug`.

---

## Frontend público (unificado em Documentos)

- **Switcher de entidade** e **sidebar de categorias** (mesmo layout de Documentos)
- **Seção Treinamentos:** grid de cards com player modal (SAS)
- **Seção Documentos:** lista de arquivos existente
- **Busca** filtra documentos e treinamentos
- **Filtro por setor** aplica-se somente a documentos
- Empty state: *"Nenhum documento ou treinamento nesta categoria."*

Componente: [`documento-categoria.component`](../frontend/src/app/pages/documentos/documento-categoria.component.ts)

---

## Banco de dados

### Colunas em `treinamentos`

| Coluna | Descrição |
|--------|-----------|
| `pagina_id` | FK → `documentos_paginas` (obrigatório após backfill) |
| `categoria_id` | FK → `categorias_documentos` ON DELETE SET NULL (opcional) |
| `categoria` | VARCHAR legado — nullable; mantido na transição |

### Migrations e scripts

1. [`007_treinamentos.sql`](../backend/src/db/migrations/007_treinamentos.sql) — colunas `pagina_id`/`categoria_id` no CREATE (no-op em banco existente)
2. [`20260623-treinamentos-pagina-categoria.sql`](../backend/scripts/20260623-treinamentos-pagina-categoria.sql) — script manual idempotente (rodar **após** script de Documentos):
   - ADD columns, `categoria` nullable
   - Backfill `pagina_id` → WTorre
   - FKs `fk_trein_pagina`, `fk_trein_categoria`

---

## Admin

- Select de **entidade** (`documentos_paginas`)
- **Árvore de categorias** via `DocAdminNodeComponent` (select)
- Botão **Sem categoria** para limpar `categoria_id`
- Tabela: Entidade, Categoria (nome + ícone), Container, Duração, Status
- Filtro por entidade na toolbar

FormData: `pagina_id`, `categoria_id` (vazio = null), demais campos inalterados.

---

## Menu sync

[`doc-pagina-menu.sync.js`](../backend/src/services/doc-pagina-menu.sync.js) cria, por entidade, dois irmãos sob o pai **Documentos**:

- `/documentos/{slug}` — nome da entidade
- `/documentos/{slug}?cat=treinamentos` — label `Treinamentos — {nome}`

URLs legadas `/treinamentos/{slug}` redirecionam no frontend. O `reconcileAll` (startup do backend) atualiza itens antigos do menu.

Ordem intercalada: `ordem * 2` e `ordem * 2 + 1`.

---

## Deploy

```bash
cd backend && npm run db:migrate
# Se ainda não rodou:
mysql ... < scripts/20260623-documentos-pagina-setor.sql
mysql ... < scripts/20260623-treinamentos-pagina-categoria.sql

cd frontend && npm run build
# restart PM2
```

Após deploy: reclassificar treinamentos existentes no admin (definir `categoria_id` onde aplicável).

---

## Arquivos principais

```
backend/
  src/db/migrations/007_treinamentos.sql
  scripts/20260623-treinamentos-pagina-categoria.sql
  src/repositories/treinamentos.repository.js
  src/controllers/treinamentos.controller.js
  src/routes/treinamentos.routes.js
  src/services/doc-pagina-menu.sync.js

frontend/
  src/app/pages/documentos/documento-categoria.component.ts
  src/app/pages/treinamentos/treinamentos.component.ts  # redirect legado
  src/app/pages/admin/treinamentos-admin/
  src/app/services/treinamentos.service.ts
  src/app/data/paginas-internas.ts
```
