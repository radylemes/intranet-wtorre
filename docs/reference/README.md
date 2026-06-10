# Referência visual WTorre

A identidade visual da intranet está implementada nos componentes Angular (SCSS), não em HTML standalone.

| Tela | Localização |
|------|-------------|
| Login (split-screen, painel escuro) | `frontend/src/app/pages/login/` |
| Home (tema claro) | `frontend/src/app/pages/inicio/` |
| Componentes partilhados | `frontend/src/app/shared/` |
| Design tokens | `frontend/src/styles/_tokens.scss` |

Tokens globais: tema claro (`#f4f5f8`, `#ffffff`, acentos WTorre/Nubank/Base/Novo). Exceção: painel de marca do login (`#0e1320`, acento `#2f6bff`) isolado em `login-brand-panel.component.scss`.
