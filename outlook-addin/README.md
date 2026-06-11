# Outlook Add-in — Assinaturas WTorre

Add-in do Outlook (Web e novo Outlook Windows) que insere automaticamente a assinatura corporativa ao compor e-mails, usando a API `GET /api/v1/assinaturas/para-email/:email`.

## Estrutura

| Ficheiro | Função |
|----------|--------|
| `manifest.json` | Manifesto unificado M365 (event-based activation) |
| `autorun.html` | Página carregada pelo Outlook nos eventos de composição |
| `autorun.js` | Handlers `OnNewMessageCompose` e `OnMessageFromChanged` |
| `config.js` | URL base da API da intranet |
| `DEPLOY.md` | Guia de publicação no tenant M365 |

## Eventos

- **newMessageComposeCreated** — insere assinatura ao abrir novo e-mail
- **messageFromChanged** — atualiza assinatura quando o utilizador altera o campo "De"

## Pré-requisitos

1. Ficheiros servidos em HTTPS (mesmo domínio configurado em `validDomains` do manifest)
2. Endpoint `GET /api/v1/assinaturas/para-email/:email` com token Microsoft Graph
3. Registo de aplicação Entra ID com SSO para Office Add-ins
4. Publicação via Microsoft 365 Admin Center (ver `DEPLOY.md`)

## Configuração local

1. Edite `config.js` com a URL da API (`apiBaseUrl`)
2. Atualize `manifest.json`:
   - `id` — novo GUID (`uuidgen`)
   - `validDomains` — domínio real da intranet
   - URL em `runtimes[].code.page` — URL pública de `autorun.html`
3. Sirva esta pasta estaticamente (ex.: `/outlook-addin/` no frontend ou CDN)

## Limitações

- Funciona apenas para aliases presentes no perfil Graph do utilizador autenticado
- Caixas compartilhadas exigem permissão "Send As" e podem não constar nos aliases pessoais
- Não altera a assinatura nas definições do OWA — insere ao compor (comportamento do `setSignatureAsync`)
