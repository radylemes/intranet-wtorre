# Módulo Treinamentos — Admin (`/admin/treinamentos`)

Documentação do módulo de vídeos de capacitação na intranet WTorre, integrado às **entidades** e **árvore de categorias de Documentos**.

---

## Visão geral

O módulo **Treinamentos** é uma biblioteca de vídeos corporativos por **entidade** (WTorre, Nubank Parque, etc.). Usuários autenticados assistem **na página de Documentos** (`/documentos/:paginaSlug?cat=...`), na mesma tela que arquivos PDF; a gestão exige o módulo RBAC `treinamentos` (ou perfil `ADMIN`).

| Aspecto | Implementação |
|---------|---------------|
| Entidade | FK `pagina_id` → `documentos_paginas` (entidade principal / legado) |
| Categoria | FK `categoria_id` → `categorias_documentos` (categoria principal / legado) |
| **Compartilhamento** | Tabela N:N `treinamento_entidades` — visível em várias entidades com categoria distinta por entidade |
| Consumo público | Unificado em `/documentos/:paginaSlug` — seções **Treinamentos** e **Documentos** |
| Armazenamento | Azure Blob (privado, SAS de leitura) — inalterado |
| Categorias fixas | **Descontinuadas** (`onboarding`, `compliance`, etc.) |
| Menu | Link opcional `/documentos/{slug}?cat=treinamentos` (label `Treinamentos — {nome}`) quando `exibir_menu_treinamento` está ativo na entidade |

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
| `GET` | `/` | JWT | Lista pública via `treinamento_entidades`: `?pagina=slug&categoria=slug` |
| `GET` | `/por-pagina/:paginaSlug` | JWT | Alias da listagem pública |
| `GET` | `/admin` | JWT + módulo | Lista admin; `?pagina_id=` filtra por visibilidade na entidade |
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

### Tabela `treinamento_entidades` (compartilhamento)

| Coluna | Descrição |
|--------|-----------|
| `treinamento_id` | FK → `treinamentos` ON DELETE CASCADE |
| `pagina_id` | FK → `documentos_paginas` ON DELETE CASCADE |
| `categoria_id` | FK → `categorias_documentos` ON DELETE SET NULL |
| PK | `(treinamento_id, pagina_id)` |

Documentos usam tabela equivalente `documento_entidades` com o mesmo modelo.

Migration [`027_documento_treinamento_entidades.sql`](../backend/src/db/migrations/027_documento_treinamento_entidades.sql) e backfill [`20260624-documento-treinamento-entidades.sql`](../backend/scripts/20260624-documento-treinamento-entidades.sql).

---

## Admin

- Editor **Visibilidade por entidade** (`ConteudoEntidadesEditorComponent`): checkbox por entidade + select de categoria na árvore de Documentos
- Pelo menos uma entidade com categoria obrigatória
- Tabela: badges de **Entidades** compartilhadas, Categoria (contextual ao filtro), Container, Duração, Status
- Filtro por entidade na toolbar lista treinamentos **visíveis** naquela entidade (JOIN `treinamento_entidades`)

FormData / JSON: `visibilidades` como array JSON:

```json
[
  { "pagina_id": 1, "categoria_id": 23 },
  { "pagina_id": 2, "categoria_id": 41 }
]
```

Campos legados `pagina_id` / `categoria_id` no registro principal espelham a **primeira** visibilidade.

---

## Menu sync

[`doc-pagina-menu.sync.js`](../backend/src/services/doc-pagina-menu.sync.js) mantém, por entidade, um item sob o pai **Documentos**:

- `/documentos/{slug}` — nome da entidade (sempre sincronizado)

O atalho de treinamentos no menu é **opcional** por entidade (`documentos_paginas.exibir_menu_treinamento`, padrão `0`):

- `/documentos/{slug}?cat=treinamentos` — label `Treinamentos — {nome}` (somente quando a flag está ativa)

Gerencie essa opção em **Gestão de Documentos → Entidades** (toggle *Exibir atalho de Treinamentos no menu*). Excluir manualmente no Admin → Menu não persiste: o sync recria ou remove conforme a flag na entidade.

URLs legadas `/treinamentos/{slug}` redirecionam no frontend. O `reconcileAll` (startup do backend) reconcilia itens do menu com `documentos_paginas` e remove atalhos de treinamento cuja flag está desligada.

A ordem no menu segue `documentos_paginas.ordem`; reordenar no Menu atualiza essa coluna (apenas itens de documento, não treinamento).

---

## Deploy

```bash
cd backend && npm run db:migrate
# Se ainda não rodou:
mysql ... < scripts/20260623-documentos-pagina-setor.sql
mysql ... < scripts/20260623-treinamentos-pagina-categoria.sql
mysql ... < scripts/20260624-documento-treinamento-entidades.sql

cd frontend && npm run build
# restart PM2
```

**Documentos públicos:** `GET /documentos` exige `?pagina=slug&categoria=slug` (breaking change; frontend atualizado).

Após deploy: reclassificar treinamentos existentes no admin (definir `categoria_id` onde aplicável).

---

## Arquivos principais

```
backend/
  src/db/migrations/007_treinamentos.sql
  scripts/20260623-treinamentos-pagina-categoria.sql
  src/repositories/treinamentos.repository.js
  src/repositories/treinamento-entidades.repository.js
  src/repositories/documento-entidades.repository.js
  src/utils/visibilidade-entidades.validation.js
  src/controllers/treinamentos.controller.js
  src/routes/treinamentos.routes.js
  src/services/doc-pagina-menu.sync.js

frontend/
  src/app/pages/documentos/documento-categoria.component.ts
  src/app/pages/treinamentos/treinamentos.component.ts  # redirect legado
  src/app/pages/admin/treinamentos-admin/
  src/app/shared/admin/conteudo-entidades-editor/
  src/app/services/treinamentos.service.ts
  src/app/data/paginas-internas.ts
```
