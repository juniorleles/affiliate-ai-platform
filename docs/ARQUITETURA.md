# Arquitetura — Plataforma Privada de IA para Marketing de Afiliados

Versão 1.2 · Documento vivo (atualizar a cada mudança estrutural relevante)

Changelog:
- v1.1 incorporou o motor de viabilidade financeira (Economics), pesquisa de
  palavra-chave/leilão, compliance de produtor e auditoria de landing page — seção 5, nova.
- v1.2 transformou a seção 9 (roadmap) numa checklist testável por fase: cada fase agora tem
  objetivo, pré-requisito, escopo e critério de "pronto" explícito, pra nenhuma etapa ficar
  subjetiva ou esquecida.

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
  interpretado "na confiança" pelo frontend.
- **Calculável primeiro, IA depois.** Tudo que pode ser determinado por fórmula (CPC máximo,
  margem, ROI, comparação com trava de segurança) é calculado por código puro, testável, e
  entra como fato dado no contexto da IA — nunca como algo que a IA "estima". A IA entra
  pra julgar o que não é redutível a fórmula (saturação de nicho, qualidade de copy, risco
  qualitativo). Isso é o motivo de existir a seção 5 abaixo.
- **Incremental de verdade.** Cada módulo abaixo tem uma versão "fina" que já entrega valor
  sozinha. Não vamos implementar tudo em paralelo — a seção 9 define a ordem.
- **Descoberta automática não é o diferencial — disciplina financeira e due diligence são.**
  (Reorientação de 2026-08-04, depois de confirmar que a maioria das redes de afiliados
  fecha ou proíbe contratualmente a navegação automatizada do marketplace — ver Fase 2 e
  a decisão de não usar scraping mesmo via terceiros.) Isso significa que "achar produto"
  continua sendo trabalho humano deliberado (cadastro manual/em lote), e o valor real da
  plataforma está em:
  1. **Economics (5.1)** — nunca deixar entrar campanha que não fecha a conta, calculado
     antes de gastar, não descoberto depois no extrato.
  2. **Compliance + Auditoria de LP (5.3, 5.4)** — evitar prejuízo não financeiro (conta
     de anúncio banida, comissão perdida por parâmetro quebrado) — isso é tão ou mais
     caro que escolher produto errado.
  3. **Loop de aprendizado** — toda análise de IA grava veredito + confiança; o sistema
     precisa também gravar o **resultado real** depois, pra virar histórico calibrável ao
     longo do tempo (não só uma opinião solta por chamada). Ver `ai_analyses.outcome_*`
     na seção 4.
  Por causa disso, Compliance + Auditoria de LP sobem de prioridade no roadmap (seção 9)
  — não são mais "depois que sobrar tempo", são parte do diferencial central.

---

## 2. Stack confirmada

| Camada | Escolha | Observação |
|---|---|---|
| Backend | Node.js (JavaScript) + Express ou Fastify | Fastify recomendado por performance e schema validation nativo (JSON Schema), mas Express funciona bem se a familiaridade for maior. |
| Banco de dados | PostgreSQL | Necessário pra volume, concorrência e JSON/JSONB nativo para os payloads de IA e snapshots. |
| Fila / cache | Redis + BullMQ | Necessário para as chamadas assíncronas de IA e scraping — ver seção 6. |
| Orquestração | n8n | Agendamento dos pipelines, alertas, glue entre sistemas. |
| IA | Claude (Anthropic) + OpenAI | Via camada de abstração única — ver seção 7. |
| Frontend | React | Dashboard único, consumindo a API interna. |
| IDE | Cursor | Com regras de projeto (.cursor/rules/) mantidas atualizadas conforme este documento evolui. |

---

## 3. Estrutura de pastas (monorepo)

```
affiliate-ai-platform/
├── apps/
│   ├── api/                          # Backend Node.js
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── discovery/         # Módulo 1 (+ compliance.js, lpAudit.js — seção 5)
│   │   │   │   ├── market-intel/      # Módulo 2 (+ economics.js — seção 5)
│   │   │   │   ├── competitive-intel/ # Módulo 3
│   │   │   │   ├── ai-advisor/        # Módulo 4
│   │   │   │   ├── google-ads/        # Módulo 5 (+ keywordResearch.js — seção 5)
│   │   │   │   ├── monitoring/        # Módulo 6
│   │   │   │   └── affiliate-ops/     # Herdado do MVP anterior (afiliados, cliques, comissões)
│   │   │   ├── shared/
│   │   │   │   ├── db/                # cliente Postgres, migrations
│   │   │   │   ├── queue/             # setup BullMQ, definição de filas
│   │   │   │   ├── ai-provider/       # abstração Claude/OpenAI (seção 7)
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
│   └── docker-compose.yml             # postgres, redis, n8n, api, web
├── docs/
│   ├── ARQUITETURA.md                 # este arquivo
│   └── decisoes/                      # 1 arquivo markdown por decisão técnica relevante (ADR)
└── .cursor/
    └── rules/                         # convenções por módulo, mantidas junto do código
```

