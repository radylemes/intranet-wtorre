# Alertas de Camarotes — gatilhos 90 / 30 / 0 dias

## Visão geral

O módulo Camarotes envia **e-mails individuais** por contrato quando o vencimento está exatamente a:

| Gatilho | Template | Urgência |
|---------|----------|----------|
| **90 dias** | `camarote-90dias.html` | Baixa |
| **30 dias** | `camarote-30dias.html` | Atenção |
| **0 dias** (vence hoje ou vencido) | `camarote-hoje.html` | Urgente |

Configuração em **Admin → Configuração de Camarotes → Alertas por e-mail**.

## Canal de envio

Os alertas usam o módulo unificado [`emailSender`](../backend/src/utils/emailSender.js) (SMTP ou Azure ACS configurado em **Configurações → E-mail**).

## Placeholders dos templates

Os ficheiros HTML estão em [`backend/src/templates/camarotes/`](../backend/src/templates/camarotes/).

| Placeholder | Descrição |
|-------------|-----------|
| `[XXX]` | Número do camarote |
| `{{numero}}` | Número do camarote |
| `{{setor}}` | Setor |
| `{{andar}}` | Andar |
| `{{cessionario}}` | Nome do cessionário |
| `{{tipo_cessionario}}` | Tipo de cessionário |
| `{{final_locacao}}` | Data de vencimento (dd/mm/aaaa) |
| `{{dias_restantes}}` | Dias até o vencimento |
| `{{capacidade}}` | Capacidade |
| `{{valor_anual}}` | Valor anual formatado (R$) |
| `{{valor_total}}` | Valor total formatado |
| `{{status_contrato}}` | Status do contrato |

O assunto de cada gatilho também aceita `[XXX]` e `{{numero}}`.

## Deduplicação

Cada combinação `unidade_id + gatilho_dias + final_locacao` só dispara **uma vez**, registada em `camarotes_alertas_envio`. Se o contrato for renovado (nova `final_locacao`), os gatilhos voltam a aplicar-se.

## Rastreamento de entrega e falhas

Cada tentativa de envio por destinatário é registada em `camarotes_alertas_destinos` com:

| Campo | Descrição |
|-------|-----------|
| `status` | `enviado`, `entregue`, `bounce` ou `falha` |
| `message_id` | ID retornado pelo provedor (ACS) para correlacionar eventos |
| `erro` | Detalhe em caso de falha ou bounce |

Na aba **Disparos de e-mail**, o status agregado por disparo reflete todos os destinatários configurados. Falhas de envio (quando o provedor rejeita antes de aceitar) também aparecem no histórico, mesmo que nenhum destinatário tenha sido aceito.

### Azure ACS — webhook de entrega

Com o provedor **Azure ACS**, configure uma subscrição Event Grid no recurso Communication Services:

1. Tipo de evento: **Email Delivery Report Received** (`Microsoft.Communication.EmailDeliveryReportReceived`)
2. Endpoint: `POST https://<seu-dominio>/api/v1/webhooks/acs-email`
3. Conclua a validação automática da subscrição (a API responde com `validationResponse`)

Quando o ACS reporta `Delivered`, o status passa a `entregue`. Qualquer outro estado terminal (bounce, spam, quarentena, etc.) é mapeado para `bounce`.

Com **SMTP**, o status permanece em `enviado` após aceite pelo servidor — não há webhook de entrega neste módulo.

Leitura/abertura de e-mail **não** faz parte do escopo.

## Agendamento

- **Horário configurável** (default `08:00`, fuso `America/Sao_Paulo`)
- **Cadência global:** diária ou semanal
- **Opcional:** disparar alertas após sincronização da planilha

## API (admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/camarotes/config` | Config + gatilhos + horário |
| PUT | `/api/v1/camarotes/config` | Salvar configuração |
| GET | `/api/v1/camarotes/gatilhos/:dias/preview` | Pré-visualizar template |
| POST | `/api/v1/camarotes/enviar-alertas` | Disparo manual |
| GET | `/api/v1/camarotes/alertas-envio-log` | Histórico de envios (status por destinatário) |

Webhook público (sem JWT) para eventos ACS:

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/webhooks/acs-email` | Event Grid — entrega/bounce de e-mails ACS |

`POST /enviar-resumo` permanece como alias de `/enviar-alertas`.

## Substituir templates

Para usar os HTMLs de design originais, substitua os ficheiros em `backend/src/templates/camarotes/` mantendo os mesmos nomes e placeholders.
