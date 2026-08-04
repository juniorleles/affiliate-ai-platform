# Arquitetura — Plataforma Privada de IA para Marketing de Afiliados

Versão 1.0 · Documento vivo (atualizar a cada mudança estrutural relevante)

## 1. Princípios que guiam toda decisão técnica abaixo

- **Modular antes de distribuído.** Vamos construir um *monólito modular*: módulos com fronteiras
  claras (Discovery, Market Intelligence, Competitive Intelligence, AI Advisor, Google Ads,
  Monitoring, Affiliate Ops), rodando no mesmo processo/deploy. Microsserviços de verdade só
  se justificam quando um módulo específico precisar escalar/deployar separado dos outros —
  não antes. Isso mantém baixo acoplamento sem pagar o custo operacional de N serviços desde o dia 1.
- **n8n orquestra, a API decide.** n8n cuida de "quando" (agendamento, retries de alto nível,
  notificações pra Slack/e-mail, aprovações humanas) e "encadeamento entre sistemas externos".
  Toda regra de negócio (como calcular um score, quando pausar uma campanha, como validar
  resposta da IA) vive no backend, testável, versionada — nunca dentro de um nó do n8n.
- **Fila para trabalho pesado.** Chamadas de IA, sincronização com APIs de redes de afiliados
  e varredura de concorrentes são lentas, sujeitas a rate limit e podem falhar. Isso roda em
  fila (BullMQ + Redis), nunca de forma síncrona dentro de uma requisição HTTP.
- **Um contrato para "opinião de IA".** Toda resposta de IA (Claude ou OpenAI) que vira decisão
  de negócio passa por um schema validado antes de ser salva ou exibida — nunca texto livre
  interpretado "na confiança" pelo frontend. Já fizemos isso no analisador de campanha do MVP
  anterior; vamos generalizar esse padrão pra todos os módulos de IA.
- **Incremental de verdade.** Cada módulo abaixo tem uma versão "fina" que já entrega valor
  sozinha. Não vamos implementar os 6 módulos em paralelo — a seção 8 define a ordem.

---

## 2. Stack confirmada

| Camada | Escolha | Observação |
|---|---|---|
| Backend | Node.js (JavaScript) + Express ou Fastify | Fastify recomendado por performance e schema validation nativo (JSON Schema), mas Express funciona bem se a familiaridade for maior. |
| Banco de dados | PostgreSQL | Substitui o SQLite do MVP anterior — necessário pra volume, concorrência e `JSON`/`JSONB` nativo para os payloads de IA e snapshots. |
| Fila / cache | Redis + BullMQ | Não estava no seu documento, mas é necessário para as chamadas assíncronas de IA e scraping — ver seção 5. |
| Orquestração | n8n | Agendamento dos pipelines, alertas, glue entre sistemas. |
| IA | Claude (Anthropic) + OpenAI | Via camada de abstração única — ver seção 6. |
| Frontend | React | Dashboard único, consumindo a API interna. |
| IDE | Cursor | Com regras de projeto (`.cursor/rules/`) mantidas atualizadas conforme este documento evolui. |

---

## 3. Estrutura de pastas (monorepo)

