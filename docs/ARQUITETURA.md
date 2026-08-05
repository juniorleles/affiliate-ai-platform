# Arquitetura — Plataforma Privada de IA para Marketing de Afiliados

Versão 2.2 · Documento vivo (atualizar a cada mudança estrutural relevante)

Changelog:
- v2.2 adicionou a Fase 6 (Cadastro de Campanhas no Google Ads) e a Fase 7 (Gestor
  de Contingência) ao roadmap — especificação inicial, sem código ainda, 3 decisões
  novas registradas na seção 10. Marca a primeira vez que o sistema consideraria
  executar ação real (criar campanha) em vez de só recomendar.
- v1.4 removeu formalmente a descoberta automática de produtos do escopo do projeto
  (decisão do usuário) — connector Digistore24 e rota de sync automático deletados do
  código; Fase 2 e Fase 5 reescritas pra refletir cadastro manual como caminho definitivo,
  não fallback temporário.
- v1.3 adicionou a Fase 3c (tela de cadastro de produtos, com diretrizes de UX) e a
  Fase 3d (Auditor de LP avançado com IA — upgrade rico da seção 5.4, especificação
  completa de CRO/UX/copywriting/correspondência Google Ads → LP recebida do usuário).
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
- **Fila para trabalho pesado.** Chamadas de IA e varredura de concorrentes (quando a Fase 4
  existir) são lentas, sujeitas a rate limit e podem falhar. Isso roda em fila (BullMQ +
  Redis), nunca de forma síncrona dentro de uma requisição HTTP.
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

**Nível 1 — checagem técnica rápida (✅ implementada, Fase 3, 2026-08-04).** Manual, sem
Playwright/Puppeteer: você preenche `hasCta`/`hasVsl`/`affiliateParamsPreserved` no
momento do cadastro, olhando a própria página. Decisão registrada na seção 10, item 6.
Continua sendo o caminho rápido — nem todo produto precisa da análise rica abaixo.

**Nível 2 — Auditor de LP avançado com IA (novo, 2026-08-04 — ver Fase 3d, seção 9).**
Especificação completa trazida pelo usuário, formalizada aqui. Muda a pergunta central
de "essa página tem CTA?" pra **"essa página está preparada pra transformar tráfego
pago do Google Ads em conversão?"** — a IA atua como gestor sênior de Google Ads +
CRO + copywriting + UX, não como um checklist raso.

**Entrada** (nem todos os campos obrigatórios — quanto mais, mais completa a análise):
URL da LP, nome e descrição do produto, país de destino, público-alvo, palavra-chave
principal (+ secundárias, opcional), texto/headline/descrição/CTA do anúncio do Google
Ads, URL do checkout (opcional).

**Dimensões analisadas** (cada uma vira uma seção do relatório, não só um número solto):
primeira impressão, proposta de valor, copywriting, oferta, CTA, caminho até o checkout,
confiança/prova social, correspondência Keyword → Anúncio → Landing Page (a mais
importante — mede se a promessa do anúncio é cumprida na página), UX mobile,
performance/experiência (só quando o dado existir de verdade — regra explícita de
**nunca inventar dado que não conseguiu verificar**, mesmo princípio que já seguimos em
Economics), intenção de compra da página (educa / gera interesse / gera desejo /
conduz à compra / solicita a compra).

**Saída**: "Landing Page Conversion Score" (0–100, com faixas de classificação de
crítica a excelente — nunca apresentado sem explicação do motivo), lista de problemas
priorizados (alta/média/baixa, com impacto esperado baixo/médio/alto, cada um com
problema → por que importa → recomendação), até 3 sugestões alternativas de headline
quando a proposta de valor for fraca, e um relatório executivo estruturado (score,
diagnóstico geral, pontos positivos, principais problemas, top 5 melhorias, análise
detalhada por dimensão).

**Regra de honestidade** (herdada diretamente da especificação original, e consistente
com o resto do projeto): a IA nunca afirma que uma mudança vai aumentar conversão —
usa linguagem de "potencial de melhoria"/"provável impacto", nunca inventa métrica, e
diferencia claramente "análise heurística da IA" de "resultado real de campanha".

⚠️ **Decisões técnicas em aberto** (seção 10, itens novos) antes de implementar:
1. **Como a IA "vê" a página?** Fetch de HTML/texto é barato mas não avalia design,
   contraste de botão, "primeira impressão" visual nem UX mobile de verdade — pra isso
   precisaria de screenshot (desktop + mobile) e um modelo com visão. Decisão parecida
   com a do Playwright que já tomamos: screenshot bem feito provavelmente exige captura
   via navegador headless (mesmo trade-off de custo/infra da seção 10 item 6 anterior) ou
   um serviço de screenshot de terceiros — checar oficialidade/ToS **antes** de escolher,
   mesma disciplina de hoje com o ClickBank.
