# Padrão de Módulos Administrativos — Intranet Grupo WTorre

> **Instrução para o Cursor:** Sempre que criar ou alterar um **módulo administrativo**, siga este documento como padrão. Cadastros usam **modal** (`AdminModalComponent`); alertas/confirmações usam **SweetAlert2** via `AlertasService`. Reutilize o shell e os componentes existentes — não recrie layout, sidebar, modal ou alertas do zero. Ao final há um **checklist** que todo módulo novo deve cumprir.

Stack: Angular standalone + SCSS · design WTorre. As telas admin vivem sob `admin-layout` (sidebar escura + conteúdo claro).

---

## 1. Shell administrativo (`admin-layout`)

Toda tela admin é renderizada dentro de `<app-admin-layout>`. **Não duplicar** sidebar/topbar — só fornecer o conteúdo da página.

### Sidebar (escura, fixa à esquerda)
- Topo: marca WTorre (logo em gradiente azul) + rótulo **ADMINISTRAÇÃO**.
- **Grupos de links** com rótulo em maiúsculas/cinza. Grupos atuais:
  - `GESTÃO DE CONTEÚDO` → Gestão do Menu, Documentos, Treinamentos, Containers
  - `ACESSOS` → Tenants Azure, Perfis de Acesso, Gestão de Acessos
- Cada item: ícone + label. Item ativo destacado (fundo claro translúcido + texto/accent azul).
- **Visibilidade por permissão:** cada link só aparece se `auth.hasModulo('<codigo>')` (ou `isAdmin()`). Itens do grupo `ACESSOS` de gestão (Perfis, Gestão de Acessos) só com `isAdmin()`.
- Rodapé da sidebar: `← Voltar à intranet`, card do usuário (avatar + nome + "Perfil ADMIN"/perfil) e botão **Sair**.

### Conteúdo (claro)
- **Breadcrumb** no topo: `Administração › <Página>`.
- **Page-head**: título (`Archivo Expanded`, ~28–32px) + subtítulo curto em cinza explicando a tela.
- Abaixo, os blocos da página em **cards** brancos.

Novo item de módulo → adicionar o link no grupo certo da sidebar (`admin-layout.component.html`) com guard `hasModulo()`/`isAdmin()`, e a rota em `app.routes.ts` com `moduloGuard('<codigo>')`.

---

## 2. Tokens de design

Conteúdo reutiliza o tema global (não redefinir). Referência:

```
/* Conteúdo (claro) */
--bg:#f4f5f8; --panel:#fff; --line:#e2e6ee;
--ink:#10151f; --ink-soft:#48536a; --ink-dim:#8a93a8;
--accent:#1d54e6;                 /* primário WTorre */
--ok:#1c9e62; --warn:#e0a52e; --danger:#d8456e;
--radius:16px;

/* Sidebar (escura) */
--adm-bg:#0d1424; --adm-ink:#e8edf6; --adm-dim:#7b88a3;
--adm-active-bg:rgba(255,255,255,.08); --adm-active-ink:#fff;
```
Fontes: `Archivo`/`Archivo Expanded` (títulos), `Hanken Grotesk` (texto).

---

## 3. Anatomia de uma página de módulo

Ordem padrão dentro do conteúdo:

1. **Page-head** — título + subtítulo.
2. **Toolbar** (quando aplicável) — busca (com debounce ~300ms) e/ou filtros à esquerda, botão **“Novo …”** (primário, abre o **modal** de cadastro) à direita.
3. **Card(s) de conteúdo** — normalmente uma **tabela** de registros.

### Tabela padrão
- Cabeçalho em maiúsculas/cinza (`--ink-dim`), 12px.
- Linhas com hover suave; **ações por ícone** (editar ✎, excluir 🗑) que aparecem no hover, à direita.
- **Badge de status** quando houver: `ATIVO` (verde suave), `INATIVO` (rosa/danger suave), etc. — pill arredondada, texto 11px.
- **Empty state**: mensagem curta centralizada + ícone (ex.: “Nenhum registro ainda.”).
- **Loading**: skeleton/placeholder ou spinner discreto; nunca tela em branco travada.
- Editar → abre o **modal** preenchido. Excluir → **SweetAlert2** de confirmação (§5).

