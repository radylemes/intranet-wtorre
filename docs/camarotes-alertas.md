# Alertas de Camarotes — gatilhos 90 / 30 / 0 dias

## Visão geral

O módulo Camarotes envia **e-mails individuais** por contrato quando o vencimento atinge cada marco. Cada gatilho é **independente**: se o alerta daquele marco ainda não foi enviado, o cron (ou disparo manual) envia — inclusive contratos **atrasados** que perderam o dia exato.

| Gatilho | Condição (dias restantes) | Template | Urgência |
|---------|---------------------------|----------|----------|
| **90 dias** | 31 a 90 dias restantes (`> 30` e `<= 90`) | `camarote-90dias.html` | Baixa |
| **30 dias** | 1 a 30 dias restantes | `camarote-30dias.html` | Atenção |
| **0 dias** | vence hoje ou já vencido (`<= 0`) | `camarote-hoje.html` | Urgente |

Na **listagem**, contratos que **vencem hoje** e **vencidos** aparecem no gatilho **0** (badge "Vence hoje" ou "Vencido"). Use o filtro **Vence hoje / vencidos** ou **Notificação: Todos** para visualizá-los.

Exemplo: contrato a **85 dias** sem alerta de 90 → enviado no próximo cron. Contrato a **25 dias** sem alerta de 30 → recebe **apenas** o e-mail de 30 dias (a faixa de 90 dias já não se aplica).

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

Cada combinação `numero + gatilho_dias + final_locacao` só dispara **uma vez**, registada em `camarotes_alertas_envio`. A verificação usa o número do camarote (não apenas `unidade_id`) para tolerar resincronizações da planilha SharePoint.

Se o contrato for renovado (nova `final_locacao`), os gatilhos voltam a aplicar-se.

O cron e o disparo manual **não reenviam** alertas já registados. Reenvio forçado exige `?forcar=true` na API.

## Rastreamento de entrega e falhas

Cada tentativa de envio por destinatário é registada em `camarotes_alertas_destinos` com:

| Campo | Descrição |
|-------|-----------|
| `status` | `pendente`, `na_fila`, `enviando`, `enviado`, `entregue`, `bounce`, `falha` ou `cancelado` |
| `enviar_em` | Previsão de envio quando em `na_fila` (rate limit ACS ou intervalo SMTP) |
| `message_id` | ID retornado pelo provedor (ACS) para correlacionar eventos |
| `erro` | Detalhe em caso de falha ou bounce |

Na aba **Disparos de e-mail**, o status agregado por disparo reflete todos os destinatários configurados. Enquanto o envio está em background, destinatários aparecem como **Pendente**, **Na fila** ou **Enviando**; o agregado fica **Em processamento**. Falhas de envio (quando o provedor rejeita antes de aceitar) também aparecem no histórico, mesmo que nenhum destinatário tenha sido aceito.

### Migration 043 — status de fila

Em produção, executar manualmente uma vez (ver [`043_camarotes_alertas_fila_status.sql`](../backend/src/db/migrations/043_camarotes_alertas_fila_status.sql)):

```sql
ALTER TABLE camarotes_alertas_destinos
  MODIFY COLUMN status ENUM(
    'pendente', 'na_fila', 'enviando', 'enviado', 'entregue', 'bounce', 'falha', 'cancelado'
  ) NOT NULL DEFAULT 'pendente',
  ADD COLUMN enviar_em DATETIME(3) NULL AFTER status;
```

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
- **Retry:** a cada execução, envia contratos pendentes **na faixa exclusiva** de cada gatilho (90: 31–90, 30: 1–30, 0: ≤0) — nunca mais de um gatilho por contrato na mesma execução

## API (admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/camarotes/config` | Config + gatilhos + horário |
| PUT | `/api/v1/camarotes/config` | Salvar configuração |
| GET | `/api/v1/camarotes/gatilhos/:dias/preview` | Pré-visualizar template |
| GET | `/api/v1/camarotes/alertas-contratos` | Contratos em alerta (pendentes e notificados) |
| POST | `/api/v1/camarotes/enviar-alertas` | Disparo manual (`?forcar=true` para reenvio). **Retorna 202** com `job_key` (exceto `?preview=1`, que é síncrono) |
| GET | `/api/v1/camarotes/enviar-alertas/status?job_key=...` | Status do job de envio (`em_andamento`, `concluido`, `erro`) |
| GET | `/api/v1/camarotes/alertas-envio-log` | Histórico de envios (status por destinatário) |

### Disparo manual assíncrono (fila em background)

O `POST /enviar-alertas` (sem preview) responde **202 Accepted** imediatamente, persiste a fila em `camarotes_alertas_destinos` e processa os e-mails em background — evitando timeout do proxy e **sem modal bloqueante** na UI.

Resposta 202:

```json
{
  "aceito": true,
  "status": "iniciado",
  "job_key": "lote-all",
  "total_enfileirados": 117,
  "tentativa_em": "2026-07-03T18:00:00.000Z"
}
```

Se o mesmo lote/contrato já estiver em processamento:

```json
{
  "aceito": true,
  "status": "em_andamento",
  "job_key": "36237-30",
  "total_enfileirados": 13,
  "tentativa_em": "2026-07-03T18:00:00.000Z"
}
```

**Frontend:** após o 202, exibe toast e abre a aba **Disparos de e-mail**, com polling automático (4s) enquanto houver destinatários em processamento.

O endpoint `GET /enviar-alertas/status?job_key=...` permanece disponível (fila in-memory, TTL 10 min), mas a UI admin acompanha pelo histórico persistido em **Disparos**.

Status da fila (banco e UI):

| Status | Significado |
|--------|-------------|
| `pendente` | Enfileirado, aguardando processamento |
| `na_fila` | Aguardando janela ACS ou intervalo entre envios; `enviar_em` indica previsão |
| `enviando` | Envio em andamento |
| `enviado` | Aceito pelo provedor |
| `falha` | Erro no envio (`erro` com detalhe) |
| `cancelado` | Reservado para cancelamento futuro |

Agregado na aba Disparos: **`processando`** enquanto algum destinatário estiver em `pendente`, `na_fila` ou `enviando`.

Quando o limite ACS (30/min, 100/h, 2400/dia) é atingido, o item passa para `na_fila` com previsão em `enviar_em`.

O **cron** e o envio **pós-sync** continuam chamando `processarAlertas()` diretamente (fora do HTTP).

Webhook público (sem JWT) para eventos ACS:

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/webhooks/acs-email` | Event Grid — entrega/bounce de e-mails ACS |

`POST /enviar-resumo` permanece como alias de `/enviar-alertas`.

## Substituir templates

Para usar os HTMLs de design originais, substitua os ficheiros em `backend/src/templates/camarotes/` mantendo os mesmos nomes e placeholders.