2. **Orçamento de tokens.** Esse schema é bem mais rico que `productOpportunity` (que já
   precisou subir de 800 pra 2048 tokens) — esperar precisar de limite ainda maior, e
   passar explícito por chamada (não virar padrão global) — ver o incidente já registrado
   na Fase 3b.
3. Como isso se relaciona com o Nível 1: a auditoria rica **substitui** os campos manuais,
   ou os dois convivem (rápido primeiro, rica sob demanda depois)? Recomendo os dois
   convivendo — a Fase 3c (tela de cadastro) já prevê "cadastro em 2 etapas": o Nível 1
   cabe na etapa rápida, o Nível 2 vira uma ação explícita ("Rodar auditoria completa")
   pra quando o produto já passou em Economics e vale o investimento de tempo/custo.

O resultado dos dois níveis continua indo pra `landing_page_audits` (seção 4) — o
Nível 2 provavelmente precisa de colunas novas (score, relatório estruturado completo em
`jsonb`) além das que já existem; definir o DDL exato quando entrar em implementação.

---

## 6. Fluxo de dados ponta a ponta

**Atualizado em 2026-08-04**: o passo de sincronização automática (n8n → discovery.sync)
foi removido — descoberta de produto é 100% manual, via `POST /api/products/manual`
(ou `/manual/bulk`). O fluxo abaixo começa a partir do cadastro manual.

