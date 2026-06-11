# Publicação do Add-in no Microsoft 365

Este guia descreve os passos para publicar o add-in **Assinaturas WTorre** no tenant Microsoft 365. A publicação real requer acesso de administrador global ou de aplicações no Entra ID.

## 1. Preparar o manifesto

1. Gere um novo GUID para o campo `id` em [`manifest.json`](manifest.json):
   ```bash
   uuidgen
   ```
2. Atualize `validDomains` com o domínio HTTPS da intranet (ex.: `intranet.wtorre.com.br`).
3. Atualize `extensions[].runtimes[].code.page` com a URL pública de `autorun.html`:
   ```
   https://intranet.wtorre.com.br/outlook-addin/autorun.html
   ```
4. Ajuste `config.js` — `apiBaseUrl` deve apontar para a API em produção.

## 2. Hospedar os ficheiros estáticos

Sirva a pasta `outlook-addin/` em HTTPS, acessível publicamente:

- `autorun.html`
- `autorun.js`
- `config.js`
- `assets/icon-32.png` e `assets/icon-64.png` (criar ícones 32×32 e 64×64 px)

Exemplo nginx (ajuste o caminho):

```nginx
location /outlook-addin/ {
    alias /www/wwwroot/IntranetWTorre/intranet-wtorre/outlook-addin/;
    add_header Access-Control-Allow-Origin *;
}
```

## 3. Registar aplicação no Entra ID (SSO)

1. Aceda ao [portal Entra ID](https://entra.microsoft.com) → **Aplicações empresariais** → **Novo registo**.
2. Nome: `Assinaturas WTorre Outlook Add-in`.
3. Tipos de conta: **Contas neste diretório organizacional apenas**.
4. URI de redirecionamento: plataforma **Cliente móvel e aplicações de desktop** — `https://intranet.wtorre.com.br/outlook-addin/autorun.html` (ou o URL do add-in).
5. Em **Expor uma API**, defina `Application ID URI`: `api://intranet.wtorre.com.br/{client-id}`.
6. Adicione scope `access_as_user` (admin e utilizadores podem consentir).
7. Em **Autorizar aplicações cliente**, autorize o cliente Office:
   - `d3590ed6-52b3-4102-aeff-aad2292ab01c` (Microsoft Office)
   - `00000002-0000-0ff1-ce00-000000000000` (Office Online)

Documentação: [Enable SSO in Office Add-ins](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/sso-in-office-add-ins)

## 4. Configurar permissões Graph

A API `/assinaturas/para-email/:email` usa o token Graph do utilizador (`User.Read`).

No registo Entra ID, em **Permissões de API** → Microsoft Graph → Delegadas:

- `User.Read`
- `profile`
- `openid`

Conceda consentimento de administrador.

## 5. Publicar no Admin Center

1. Aceda ao [Microsoft 365 Admin Center](https://admin.microsoft.com).
2. **Configurações** → **Aplicações integradas** → **Carregar aplicações personalizadas**.
3. Selecione **Fornecer link ao manifesto** ou **Carregar ficheiro manifest.json**.
4. Atribua utilizadores ou grupos de segurança (recomendado: grupo "Intranet — Assinaturas").
5. Aguarde propagação (até 24 h; normalmente algumas horas).

Alternativa: **Centralized Deployment** via Exchange Admin Center → **Organização** → **Add-ins** → **Add-ins personalizados**.

## 6. Validar

1. Abra [outlook.office.com](https://outlook.office.com) com um utilizador piloto.
2. **Novo e-mail** — verifique se a assinatura aparece automaticamente.
3. Altere o campo **De** para outro alias — a assinatura deve atualizar.
4. Consulte a consola do browser (F12) se o add-in não carregar — erros comuns:
   - Domínio não listado em `validDomains`
   - SSO não configurado (401 na API)
   - E-mail "De" não pertence aos aliases do utilizador (403)

## 7. Rollback

No Admin Center, desative ou remova a atribuição do add-in. Os utilizadores deixam de receber inserção automática; podem continuar a usar **Copiar para Outlook Web** na página `/assinaturas`.

## Checklist

- [ ] GUID único no manifest
- [ ] Ficheiros em HTTPS com CORS adequado
- [ ] Ícones 32×32 e 64×64
- [ ] Registo Entra ID com SSO
- [ ] Consentimento admin Graph `User.Read`
- [ ] `config.js` com `apiBaseUrl` de produção
- [ ] Teste piloto com 2–3 utilizadores
- [ ] Comunicação interna sobre coexistência: instalador desktop + add-in OWA