```
affiliate-ai-platform/
├── apps/
│   ├── api/                          # Backend Node.js
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── discovery/         # Módulo 1
│   │   │   │   ├── market-intel/      # Módulo 2
│   │   │   │   ├── competitive-intel/ # Módulo 3
│   │   │   │   ├── ai-advisor/        # Módulo 4
│   │   │   │   ├── google-ads/        # Módulo 5
│   │   │   │   ├── monitoring/        # Módulo 6
│   │   │   │   └── affiliate-ops/     # Herdado do MVP anterior (afiliados, cliques, comissões)
│   │   │   ├── shared/
│   │   │   │   ├── db/                # cliente Postgres, migrations
│   │   │   │   ├── queue/             # setup BullMQ, definição de filas
│   │   │   │   ├── ai-provider/       # abstração Claude/OpenAI (seção 6)
│   │   │   │   ├── auth/
│   │   │   │   └── logger/
│   │   │   ├── jobs/                  # workers BullMQ (1 arquivo por tipo de job)
│   │   │   ├── routes/                # camada HTTP, fina — delega pros módulos
│   │   │   └── server.js
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
│   └── web/                           # Frontend React
│       └── src/
│           ├── features/              # espelha os módulos do backend
│           ├── components/
│           └── pages/
├── workflows/                         # exports .json dos workflows do n8n (versionados no git)
├── infra/
│   └── docker-compose.yml             # postgres, redis, n8n, api, web — sobe o ambiente inteiro local
├── docs/
│   ├── ARQUITETURA.md                 # este arquivo
│   └── decisoes/                      # 1 arquivo markdown por decisão técnica relevante (ADR)
└── .cursor/
    └── rules/                         # convenções por módulo, mantidas junto do código
```

Cada módulo em `modules/` segue o mesmo esqueleto interno, sempre:
```
modules/<nome>/
├── service.js       # regra de negócio, testável sem HTTP nem banco (recebe dados, devolve dados)
├── repository.js     # única camada que fala SQL para as tabelas desse módulo
├── routes.js          # endpoints HTTP finos, validam entrada e chamam service.js
└── <nome>.test.js     # testes unitários do service.js (o que mais importa testar)
```

---

## 4. Modelo de dados (PostgreSQL) — visão por módulo

Não é o DDL completo (isso é implementação, vem depois) — é o suficiente pra validar que os
módulos se conectam do jeito certo antes de escrever qualquer migration.

### Discovery (Módulo 1)
- `networks` — id, nome, tipo (`digistore24`, `clickbank`, `cj`, `impact`, `awin`, `partnerstack`), credenciais (referência, não a chave em texto puro), status
- `products` — id, network_id, external_id, nome, categoria, preço, tipo/valor de comissão, EPC, taxa de conversão, países permitidos (`jsonb`), url da página de vendas, primeira/última vez visto, status
- `product_snapshots` — histórico: product_id, capturado_em, preço, comissão, EPC, conversão naquele momento (sem isso não dá pra ver tendência, só foto)

### Market Intelligence (Módulo 2)
- `opportunity_scores` — product_id, score 0–100, sub-scores (demanda, concorrência, tendência,
  sazonalidade, qualidade da página, ticket médio), reasoning, modelo/versão usada, calculado_em

### Competitive Intelligence (Módulo 3)
- `competitors` — id, product_id (nullable — um concorrente pode anunciar vários produtos), nome, domínio
- `competitor_ads` — competitor_id, product_id, plataforma, headline, corpo, criativo (url), landing page, primeira/última vez visto, ativo
- `competitor_ad_snapshots` — competitor_ad_id, capturado_em, payload bruto (`jsonb`) — pra detectar mudança ao longo do tempo, não só o estado atual

### AI Advisor (Módulo 4)
- `ai_analyses` — tabela genérica reaproveitável por qualquer módulo que precise de "opinião
  estruturada de IA": subject_type (`product` | `campaign`), subject_id, tipo de pergunta,
  provider (`claude`|`openai`), modelo, resposta estruturada (`jsonb`, valida contra schema —
  seção 6), reasoning, criado_em. **É a mesma tabela/padrão que já usamos no `campaign_analyses`
  do MVP anterior, generalizada.**

### Google Ads (Módulo 5) — evolução direta do que já existe
- `google_ads_accounts`, `campaigns` (agora com `product_id` FK, ligando campanha ↔ produto do
  Discovery), `campaign_metrics_daily`, `keywords` (incluindo negativas), `ad_quality_snapshots`

### Monitoring (Módulo 6)
- `alerts` — tipo (`campaign_paused`, `ad_disapproved`, `impression_drop`, `billing_issue`,
  `other`), severidade, subject_type/subject_id, mensagem, status (`open`/`ack`/`resolved`), criado_em