```
Você cadastra um produto manualmente
POST /api/products/manual  -->  grava em products + product_snapshots
                                              |
                                              v
                                    já roda economics.js (5.1) na hora
                                    calcula CPC máximo, checa trava de comissão mínima.
                                    Se reprovar aqui (comissão baixa), já marca
                                    rejeitado_por_comissao_minima — não precisa de
                                    mais nenhum passo pra saber que não compensa.
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

Isso aqui merece atenção redobrada porque a plataforma guarda chaves de API de:
Google Ads, Anthropic, OpenAI (e futuramente um provedor de inteligência competitiva,
Fase 4) — poder de gastar dinheiro ou expor dados de conta. (Credenciais de rede de
afiliados não são mais necessárias — descoberta automática saiu do escopo, ver Fase 2.)

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

### Fase 2 — Discovery (cadastro manual) + Economics (5.1)
**Status: ✅ concluída e testada com dado real (2026-08-04, atualizado).**
Cadastro **manual, definitivo** — não é mais fallback temporário.

- Objetivo: produtos reais entrando no sistema, e o cálculo de viabilidade financeira funcionando.
- Pré-requisito: nenhuma credencial de rede de afiliados — limiar de comissão mínima definido (padrão **R$ 20**, ajustável).
- Escopo: `economics.js` completo (`market-intel`), `addManualProduct`/`addManualProductsBulk` (`discovery`).
- ⚠️ **Decisão formalizada em 2026-08-04**: descoberta automática de produtos via API
  foi **removida do escopo do projeto** (decisão do usuário, não só "adiada"). Motivo:
  confirmado com a Digistore24 que `listMarketplaceEntries` lista só produtos do
  **próprio vendedor**, não o marketplace geral que um afiliado navega — não existe
  função de API pra isso. Confirmado também que a ClickBank proíbe scraping
  explicitamente nos Termos de Uso, mesmo via terceiro (ver decisão de não usar o
  scraper do Apify). O connector Digistore24 e a rota de sync automático foram
  **removidos do código** (não ficam como código morto). Cadastro manual/em lote é o
  único caminho de Discovery, ponto final — ver Fase 5 pra como isso afeta expansão.
- Checklist de teste:
  - [x] `upsertProducts` grava produto + snapshot sem duplicar quando roda de novo (mesmo `external_id` = update, não insert novo) — confirmado com os 3 produtos reais já cadastrados
  - [x] Testes unitários de `economics.js` — 10/10 passando: CPC de equilíbrio, aplicação de margem, trava de comissão mínima (ativando E desativando), caso de borda `taxaConversaoEsperada = 0` (marca `dado_insuficiente`, não lança erro nem aprova/rejeita), rejeição por leilão caro, validação de entrada
  - [x] Endpoint de listagem (`GET /api/products`) retorna produtos já com o `economics_status` certo — confirmado com os 3 produtos reais
- Definição de pronto: ✅ atingida — 3 produtos reais passaram pelo pipeline completo.
- **Endpoints disponíveis**:
  - `POST /api/products/manual` (admin) — cadastro manual de 1 produto
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
- Pré-requisito: ~~Fases 2 e 2b concluídas~~ ✅ + ~~Claude/OpenAI~~ ✅ **RESOLVIDO em 2026-08-05**: só Claude, definitivamente.
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

### Fase 3c — Tela de cadastro de produtos (frontend)
**Status: ✅ concluída e testada com dado real (2026-08-05).**
- Objetivo: destravar o uso contínuo do sistema. Hoje o cadastro (`POST /api/products/manual` e `/manual/bulk`) só é acionado via chamada HTTP direta (curl/Postman) — inviável pra virar hábito semanal de verdade.
- Pré-requisito: nenhum técnico — a API já existe e está testada (Fases 2 e 3). É 100% trabalho de frontend.
- Escopo: `apps/web/src/features/discovery/{ProductsPage,QuickAddModal,LpAuditModal}.jsx`, estilos novos em `styles.css` (cards, modal, preview de economics).
- Diretrizes de UX aplicadas (todas as 6 da sessão anterior):
  1. ✅ Formulário curto — nome, rede, comissão, preço, conversão em destaque; URL da página e comissão mínima em seção "opções avançadas" recolhível.
  2. ✅ Preview de Economics ao vivo — chama `/market-intel/economics/evaluate` com debounce de 400ms a cada mudança em comissão/conversão, mostra CPC máximo e status colorido antes de salvar.
  3. ✅ Cadastro em 2 etapas — `QuickAddModal` (Etapa 1: dados essenciais, dispara Economics + Compliance automaticamente) e `LpAuditModal` (Etapa 2: CTA/VSL/parâmetro preservado, aberta a qualquer momento depois, reenvia os dados via upsert com `skipCompliance: true` pra não gastar chamada de IA repetida).
  4. ✅ `externalId` sugerido automaticamente via slug do nome, editável.
  5. ✅ Lista em cards com badges de status (economics colorido, sensibilidade de nicho, indicador "Auditoria de LP pendente" quando `lp_audited_at` é null).
  6. ✅ Botão "+ Adicionar produto" sempre visível no topo da tela.
- Backend também estendido: `discovery/repository.js#listProducts` agora traz `niche_sensitivity`, `requires_presell`, `has_cta`, `has_vsl`, `affiliate_params_preserved`, `network_type` junto com cada produto (antes só trazia `economics_status`) — necessário pra tela mostrar tudo isso sem chamada extra por produto.
- **Extra adicionado em 2026-08-05** (não estava no escopo original da Fase 3c, mas complementa direto): `BulkAddModal.jsx` — cadastro em lote pela UI, formato de mini-planilha (várias linhas, `+ Adicionar linha`), usa o `POST /manual/bulk` que já existia só via API. Sem preview de Economics por linha (ficaria pesado com várias linhas ao mesmo tempo) — o resultado (viável/rejeitado por produto) aparece no resumo depois de salvar.
- Checklist de teste:
  - [x] `npm install`/`npm run dev` no `apps/web` — rodou; 1 bug de robustez corrigido pelo Cursor: `loadProducts()` não tinha `try/catch/finally`, deixando a tela presa em "Carregando..." se a API falhasse — corrigido, aplicado também no sandbox de referência
  - [x] Cadastrado produto real ("Advanced Amino Formula UI Test") pela Etapa 1 — preview de Economics apareceu **antes de salvar**: `CPC máx. EUR 2.94 / Viável`, batendo com o cálculo do backend
  - [x] Card apareceu na lista com badge "Auditoria de LP pendente"
  - [x] Etapa 2 (CTA/VSL/parâmetro + URL) preenchida e salva com sucesso
  - [x] Badge de pendente sumiu depois de salvar, botão virou "Editar auditoria"
  - [x] **Cadastro em lote testado com dado real (2026-08-05)**: 3 produtos reais (CircO2, Mitochondrial, Amino) cadastrados de uma vez pelo `BulkAddModal`, resumo mostrou `Viável` pros 3, cards apareceram na grade depois de atualizar — zero correções necessárias, JSX carregou de primeira no Vite.
- Definição de pronto: ✅ atingida por completo — cadastro individual, em lote, e auditoria de LP, todos testados com dado real pela UI.