Cada módulo em modules/ segue o mesmo esqueleto interno, sempre:
```
modules/<nome>/
├── service.js       # regra de negócio, testável sem HTTP nem banco
├── repository.js     # única camada que fala SQL para as tabelas desse módulo
├── routes.js          # endpoints HTTP finos, validam entrada e chamam service.js
└── <nome>.test.js     # testes unitários do service.js
```
Sub-serviços determinísticos (ex: economics.js) seguem a mesma regra de commission.js do
affiliate-ops: função pura, sem SQL, sem HTTP, 100% testável isoladamente.

---

## 4. Modelo de dados (PostgreSQL) — visão por módulo

Não é o DDL completo (isso é implementação, vem depois) — é o suficiente pra validar que os
módulos se conectam do jeito certo antes de escrever qualquer migration.

### Discovery (Módulo 1)
- networks — id, nome, tipo (digistore24, clickbank, cj, impact, awin, partnerstack), credenciais (referência, não a chave em texto puro), status
- products — id, network_id, external_id, nome, categoria, preço, tipo/valor de comissão, EPC, taxa de conversão, países permitidos (jsonb), url da página de vendas, primeira/última vez visto, status
- product_snapshots — histórico: product_id, capturado_em, preço, comissão, EPC, conversão naquele momento
- producer_compliance (novo — seção 5.3) — product_id, allows_brand_bidding (bool), allows_bottom_funnel (bool), requires_presell (bool), niche_sensitivity (normal|sensitive|black), compliance_notes, source (manual|network_api|ai_inferred), checked_at
- landing_page_audits (novo — seção 5.4) — product_id, audited_at, has_cta (bool), has_vsl (bool), load_time_ms, offer_clarity_score (0–100), affiliate_params_preserved (bool), raw_findings (jsonb)

### Market Intelligence (Módulo 2)
- opportunity_scores — product_id, score 0–100, sub-scores (demanda, concorrência, tendência, sazonalidade, qualidade da página, ticket médio), reasoning, modelo/versão usada, calculado_em
- product_economics (novo — seção 5.1) — product_id, comissao_usada, taxa_conversao_esperada, margem_desejada_pct, cpc_maximo_calculado, comissao_minima_ok (bool), roi_estimado_pct, status (viavel|rejeitado_por_economics|rejeitado_por_comissao_minima), calculado_em

### Competitive Intelligence (Módulo 3)
- competitors — id, product_id (nullable), nome, domínio
- competitor_ads — competitor_id, product_id, plataforma, headline, corpo, criativo (url), landing page, primeira/última vez visto, ativo
- competitor_ad_snapshots — competitor_ad_id, capturado_em, payload bruto (jsonb)

### AI Advisor (Módulo 4)
- ai_analyses — tabela genérica: subject_type (product|campaign), subject_id, tipo de pergunta, provider (claude|openai), modelo, resposta estruturada (jsonb, valida contra schema — seção 7), reasoning, criado_em.
- Loop de aprendizado (novo, 2026-08-04): outcome_status (pending|confirmed_good|confirmed_bad|ignored), outcome_notes, outcome_recorded_at — permite registrar, depois do fato, se o veredito da IA bateu com o resultado real. Sem isso, cada análise é uma opinião isolada; com isso, dá pra medir a taxa de acerto ao longo do tempo por tipo de pergunta/produto/campanha.

### Google Ads (Módulo 5)
- google_ads_accounts, campaigns (com product_id FK), campaign_metrics_daily, keywords, ad_quality_snapshots
- keyword_metrics (novo — seção 5.2) — product_id (nullable), keyword_text, avg_monthly_searches, competition_level (low|medium|high), competition_index (0–100), top_of_page_bid_low, top_of_page_bid_high, captured_at

### Monitoring (Módulo 6)
- alerts — tipo (campaign_paused, ad_disapproved, impression_drop, billing_issue, other), severidade, subject_type/subject_id, mensagem, status (open/ack/resolved), criado_em

### Affiliate Ops (herdado do MVP, migrado de SQLite → Postgres)
- affiliates, clicks, conversions — como já implementado, sem mudança de modelo, só de banco.

---

## 5. Motor de Viabilidade Financeira e Compliance

Esta seção formaliza 4 blocos de regra que faltavam no desenho original — eles decidem se um
produto entra ou não no funil de campanhas, antes de qualquer centavo ser investido. Nenhum
dos 4 existia implementado até a v1.0 deste documento; eram só schema genérico.

### 5.1 Economics — viabilidade financeira (dono: market-intel)

Cálculo determinístico, sem IA. Arquivo: modules/market-intel/economics.js, função pura.

```
CPC de equilíbrio    = comissao_esperada x taxa_conversao_esperada
CPC máximo aceitável = CPC de equilíbrio x (1 - margem_desejada_pct)
ROI estimado         = (comissao_esperada x conversoes_esperadas - custo_estimado) / custo_estimado
```