---

## 4. Cadastros em MODAL (`AdminModalComponent`)

**Cadastro e edição usam SEMPRE modal centralizado** (`AdminModalComponent`). Reutilize o componente existente; se faltar algo, estenda-o (não crie outro).

### Anatomia
- **Header**: ícone do módulo (em quadrado arredondado com gradiente) + **título** (“Novo …” / “Editar …”) + botão **X** (fecha).
- **Body**: campos do formulário, um por linha (ou grid 2 col em telas largas), com:
  - **Label ACIMA do campo** (nunca ao lado nem como placeholder). Obrigatórios com `*`.
  - Inputs/Selects no padrão do tema (borda `--line`, radius 12px, foco azul).
  - **Toggles** como _switch_ para booleanos (ativo, padrão, destaque…).
  - **Campos sensíveis** (segredos/chaves) mascarados com botão **mostrar/ocultar**.
  - **Validação inline** abaixo do campo (texto `--danger`), e o botão Salvar desabilitado enquanto inválido.
- **Footer**: **Salvar** (primário, à direita) + **Cancelar** (fantasma). Em telas largas, alinhados à direita.

### Tamanhos
- Padrão `~560px` de largura; formulários longos `~720px`. Scroll interno no body se passar da altura.

### Comportamento ao salvar
1. Botão entra em estado **carregando** (desabilita, spinner).
2. Sucesso → fecha o modal, **recarrega a lista**, dispara **toast de sucesso** (§5).
3. Erro → **mantém o modal aberto** e mostra **SweetAlert2 de erro** com a mensagem do servidor (inclui tratamento de **409** — ex.: “registro em uso”).