---
### Fase 3d — Auditor de LP avançado com IA (upgrade do 5.4 Nível 2)
**Status: ✅ COMPLETA — Camada A e Camada B implementadas, testadas e validadas com
dado real (2026-08-05). As duas camadas foram confirmadas contra inspeção manual real
da página pelo usuário, não só "rodou sem erro".**
- Objetivo: substituir o julgamento raso do Nível 1 (3 checkboxes manuais) por uma
  análise rica de CRO/UX/copywriting/correspondência Google Ads → LP, gerando um
  "Landing Page Conversion Score" (0–100) com relatório executivo priorizado — não só
  um número, um diagnóstico acionável.
- Escopo da Camada A (texto + performance real, sem visão):
  - `shared/pagespeed.js` — PageSpeed Insights API (oficial, gratuita, confirmada
    ativa), dado real de performance (Core Web Vitals), nunca estimado pela IA.
  - `discovery/lpTextFetch.js` — busca e extrai texto da página (regex simples com
    marcadores de estrutura H1/H2/H3/botão/lista — simplificação consciente, sem
    parser de HTML completo; suficiente pra Camada A, revisitar se a qualidade da
    análise não for boa o bastante).
  - `ai-advisor/service.js#analyzeLandingPageText()` — monta o contexto (produto,
    público-alvo, keyword, anúncio do Google Ads quando fornecido, performance real,
    texto da página) e chama a IA com o schema `landingPageAuditReport`.
  - `discovery/lpAudit.js#runAdvancedAuditTextOnly()` — orquestra tudo, grava em
    `landing_page_audits` com `analysis_tier = 'camada_a'` (migration 013 — reaproveita
    a tabela do Nível 1, não cria uma nova).
  - Schema cobre: score + classificação, diagnóstico geral, pontos positivos,
    problemas priorizados (com por-que-importa/recomendação/prioridade/impacto),
    top 5 melhorias, correspondência Keyword→Anúncio→LP (quando há dado de anúncio),
    força da proposta de valor (+ sugestões de headline se fraca), força da oferta,
    avaliação de CTA, confiança/prova social + objeções não respondidas, intenção da
    página, e **`limitacoes_da_analise`** (sempre preenchido — o prompt exige que a
    IA declare que design visual/mobile/checkout não foram avaliados nesta camada).
  - `max_tokens: 4096` — schema mais rico que `productOpportunity`, aplicado o mesmo
    padrão de configurar por chamada (não virou default global) desde o incidente da
    Fase 3b.
- Fora de escopo nesta camada (fica pra Camada B): primeira impressão visual, UX
  mobile real, contraste/posicionamento visual do CTA, análise de checkout por
  interação — tudo que exige "ver" a página, não só ler o texto.
