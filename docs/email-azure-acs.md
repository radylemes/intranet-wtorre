# E-mail — Azure Communication Services (ACS)

Este documento descreve os pré-requisitos para usar o **Azure Communication Services Email** como provedor de envio na intranet (alternativa ao SMTP).

## Visão geral

O módulo de e-mail (`backend/src/utils/emailSender.js`) suporta dois provedores configuráveis no painel **Configurações > E-mail**:

- **SMTP** — Nodemailer (padrão)
- **Azure ACS** — `@azure/communication-email`

A troca de provedor é feita apenas pela configuração; os serviços que enviam e-mail (ex.: Solicitação de Colaborador) usam a API unificada `sendEmail()` / `sendMailBatched()`.

## Pré-requisitos no Azure

### 1. Criar recurso Azure Communication Services

No portal Azure, crie um recurso **Communication Services** na subscription desejada.

### 2. Adicionar Email Communication Services

No recurso ACS, adicione o serviço **Email Communication Services** e associe um domínio de envio.

### 3. Verificar domínio

Verifique o domínio que será usado para envio (ex.: `seudominio.com`). O Azure fornecerá registos DNS a configurar:

| Registo | Finalidade |
|---------|------------|
| **SPF** | Autorização de servidores de envio |
| **DKIM** | Assinatura de mensagens |
| **DMARC** | Política de autenticação (recomendado) |

Aguarde a propagação DNS e confirme o domínio como **Verified** no portal.

### 4. Obter Connection String

Em **Settings → Keys** do recurso Communication Services, copie a **Connection String** (Primary ou Secondary).

Configure no painel admin (**Configurações > E-mail > Azure ACS**). O valor é armazenado cifrado no banco (AES-256-GCM) e nunca é retornado pela API.

### 5. Endereço remetente (`acs_sender`)

Use um endereço do domínio verificado, por exemplo:

```
no-reply@seudominio.com
```

Esse endereço deve estar autorizado no domínio ACS verificado.

## Limites padrão do ACS

O rate limiter em `emailSender.js` respeita os limites padrão do Azure:

| Janela | Limite |
|--------|--------|
| 1 minuto | 30 e-mails |
| 1 hora | 100 e-mails |
| 24 horas | 2.400 e-mails |

Em disparos em massa, há throttling adicional (`batchSize: 10`, delays entre itens e lotes).

## Variáveis de ambiente opcionais

| Variável | Descrição |
|----------|-----------|
| `EMAIL_PROVIDER` | `smtp` ou `acs` (fallback se não definido no BD) |
| `EMAIL_OCULTAR_PARA` | `1` ou `true` — ocultar destinatário no campo Para (BCC) |

Segredos (connection string ACS, senha SMTP) devem ser configurados **apenas no banco** via painel admin, não no `.env`.

## Teste de envio

1. Acesse **Admin → Configurações → E-mail**
2. Selecione **Azure ACS**
3. Preencha connection string e remetente verificado
4. Ative **Envio de e-mail ativo**
5. Clique em **Testar envio de e-mail**

A API `POST /api/v1/configuracoes/email/teste` usa o provedor ativo configurado.

## Rastreamento de entrega (alertas de Camarotes)

Para atualizar o status **Entregue** / **Bounce** na aba **Disparos de e-mail** dos Camarotes:

1. Use **Azure ACS** como provedor ativo
2. No portal Azure, no recurso **Communication Services**, crie uma subscrição **Event Grid**
3. Selecione o evento **Email Delivery Report Received**
4. Endpoint webhook: `https://<host-da-api>/api/v1/webhooks/acs-email`
5. Após validação, os disparos passam a correlacionar `messageId` do envio com os eventos de entrega

Com SMTP, os disparos ficam apenas com status **Enviado** (aceite pelo servidor de saída).

Ver também [camarotes-alertas.md](./camarotes-alertas.md).

## Opção BCC (ocultar Para)

Com **"Ocultar e-mail do destinatário no campo Para"** ativo, o destinatário real recebe a mensagem via BCC e o campo **Para** exibe o endereço do remetente (`acs_sender` ou `smtp_from`). Útil para evitar exposição de e-mails em envios individuais.