Regras de negócio:
- Trava de comissão mínima: se comissao_esperada for menor que um limiar configurável (ex:
  R$ 20), o produto é marcado rejeitado_por_comissao_minima antes de calcular qualquer outra
  coisa. Produto de comissão baixa não compensa o esforço de análise.
- Rejeição automática por leilão caro: quando o dado do item 5.2 (CPC médio do leilão)
  chegar, se top_of_page_bid médio for maior que cpc_maximo_calculado, o produto vira
  rejeitado_por_economics — isso acontece antes de gastar cota de IA analisando o produto.
- O resultado desse cálculo entra como fato pré-computado no contexto passado pra IA (schema
  productOpportunity, seção 7) — a IA não estima CPC máximo do zero, ela recebe o número
  calculado e comenta sobre ele no reasoning.

### 5.2 Pesquisa de palavra-chave e leilão (dono: google-ads)

Usa uma API do Google Ads diferente da que já implementamos na Fase 1 (aquela lê métricas de
campanhas existentes via recurso campaign; esta usa o Keyword Plan Idea Service, que não
depende de haver campanha rodando — é pesquisa prévia).

Arquivo novo: modules/google-ads/keywordResearch.js. Retorna, por palavra-chave: volume médio
mensal de busca, nível/índice de competição (proxy pro número de anunciantes — o Google não
expõe "número exato de concorrentes", só um índice), faixa de lance pro topo da página
(top_of_page_bid_low/high).

Dependência a confirmar (seção 10, item novo): o Keyword Plan Idea Service normalmente exige
nível de acesso Basic/Standard do developer token — acesso Test (suficiente pra tudo que
fizemos na Fase 1) pode não bastar aqui. Verificar isso é o primeiro passo antes de
implementar esta subseção.

### 5.3 Compliance do produtor (dono: discovery; classificação de nicho: ai-advisor)

Dois níveis, propositalmente separados:
- Fatos objetivos (arquivo modules/discovery/compliance.js, tabela producer_compliance):
  permissão de disputar a marca do produtor (brand bidding), permissão de anunciar direto pro
  fundo de funil, exigência de presell. Vem do que a rede de afiliados expõe, ou é preenchido
  manualmente quando a rede não expõe isso via API (esperar preenchimento manual no começo).
- Classificação de nicho e recomendação (novo schema de IA complianceClassification, seção 7):
  dado o nome/categoria/página de vendas do produto, a IA classifica sensibilidade
  (normal/sensitive/black) e recomenda se Presell/Cloaker é necessário. Julgamento
  qualitativo — retorna estruturado e nunca decide sozinha.

### 5.4 Auditoria de landing page (dono: discovery)

Dois tipos de checagem, de natureza bem diferente — importante não misturar:

1. Checagem técnica/determinística: a página carrega rápido? Os parâmetros de afiliado
   (subid, click id) sobrevivem até o checkout? Testável com automação de navegador
   (Playwright/Puppeteer): abrir a LP com um parâmetro de teste na URL, seguir o funil até o
   checkout, verificar se o parâmetro ainda está lá. Decisão em aberto (seção 10, item novo):
   isso roda automaticamente e periodicamente (custo de infra: navegador headless), ou fica
   manual/sob demanda por enquanto?
2. Checagem qualitativa via IA (novo schema landingPageAudit, seção 7): presença de CTA claro,
   presença de VSL, clareza da oferta. Precisa decidir se a IA analisa o HTML/texto da página
   ou uma screenshot (visão) — screenshot é mais fiel pra "isso parece uma página de vendas de
   qualidade?", HTML é mais barato e determinístico pra "existe um elemento de vídeo ou link de
   VSL na página?". Recomendo começar por HTML/texto e evoluir pra screenshot se necessário.

O resultado dos dois tipos vai pra mesma tabela landing_page_audits (seção 4), mas
affiliate_params_preserved e load_time_ms vêm do check técnico, has_cta/has_vsl/
offer_clarity_score vêm da IA — a coluna raw_findings (jsonb) guarda o detalhe de cada um.

---

## 6. Fluxo de dados ponta a ponta