- Checklist de teste:
  - [x] `POST /api/products/:productId/lp-audit/advanced` rodou (Advanced Amino Formula) — HTTP 200, score `58 / precisa_melhorias`, gravado em `landing_page_audits` (`analysis_tier: camada_a`)
  - [x] **Bug real encontrado e corrigido (2026-08-05)**: `sales_page_url` (e `category`, `countries_allowed`) nunca eram atualizados numa segunda gravação do mesmo produto — o `ON CONFLICT` do `upsertProducts` só tocava `name`/`price`/`commission_value`/`epc`/`conversion_rate`/`currency`. Isso quebrava silenciosamente o fluxo de "cadastro rápido sem URL → completar depois" (Etapa 2 da Fase 3c) — se a URL não fosse dada na Etapa 1, nunca dava pra setar depois. Corrigido: `sales_page_url` agora usa `COALESCE(EXCLUDED.sales_page_url, products.sales_page_url)` (atualiza se veio valor novo, preserva o antigo se não veio — não apaga por engano no cadastro em lote, que não pede URL).
  - [x] `limitacoes_da_analise` veio preenchido corretamente: análise visual/mobile ausente, PageSpeed indisponível, checkout não avaliado, e a IA ainda declarou por conta própria "texto extraído com ruído de formatação" — sinal de que o extrator simples (regex) tem limitação real, considerar melhorar se isso prejudicar a qualidade da análise no futuro.
  - [x] `correspondencia_google_ads` veio preenchido e classificou `critica` — **mas por dado de teste ruim meu**, não falha do sistema: usei o texto promocional de recrutamento de afiliado da Digistore24 ("Earn 60% Commission...") como se fosse o headline do anúncio real do Google Ads, o que está errado — esse texto é pro afiliado, não pro consumidor final. A IA identificou a incoerência corretamente dado o que recebeu. Refazer o teste com copy de anúncio realista antes de validar essa parte de verdade.
  - [~] PageSpeed retornou `null` — **não é bug**: cota diária da API excedida (`Quota exceeded... Queries per day`), capturado com `try/catch`, logou aviso, não quebrou a auditoria. Comportamento de degradação graciosa funcionando como desenhado. Configurar `GOOGLE_PAGESPEED_API_KEY` (chave própria, gerada no Google Cloud Console) deve resolver — cota anônima é baixa.
  - [x] Reasoning específico, citando o problema real (incoerência headline × produto) — não genérico
  - **Ajustes de robustez feitos pelo Cursor + eu**: 1ª tentativa da IA não bateu com o schema (inventou chaves) — `maxTokens` subiu de 4096 pra 8192, e a extração de JSON (`shared/ai-provider/index.js#cleanJsonText`) ficou mais tolerante (extrai o miolo entre a primeira `{` e a última `}`, não exige mais que a resposta já venha 100% limpa). `diagnostico_geral.maxLength` subiu de 600 pra 1200 — 600 rejeitava diagnósticos válidos em português (naturalmente mais verboso que inglês pra dizer a mesma coisa). Tudo aplicado no código-fonte, não só no ambiente do Cursor.
  - [x] **Reteste com dado de anúncio realista (2026-08-05) — comparação direta que prova que o sistema está lendo a página de verdade**:

    | | Anúncio ruim (texto de afiliado) | Anúncio realista |
    |---|---|---|
    | `correspondencia_google_ads` | `critica` | `boa` |
    | `score` | 58 / precisa_melhorias | 76 / boa |

    A explicação do segundo teste citou o **H3 exato da página** ("This combination of 8 essential amino acids...") pra justificar a nota — não é resposta genérica, é leitura real do texto extraído. Ainda achou 1 problema específico e válido: o H1 da página é um depoimento de cliente, não reforça a promessa do anúncio imediatamente — esse é o tipo de achado acionável que a Fase 3d existe pra dar.

**Camada B (visão) — implementada em 2026-08-05:**
- Fonte de screenshot decidida (seção 10, item 7): **ScreenshotOne**, pesquisada
  contra 8 outras opções — 100 capturas grátis/mês sem cartão, não cobra por
  captura que falha, mais recomendada nas comparações de 2026.
- Escopo: `shared/screenshot.js` (captura desktop 1280x900 + mobile 390x844, com
  bloqueio de anúncio/cookie banner/tracker embutido no próprio serviço), suporte a
  imagem adicionado em `claudeProvider.js`/`ai-provider/index.js` (antes só aceitava
  texto), schema novo `landingPageVisualAudit` (primeira impressão, hierarquia
  visual, UX mobile, problemas visuais — deliberadamente **não repete** análise de
  copy, que já é coberta pela Camada A), `ai-advisor/service.js#analyzeLandingPageVisual()`,
  `discovery/lpAudit.js#runAdvancedAuditVisual()`.
- Grava na mesma tabela `landing_page_audits`, `analysis_tier = 'camada_b'` — **não
  substitui** o registro da Camada A, os dois convivem lado a lado (decisão já
  registrada no item 8 da seção 10, aplicada aqui de propósito).
- `score_visual_parcial` é deliberadamente separado do `landing_page_conversion_score`
  da Camada A — ainda não existe lógica de combinar os dois num score único; unir os
  dois com peso definido é decisão de produto pra revisitar depois de ver alguns
  resultados reais, não inventar um peso arbitrário agora.
- Checklist de teste (pendente — precisa de conta ScreenshotOne configurada):
  - [x] Conta ScreenshotOne criada, `SCREENSHOTONE_ACCESS_KEY` configurada
  - [x] `POST /api/products/:productId/lp-audit/visual` rodado no Advanced Amino Formula — HTTP 200, `score_visual_parcial: 76`, persistido (`analysis_tier: camada_b`, id=5)
  - [x] **Validação cruzada real (2026-08-05)**: usuário abriu a LP no navegador e confirmou ponto a ponto — hero navy + CTA laranja, frasco, selo Money Back, quote da Jacqui, tudo batendo com `clareza_produto: clara`, `cta_visivel_acima_da_dobra: true`, `contraste_cta: bom`. Achados específicos não genéricos: gráfico "Protein Utilization Chart" ilegível no mobile, selo de garantia sobrepondo o produto no hero desktop, menu hambúrguer pouco visível — só aparecem analisando a imagem de verdade.
  - [x] `limitacoes_da_analise` funcionou como desenhado: a IA declarou honestamente que parte da página ficou cortada na captura (limite `full_page_max_height` ou timeout) em vez de inventar avaliação da parte que não viu.