### Affiliate Ops (herdado do MVP, migrado de SQLite → Postgres)
- `affiliates`, `clicks`, `conversions` — como já implementado, sem mudança de modelo, só de banco.

---

## 5. Fluxo de dados ponta a ponta

```
n8n (agendado, ex: a cada 6h)
   │
   ▼
POST /internal/jobs/discovery/sync  ──▶  enfileira job em BullMQ (fila "discovery")
                                              │
                                              ▼
                                    worker: discovery.service.js
                                    consulta APIs das redes de afiliados
                                    grava em products + product_snapshots
                                              │
                                              ▼
                                    ao terminar, enfileira 1 job por produto
                                    novo/atualizado na fila "market-intel"
                                              │
                                              ▼
                                    worker: market-intel.service.js
                                    calcula score determinístico (demanda, sazonalidade
                                    via dados de tendência) + 1 chamada de IA pra
                                    reasoning qualitativo → grava opportunity_scores
                                              │
                                              ▼
                          produtos com score acima de um limiar configurável
                          entram na fila "competitive-intel" (varredura só nos
                          produtos que já parecem valer a pena — evita gastar
                          cota de API/IA em produto ruim)
                                              │
                                              ▼
                                    worker: competitive-intel.service.js
                                    grava competitor_ads + snapshots
                                              │
                                              ▼
                          usuário (você), pelo dashboard React, pede ao AI Advisor:
                          "vale a pena anunciar este produto?" → chamada síncrona
                          (rápida o bastante pra não precisar de fila) que lê
                          products + opportunity_scores + competitor_ads e monta
                          o contexto pra IA responder as perguntas do Módulo 4
                                              │
                                              ▼
                          se a resposta for "sim, vale a pena": você cria a
                          campanha no Google Ads (manual ou com apoio da IA
                          pra sugerir estrutura/palavras-chave — Módulo 5)
                                              │
                                              ▼
                          Monitoring (Módulo 6) roda em paralelo, continuamente,
                          via n8n (ex: a cada 15 min) → GET /internal/jobs/monitoring/check
                          → compara métricas atuais com esperadas → grava alerts
                          → n8n manda notificação (Slack/e-mail/WhatsApp)
```

Ponto importante: **o AI Advisor nunca executa ações sozinho** (não pausa campanha, não muda
orçamento, não aprova produto). Ele sempre devolve uma recomendação estruturada; a ação é
manual ou, no máximo, sugerida como próximo passo pra você confirmar. Isso é decisão de
arquitetura, não só de produto — evita a IA tomar decisão financeira sem supervisão.

---

## 6. Camada de IA (Claude + OpenAI)

Interface única, os módulos não sabem qual provider está por trás:

```
shared/ai-provider/
├── index.js              # export { analyze }
├── claudeProvider.js
├── openaiProvider.js
└── schemas/               # 1 JSON Schema por tipo de análise
    ├── productOpportunity.schema.json
    ├── campaignVerdict.schema.json     # já existe, migrar do MVP anterior
    └── ...
```

`analyze({ task, context, schema })` decide o provider (config por `task`), monta o prompt,
chama a API, valida a resposta contra o `schema` (com `ajv`, por exemplo) e só então devolve —
se a validação falhar, tenta 1 retry pedindo correção, e se falhar de novo, lança erro (nunca
salva resposta fora do formato esperado).

**Decisão em aberto que preciso da sua confirmação (seção 9):** o motivo prático de ter dois
providers é redundância (se um cair ou tiver rate limit) ou tarefas diferentes por provider
(ex: Claude para reasoning qualitativo mais longo, OpenAI para algo específico como embeddings
de busca)? Isso muda a implementação da camada — vale decidir antes de construir os dois adaptadores.

---

## 7. Segurança e credenciais

Isso aqui merece atenção redobrada porque a plataforma vai guardar chaves de API de:
Digistore24, ClickBank, CJ, Impact, Awin, PartnerStack, Google Ads, Anthropic, OpenAI — oito
integrações externas com poder de gastar dinheiro ou expor dados de conta.

