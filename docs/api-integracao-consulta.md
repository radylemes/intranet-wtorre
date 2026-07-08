# Consulta à API de Integração Externa

Este documento descreve como consumir os endpoints de **consulta de eventos** e **consulta de usuários** expostos pelo sistema BID para integrações externas (painéis, dashboards, automações, etc.).

---

## 1) Visão geral

A API de integração permite que uma aplicação externa consulte:

**Eventos** (`GET /api/integracao/eventos`) — em uma única requisição:

- **BIDs** (partidas): abertos, encerrados e vencedores;
- **WT Pass** (eventos RH): abertos, encerrados e vencedores;
- **Portaria**: resumo agregado dos eventos do dia (totais de check-in, sem dados pessoais).

**Usuários** (`GET /api/integracao/usuarios`):

- Lista de **usuários ativos** com `microsoft_id`, nome, e-mail, pontos e grupo de apostas.

**Lookup** (`GET /api/integracao/usuarios/lookup?microsoft_id=`):

- Consulta **um** usuário ativo por OID Azure AD.

| Endpoint | Método | Rota |
|----------|--------|------|
| Eventos | `GET` | `/api/integracao/eventos` |
| Usuários (lista) | `GET` | `/api/integracao/usuarios` |
| Usuário (lookup) | `GET` | `/api/integracao/usuarios/lookup` |

| Item | Valor |
|------|-------|
| Autenticação | Chave de API (não utiliza JWT de usuário) |
| Formato | JSON |

**URLs base de exemplo (desenvolvimento):**

```
http://localhost:3005/api/integracao/eventos
http://localhost:3005/api/integracao/usuarios
```

Em produção, substitua pelo domínio configurado em `app_base_url` ou pela URL pública da API.

---

## 2) Habilitação e chave de API

A consulta só funciona quando a integração está **ativa** e a chave foi gerada pelo administrador.

### No painel (perfil ADMIN)

1. Acesse **Configurações** → aba **Integração API externa**  
   (ou navegue direto para `/settings?aba=integracao-api`).
2. Ative a opção **API externa**.
3. Clique em **Gerar nova chave** e copie a chave exibida.

> **Importante:** a chave completa só é mostrada no momento da geração. Guarde-a em local seguro (variável de ambiente, cofre de segredos, etc.). Após fechar a tela, apenas os últimos 4 caracteres permanecem visíveis.

### Gerar nova chave invalida a anterior

Ao gerar uma nova chave, todas as integrações que usavam a chave antiga deixam de funcionar até serem atualizadas.

---

## 3) Autenticação

Envie a chave em **um** dos formatos abaixo:

### Opção A — Header `X-API-Key` (recomendado)

```http
X-API-Key: sua-chave-de-64-caracteres-hex
```

### Opção B — Header `Authorization`

```http
Authorization: ApiKey sua-chave-de-64-caracteres-hex
```

A chave é uma string hexadecimal de 64 caracteres gerada pelo sistema (`crypto.randomBytes(32).toString("hex")`).

---

## 4) Parâmetros de consulta

| Parâmetro | Obrigatório | Formato | Descrição |
|-----------|-------------|---------|-----------|
| `date` | Não | `YYYY-MM-DD` | Data de referência para o bloco **portaria**. Se omitido, usa a data atual do servidor. |

### Exemplos de URL

```text
GET /api/integracao/eventos
GET /api/integracao/eventos?date=2026-07-06
```

---

## 5) Exemplos de requisição

### cURL

```bash
curl -s -H "X-API-Key: SUA_CHAVE_AQUI" \
  "http://localhost:3005/api/integracao/eventos"
```

Com filtro de data para portaria:

```bash
curl -s -H "X-API-Key: SUA_CHAVE_AQUI" \
  "http://localhost:3005/api/integracao/eventos?date=2026-07-06"
```

### JavaScript (fetch)

```javascript
const response = await fetch(
  "https://seu-dominio.com/api/integracao/eventos?date=2026-07-06",
  {
    headers: {
      "X-API-Key": process.env.BID_API_KEY,
    },
  },
);

if (!response.ok) {
  const err = await response.json();
  throw new Error(err.error || response.statusText);
}

const dados = await response.json();
console.log(dados.gerado_em, dados.bids.abertos.length);
```

### Python (requests)

```python
import os
import requests

url = "https://seu-dominio.com/api/integracao/eventos"
headers = {"X-API-Key": os.environ["BID_API_KEY"]}
params = {"date": "2026-07-06"}

resp = requests.get(url, headers=headers, params=params, timeout=30)
resp.raise_for_status()
dados = resp.json()
```

---

## 6) Resposta de sucesso (HTTP 200)

Estrutura principal:

```json
{
  "bids": {
    "abertos": [],
    "encerrados": [],
    "vencedores": []
  },
  "wtpass": {
    "abertos": [],
    "encerrados": [],
    "vencedores": []
  },
  "portaria": {
    "data": "2026-07-06",
    "eventos": []
  },
  "gerado_em": "2026-07-06T14:30:00.000Z"
}
```