- **Ponto de atenção pra próxima vez**: a captura cortou o fim da página (depoimentos completos, seção do especialista, garantia). Se isso prejudicar auditorias futuras em páginas muito longas, considerar subir `full_page_max_height` ou capturar em múltiplas seções — não é bloqueante agora, só registrar como limitação conhecida.
- Definição de pronto: ✅ atingida por completo — Camada A (texto) e Camada B
  (visual) implementadas, testadas e validadas contra a página real.
- **Nota de valor**: o usuário classificou isso como potencialmente uma das
  features principais da plataforma — priorizar na próxima sessão de implementação,
  não deixar esquecido no fim da lista.

---

### Fase 4 — Competitive Intelligence
**Status: ✅ COMPLETA e validada com dado real (2026-08-05).**

- Objetivo: visibilidade sobre o que concorrentes estão anunciando pros produtos já qualificados.
- Pré-requisito: ~~fonte de dado decidida~~ ✅ resolvido — Google Ads Transparency Center, cadastro manual (seção 10, item 1).
- Escopo: `competitive-intel/{repository,service,routes}.js` (cadastro manual + detecção de mudança via snapshot), `apps/web/src/features/competitive-intel/{CompetitiveIntelPage,CompetitorAdModal}.jsx`.
- Detalhe de implementação: `addManualCompetitorAd()` verifica se já existe um anúncio do mesmo concorrente com o mesmo headline + landing page — se sim, **não duplica**, só atualiza `last_seen_at` e grava um snapshot novo (histórico preservado). Anúncio pode opcionalmente ser vinculado a um produto seu específico (`productId`), mas isso é opcional — dá pra cadastrar concorrência geral sem vincular a nada.
- Checklist de teste:
  - [x] Cadastrado anúncio real (Vital Proteins/Nestlé USA, nicho suplementos) via Ads Transparency Center pela tela — apareceu na lista, `snapshot_count: 1`
  - [x] Recadastrado o **mesmo** anúncio (mesmo concorrente + headline + LP) — **não duplicou**: continuou 1 linha, `snapshot_count` foi pra 2
  - [x] Cadastrado anúncio **diferente** do mesmo concorrente (headline diferente: "Eco-Friendly Collagen Peptides") — virou registro novo e separado, `snapshot_count: 1`
- Definição de pronto: ✅ atingida — deduplicação por concorrente+headline+LP confirmada com dado real, exatamente como desenhado.

---

### Fase 5 — Expansão pra mais redes de afiliados
**Redefinida em 2026-08-04**: não existe mais "connector de rede" nenhum pra repetir
— descoberta automática está fora do escopo (ver Fase 2). Expandir pra mais redes
agora é só usar o cadastro manual que já existe, sem código novo.

- Objetivo: ter produtos de mais de uma rede de afiliados no sistema, comparáveis entre si.
- Pré-requisito: nenhum técnico — só você ter produtos de outra rede pra cadastrar.
- Escopo: nenhum código novo. `POST /api/products/manual` já aceita qualquer
  `networkType` (é só uma string, não precisa de connector cadastrado).
- Checklist de teste:
  - [ ] Cadastrar pelo menos 1 produto de uma segunda rede (ex: ClickBank, CJ, o que você tiver acesso)
  - [ ] Comparar `opportunity_scores` entre produtos de redes diferentes e confirmar que o modelo não está enviesado pra rede com mais dado histórico acumulado
- Definição de pronto: pelo menos 2 redes com produtos cadastrados, ambas passando pelo mesmo pipeline (Economics, Compliance, Auditoria de LP, score) sem tratamento especial.

---

### Fase 6 — Cadastro de Campanhas no Google Ads
**Status: 📋 planejada (2026-08-05) — especificação inicial, decisões em aberto,
sem código.**

- Objetivo: fechar o loop que hoje para em "vale a pena anunciar?" (Fase 3b). A
  campanha nasce já com os números que Economics (5.1) e Keyword Research (5.2)
  calcularam — CPC máximo, orçamento inicial sugerido, palavras-chave reais com
  volume/competição — em vez de você digitar tudo de novo manualmente no Google Ads.
- **Princípio central (não negociável, ver seção 1)**: o sistema **nunca cria
  campanha automaticamente**. Gera um **rascunho** (gravado no banco), você revisa
  na tela, e só cria de verdade no Google Ads com confirmação explícita. Isso é
  a primeira vez que o sistema executaria uma ação real com dinheiro real — o
  padrão de "recomendação, nunca execução automática" que seguimos o projeto
  inteiro fica ainda mais crítico aqui.