```
n8n (agendado, ex: a cada 6h)
   |
   v
POST /internal/jobs/discovery/sync  -->  enfileira job em BullMQ (fila "discovery")
                                              |
                                              v
                                    worker: discovery.service.js
                                    consulta APIs das redes de afiliados
                                    grava em products + product_snapshots
                                              |
                                              v
                                    enfileira 1 job por produto novo/atualizado
                                    na fila "market-intel"
                                              |
                                              v
                          worker: market-intel — PRIMEIRO passo: economics.js (5.1)
                          calcula CPC máximo, checa trava de comissão mínima.
                          Se já reprovar aqui (comissão baixa), PARA — não gasta
                          cota de Keyword Planner nem de IA com produto descartado.
                                              |
                                              v
                          se passou: enfileira job na fila "google-ads-keyword-research" (5.2)
                          busca volume de busca + CPC de leilão da palavra-chave do produto
                                              |
                                              v
                          de volta no market-intel: compara CPC do leilão vs CPC máximo (5.1).
                          Se leilão mais caro, rejeitado_por_economics, PARA de novo.
                          Se passou: calcula score determinístico (demanda, sazonalidade)
                          + 1 chamada de IA (schema productOpportunity, já com CPC máximo
                          e dados do leilão como fatos no contexto) -> grava opportunity_scores
                                              |
                                              v
                          em paralelo, dentro do discovery: compliance.js (5.3) preenche fatos
                          objetivos (ou aguarda preenchimento manual) -> chama IA (schema
                          complianceClassification) pra classificar sensibilidade de nicho
                          -> lpAudit.js (5.4) roda checagem técnica + IA sobre a landing page
                                              |
                                              v
                          produtos com score acima de um limiar E sem rejeição por
                          economics/compliance entram na fila "competitive-intel"
                                              |
                                              v
                                    worker: competitive-intel.service.js
                                    grava competitor_ads + snapshots
                                              |
                                              v
                          você, pelo dashboard React, pede ao AI Advisor:
                          "vale a pena anunciar este produto?" -> lê TUDO que foi calculado/
                          coletado acima (economics, keyword, compliance, LP audit,
                          competitive intel) e responde as perguntas do Módulo 4 com
                          contexto completo, não só a opinião solta da IA
                                              |
                                              v
                          se sim: você cria a campanha no Google Ads (Módulo 5)
                                              |
                                              v
                          Monitoring (Módulo 6) roda em paralelo, continuamente,
                          e AGORA também compara o CPC real da campanha rodando contra
                          o cpc_maximo_calculado (5.1) — não é só "impressão caiu",
                          é "seu CPC real furou o teto que você mesmo definiu"
```

Ponto importante, sem mudança: o AI Advisor nunca executa ações sozinho. Ele sempre devolve
uma recomendação estruturada; a ação é manual ou, no máximo, sugerida pra você confirmar.

---

## 7. Camada de IA (Claude + OpenAI)

Interface única, os módulos não sabem qual provider está por trás:

```
shared/ai-provider/
├── index.js                               # export { analyze }
├── claudeProvider.js
├── openaiProvider.js
└── schemas/                                # 1 JSON Schema por tipo de análise
    ├── productOpportunity.schema.json       # existente — agora recebe CPC máximo como fato
    ├── campaignVerdict.schema.json          # existente
    ├── complianceClassification.schema.json # novo — seção 5.3
    └── landingPageAudit.schema.json          # novo — seção 5.4
```

analyze({ task, context, schema }) decide o provider (config por task), monta o prompt, chama
a API, valida a resposta contra o schema (com ajv) e só então devolve — se a validação falhar,
tenta 1 retry pedindo correção, e se falhar de novo, lança erro.

Decisão em aberto (seção 10): motivo prático de ter dois providers — redundância ou tarefas
diferentes por provider? Isso muda a implementação da camada.

---

## 8. Segurança e credenciais

Isso aqui merece atenção redobrada porque a plataforma vai guardar chaves de API de:
Digistore24, ClickBank, CJ, Impact, Awin, PartnerStack, Google Ads, Anthropic, OpenAI — oito
integrações externas com poder de gastar dinheiro ou expor dados de conta.

- Nenhuma credencial em texto puro no banco. Mesmo sendo uso privado/pessoal, usar ao menos
  criptografia simétrica em repouso (ex: pgcrypto no Postgres, ou node:crypto com uma chave
  mestra fora do banco, vinda de variável de ambiente).
- .env nunca commitado.
- Se em algum momento mais de uma pessoa acessar a plataforma, sai do modelo "uma ADMIN_KEY
  simples" para autenticação de usuário de verdade com hash de senha — já existe a tabela
  users prevista no modelo de dados por causa disso.
- Rate limiting e backoff exponencial em toda chamada a API externa — isso mora dentro dos
  workers da fila, não na rota HTTP.
- Novo, por causa da seção 5.4: se a checagem técnica de LP usar automação de navegador
  (Playwright/Puppeteer), isso roda isolado (container próprio ou processo separado do worker
  principal) — navegador headless tem superfície de ataque e consumo de recursos diferentes.
- Bug real corrigido em 2026-08-04 — comparação de moeda: nenhuma parte do sistema
  rastreava moeda até esse dia. commissionValue de um produto (ex: EUR, vindo da
  Digistore24) estava sendo comparado direto com cpcLeilao (vindo do leilão do
  Google Ads, na moeda da conta) como se fossem a mesma unidade. Isso invalidou 2
  conclusões de rejeitado_por_economics que já tínhamos aceito como corretas antes
  de perceber o erro. Corrigido com: coluna products.currency,
  google-ads/googleAdsClient.js#fetchAccountCurrency() (consulta a moeda real da
  conta via GAQL, nunca assume) e shared/fx.js (conversão com taxa manual
  configurável em .env, nunca inventa taxa — lança erro se não configurada). Lição
  pro resto do projeto: qualquer novo módulo que compare valores monetários vindos
  de fontes diferentes (rede de afiliados, Google Ads, IA estimando orçamento)
  precisa checar moeda explicitamente — não assumir que bate.