| Campo | Descrição |
|-------|-----------|
| `gerado_em` | Timestamp ISO 8601 (UTC) do momento em que a resposta foi montada |
| `bids` | Partidas (BIDs) agrupadas por situação |
| `wtpass` | Eventos WT Pass agrupados por situação |
| `portaria` | Resumo de portaria para a data consultada |

---

## 6.1) Consulta de usuários

Retorna todos os **usuários ativos** (`ativo = 1`) com dados para integração externa.

> **Atenção — dados pessoais:** este endpoint expõe **e-mails**. A mesma chave de API usada para eventos também autoriza esta consulta. Trate a chave como segredo de alto nível e restrinja o acesso.

### Requisição

```bash
curl -s -H "X-API-Key: SUA_CHAVE_AQUI" \
  "http://localhost:3005/api/integracao/usuarios"
```

Sem parâmetros de query.

### Resposta (HTTP 200)

```json
{
  "usuarios": [
    {
      "id": 1,
      "nome_completo": "João Silva",
      "email": "joao@empresa.com",
      "pontos": 150,
      "grupo_id": 2,
      "nome_grupo": "Colaboradores SP"
    }
  ],
  "total": 1,
  "gerado_em": "2026-07-06T20:00:00.000Z"
}
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `usuarios` | array | Lista de usuários ativos |
| `total` | number | Quantidade de registros em `usuarios` |
| `gerado_em` | string | Timestamp ISO 8601 (UTC) da resposta |

### Campos de cada usuário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID do usuário |
| `nome_completo` | string | Nome completo |
| `email` | string \| null | E-mail corporativo |
| `pontos` | number | Saldo efetivo (último registro em `historico_pontos`, ou `usuarios.pontos`) |
| `grupo_id` | number \| null | ID do grupo de apostas |
| `nome_grupo` | string \| null | Nome do grupo; `null` = sem grupo |

Usuários inativos **não** são incluídos. Campos sensíveis (CPF, senha, perfil, etc.) **não** são expostos.

---

## 7) Estrutura dos objetos

### 7.1) BID — listas `abertos` e `encerrados`

Cada item representa uma partida:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID da partida |
| `titulo` | string | Título do evento |
| `subtitulo` | string \| null | Subtítulo |
| `local` | string \| null | Local do evento |
| `imagem_url` | string \| null | URL pública do banner |
| `data_jogo` | string \| null | Data/hora do jogo (ISO 8601 UTC) |
| `data_inicio_apostas` | string \| null | Início das apostas |
| `data_limite_aposta` | string \| null | Limite para apostas |
| `data_apuracao` | string \| null | Data de apuração/sorteio |
| `status` | string | Ex.: `ABERTA`, `FINALIZADA` |
| `quantidade_premios` | number | Quantidade de ingressos/prêmios |
| `setor_evento_nome` | string \| null | Setor do evento |
| `grupo_id` | number \| null | ID do grupo de apostas; `null` = evento público |
| `nome_grupo` | string \| null | Nome do grupo de apostas; `null` = evento público |
| `total_apostas` | number | Total de lances |
| `total_participantes` | number | Usuários distintos que apostaram |

### 7.2) BID — lista `vencedores`

Mesmos campos da seção 7.1 (incluindo `grupo_id` e `nome_grupo`), mais o array `vencedores`:

| Campo (em `vencedores[]`) | Tipo | Descrição |
|---------------------------|------|-----------|
| `nome` | string | Nome do ganhador |
| `setor` | string \| null | Setor do colaborador |
| `lance` | number | Valor pago na aposta vencedora |
| `data_aposta` | string \| null | Data/hora do lance (ISO 8601 UTC) |

> Apenas partidas com status `FINALIZADA` entram em `vencedores`. Cada evento pode ter um ou mais ganhadores (conforme `quantidade_premios`).

### 7.3) WT Pass — listas `abertos` e `encerrados`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | ID do evento WT Pass |
| `titulo` | string | Título |
| `subtitulo` | string \| null | Subtítulo |
| `local` | string \| null | Local |
| `imagem_url` | string \| null | URL do banner |
| `data_evento` | string \| null | Data/hora do evento |
| `data_inicio_inscricao` | string \| null | Início das inscrições |
| `data_limite_inscricao` | string \| null | Fim das inscrições |
| `status` | string | Ex.: `ABERTO`, `ENCERRADO`, `REALIZADO`, `CANCELADO` |
| `vagas` | number | Total de vagas |
| `ocupadas` | number | Inscrições confirmadas (inclui fila ocupando vaga quando aplicável) |
| `fila_count` | number | Pessoas na fila de espera |
| `vagas_restantes` | number | `max(0, vagas - ocupadas)` |
| `partida_id` | number \| null | Partida BID vinculada, se houver |
| `grupo_id` | number \| null | ID do grupo (herdado da partida vinculada) |
| `nome_grupo` | string \| null | Nome do grupo; `null` se não houver partida vinculada |

**Classificação nas listas:**

| Lista | Status incluídos |
|-------|------------------|
| `abertos` | `ABERTO` |
| `encerrados` | `ENCERRADO`, `REALIZADO`, `CANCELADO` |

### 7.4) WT Pass — lista `vencedores`

Mesmos campos de evento encerrado, mais `vencedores[]`:

| Campo (em `vencedores[]`) | Tipo | Descrição |
|---------------------------|------|-----------|
| `nome` | string | Nome do inscrito |
| `setor` | string \| null | Setor |
| `posicao` | number \| null | Posição na inscrição |
| `status_inscricao` | string | Ex.: `INSCRITO`, `PRESENTE` |

### 7.5) Portaria — bloco `portaria`

Retorna eventos com data de jogo/evento na data consultada (`date`).

```json
{
  "data": "2026-07-06",
  "eventos": [
    {
      "id": 12,
      "tipo_evento": "BID",
      "titulo": "Final do Campeonato",
      "imagem_url": "https://seu-dominio.com/api/matches/12/banner",
      "data_evento": "2026-07-06T22:00:00.000Z",
      "partida_id": 12,
      "evento_rh_id": null,
      "grupo_id": 3,
      "nome_grupo": "Colaboradores SP",
      "totais": {
        "liberados": 45,
        "pendentes": 12,
        "por_tipo": {
          "BID": { "liberados": 30, "pendentes": 8 },
          "WT_PASS": { "liberados": 15, "pendentes": 4 }
        }
      },
      "por_empresa": [
        {
          "empresa": "Empresa A",
          "liberados": 20,
          "pendentes": 5,
          "por_tipo": {
            "BID": { "liberados": 12, "pendentes": 3 },
            "WT_PASS": { "liberados": 8, "pendentes": 2 }
          }
        }
      ]
    }
  ]
}
```

| Campo | Descrição |
|-------|-----------|
| `tipo_evento` | `BID` ou `WT_PASS` |
| `partida_id` | ID da partida (eventos BID) |
| `evento_rh_id` | ID do evento RH (eventos WT Pass) |
| `grupo_id` | ID do grupo de apostas (`null` = público ou sem partida vinculada) |
| `nome_grupo` | Nome do grupo de apostas |
| `totais` | Agregados gerais do evento (sem nomes ou CPFs) |
| `por_empresa` | Mesmos totais segmentados por empresa |

> A portaria **não expõe dados pessoais** — apenas contagens agregadas para uso em painéis externos.

---

## 8) Códigos de erro

| HTTP | Mensagem (`error`) | Causa provável |
|------|-------------------|----------------|
| `400` | `Formato de data inválido. Use YYYY-MM-DD.` | Parâmetro `date` em formato incorreto |
| `401` | `Chave de API não fornecida.` | Header `X-API-Key` ou `Authorization` ausente |
| `401` | `Chave de API inválida.` | Chave incorreta ou desatualizada |
| `503` | `Integração externa desativada.` | API desligada nas configurações |
| `500` | `Erro ao consultar eventos.` | Falha interna ao consultar eventos |
| `500` | `Erro ao consultar usuários.` | Falha interna ao consultar usuários |

Exemplo de resposta de erro:

```json
{
  "error": "Chave de API inválida."
}
```

---

## 9) Boas práticas

1. **Armazene a chave com segurança** — nunca a inclua em repositórios públicos ou no front-end. A chave dá acesso a eventos **e** e-mails de usuários.
2. **Trate erros 401 e 503** — verifique se a integração continua ativa e se a chave não foi regenerada.
3. **Use cache local** — a resposta consolida várias consultas internas; evite polling agressivo (ex.: intervalo mínimo de 1–5 minutos para dashboards).
4. **Valide `gerado_em`** — útil para saber a idade dos dados exibidos.
5. **Datas em UTC** — todos os campos de data/hora retornam ISO 8601 em UTC; converta no cliente conforme o fuso desejado.

---

## 10) Referência rápida

**Eventos:**

```http
GET /api/integracao/eventos?date=YYYY-MM-DD
X-API-Key: <chave-hex-64-chars>
Accept: application/json
```

Resposta: `bids` + `wtpass` + `portaria` + `gerado_em`.

**Usuários:**

```http
GET /api/integracao/usuarios
X-API-Key: <chave-hex-64-chars>
Accept: application/json
```

Resposta: `usuarios` + `total` + `gerado_em` (somente usuários ativos).

Configuração administrativa: **Configurações → Integração API externa** (perfil `ADMIN`).

---

## Intranet WTorre — sync local

A intranet **não consulta a API BID em cada request da home**. Um job em background (padrão: **15 min**) executa:

1. `GET /api/integracao/eventos`
2. `GET /api/integracao/usuarios`

Os payloads são persistidos em `bid_sync_snapshot` (MySQL). As rotas `/api/v1/bid/eventos-abertos` e `/api/v1/bid/meus-premios` leem o snapshot local e resolvem o usuário por:

1. `microsoft_id` (JWT Azure AD)
2. E-mail / local-part (fallback PNU)

Vitórias são cruzadas por `microsoft_id`, `usuario_id` ou `e-mail` em `vencedores[]`.

Admin: **Configurações → Integração BID** — status da sync e botão **Sincronizar agora**.