- Escopo previsto:
  - Tabela nova `campaign_drafts` (product_id, nome, orçamento diário proposto,
    moeda, palavras-chave propostas — reaproveitando `keyword_metrics` já
    coletado na Fase 2b —, sugestões de headline/descrição, `final_url`, status:
    `draft` → `approved` → `created_in_google_ads` → `failed`, `google_campaign_id`
    preenchido só depois da criação real).
  - Sugestão de copy do anúncio via IA, **checando correspondência com a Landing
    Page** — reaproveita a mesma lógica já validada no Auditor de LP (Fase 3d,
    seção 5.4) pra não nascer um anúncio que promete o que a página não entrega.
  - Criação real via API do Google Ads: sequência encadeada (orçamento → campanha
    → grupo de anúncios → palavras-chave → anúncio), cada chamada dependendo do
    ID da anterior — mais complexo que qualquer coisa que já fizemos (leitura é
    simples, escrita tem bem mais regra de negócio própria do Google Ads).
- Decisões em aberto antes de implementar (ver seção 10, itens novos):
  9. Orçamento diário/mensal máximo — trava dura que nunca pode ser ultrapassada,
     mesmo que a Economics sugira mais?
  10. Copy do anúncio: IA sugere (com revisão sua) ou você escreve e o sistema só
      cuida da estrutura (orçamento/palavras-chave)?
- Checklist de teste: (definir quando as decisões acima forem resolvidas)
- Definição de pronto: criar 1 campanha real, pequena, a partir de um rascunho
  revisado por você, e ela aparecer certinha no Google Ads (mesmos dados do
  rascunho, sem surpresa).

---

### Fase 7 — Gestor de Contingência
**Status: 📋 planejada (2026-08-05) — especificação inicial, decisões em aberto,
sem código.**

Duas partes de natureza bem diferente — importante não misturar expectativa.

**Parte A — Revisão preventiva de anúncio (viável de verdade).**
- Objetivo: revisar o texto exato do anúncio contra políticas reais do Google Ads
  (alegação sem comprovação, superlativo problemático, uso indevido de marca) antes
  de publicar — não depois de tomar reprovação. Estende o Compliance (5.3), que
  hoje classifica só o nicho do produto, não o texto específico do anúncio.
- Também fecha uma lacuna real: a tabela `alerts` já previa o tipo `ad_disapproved`
  desde o desenho original (migration 004), mas isso **nunca foi implementado** —
  só `campaign_paused` e `impression_drop` existem de verdade hoje. O Google Ads
  expõe via API o status de aprovação de cada anúncio e o motivo da reprovação —
  é extensão natural do `monitoring` que já roda.
- Escopo previsto: novo schema de IA (`adPolicyReview` ou similar) reaproveitando
  o padrão `ai-advisor`; extensão do `monitoring/service.js` pra consultar status
  de aprovação de anúncio via GAQL e gerar alerta `ad_disapproved` de verdade.

**Parte B — Diagnóstico e apelação (limite real, não é "resgate automático").**
- ⚠️ **Não existe automação possível pra desbloquear conta.** Suspensão de conta
  no Google Ads só se resolve pelo processo de apelação do próprio Google (recurso
  formal, revisão humana do lado deles) — não existe endpoint de API pra isso.
  Nenhuma automação (nossa ou de terceiro) pula essa etapa. Registrar isso aqui
  pra não a expectativa errada voltar numa conversa futura.
- O que dá pra construir de verdade:
  1. Detecção rápida de mudança de status da **conta** (não só campanha) via
     monitoring.
  2. Diagnóstico assistido por IA: juntar histórico de compliance + anúncios
     reprovados recentes, gerar hipótese de causa provável.
  3. Rascunho de texto de apelação — a IA prepara, você revisa e envia manualmente
     pelo formulário oficial do Google.
- Decisão em aberto antes de implementar (ver seção 10, item novo):
  11. Você já tem mais de uma conta de anúncio hoje, ou é uma única conta por
      enquanto? O sistema inteiro hoje está fixado numa conta só via `.env`
      (`GOOGLE_ADS_CUSTOMER_ID`) — múltiplas contas mudaria bastante o desenho
      do banco (a tabela `google_ads_accounts` já existe desde o início, mas
      nunca foi usada pra mais de 1 conta de verdade).