---

## 9. Roadmap incremental — fases com critério de teste

Regra geral: **nenhuma fase começa sem os pré-requisitos da anterior confirmados**, e
**nenhuma fase é considerada concluída sem passar pela sua checklist de teste**. A checklist
é sempre uma mistura de (a) teste automatizado (quando fizer sentido escrever) e (b) verificação
manual pontual (quando o custo de automatizar não compensa, ex: "olhar se o produto retornado
é real" — é 1 vez, não precisa de teste automatizado pra isso).

Cada fase abaixo segue o mesmo formato: **Objetivo → Pré-requisito → Escopo → Checklist de
teste → Definição de pronto**.

---

### Fase 0 — Infra + Affiliate Ops
**Status: ✅ concluída.** Checklist abaixo fica registrada por completude (não precisa
re-executar, a menos que algo mude nessa área).

- Objetivo: ter onde tudo mais vai rodar, sem perder a lógica de negócio já validada do MVP anterior.
- Pré-requisito: nenhum.
- Escopo: `docker-compose`, migrations, módulo `affiliate-ops` migrado de SQLite → Postgres.
- Checklist de teste:
  - [x] `docker compose up` sobe Postgres, Redis, n8n sem erro
  - [x] `npm run migrate` aplica as migrations sem erro e é idempotente (rodar 2x não duplica nem falha)
  - [x] `npm test` passa os testes de comissão
  - [x] Cadastro de afiliado gera `referral_code` único; login retorna JWT válido
  - [x] Clique em `/api/r/:code` grava em `clicks` e redireciona corretamente
  - [x] Conversão via `/api/conversions` calcula comissão certa e liga ao clique certo
  - [x] Dashboard admin carrega sem erro com banco vazio e com dados de seed
- Definição de pronto: todos os itens acima marcados, sem depender de credencial externa nenhuma.

---

### Fase 1 — Google Ads + Monitoring
**Status: ✅ concluída e testada com conta real** (2026-08-04, conta MagicZap,
customer_id 7169854441).

- Objetivo: métricas de campanha reais entrando no sistema + primeiro alerta automático.
- Pré-requisito: developer token do Google Ads (ao menos nível Test) configurado no `.env`.
- Escopo: sync de campanhas, análise de IA por campanha, detecção de campanha pausada/queda de impressão.
- Checklist de teste:
  - [x] Sync grava métricas diárias sem duplicar — 5 campanhas / 25 métricas na 1ª rodada, 2ª rodada manteve 5/25, 0 duplicatas
  - [x] Análise de IA retorna JSON validado numa campanha com dado real — `verdict: pause`, `confidence: medium`, reasoning em pt-BR
  - [x] Análise de IA numa campanha **sem** dado sincronizado retorna erro claro (400) — confirmado, sem travar `/health`
  - [x] Teste de monitoramento: 2 alertas `campaign_paused` gerados corretamente (campanhas já estavam PAUSED de fato)
  - [x] Frontend mostra veredito ("Pausar"), expande reasoning, aceita edição de meta CPA/ROAS
- Definição de pronto: ✅ atingida — todos os itens confirmados com conta real.
- **Nota de negócio, não só técnica**: a primeira análise real já recomendou pausar 1
  campanha (as 2 pausadas detectadas pelo monitoring eram ações manuais já feitas na
  conta, separadas dessa recomendação da IA) — vale revisar o reasoning completo antes
  de agir, mas registra aqui que o sistema já está gerando sinal de decisão real.

---

### Fase 2 — Discovery (1 rede) + Economics (5.1)
**Status: 🟡 código completo, ⏳ pendente de teste com credencial real.**
Rede escolhida: **Digistore24**.

- Objetivo: primeiro produto real entrando no sistema, e o cálculo de viabilidade financeira funcionando isoladamente.
- Pré-requisito: `DIGISTORE24_API_KEY` no `.env` (Digistore24 → configurações de conta → chave de API, permissão `readonly` já basta) + limiar de comissão mínima — usando **R$ 20** como padrão até você definir outro valor.
- Escopo: connector Digistore24 (`discovery/connectors/digistore24.js`), `economics.js` completo (`market-intel`), `syncNetwork()` já roda Economics automaticamente pra cada produto sincronizado.
- ⚠️ **Bloqueio CONFIRMADO (2026-08-04)**: `listMarketplaceEntries` foi checada
  contra a descrição oficial no Swagger — *"Lists all marketplace data of the
  vendor including statistical numbers"*. Ou seja: essa função lista as entradas
  de marketplace que **você publicou como vendedor**, não o catálogo público que
  um afiliado navega. **Não existe função de API documentada para "buscar o
  marketplace geral como afiliado"** no Digistore24 — isso parece ser uma
  funcionalidade só de UI. Confirmado com conta real: `count: 0` fazia sentido
  o tempo todo (a conta não publica produtos próprios).
  **Decisão**: descoberta automática de produtos via API não é viável para o
  Digistore24 no momento. `POST /api/products/manual` (e sua versão em lote,
  `POST /api/products/manual/bulk`) é o caminho oficial pra alimentar o Discovery
  com produtos dessa rede — você copia os dados da UI, o pipeline de Economics
  roda igual. **Vale abrir chamado com o suporte do Digistore24** perguntando se
  existe uma forma de automatizar isso (ex: feed RSS/CSV de ofertas, ou uma
  função de API não documentada) antes de assumir que é impossível de vez — mas
  isso não bloqueia mais o progresso.
  **Lição para a Fase 5**: nem toda rede de afiliados expõe "navegar o
  marketplace" via API — checar isso é o primeiro passo antes de investir tempo
  em qualquer connector novo, não o último.
- Checklist de teste:
  - [ ] Connector autentica na rede escolhida e retorna ao menos 1 produto real (conferir manualmente que os dados fazem sentido: nome, comissão, preço batem com o que aparece no painel da rede)
  - [ ] `upsertProducts` grava produto + snapshot sem duplicar quando roda de novo (mesmo `external_id` = update, não insert novo)
  - [x] Testes unitários de `economics.js` — 10/10 passando: CPC de equilíbrio, aplicação de margem, trava de comissão mínima (ativando E desativando), caso de borda `taxaConversaoEsperada = 0` (marca `dado_insuficiente`, não lança erro nem aprova/rejeita), rejeição por leilão caro, validação de entrada
  - [ ] Endpoint de listagem (`GET /api/products`) retorna produtos já com o `economics_status` certo (`viavel` / `rejeitado_por_comissao_minima`)
- Definição de pronto: 1 produto real passou pelo pipeline completo de Discovery + Economics e o status faz sentido pra alguém que conhece esse produto (você).
- **Endpoints disponíveis**:
  - `POST /api/products/sync/digistore24` (admin) — ⚠️ sempre retorna `synced: 0` (bloqueio confirmado acima, não é mais esperado corrigir isso via código)
  - `POST /api/products/manual` (admin) — cadastro manual de 1 produto, caminho principal por agora
  - `POST /api/products/manual/bulk` (admin) — cadastro em lote, body `{ products: [...], minCommission? }`
  - `GET /api/products` (admin) — lista com `economics_status` incluído
  - `POST /api/market-intel/economics/evaluate` (admin) — testa a fórmula isoladamente, sem produto real

---

### Fase 2b — Pesquisa de palavra-chave/leilão (5.2)
**Status: ✅ concluída, re-testada com conversão de moeda corrigida (2026-08-04).**
- Objetivo: dado de leilão real entrando na equação de Economics.
- Pré-requisito: ~~nível de acesso do developer token~~ ✅ resolvido (Acesso Básico confirmado, seção 10 item 5).
- Escopo: `keywordResearch.js` (`google-ads`), tabela `keyword_metrics`, `researchKeywordsForProduct()` já re-avalia Economics automaticamente com o CPC de leilão — **agora convertendo moeda antes de comparar** (`shared/fx.js`).
- Checklist de teste:
  - [x] Chamada real ao Keyword Plan Idea Service — seed "amino acid supplement", 20 ideias retornadas, **zero avisos `[keyword-research]`** (parsing defensivo funcionou de primeira, sem precisar ajustar `normalizeIdea()`)
  - [x] Dados plausíveis: volume de busca e faixa de CPC condizentes com nicho de suplemento, categoria competitiva
  - [x] Grava em `keyword_metrics` sem erro
  - [x] **Re-teste com moeda corrigida**: conta confirmada em BRL (`GET /api/campaigns/account-currency`), `FX_EUR_TO_ACCOUNT_CURRENCY=5.90` configurado. Leilão de R$ 17,71 (bruto) virou **€ 3,00** depois de convertido — contra teto de € 2,94. Resultado: `rejeitado_por_economics`, mas por uma margem de **~2%**, não os "6x mais caro" que o bug sugeria antes. Isso é uma decisão de risco, não uma rejeição óbvia — ver nota abaixo.
- Definição de pronto: ✅ atingida.
- **Nota estratégica**: o teto de € 2,94 já embute 30% de margem de segurança (`margemDesejadaPct` padrão). Com dado tão perto do limite, vale considerar: (a) rodar com margem menor (ex: 20%) se você tiver confiança na conversão real do produto, já que "top of page bid" é uma faixa estimada, não o preço garantido que você pagaria; (b) testar outras palavras-chave de cauda longa (ex: "advanced amino formula reviews", que já veio na mesma consulta com bid de € 0,43–2,96 depois de convertido — dentro do teto).
- **Endpoints**: `POST /api/campaigns/keyword-research/:productId` (body opcional `{ seedKeyword?, minCommission? }`), `GET /api/campaigns/keyword-research/:productId` (histórico), `GET /api/campaigns/account-currency`

---

### Fase 3 — Compliance (5.3) + Auditoria de LP (5.4)
**Status: ✅ concluída e testada com dado real (2026-08-04).**
**Prioridade elevada em 2026-08-04** — ver seção 1: com descoberta automática fora de
alcance pra maioria das redes, isso deixou de ser "nice to have depois" e virou parte
do diferencial central (evitar prejuízo não financeiro é tão importante quanto achar
produto bom).

**Decisão registrada (seção 10, item 6)**: Auditoria de LP é **manual**, não
Playwright — você preenche `hasCta`/`hasVsl`/`affiliateParamsPreserved` no momento
do cadastro, olhando a página. Não existe checagem por IA/visão pra LP nesta fase
(diferente do desenho original) — simplificação consciente, registrada aqui pra não
"redescobrir" essa decisão numa conversa futura achando que falta implementar.

- Objetivo: proteção contra prejuízo não financeiro (conta banida, comissão perdida).
- Pré-requisito: ao menos 1 produto cadastrado (manual ou em lote, Fase 2) pra valer a pena auditar.
- Escopo: `compliance.js` (`discovery`) delega classificação ao `ai-advisor`; `lpAudit.js` (`discovery`) só persiste registro manual.
- Checklist de teste:
  - [x] **Compliance testado com dado real (2026-08-04)**: 3 produtos reais (Advanced Amino Formula, CircO2 Nitric Oxide Booster, Advanced Mitochondrial Formula) classificados como `sensitive`, `requires_presell_recommendation: true`, com `risk_flags` específicos citando as alegações reais de cada produto (não genéricos). Confirmado gravando em `ai_analyses` (`question_type: compliance_niche_classification`, `outcome_status: pending`) — dentro do loop de aprendizado.
  - [x] **Checagem técnica de LP testada com dado real (2026-08-04)**: produto "Advanced Amino Formula", link promocional `#aff=Serafim38` — parâmetro confirmado presente até a página de checkout (teste manual real, navegador anônimo). Achado técnico relevante: o parâmetro vai por fragmento de URL (`#`, não `?`), que depende de JavaScript da página pra ser repassado — mais frágil que query string comum, vale reconferir periodicamente, não é "testou uma vez, garantido pra sempre".
  - ~~Checagem de IA sobre a LP~~ — não se aplica mais (decisão acima: 100% manual)
- Definição de pronto: ✅ **atingida (2026-08-04)** — 1 produto real com `producer_compliance` (classificação de nicho via IA, com risk_flags específicos) e `landing_page_audits` (CTA/VSL/preservação de parâmetro confirmados manualmente) preenchidos de ponta a ponta.

---

### Fase 3b — Market Intelligence + AI Advisor (perguntas do Módulo 4)
**Status: ✅ concluída e testada com dado real (2026-08-04).**
- Objetivo: a IA respondendo, com contexto completo, as 8 perguntas do documento original.
- Pré-requisito: ~~Fases 2 e 2b concluídas~~ ✅ + Claude/OpenAI (seção 10, item 2) — **aplicado o default**: só Claude por ora (`DEFAULT_AI_PROVIDER=claude`), decisão nunca formalmente respondida mas o sistema já opera assim desde o início; considerar resolvido na prática.
- Escopo: `scoring.js` (sub-scores determinísticos, testado — 6/6), `market-intel/service.js#scoreProduct()` (orquestra score + chama IA), `ai-advisor/service.js#evaluateProductOpportunity()` (as 8 perguntas, schema `productOpportunity`).
- Detalhe de implementação: chamada de IA é **pulada** quando `economics.status === 'rejeitado_por_comissao_minima'` (rejeição trivial, não precisa de julgamento) — mas **continua rodando** pra `rejeitado_por_economics` (caso de borda real, vale testar se a IA recomenda `false` corretamente, ou identifica uma keyword alternativa mais barata).
- ⚠️ **Incidente corrigido no mesmo dia — limite de tokens**: a primeira chamada real truncou o JSON (schema `productOpportunity` é maior que os outros — 2 arrays + reasoning de até 200 palavras — e o limite padrão de 800 tokens não coube). Corrigido com limite **configurável por chamada** (`shared/ai-provider/index.js` agora aceita `maxTokens` e repassa pro provider), `evaluateProductOpportunity()` pede 2048 especificamente, os outros (veredito de campanha, compliance) continuam em 800 — evita pagar o custo de um limite alto em TODAS as chamadas só porque uma precisa.
- Checklist de teste:
  - [x] Score calculado e gravado — Advanced Amino Formula: score geral 51 (demand 100, competition 0, LP quality 85, economics implícito 25); CircO2: score 75 (só economics disponível, resto null por falta de keyword/LP audit pra esse produto — comportamento correto, sub-score ausente vira null, não inventado)
  - [x] As 8 perguntas do documento original têm campo correspondente no schema `productOpportunity` — confirmado
  - [x] **Contrato "calculável primeiro, IA depois" verificado com dado real**: `max_recommended_cpc` retornado pela IA bateu **exatamente** com `cpc_maximo_calculado` (€ 2,94) — a IA usou o valor fornecido, não reestimou. `max_recommended_cpa` (€ 42) bate com a fórmula CPC máximo / taxa de conversão (2,94 / 0,07 ≈ 42).
  - [x] Testado com produto em zona de borda (`rejeitado_por_economics`, Advanced Amino Formula): IA retornou `worth_advertising: true`, citando keywords alternativas reais mais baratas que o teto (glutamin, bcaa supplements) — comportamento correto conforme a regra do prompt ("false, A MENOS que haja alternativa clara").
  - [x] Reasoning em português, dentro do limite, específico (cita números reais, não genérico)
  - [x] **Loop de aprendizado**: ✅ testado com dado real (2026-08-04) — análise `id=1` (veredito `pause`, campanha 20) confirmada via `PATCH /api/ai-advisor/analyses/1/outcome` como `confirmed_good`; `GET /api/ai-advisor/accuracy` retornou `{"acertos":1,"erros":0,"total_confirmado":1,"taxa_acerto_pct":100,"ainda_pendente":0}`. ⚠️ `n=1` — sem significado estatístico ainda.
- Definição de pronto: ✅ atingida.
- **Endpoint**: `POST /api/market-intel/:productId/analyze` (admin) — roda score + IA; `GET /api/market-intel/:productId/score` (histórico de scores)

---

### Fase 4 — Competitive Intelligence
- Objetivo: visibilidade sobre o que concorrentes estão anunciando pros produtos já qualificados.
- Pré-requisito: fonte de dado decidida (seção 10, item 1).
- Escopo: integração com o provider escolhido, `competitive-intel`.
- Checklist de teste:
  - [ ] Integração retorna ao menos 1 anúncio de concorrente real pra 1 produto já qualificado
  - [ ] Rodar a coleta 2x com um intervalo (ex: 1 semana) e confirmar que uma mudança real gera um novo snapshot, não sobrescreve o anterior
- Definição de pronto: você consegue ver, pelo dashboard, o que pelo menos 1 concorrente está fazendo pra 1 produto seu.

---

### Fase 5 — Expansão
- Objetivo: multiplicar Discovery pras demais redes, com o pipeline já provado.
- Pré-requisito: Fases 2 a 4 rodando de forma estável há um tempo (você define quanto).
- Escopo: repetir o connector de Discovery pras redes restantes.
- Checklist de teste:
  - [ ] Repetir a checklist da Fase 2 pra cada rede nova
  - [ ] Comparar scores de produtos entre redes diferentes e confirmar que o modelo não está enviesado pra rede que tem mais dado histórico acumulado
- Definição de pronto: pelo menos 2 redes rodando em paralelo sem comportamento inconsistente entre elas.

---

## 10. Decisões que preciso da sua confirmação

1. Fonte de dado do Módulo 3 (Inteligência Competitiva). Ferramenta de terceiros com API
   própria (SpyFu, SEMrush, Adbeat, BigSpy) vs. scraping direto (frágil, risco de ToS).
   Recomendo a primeira opção. Qual caminho?
2. Claude vs OpenAI (seção 7). Redundância entre os dois, ou tarefas diferentes por provider?
3. Single-user ou multi-user? Decide se vale a pena já sair com autenticação de usuário
   completa ou se a ADMIN_KEY simples ainda serve.
4. Hospedagem. Local (sua máquina/servidor doméstico) ou VPS/cloud?
5. ~~(Novo) Nível de acesso do developer token do Google Ads.~~ **RESOLVIDO em 2026-08-04**:
   conta MagicZap já tem developer token com **Acesso Básico** (`H1JCPetQ3VRaB-Hs49nx0g`),
   confirmado suficiente pro Keyword Plan Idea Service (limite de 15 mil operações/dia, bem
   acima do volume esperado por agora). Fase 2b desbloqueada.
6. ~~(Novo) Checagem de preservação de parâmetro de afiliado (seção 5.4).~~ **RESOLVIDO
   em 2026-08-04**: verificação manual (você preenche `affiliateParamsPreserved` ao
   cadastrar o produto, olhando a página) — sem Playwright/Puppeteer por ora. Reavaliar
   automação só se o volume de produtos justificar o investimento de infra.

Assim que você responder as pendentes, eu fecho os detalhes de implementação da próxima fase e a
gente parte pro Cursor com escopo bem definido.