- Nenhuma credencial em texto puro no banco. Mesmo sendo uso privado/pessoal, usar ao menos
  criptografia simétrica em repouso (ex: `pgcrypto` no Postgres, ou uma lib como `node:crypto`
  com uma chave mestra fora do banco, vinda de variável de ambiente).
- `.env` nunca commitado (já era regra no MVP anterior, continua).
- Se em algum momento mais de uma pessoa acessar a plataforma, sai do modelo "uma `ADMIN_KEY`
  simples" (que valia para o MVP solo) para autenticação de usuário de verdade com hash de senha
  — já deixei uma tabela `users` prevista no modelo de dados por causa disso.
- Rate limiting e backoff exponencial em toda chamada a API externa (principalmente Google Ads
  e redes de afiliados, que penalizam abuso) — isso mora dentro dos workers da fila, não na rota HTTP.

---

## 8. Roadmap incremental (fases)

| Fase | Entrega | Por quê nessa ordem |
|---|---|---|
| **Fase 0** | Infra base: monorepo, `docker-compose` (Postgres + Redis + n8n), migração do módulo `affiliate-ops` existente (SQLite → Postgres), CI rodando testes | Sem isso, nada mais tem onde rodar. Reaproveita 100% da lógica de negócio já validada do MVP anterior. |
| **Fase 1** | Módulo 5 (Google Ads) completo + Módulo 6 (Monitoring) básico | Já tínhamos boa parte disso pronto no MVP anterior — é a parte de menor risco técnico e já gera valor imediato (você já tem campanhas rodando). |
| **Fase 2** | Módulo 1 (Discovery) para **uma única rede de afiliados** (a que você mais usa) | Provar o pipeline de ingestão com 1 integração antes de multiplicar por 6 redes. |
| **Fase 3** | Módulo 2 (Market Intelligence) sobre os produtos da Fase 2 + Módulo 4 (AI Advisor) respondendo as perguntas do documento original | Aqui a IA começa a dar opinião de verdade, mas ainda sobre dado só de 1 rede — mais fácil validar se a IA está "certa". |
| **Fase 4** | Módulo 3 (Competitive Intelligence) | O mais incerto tecnicamente (depende da decisão da seção 9 sobre fonte de dado) — deixado por último de propósito. |
| **Fase 5** | Expandir Discovery para as demais redes de afiliados + refinar scoring com dado real acumulado | Só multiplica integrações depois que o pipeline provou valor com uma. |

---

## 9. Decisões que preciso da sua confirmação antes de começar a Fase 0

1. **Fonte de dado do Módulo 3 (Inteligência Competitiva).** Não existe API pública do Google
   pra "ver todos os anúncios dos concorrentes". As opções realistas são: (a) contratar uma
   ferramenta de terceiros com API própria para isso (ex: SpyFu, SEMrush, Adbeat, BigSpy — cada
   uma com custo e cobertura diferentes), ou (b) scraping direto de landing pages/anúncios, que
   esbarra em termos de uso das plataformas e é tecnicamente frágil (quebra a cada mudança de
   layout). Recomendo (a). Qual caminho você quer seguir?
2. **Claude vs OpenAI (seção 6).** Redundância entre os dois, ou tarefas diferentes por provider?
3. **Single-user ou multi-user?** Só você vai acessar, ou outras pessoas do seu time também?
   Isso decide se a Fase 0 já entra com autenticação de usuário completa ou se a `ADMIN_KEY`
   simples do MVP anterior ainda serve por enquanto.
4. **Hospedagem.** Vai rodar isso local (sua máquina/servidor doméstico) ou num VPS/cloud? Muda
   como tratamos secrets (variável de ambiente local é suficiente vs. precisar de um secrets
   manager de verdade) e como o `docker-compose` da Fase 0 é desenhado.

Assim que você responder essas quatro, eu fecho os detalhes de implementação da Fase 0 e a
gente parte pro Cursor com escopo bem definido — nada de "código genérico" que depois precisa
ser jogado fora.