- Checklist de teste: (definir quando as decisões acima forem resolvidas)
- Definição de pronto: Parte A rodando num anúncio real antes de publicar; Parte B
  gerando um diagnóstico + rascunho de apelação úteis o suficiente pra você usar
  de verdade, sem prometer resultado da apelação em si (isso depende do Google).

---

## 10. Decisões que preciso da sua confirmação

1. ~~Fonte de dado do Módulo 3 (Inteligência Competitiva).~~ **RESOLVIDO em
   2026-08-05**: cadastro manual, a partir do **Google Ads Transparency Center**
   (`adstransparency.google.com`) — ferramenta oficial e gratuita do Google, mas
   **sem API pública** (confirmado por pesquisa, nenhuma fonte de 2026 lista uma
   API oficial). Descartada a ideia original de ferramenta paga terceira
   (SpyFu/SEMrush/Adbeat/BigSpy) — não é necessária, mesmo padrão de cadastro
   manual que já validamos pra produtos (Fase 2) resolve isso sem custo e sem
   risco de ToS.
2. ~~Claude vs OpenAI (seção 7).~~ **RESOLVIDO em 2026-08-05**: só Claude,
   definitivamente — sem necessidade prática de adicionar OpenAI pro caso de uso atual.
3. ~~Single-user ou multi-user?~~ **RESOLVIDO em 2026-08-05**: `ADMIN_KEY` simples
   mantida — usuário único, autenticação completa não se justifica agora.
4. ~~Hospedagem.~~ **RESOLVIDO em 2026-08-05**: local, por enquanto. Revisitar quando o
   sistema estiver mais maduro/em uso constante.
5. ~~(Novo) Nível de acesso do developer token do Google Ads.~~ **RESOLVIDO em 2026-08-04**:
   conta MagicZap já tem developer token com **Acesso Básico** (`H1JCPetQ3VRaB-Hs49nx0g`),
   confirmado suficiente pro Keyword Plan Idea Service (limite de 15 mil operações/dia, bem
   acima do volume esperado por agora). Fase 2b desbloqueada.
6. ~~(Novo) Checagem de preservação de parâmetro de afiliado (seção 5.4).~~ **RESOLVIDO
   em 2026-08-04**: verificação manual (você preenche `affiliateParamsPreserved` ao
   cadastrar o produto, olhando a página) — sem Playwright/Puppeteer por ora. Reavaliar
   automação só se o volume de produtos justificar o investimento de infra.
7. ~~(Novo, 2026-08-04) Captura de screenshot pro Auditor de LP avançado (Fase 3d).~~
   **RESOLVIDO em 2026-08-05**: **ScreenshotOne** — pesquisado contra 8 outras opções
   (CaptureKit, ApiFlash, Urlbox, ScreenshotAPI.net, Scrnify, entre outras). Motivo:
   100 capturas grátis/mês sem cartão (cobre o volume esperado — poucos produtos por
   semana), não cobra por captura que falha, e é a opção mais citada como confiável/
   recomendada nas comparações de 2026. Urlbox é mais "enterprise" (sem tier grátis,
   mais caro); CaptureKit é mais barato em volume alto, que não é o nosso caso.
8. ~~(Novo, 2026-08-04) Nível 1 e Nível 2 da Auditoria de LP convivem, ou o Nível 2
   substitui o Nível 1?~~ **RESOLVIDO em 2026-08-04** (aplicado na prática, Fase 3c):
   convivem — Nível 1 no cadastro rápido, Nível 2 como ação separada sob demanda.
9. **(Novo, 2026-08-05) Orçamento máximo — Fase 6.** Trava dura de orçamento
   diário/mensal que o cadastro de campanha nunca pode ultrapassar, mesmo que a
   Economics sugira mais? Se sim, qual valor?
10. **(Novo, 2026-08-05) Copy do anúncio — Fase 6.** A IA sugere headline/descrição
    (com sua revisão antes de publicar), ou você escreve e o sistema só cuida da
    estrutura (orçamento/palavras-chave)?
11. **(Novo, 2026-08-05) Single ou multi-conta de anúncio — Fase 7.** Você já tem
    mais de uma conta do Google Ads hoje, ou é uma só por enquanto? Muda o desenho
    do Gestor de Contingência (Parte B) e de como usamos a tabela
    `google_ads_accounts`, que já existe mas nunca foi usada pra mais de 1 conta.

Assim que você responder as pendentes, eu fecho os detalhes de implementação da próxima fase e a
gente parte pro Cursor com escopo bem definido.