### Painel lateral (drawer) — exceção
Para fluxos de **atribuição/edição rica** (ex.: **Gestão de Acessos**, onde se vinculam perfis + módulos extras + status de um usuário), use **drawer lateral à direita** em vez do modal centralizado. Mesma gramática visual: header (título + X), seções com label, footer **Salvar**/**Cancelar**. Regra: **cadastro simples de entidade → modal**; **atribuição/configuração de relacionamentos → drawer**.

---

## 5. Alertas e confirmações — SweetAlert2

**Todo alerta, confirmação e toast usa SweetAlert2** via um serviço único `AlertasService`, com tema WTorre e textos em pt-BR. Não usar `window.confirm`/`alert` nem toasts caseiros.

### Instalação
```
npm install sweetalert2
```

### Serviço único — `shared/alertas.service.ts`
```ts
import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false,
    timer: 2600, timerProgressBar: true,
    customClass: { popup: 'wt-swal-toast' },
  });

  /** Confirmação de exclusão (ou ação destrutiva). Retorna true se confirmado. */
  async confirmarExclusao(nome: string, mensagem?: string): Promise<boolean> {
    const r = await Swal.fire({
      icon: 'warning',
      title: `Excluir “${nome}”?`,
      text: mensagem ?? 'Esta ação não pode ser desfeita.',
      showCancelButton: true,
      confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d8456e',   // --danger
      cancelButtonColor: '#8a93a8',    // --ink-dim
      reverseButtons: true,
      customClass: { popup: 'wt-swal' },
    });
    return r.isConfirmed;
  }

  /** Confirmação genérica (ex.: desativar conta). */
  async confirmar(titulo: string, texto: string, okText = 'Confirmar'): Promise<boolean> {
    const r = await Swal.fire({
      icon: 'question', title: titulo, text: texto,
      showCancelButton: true, confirmButtonText: okText, cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1d54e6', cancelButtonColor: '#8a93a8',
      reverseButtons: true, customClass: { popup: 'wt-swal' },
    });
    return r.isConfirmed;
  }

  sucesso(titulo = 'Salvo com sucesso')      { this.toast.fire({ icon: 'success', title: titulo }); }
  info(titulo: string)                        { this.toast.fire({ icon: 'info', title: titulo }); }

  /** Erro — usa a mensagem do servidor quando houver (inclui 409). */
  erro(titulo: string, detalhe?: string) {
    Swal.fire({
      icon: 'error', title: titulo, text: detalhe,
      confirmButtonText: 'Entendi', confirmButtonColor: '#1d54e6',
      customClass: { popup: 'wt-swal' },
    });
  }
}
```

### Tema WTorre — `styles.scss` (global, não scoped)
```scss
.wt-swal, .wt-swal-toast {
  border-radius: 16px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
}
.wt-swal .swal2-title { font-family: 'Archivo', sans-serif; font-weight: 800; color: #10151f; }
.wt-swal .swal2-html-container { color: #48536a; }
.swal2-confirm, .swal2-cancel { border-radius: 12px !important; font-weight: 700 !important; }
```

### Padrões de uso
- **Excluir**: `if (await alertas.confirmarExclusao(item.nome)) { service.remover(id).subscribe({ next: () => { alertas.sucesso('Excluído'); recarregar(); }, error: e => alertas.erro('Não foi possível excluir', e?.error?.message); } }`.
- **Salvar (no modal)**: sucesso → fechar modal + `alertas.sucesso()` + recarregar; erro → `alertas.erro('Não foi possível salvar', e?.error?.message)` mantendo o modal.
- **409 / regra de negócio** (ex.: perfil/container em uso): sempre exibir a **mensagem do servidor** no `alertas.erro(...)`, não uma genérica.
- **Ações destrutivas não-exclusão** (desativar conta, revogar): usar `alertas.confirmar(...)` antes.

---

## 6. Botões e estados

- **Primário** (`Salvar`, `Novo`): fundo `--accent`, texto branco, radius 12px.
- **Fantasma** (`Cancelar`): borda `--line`, texto `--ink-soft`, fundo transparente.
- **Destrutivo** (`Excluir` dentro de confirmação): tratado pelo SweetAlert (`--danger`).
- Botão em ação assíncrona → **estado carregando** (desabilitado + spinner). Nunca permitir duplo-submit.

---

## 7. Convenções de comportamento

- **Toolbar “Novo”** abre o modal vazio; **editar** abre o modal preenchido (mesmo componente, modo create/edit).
- Após qualquer escrita bem-sucedida: **recarregar a lista** da fonte (não confiar só em estado local) e dar **toast**.
- Buscas com **debounce** e estado de “nenhum resultado”.
- Erros de API sempre passam pelo `AlertasService.erro` com a mensagem do backend quando disponível.
- Acessibilidade: modal/drawer fecham com **Esc** e clique no overlay; foco vai pro primeiro campo ao abrir.
- Responsivo: em telas estreitas, sidebar colapsa (ou vira menu), modal/drawer ocupam largura total.

---

## 8. Checklist do módulo administrativo novo

Ao criar um módulo admin, garanta:

- [ ] Rota em `app.routes.ts` sob `admin` com `moduloGuard('<codigo>')` (ou `superAdminGuard` se for gestão sensível).
- [ ] Link no grupo certo da **sidebar** (`admin-layout`) com visibilidade `hasModulo('<codigo>')`/`isAdmin()`.
- [ ] Página com **page-head** (título + subtítulo), **toolbar** (busca/filtros + botão “Novo …”) e **card(s)** de conteúdo.
- [ ] Lista em **tabela** com cabeçalho cinza, ações por ícone no hover, badge de status e **empty/loading state**.
- [ ] **Cadastro/edição em `AdminModalComponent`** — labels acima, toggles switch, segredos mascarados, validação inline, footer Salvar/Cancelar, estado carregando.
- [ ] (Se houver atribuição de relacionamentos) **drawer lateral** no mesmo padrão.
- [ ] **Todos os alertas via `AlertasService`** (SweetAlert2): confirmar exclusão, toast de sucesso, erro com mensagem do servidor (inclui 409).
- [ ] Após salvar/excluir: recarrega a lista + toast.
- [ ] Sem `window.alert/confirm`, sem toasts caseiros, sem redefinir tokens/sidebar/modal.

---

## 9. Como o Cursor referencia este documento

Commitar em `docs/padrao-modulos-admin.md` (ou na pasta de specs do repo) e citar no prompt do agente com `@docs/padrao-modulos-admin.md` ao pedir qualquer módulo administrativo, para que o layout, o modal de cadastro e os alertas SweetAlert2 saiam sempre no mesmo padrão.
