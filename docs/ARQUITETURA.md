# Arquitetura — Plataforma Privada de IA para Marketing de Afiliados

Versão 6.3 · Documento vivo (atualizar a cada mudança estrutural relevante)

Changelog:
- v6.3 corrigiu efeito colateral real da própria correção de ontem/hoje: mandar
  o schema completo pro modelo fez adCopySuggestion (único com maxItems:15)
  truncar com maxTokens:4096, que antes bastava. Subido pra 8192. Outros 5
  schemas checados (maxItems 6-8, bem mais folgados), nenhum ajustado sem
  evidência real de quebra.
- v6.2 — Bloco 4 do Roteiro de Teste passou sem bug: confidence=80 confirma
  a integração de LP no Decision Engine funcionando com produto real pela
  primeira vez (20+20+25+15, batendo exato com a fórmula). Sem achado novo.
- v6.1 corrigiu bug sistêmico real, achado no Bloco 2 do Roteiro de Teste:
  ai-provider nunca mandava o schema JSON pro modelo, só validava a resposta
  depois — prompt do Auditor de LP tinha ficado desatualizado, faltando 6
  campos obrigatórios. Corrigido de forma sistêmica: schema completo agora
  vai junto em toda chamada de IA (todos os 7 schemas), e o retry inclui o
  erro real do AJV em vez de instrução genérica. Risco residual nos outros
  6 prompts registrado, não auditado individualmente ainda.

- v6.0 iniciou o Roteiro de Teste completo — Bloco 1 já achou 1 bug real:
  POST /products/manual não devolvia product.id na resposta (calculava e
  usava internamente, mas nunca anexava de volta). Corrigido, sem afetar
  addManualProductsBulk (reaproveita a mesma função). Referência stale de
  "R$ 20" também corrigida no documento (era EUR/USD desde sempre).
- v5.9 confirmou com dado real a penalidade de VSL — matemática exata
  (90→63, ×0.7), decisão não invertida sozinha pela penalidade (comportamento
  correto), produto de controle sem auditoria permaneceu idêntico. Sinal de
  VSL fechado e validado.
- v5.8 implementou o sinal de VSL no Decision Engine — regra externa trazida
  pelo usuário (mapa de qualificação de produto): página com VSL penaliza o
  Opportunity Score em 30%, checagem oportunista (não dispara auditoria nova).
  Registrado, não implementado: distinção físico/digital, "rastro na
  internet" (reforça Autocomplete como próxima fonte), checklist de
  afiliação manual. 53/53 testes.
- v5.7 corrigiu o rótulo de moeda na trava de comissão mínima — o valor já
  era 20 (confirmado, nunca precisou mudar), mas a mensagem sempre dizia
  "R$" mesmo pra produtos em EUR/USD (herdado do MVP original). evaluateEconomics()
  ganhou parâmetro moeda (só rótulo, sem conversão), 2 testes novos travando
  isso. 50/50 na suíte.
- v5.6 implementou o badge visual do Decision Engine na tela Produtos —
  🟢🟡🔴 com score/confiança e motivo em tooltip, botão Avaliar/Reavaliar.
  Sem endpoint novo (reaproveitou GET /products com mais 1 LATERAL JOIN) e
  sem CSS novo (reaproveitou classes de cor já existentes). Pendente de
  teste real.
- v5.5 validou a trava do Decision Engine com dado real (3 cenários: investigar
  avisa, descartar bloqueia, override libera) e corrigiu 1 achado do teste:
  override apagava o rastro do aviso (decisionWarning vinha null) — agora o
  override ignora o bloqueio mas nunca o aviso, sempre citando o motivo
  original que foi superado.
- v5.4 implementou a trava do Decision Engine em campaignDrafts.js — descartar
  bloqueia (409, com override explícito disponível), investigar avisa sem
  bloquear, produto nunca avaliado não bloqueia (falha aberto). Sem
  dependência circular entre google-ads e decision-engine. Pendente de
  teste real.
- v5.3 fechou a Fase 12 com dado real de ponta a ponta: Advanced Amino Formula
  evoluiu 22→24→45 (descartar→descartar→investigar) através das 2 correções
  de hoje. Resultado final é uma decisão honestamente ambígua (zona cinzenta),
  não um veredito forçado — validação real do princípio central do desenho
  (nunca decidir com só 1 dos 2 scores).
- v5.2 corrigiu um SEGUNDO bug real, diagnosticado pelo próprio usuário no
  reteste: bid de leilão (moeda da conta) comparado direto contra CPC máximo
  (moeda do produto) sem converter — mesma categoria de bug já corrigida uma
  vez na Fase 2b, reintroduzida no Decision Engine. Corrigido reaproveitando
  shared/fx.js. Lição: proteção de moeda precisa ser reaplicada em cada
  comparação monetária nova, não presumida como "já resolvida".
- v5.1 corrigiu bug real encontrado no primeiro teste real do Decision Engine
  (Advanced Amino Formula devolveu "descartar" em vez de "testar"): o filtro
  de keyword comercial usava research_source (de qual busca a linha veio) em
  vez de classifyKeywordIntent (que intenção o texto expressa) — a keyword de
  resgate tinha vindo da busca genérica, não da comercial, e ficava invisível
  pro cálculo. Funções puras movidas de service.js pra scoring.js (testáveis
  sem banco). 48/48 testes.
- v5.0 implementou o núcleo do Evidence Engine + Decision Engine (Fase 12) —
  Opportunity e Confidence Score separados, decisão testar/investigar/descartar
  nunca baseada em só 1 dos 2. Zero API nova, zero tela nova (escopo controlado
  pedido pelo usuário). Reaproveita opportunity_scores e keyword_metrics
  (2 colunas novas em cada, sem tabela nova). 10 testes unitários, incluindo
  reprodução numérica do caso real Advanced Amino Formula. Pendente de teste real.
- v4.9 corrigiu bug antigo (pré-existente, não relacionado a hoje) na tela de
  Campanhas: SELECT/GROUP BY inconsistente em getAffiliateStatsByCampaignName
  causava erro do Postgres ao sincronizar. Corrigido usando LOWER() em ambos
  os lugares, sem mudar comportamento (resto do código já esperava lowercase).
- v4.8 adicionou exclusão de conta/MCC (não existia até então) — pedido do
  usuário pra limpar dado de teste da tela Contas antes de considerar
  "só o que está realmente no Ads". DELETE /accounts/:id sem soft-delete;
  DELETE /mccs/:id falha com erro claro (409) se ainda tiver conta vinculada.
- v4.7 corrigiu bug real achado pelo usuário olhando a tela: status de conta
  vinha como código numérico bruto ("2") em vez de string ("ENABLED") no
  recurso customer_client — risco real, não só estético: quebrava
  silenciosamente a detecção de conta crítica em outros lugares do código.
  normalizeCustomerStatus() traduz o enum oficial. Rodar o sync de novo
  corrige o dado já gravado.
- v4.6 confirmou com dado real o fix de reparentamento — MagicZap migrada
  corretamente de mcc_id 1 (MCC incorreta) pra mcc_id 2 (MCC Real).
  **Fase 8 (Governança Guarda-Chuva Multi-Conta) fechada de ponta a ponta,
  incluindo o caminho feliz da descoberta automática de hierarquia.**
- v4.5 fechou o teste do caminho feliz da descoberta de MCC — 7169854441
  confirmado como MCC real (API + interface do Google Ads batendo), resolvido
  um problema real de permissão de acesso de conta (não código) no processo.
  1 bug real encontrado e corrigido: sync não reparentava conta existente pra
  MCC certa quando descoberta, só atualizava status — updateAccountFromSync()
  corrige isso, resposta ganhou campo reparented.
- v4.4 corrigiu um achado real do usuário: sincronização de MCC devolvia "0
  contas" sem explicação quando o customer_id cadastrado não era uma conta
  gerenciadora de verdade — indistinguível de falha silenciosa. Agora lança
  erro claro explicando o motivo exato. Confirmado com dado real: a conta
  cadastrada (MagicZap, 6815930756) não é MCC segundo a própria API do Google.
- v4.3 implementou a Fase 11 (Teste E2E + Manual de Uso gerado) — Playwright
  clica na UI de verdade como um humano, tira screenshot em cada etapa, essas
  imagens alimentam docs/MANUAL_DE_USO.md diretamente. Rodar o teste de novo
  regenera o manual, sem manutenção manual de imagem. Pendente de rodar de
  verdade pela primeira vez.
- v4.2 respondeu a pergunta do usuário ("como o sistema sabe quais contas
  existem?") implementando descoberta automática de hierarquia via API oficial
  (recurso customer_client, confirmado por pesquisa antes de implementar) —
  botão "Sincronizar contas da MCC", nunca sobrescreve governança preenchida
  manualmente. Pendente de teste real.
- v4.1 validou a Fase 10 com dado real — 2 bugs reais corrigidos: mismatch de
  tipo integer/text na query de alertas por conta (quebrava a API inteira,
  sem erro claro) e bug de toggle no primeiro clique da árvore. Cores
  confirmadas batendo entre Heatmap/Tabela/Árvore, conta com alerta
  corretamente amarela nas 3 visualizações.
- v4.0 implementou a Fase 10 (Painel NOC) — árvore hierárquica MCC → Operação →
  Conta, heatmap operacional, saúde por conta calculada deterministicamente
  (status + alertas abertos). Escopo calibrado: sem TypeScript, sem dashboard
  financeiro ainda. Pendente de teste real.
- v3.9 validou a Fase 9 com dado real de ponta a ponta — bootstrap, login,
  criação de usuário com perfil visualizador, bloqueio de tela restrita, e o
  teste mais importante: retrocompatibilidade confirmada (x-admin-key sem JWT
  continua funcionando, nada das Fases 0-8 quebrou).
- v3.8 implementou a Fase 9 (Autenticação JWT + 4 perfis) — fundação pro painel
  NOC de contingência (Fase 10). Reverteu a decisão anterior de single-user
  (seção 10, item 3), mas manteve `ADMIN_KEY` funcionando em paralelo —
  nenhuma rota existente foi tocada. Achado real: rotas montadas em `/api/staff/*`
  pra evitar colisão com `/auth/login` que affiliate-ops já usava. Pendente de
  teste real.
- v3.7 implementou a Fase 8 (Governança "Guarda-Chuva" Multi-Conta) — hierarquia
  de MCC, isolamento de risco (pagamento/marca/domínio), detecção de mudança de
  status de conta (não repete alerta), rollup de governança, tela "Contas", e
  docs/PLANO_CONTINGENCIA.md com 5 procedimentos ancorados em ferramentas reais
  do projeto. Escopo calibrado pra dezenas de contas, não centenas. Pendente de
  teste real.
- v3.6 desacoplou o scheduler interno em 2 flags — `ENABLE_INTERNAL_SCHEDULER_MONITORING`
  (zero custo de IA, seguro ligar) e `ENABLE_INTERNAL_SCHEDULER_ANALYSIS` (custo real
  e recorrente, sem teto de gasto implementado ainda — fica desligada até medir
  consumo real). A flag antiga `ENABLE_INTERNAL_SCHEDULER` foi substituída (com
  aviso de retrocompatibilidade no log, não falha silenciosa).
  **✅ Testado com dado real (2026-08-05)**: `ENABLE_INTERNAL_SCHEDULER_MONITORING=true`
  no `.env`, Redis/Postgres/n8n de pé, `npm run worker` rodando — log confirmou
  "Scheduler de monitoramento ATIVADO", fila enfileirou na subida da API, worker
  processou na hora ("Checagem concluída: 0 alerta(s) novo(s)." — esperado, nada
  mudou desde a última checagem manual). Primeira automação de verdade rodando
  sozinha no projeto, sem supervisão — e sem custo de IA associado.
- v3.5 atualizou o Dashboard — ganhou seção "Visão geral" com KPIs dos módulos
  novos (produtos, viabilidade, auditoria pendente, rascunhos de campanha,
  concorrentes mapeados, alertas abertos), cada card linkando pra tela
  correspondente. Seção antiga de afiliados preservada abaixo, reposicionada
  (não removida — sem confirmação de que não é mais usada). Sem endpoint novo,
  reaproveita as APIs já existentes via chamadas paralelas no frontend.
  **✅ Testado com dado real (2026-08-05)**: todos os 6 KPIs conferidos contra
  a tela/API individual correspondente, todos batendo, todos os links
  funcionando, seção de afiliados intacta.
  **1 bug real encontrado e corrigido**: card de alertas chamava `/api/alerts`
  (path errado, 404) — o `.catch()` defensivo mascarou o erro e mostrou `0`
  silenciosamente, um número plausível mas errado, pior que um erro visível.
  Corrigido pro path certo (`/api/monitoring/alerts`, mesmo que a aba Alertas
  usa). Lição: `.catch()` defensivo em chamada de dashboard esconde bug de
  path — vale conferir contra a tela individual, não só "não quebrou".
- v3.4 validou a tela de Market Intelligence com dado real (7 produtos, análise
  existente, reanalisar, produto sem análise) — zero bug de UI. 1 achado real:
  maxTokens: 2048 (herdado da Fase 3b original) truncava no Reanalisar, subiu
  pra 4096.
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
- **Bug antigo corrigido em 2026-08-06** (pré-existente, não relacionado a nada
  construído hoje — só nunca tinha sido exercitado com dado real que disparasse o
  erro): `getAffiliateStatsByCampaignName()` misturava `SELECT cl.utm_campaign`
  (bruto) com `GROUP BY LOWER(cl.utm_campaign)` (transformado) — Postgres exige
  que toda coluna não-agregada no SELECT bata exatamente com a expressão do
  GROUP BY, erro: `column "cl.utm_campaign" must appear in the GROUP BY clause`.
  Corrigido usando `LOWER()` nos dois lugares — mantém o agrupamento
  case-insensitive (comportamento pretendido, o resto do código já esperava
  isso: `service.js` já fazia `.toLowerCase()` no valor antes de usar).

---

### Fase 2 — Discovery (cadastro manual) + Economics (5.1)
**Status: ✅ concluída e testada com dado real (2026-08-04, atualizado).**
Cadastro **manual, definitivo** — não é mais fallback temporário.

- Objetivo: produtos reais entrando no sistema, e o cálculo de viabilidade financeira funcionando.
- Pré-requisito: nenhuma credencial de rede de afiliados — limiar de comissão mínima definido (padrão **20 unidades da moeda do produto, USD ou EUR** — corrigido em 2026-08-06, era rotulado "R$" por engano; ver Fase 12).
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
  - [x] **Bug real corrigido em 2026-08-11**, achado seguindo o `ROTEIRO_DE_TESTE.md`
    (Bloco 1): `POST /products/manual` calculava e usava `productId` internamente
    (pra Compliance e Auditoria de LP) mas nunca anexava esse `id` de volta no
    objeto `product` da resposta — quem cadastrava um produto não tinha como saber
    o `id` dele sem uma segunda chamada (`GET /products`) ou vasculhar
    `compliance.compliance.product_id`. Um `POST` que cria recurso sem devolver o
    identificador dele é contrato de API quebrado. Corrigido: resposta agora inclui
    `product.id` diretamente. `addManualProductsBulk` reaproveita a mesma função,
    ganhou o fix de graça, sem mudança própria.
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

**Extensão — pesquisa de intenção comercial (✅ implementada e validada com dado
real, 2026-08-05, pedido explícito do usuário depois de notar que só 1 de 10
keywords no rascunho da Fase 6 tinha sinal de fundo de funil).** Pesquisa padrão
com seed genérico (nome do produto) traz principalmente
termo informacional, porque é assim que o Keyword Planner expande "ideias
relacionadas" de um seed genérico — não é bug, é como a ferramenta funciona.
- Escopo: `service.js#researchCommercialIntentKeywords()` — roda o **mesmo**
  Keyword Plan Idea Service (nenhuma API nova) várias vezes, uma por seed
  modificado com intenção comercial: `"buy {produto}"`, `"{produto} price"`,
  `"{produto} discount"`, `"{produto} coupon"`, `"where to buy {produto}"`.
  Continua mesmo se 1 seed falhar, pra não perder o resto. Aceita `modifiers`
  customizado no body (útil pra público não-americano — os padrões são em inglês).
- Ajuste necessário junto: `getLatestKeywordMetrics()` tinha `LIMIT 20` (pensado
  pra exibição, não pra "todo o pool de um produto") — com múltiplos seeds, o
  pool de candidatos passa fácil de 20 e o limite cortava opção de fundo de
  funil sem avisar. Subiu pra `LIMIT 200`.
- Checklist de teste: (pendente — implementado, não testado com dado real ainda)
  - [x] Rodado num produto real (Advanced Amino Formula) — `comSinalDeFundoDeFunilAgora` subiu de 1 → 7. Cada seed trouxe só 1 ideia (o próprio seed ecoado de volta, sem expandir muito) — comportamento real do Keyword Planner com seed muito específico, não bug.
  - [x] **Bug real encontrado pelo próprio usuário, investigando o resultado**: dos 7 termos com sinal de fundo de funil, 5 vieram sem `top_of_page_bid_low` (Google não tinha dado de leilão suficiente pra estimar preço nesses seeds específicos) — e `selectDraftKeywords()` exigia bid como filtro obrigatório, então só 1 desses 7 realmente virava candidato no rascunho. "7 com sinal" ≠ "7 elegíveis pro rascunho" — o próprio usuário identificou a causa raiz antes de eu precisar investigar.
  - [x] **Corrigido**: bid deixou de ser filtro obrigatório (era rigor herdado de um propósito diferente — estimar CPC de leilão na Fase 2b — não faz sentido pra "montar lista de keyword do anúncio"). Agora é só critério de ORDEM secundário dentro do mesmo estágio de funil (prefere quem tem dado de leilão, mas não descarta quem não tem). Texto de cópia ganhou aviso novo: `[revisar: sem dado de leilão — defina lance manual]`. 2 testes novos cobrindo isso (36/36 na suíte completa).
  - [x] **Reteste confirmado (2026-08-05)**: rascunho gerado depois da correção trouxe **6 keywords de fundo de funil** (antes: 1) — `"advanced amino formula reviews"` (limpa, com leilão) + 5 termos comerciais (`buy`, `price`, `discount`, `coupon`, `where to buy`) corretamente marcados `[revisar: sem dado de leilão]`. As 4 vagas restantes preenchidas com termos "unclear", marcados como esperado. Ciclo de 3 correções em cascata fechado (marca de concorrente → duplicata → filtro de bid rígido demais), todas achadas testando com dado real.
- **Endpoint**: `POST /api/campaigns/keyword-research/:productId/commercial-intent`
  (body opcional `{ baseSeed?, modifiers?: string[] }`)

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
**Status: ✅ concluída e testada com dado real (2026-08-04). Ganhou tela própria
em 2026-08-05 — até então só existia via API/curl, mesmo com o backend
completo há um dia.**
- Frontend: `apps/web/src/features/market-intel/{MarketIntelPage,MarketIntelDetail}.jsx`
  — lista de produtos, cada um abre um modal com o score determinístico (barras
  de demanda/competição/qualidade de LP) + as 8 respostas da IA (vale anunciar,
  saturação, CPC/CPA máximo, orçamento sugerido, riscos, sugestões de ROI,
  raciocínio). Botão "Analisar"/"Reanalisar" chama `POST /:id/analyze` na hora.
  **✅ Testado com dado real (2026-08-05)**: 7 produtos listados, análise
  existente carregou sem reanalisar, "Reanalisar" funcionou, produto nunca
  analisado mostrou estado vazio + botão funcionando (~9s de resposta). Zero
  bug de UI (sem JSX quebrado, sem `undefined` na tela).
  **1 achado real**: `maxTokens: 2048` (herdado da implementação original da
  Fase 3b) truncava o JSON no "Reanalisar" — subiu pra 4096, mesmo padrão de
  todos os outros ajustes de token de hoje.
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
**Status: 🟡 volta a "com ressalva" em 2026-08-11 — bug real encontrado seguindo
o Roteiro de Teste (Bloco 2), corrigido de forma sistêmica. Camada A e B
tinham sido validadas com dado real em 2026-08-05, mas o achado de hoje
mostra que a validação de schema tinha uma fragilidade estrutural que não
tinha aparecido até agora.**
- **Bug real e sua causa raiz (2026-08-11)**: `POST /:id/lp-audit/advanced`
  (Camada A) falhou com HTTP 502 — a resposta da IA não batia com o schema
  `landingPageAuditReport`, faltando 6 campos obrigatórios inteiros
  (`score_classification`, `diagnostico_geral`, `pontos_positivos`,
  `top_5_melhorias`, `oferta`, `intencao_pagina`) mais a forma detalhada de
  `principais_problemas`. Investigando, achei que **isso não era um problema
  isolado desse prompt** — `ai-provider/index.js#analyze()` nunca mandava o
  schema JSON pro modelo, só usava ele pra **validar a resposta depois**. A
  IA tinha que adivinhar o formato inteiro só pela prosa do
  `LP_AUDIT_SYSTEM_PROMPT`, que tinha ficado desatualizada em relação ao
  schema real (schema cresceu ao longo do dia, prompt não acompanhou). O
  retry que já existia também não ajudava — mandava só "tente de novo", sem
  dizer quais campos faltaram, então a IA repetia o mesmo erro.
- **Correção sistêmica (não só remendo de 1 prompt)**:
  - `ai-provider/index.js#analyze()` agora manda o **schema JSON completo**
    junto em toda chamada, pra qualquer um dos 7 schemas do projeto — elimina
    essa categoria de bug de vez, não só pro Auditor de LP. Prompt e schema
    não podem mais divergir silenciosamente, porque o modelo vê a fonte da
    verdade diretamente.
  - O retry agora inclui o **erro real do AJV** (`firstErr.message`, que já
    cita os campos exatos ausentes/extras) em vez de uma instrução genérica —
    a segunda tentativa sabe exatamente o que corrigir.
  - `LP_AUDIT_SYSTEM_PROMPT` também foi atualizado com prosa explicando os 6
    campos que faltavam — o schema resolve a estrutura, a prosa continua
    importando pra qualidade do conteúdo desses campos.
- **Risco residual, registrado com honestidade**: não auditei os outros 6
  prompts (Compliance, Ad Copy, Ad Policy, Campaign Verdict, Product
  Opportunity, LP Visual) pra confirmar se têm o mesmo tipo de deriva —
  a correção sistêmica (schema sempre anexado) já protege contra isso daqui
  pra frente, mas não retroage sobre qualquer suposição errada que eu já
  tenha carregado sobre eles funcionarem "porque nunca deu erro ainda".
- **Efeito colateral real da própria correção, achado no Bloco 5 (2026-08-11)**:
  mandar o schema completo pro modelo (o fix acima) teve uma consequência que eu
  não tinha previsto — `adCopySuggestion` (Fase 6, geração de copy de anúncio)
  passou a truncar com `maxTokens: 4096`, que já tinha sido suficiente antes.
  Causa: `adCopySuggestion` é o único schema com `maxItems: 15` (headlines) —
  bem mais alto que os outros (6-8) — e o modelo, vendo esse limite explícito
  no schema, passou a preencher o array até o teto com mais consistência do
  que quando só via a contagem sugerida vagamente na prosa do prompt. Corrigido
  subindo `maxTokens` pra 8192 (`ai-advisor/service.js#generateAdCopy`).
  Checados os outros 5 schemas (`maxItems` entre 6 e 8, bem mais folgados) —
  nenhum ajuste feito neles sem evidência de que quebraram, só o que realmente
  truncou.

**Nota — Bloco 4 do roteiro confirmou a integração de LP no Confidence Score
(2026-08-11)**: depois do fix acima, `POST /decision-engine/5/evaluate`
retornou `confidence=80` — primeira vez que um produto real combina keyword
genérico (20) + comercial (25) + LP Camada A (15) + base (20) = 80, batendo
exatamente com a fórmula desenhada na Fase 12/extensão de VSL. `has_vsl` veio
`null` (produto sem VSL de verdade, comportamento correto, não bug).
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

### Fase 6 — Rascunho de Campanha (criação manual pelo usuário)
**Status: ✅ completa e testada com dado real (2026-08-05).**

- Objetivo: fechar o loop que hoje para em "vale a pena anunciar?" (Fase 3b),
  sem o sistema precisar escrever no Google Ads. A IA prepara orçamento
  validado, palavras-chave reais (Fase 2b) e copy de anúncio (checada contra a
  LP real, Fase 3d) — você mesmo cria a campanha copiando esses dados pra
  dentro do Google Ads.
- **Decisão revisada em 2026-08-05**: a versão original desta fase previa o
  sistema criar a campanha de verdade via API (`campaignBuilder.js`, sequência
  orçamento → campanha → grupo → keywords → anúncio). O usuário decidiu que
  prefere criar manualmente — **essa parte foi removida do código**, não
  deixada como opção não usada. Motivo: elimina de propósito a parte de maior
  risco do projeto (escrita real no Google Ads, nunca testada) sem perder o
  valor real (decidir orçamento/keywords/copy continua automatizado).
- Fluxo agora: `POST /drafts` (gera rascunho) → `POST /drafts/:id/approve`
  (revisão) → você cria manualmente no Google Ads, usando o texto formatado de
  `GET /drafts/:id/copy-text` → `POST /drafts/:id/mark-as-used` (bookkeeping
  manual, não chama nenhuma API do Google).
- Decisões da seção 10 aplicadas (2026-08-05):
  9. Orçamento máximo: **R$ 100/dia** (topo da faixa R$ 50–100 escolhida) —
     `MAX_DAILY_BUDGET_HARD_CAP` no `.env`, validado em `createDraft()` antes de
     gravar o rascunho.
  10. Copy do anúncio: **IA sugere, usuário revisa** — `generateAdCopy()`,
      schema `adCopySuggestion`, checa correspondência com o texto real da LP.
- Escopo implementado:
  - `campaign_drafts` (migration 014).
  - `google-ads/campaignDrafts.js` — orquestra o rascunho + `formatDraftForCopy()`
    (texto simples, pronto pra ler e digitar no Google Ads).
  - Frontend: `CampaignDraftsPage`, `CampaignDraftModal`, `CampaignDraftDetail`
    (com botão "Copiar tudo" e aprovação/marcação de uso).
- Checklist de teste:
  - [x] Criar 1 rascunho real (Advanced Amino Formula, EUR 30/dia) e revisar copy/keywords — copy fez sentido (8 aminos, recuperação, vs BCAA, vegano, garantia 90 dias), limites de RSA respeitados (headlines ≤30, descrições ≤90)
  - [x] Confirmar que orçamento acima de R$ 100/dia é rejeitado antes de gravar — HTTP 400 confirmado, zero rascunhos criados
  - [x] Aprovar → copiar texto formatado → marcar como usado — fluxo completo testado na UI, badge mudou corretamente em cada etapa
  - [x] Teste de usabilidade real do `copy-text`: "Dá pra montar a RSA no Google Ads só com isso" — validação direta do usuário, não só funcionamento técnico
- **3 achados reais corrigidos no mesmo dia**:
  1. **Truncamento de JSON** (mesma categoria do incidente da Fase 3b): `maxTokens: 2048` não bastava pra `generateAdCopy()` — subiu pra 4096, e um exemplo de formato foi injetado no prompt (mesmo padrão que já estabilizou o Auditor de LP).
  2. **Palavra-chave de marca de concorrente sugerida sem aviso**: a pesquisa de keyword (Fase 2b) trouxe "xtend bcaa", "kion aminos", "bodyhealth perfectamino" — nomes de marcas concorrentes, não termos genéricos — junto com o resto por causa de como o Keyword Planner gera "ideias relacionadas". Corrigido com `excludeKeywordTerms` (campo na tela, filtra antes de gerar o rascunho) **e** aviso permanente no texto de cópia, já que não dá pra detectar marca de terceiro com 100% de confiança sem uma lista mantida — a responsabilidade final de revisar continua sendo do usuário, o sistema só facilita.
  3. **Seleção de keyword não considerava fundo de funil** (2026-08-05, achado depois de pergunta direta do usuário): a estratégia do projeto é fundo de funil (alta intenção de compra), mas a seleção original só ordenava por volume de busca — termos genéricos/informacionais de alto volume ("glutamin", "bcaa supplements") ficavam à frente de termos de intenção de compra. Isso não é só subótimo — contradiz a taxa de conversão assumida no cálculo de Economics (5.1), que pressupõe um público mais qualificado. Corrigido com `google-ads/keywordIntent.js` — função determinística (sem IA, mesmo padrão de `scoring.js`) que classifica cada keyword por sinal de intenção de compra (lista de termos PT-BR + EN: "buy", "comprar", "review", "preço", "cupom", etc.), prioriza as com sinal, usa o resto só pra completar até 10, e **marca explicitamente no texto de cópia** quando um termo "sobrou" sem sinal claro — nunca esconde a mistura.
  4. **2 bugs reais encontrados testando a correção acima, com dado real (2026-08-05)**: (a) `excludeKeywordTerms` comparava a keyword **inteira** contra o termo excluído — usuário passou `"xtend"` esperando filtrar `"xtend bcaa"`, e não funcionou, porque a string inteira não batia. Corrigido pra substring (`kw.includes(termo)`), do jeito que qualquer pessoa razoavelmente esperaria. (b) `keyword_metrics` podia ter a mesma keyword gravada 2x (pesquisas com seeds diferentes que se sobrepõem — "amino acid supplement" e "advanced amino formula" ambos trouxeram "advanced amino formula reviews"), e sem dedupe, a mesma keyword ocupava 2 das 10 vagas do rascunho. Lógica de seleção inteira foi extraída pra uma função pura (`selectDraftKeywords()`), testável isolada — 9 testes unitários no total (`keywordIntent.test.js`, 35/35 na suíte completa), incluindo os 2 bugs específicos replicados como teste, pra nunca mais voltarem sem que um teste quebre primeiro.
- Definição de pronto: ✅ atingida — rascunho real gerado, revisado e "usado" de ponta a ponta pela UI, com o próprio usuário confirmando que o texto é suficiente pra criar a campanha sem digitar nada a mais.
- **Endpoints**: `POST /api/campaigns/drafts` (aceita `excludeKeywordTerms` opcional), `GET /api/campaigns/drafts`,
  `GET /api/campaigns/drafts/:id`, `GET /api/campaigns/drafts/:id/copy-text`,
  `POST /api/campaigns/drafts/:id/approve`, `POST /api/campaigns/drafts/:id/mark-as-used`

---

### Fase 7 — Gestor de Contingência
**Status: ✅ COMPLETA E TESTADA COM DADO REAL (2026-08-05) — Parte A implementada
e validada, Parte B cortada por decisão consciente do usuário.**

**Parte A — Revisão preventiva de anúncio (implementada).**
- Objetivo: revisar o texto exato do anúncio contra políticas reais do Google Ads
  antes de publicar — não depois de tomar reprovação. Estende o Compliance (5.3),
  que classifica só o nicho do produto, não o texto específico do anúncio.
- Escopo implementado:
  - `ai-advisor/service.js#reviewAdPolicy()`, schema `adPolicyReview` — avalia
    risco (`low`/`medium`/`high`), estimativa de aprovação, problemas específicos
    com recomendação de reescrita.
  - `monitoring/service.js#checkAdDisapprovals()` — **fecha uma lacuna real**: a
    tabela `alerts` previa o tipo `ad_disapproved` desde a migration 004, mas
    nunca tinha sido implementado (só `campaign_paused` e `impression_drop`
    existiam de verdade). Agora consulta `ad_group_ad.policy_summary` via GAQL a
    cada checagem de monitoramento e gera alerta real quando encontra
    `DISAPPROVED`.
  - `google-ads/googleAdsClient.js#fetchAdApprovalStatuses()` — mesma ressalva
    de sempre: nomes de campo não confirmados contra conta real ainda, parsing
    defensivo com aviso no console se vier vazio.
- Base multi-conta implementada junto: `google_ads_accounts` ganhou
  `login_customer_id`, `is_default`, `status` (migration 014);
  `googleAdsClient.js` inteiro refatorado pra aceitar conta específica em vez
  de só ler do `.env` — **retrocompatível**, sem conta especificada cai no
  comportamento antigo (conta única via `.env`).
- Checklist de teste:
  - [x] `review-policy` testado com copy real e limpa (Advanced Amino Formula) — `risk_level: low`, `likely_to_be_approved: true`, encontrou 1 achado leve ("recuperação rápida"/"músculos fortes" → área de alegações de saúde, sugeriu suavizar) — mostra sensibilidade real, não é binário grosseiro
  - [x] `review-policy` testado com copy propositalmente arriscada ("Cura Garantida em 7 Dias", "aprovado por médicos") — `risk_level: high`, `likely_to_be_approved: false`, **3 achados específicos citando o texto exato** ("Cura Garantida em 7 Dias", "Resultado 100% garantido...", "aprovado por médicos") — não genérico, aponta a frase problemática de verdade
  - [x] Diferenciação `low` → `high` confirmada entre os dois testes acima
  - [x] Checagem de monitoramento rodada — `{"total":0,"statusAlerts":0,"impressionAlerts":0,"adDisapprovalAlerts":0}` — campo novo presente e funcionando (0 é o esperado, sem anúncio reprovado real no momento)
  - [x] Cadastro de segunda conta testado — `GET /accounts` vazio → `POST` cria conta (`id:1`, `status: active`) → `GET /accounts` mostra a conta nova. CRUD multi-conta confirmado.

**Parte B — Diagnóstico e apelação — CORTADA (decisão de 2026-08-05).**
- ⚠️ **Decisão do usuário, com base em dado real, não suposição.** Pesquisamos
  taxas de sucesso de apelação de suspensão do Google Ads em 2026: existe um
  sistema por níveis — violações "standard-tier" (primeira ofensa) têm
  recuperação razoável, mas violações "egregious-tier" (repetidas, graves)
  têm taxa de sucesso muito baixa — o próprio Google declara que "não permite
  anunciar de novo, exceto em circunstâncias excepcionais". **Exatamente o
  tipo de nicho que nosso Compliance (5.3) já classifica como `sensitive`**
  (alegação de saúde, suplemento) é o que mais rápido escala pra essa
  categoria de difícil recuperação se repetido.
- **Conclusão registrada**: construir "IA escreve seu recurso de apelação" não
  compensa o investimento dado esse cenário — a Parte A (prevenção, já
  implementada) é o que realmente evita cair na categoria "egregious" em
  primeiro lugar. Prevenção > recurso, pro caso de uso real deste projeto.
- **Não reintroduzir isso sem pedido explícito do usuário** — não é lacuna
  esquecida, é escopo removido conscientemente.
- **Endpoints (Parte A)**: `POST /api/campaigns/drafts/:id/review-policy`,
  `GET /api/campaigns/accounts`, `POST /api/campaigns/accounts`,
  `POST /api/campaigns/accounts/refresh-status`

---

### Fase 8 — Governança "Guarda-Chuva" Multi-Conta
**Status: 🟡 código completo (2026-08-05), ⏳ pendente de teste real.**

- Origem: o usuário trouxe um texto sobre estrutura de contingência
  "guarda-chuva" (MCC principal → MCCs por operação → contas individuais,
  isolamento de risco por método de pagamento/marca/domínio). Escopo
  calibrado pela escala real informada (dezenas de contas, MCC já existente
  com pelo menos 1 sub-conta) — **não** a versão "centenas de contas,
  automação de criação em massa" do texto original, que seria
  over-engineering pro estágio atual.
- **Princípio seguido, explícito no texto original e reforçado aqui**: isso é
  visibilidade e isolamento de risco de uma estrutura legítima — nunca
  criação de conta pra burlar suspensão, nunca automação de bypass de
  política. Mesma linha do resto do projeto.
- Escopo implementado:
  - `google_mccs` (migration 015) — hierarquia de MCC (`parent_mcc_id`
    self-referencial, pra MCC dentro de MCC se a estrutura tiver isso).
  - `google_ads_accounts` ganhou: `mcc_id`, `operacao`, `marca`, `regiao`,
    `dominio`, `payment_method_label` (rótulo descritivo, **não** integra com
    dado real de cobrança — API do Google Ads não expõe isso de forma
    simples), `daily_budget_cap`, `previous_status` (pra detectar mudança,
    não só estado atual).
  - `monitoring/service.js#checkAccountStatusChanges()` — novo, roda dentro
    do `runAllChecks()` já agendado (Fase 7). Só alerta quando o status muda
    de verdade (compara com `previous_status`), não repete a cada 15min.
    Severidade `high` se virar `SUSPENDED`/`CANCELED`/`CLOSED`.
  - `getGovernanceRollup()` — agrupa contas por método de pagamento/operação/
    status, pra responder "quantas contas dependem do mesmo cartão" sem
    contar na mão.
  - Frontend: `apps/web/src/features/google-ads/{AccountsPage,McCModal,AccountModal}.jsx`
    — tela "Contas", com aviso visual quando 5+ contas compartilham o mesmo
    `payment_method_label`.
  - **Documento**: `docs/PLANO_CONTINGENCIA.md` — 5 procedimentos (falha de
    pagamento, mudança de política, reprovação em massa, mudança de domínio,
    rotatividade de acesso admin), cada um referenciando telas/endpoints reais
    do projeto, não conselho genérico. Registra explicitamente o que o plano
    **não** cobre (apelação de suspensão — já cortada na Fase 7 Parte B;
    criação automática de conta/MCC — nunca vai existir).
- Nota de custo de cota (calculado, não assumido): 30 contas × 4 checagens/hora
  × 24h = 2.880 chamadas/dia pra `checkAccountStatusChanges()` — bem dentro do
  limite de 15 mil operações/dia do Acesso Básico. Revisitar frequência se a
  escala crescer bem além de "dezenas".
- Checklist de teste:
  - [ ] Cadastrar 1 MCC e pelo menos 2 contas com o mesmo `payment_method_label`,
    confirmar que o aviso de risco aparece na tela
  - [ ] Rodar "Atualizar status" e confirmar que `getGovernanceRollup()` reflete
    o status real
  - [ ] Forçar (ou aguardar) uma mudança de status de conta real e confirmar
    que gera exatamente 1 alerta `account_status_change`, não um a cada 15min
  - [ ] Ler o `PLANO_CONTINGENCIA.md` e confirmar que os endpoints/telas
    citados realmente existem e fazem o que o documento diz
  - [x] **Sincronização testada com dado real (2026-08-06)**: o `customer_id`
    cadastrado como MCC (`6815930756`, "MagicZap") **não é uma conta gerenciadora
    de verdade** (`manager: false` segundo a própria API) — resultado correto foi
    "0 contas encontradas". Achado real no processo: isso vinha sem explicação
    nenhuma (indistinguível de falha silenciosa) — corrigido: `fetchAccountHierarchy()`
    agora lança erro claro nesse caso específico ("não é uma conta gerenciadora...
    confirme se é realmente o customer_id da sua MCC"), em vez de devolver `0`
    sem contexto. `skippedManagers: 0` confirmado correto (não havia sub-MCC
    pra ignorar).
  - [x] **Caminho feliz confirmado com dado real (2026-08-06)**: `7169854441`
    é a MCC gerenciadora de verdade (confirmado tanto pela API — `manager: true`
    — quanto pela própria interface do Google Ads, rótulo "· Gerente").
    Descoberto pelo caminho todo: erro de permissão inicial (`login-customer-id`)
    era falta de acesso do usuário dono do refresh token nessa MCC específica —
    resolvido concedendo acesso "Padrão" via **Acesso e segurança** no Google
    Ads (não é código, é configuração de conta). Sync encontrou a hierarquia
    real: `7169854441` (MCC) → `6815930756` (MagicZap, filha).
  - [x] **Bug real encontrado no mesmo teste, corrigido**: a conta filha já
    existia no banco vinculada a uma "MCC" incorreta (cadastrada antes de
    sabermos qual era a de verdade) — o sync original só atualizava `status`
    da conta existente, nunca corrigia `mcc_id`, deixando a hierarquia errada
    presa pra sempre. Corrigido com `updateAccountFromSync()` (nova função,
    separada de `updateAccountStatus()` que o monitoring usa) — agora
    reparenta a conta pra MCC certa quando descoberta. Resposta do endpoint
    ganhou o campo `reparented` pra deixar isso visível.
  - [x] **Reteste confirmou o fix (2026-08-06)**: `reparented: 1` na resposta,
    e `GET /api/campaigns/accounts` confirmou `MagicZap` (customer_id
    `6815930756`) migrada de `mcc_id: 1` ("MCC Principal", errada) pra
    `mcc_id: 2` ("MCC Real") — reparentamento correto, ponta a ponta.
  - [x] **Bug real encontrado pelo usuário olhando a tela (2026-08-06)**: o
    badge de status mostrava `"2"` em vez de "Ativo"/"Enabled" — o recurso
    `customer_client` devolve status como **código numérico bruto**, diferente
    de `customer.status` (usado em `fetchAccountStatus`, que já vem como
    string `'ENABLED'`/`'SUSPENDED'`) — mesma lib, resource diferente,
    serialização diferente. Isso não era só estético: a detecção de conta
    crítica em outros lugares do código compara STRING (`['SUSPENDED', ...].includes(status)`)
    — um número bruto tipo `"4"` nunca bateria com isso, quebrando a
    detecção **silenciosamente** pra contas que passassem por esse caminho.
    Corrigido com `normalizeCustomerStatus()` (mapeia o enum oficial
    `CustomerStatus` da API pra string). Rodar o sync de novo corrige o dado
    já gravado errado (`updateAccountFromSync` sobrescreve o status).
- Definição de pronto: ✅ atingida — MCC real, hierarquia real, reparentamento
  correto, tudo confirmado com dado real, incluindo um problema de acesso de
  conta real resolvido no processo (não só código).
- **Extensão — exclusão de conta/MCC (2026-08-06, pedido do usuário pra limpar
  dado de teste)**: não existia até então, só criar/listar. `DELETE /accounts/:id`
  (sem soft-delete, escopo pequeno não justifica ainda) e `DELETE /mccs/:id`
  (falha com erro claro — HTTP 409 — se ainda tiver conta vinculada, em vez de
  `CASCADE` silencioso). Botão "Excluir" na visão Tabela da tela Contas, com
  confirmação antes de excluir.
  você como "isso eu realmente seguiria numa emergência", não só documentação
  de prateleira.
- **Extensão — descoberta automática de contas (2026-08-06, respondendo pergunta
  direta do usuário: "como o sistema sabe quais contas existem na MCC?")**.
  Até aqui, toda MCC/conta era cadastrada manualmente — o sistema não sabia
  nada sozinho. Corrigido com a API oficial certa (confirmada por pesquisa
  antes de implementar, mesma disciplina de sempre): recurso `customer_client`
  via GAQL, consultado a partir da própria MCC — diferente de
  `ListAccessibleCustomers` (que só lista o que o usuário logado tem acesso
  direto, não a árvore da MCC).
  - `googleAdsClient.js#fetchAccountHierarchy()` — consulta a MCC, retorna
    toda a árvore (nível ≤ 2), já filtrando a própria MCC (nível 0) fora do resultado.
  - `service.js#syncAccountsFromMcc()` — faz upsert: cria conta nova
    encontrada no Google, atualiza status de conta que já existia, **nunca
    sobrescreve campos de governança preenchidos manualmente**
    (`operacao`/`marca`/`payment_method_label`/etc.) — a API do Google não
    sabe "qual operação atende", isso continua sendo julgamento seu. Sub-MCCs
    encontradas na árvore são identificadas (`customer_client.manager`) e não
    viram "conta" — só conta de gasto de verdade é cadastrada.
  - Botão "Sincronizar contas da MCC" na tela **Contas**.
  - ⚠️ Mesma ressalva de sempre: nomes de campo do `customer_client` não
    confirmados contra conta real a partir deste ambiente — parsing
    defensivo, primeira chamada real precisa de revisão.
- **Endpoints**: `GET/POST /api/campaigns/mccs`, `POST /api/campaigns/mccs/:id/sync-accounts`, `GET /api/campaigns/governance/rollup`

---

### Fase 9 — Autenticação JWT + Perfis (fundação pro NOC guarda-chuva)
**Status: ✅ completa e testada com dado real (2026-08-05).**

- Origem: o usuário trouxe uma especificação de painel estilo NOC/enterprise
  (Datadog/Grafana/Linear/Stripe) pra gestão de contingência, incluindo
  autenticação JWT com 4 perfis. Calibrado em conversa: **TypeScript ficou de
  fora por ora** (código novo continua JavaScript; migração seria projeto
  separado, decisão explícita do usuário) — só a fundação de autenticação
  entrou nesta fase, a tela NOC visual em si é a próxima (Fase 10, a definir).
- **Sequenciamento deliberado**: JWT primeiro, por ser a fundação que a tela
  nova (Fase 10) e o resto do sistema dependem — construir a tela bonita em
  cima da autenticação antiga significaria refazer duas vezes.
- **Risco gerenciado**: `requireAdmin` (usado em TODAS as rotas existentes do
  projeto) continua aceitando a `ADMIN_KEY` antiga — **nenhuma rota precisou
  ser tocada**. JWT de usuário com perfil `administrador` foi adicionado como
  caminho alternativo, não substituto. Migrar rotas existentes pra JWT-only é
  decisão separada, futura, não forçada aqui — reduz risco de quebrar as 8
  fases já testadas hoje.
- Escopo implementado:
  - `users` (migration 001, nunca usada até hoje) ganhou `name`, `is_active`
    (migration 016).
  - `shared/auth/passwords.js` (bcrypt), `shared/auth/tokens.js` (JWT, 12h de
    validade), `shared/auth/middleware.js#requireAuth(minRole)` — hierarquia
    `visualizador < operador < gerente < administrador`.
  - `modules/users/` — bootstrap do primeiro usuário (só funciona com 0
    usuários no banco, sempre cria como `administrador`), login, CRUD de
    usuário (só administrador cria/edita).
  - **Rotas montadas em `/api/staff/*`, não `/api/auth/*`** — achado real
    durante a implementação: `affiliate-ops` já usava `/auth/login` pros
    afiliados (sistema de login diferente, pra quem clica em link de
    afiliado). `/staff` evita a colisão e também deixa semanticamente claro
    que são dois sistemas de auth diferentes.
  - Frontend: `Login.jsx` reescrito (detecta primeiro acesso via
    `GET /staff/auth/status`, mostra bootstrap ou login normal),
    `UsersPage.jsx` novo (gestão de perfil, só visível/funcional pra
    administrador), `client.js` guarda token JWT em paralelo com a
    `adminKey` antiga.
- Checklist de teste:
  - [x] Migration rodada, `users` com `name`/`is_active` confirmados
  - [x] Primeiro acesso detectado corretamente (`GET /staff/auth/status`), bootstrap criou o primeiro administrador
  - [x] Logout + login normal (não bootstrap) funcionou com o mesmo e-mail/senha
  - [x] Segundo usuário criado como `visualizador` pela tela **Usuários**
  - [x] Login como `visualizador` — aba "Usuários" sumiu do menu, acesso direto à rota bloqueado com mensagem clara
  - [x] **Retrocompatibilidade confirmada com dado real**: `POST /api/products/manual` com `x-admin-key` (sem JWT nenhum) retornou HTTP 201 normalmente — nada do que já foi testado nas Fases 0-8 quebrou
- Definição de pronto: ✅ atingida.
- **Endpoints**: `GET /api/staff/auth/status`, `POST /api/staff/auth/bootstrap`,
  `POST /api/staff/auth/login`, `GET/POST /api/staff/users`, `PATCH /api/staff/users/:id`

---

### Fase 10 — Painel NOC (Árvore + Heatmap + Saúde por Conta)
**Status: ✅ completa e testada com dado real (2026-08-05/06), com 2 bugs reais
encontrados e corrigidos no processo.**

- Origem: evolução visual da Fase 8, calibrada a partir da especificação de
  painel estilo NOC/enterprise (Datadog/Grafana/Linear/Stripe) que o usuário
  trouxe — escopo confirmado em conversa: **árvore hierárquica + heatmap**,
  sem TypeScript, sem reconstruir as 15 páginas do documento original (várias
  já existem em versão mais simples: Campanhas, Alertas).
- Escopo implementado:
  - Backend: `getGovernanceRollup()` (google-ads/repository.js) ganhou
    cálculo de **saúde por conta** — `green`/`yellow`/`red`, determinístico
    (sem IA): `red` se status da conta virar `SUSPENDED`/`CANCELED`/`CLOSED`,
    `yellow` se tiver qualquer alerta aberto vinculado (`subject_type='account'`),
    `green` caso contrário. Contagem agregada (`byHealth`) alimenta os KPIs
    do topo da tela.
  - Frontend: `AccountTree.jsx` (árvore expansível MCC → Operação → Conta,
    com indicador de saúde por conta), `AccountHeatmap.jsx` (grade de
    quadrados coloridos, 1 por conta, clicável), `AccountDetailModal.jsx`
    (clique em qualquer visualização abre o detalhe, com aviso específico se
    `red`/`yellow`, referenciando `PLANO_CONTINGENCIA.md`).
  - `AccountsPage.jsx` ganhou seletor de visualização (Árvore / Heatmap /
    Tabela — a tabela antiga da Fase 8 continua disponível, não foi
    removida) e KPIs de saúde no topo (🟢/🟡/🔴).
- **O que ficou de fora, deliberadamente** (não é lacuna, é escopo
  calibrado): TypeScript, dashboard financeiro (gasto/CPA/ROAS reais por
  conta — precisaria agregar `campaign_metrics_daily` por conta, não
  implementado ainda), páginas de Automações/Logs (não existem no projeto
  hoje, fora do escopo desta fase).
- Checklist de teste:
  - [ ] Abrir a aba **Contas**, confirmar que a árvore aparece por padrão,
    expandir/recolher MCC e operação
  - [ ] Trocar pra visualização **Heatmap**, confirmar que as cores batem
    com o que a tabela mostra pro mesmo conjunto de contas
  - [ ] Clicar numa conta em cada uma das 3 visualizações, confirmar que o
    modal de detalhe abre com o dado certo
  - [ ] Se tiver algum alerta aberto vinculado a uma conta (`account_status_change`
    da Fase 8), confirmar que ela aparece `yellow`, não `green`
- **2 bugs reais encontrados testando com dado real (2026-08-05/06), corrigidos**:
  1. **`subject_id integer = text`** — a query de `open_alerts_count` fazia
     `al.subject_id = a.id::text`, mas `alerts.subject_id` é `INTEGER` (migration
     004), não `TEXT` — o cast estava invertido, e isso **quebrava a API
     inteira** (tela ficava com 0 contas, sem erro claro pro usuário). Corrigido
     removendo o cast (`a.id` puro, comparação integer-integer). Também ajustado
     `checkAccountStatusChanges()` (monitoring) que criava o alerta com
     `subjectId: String(account.id)` — mesma causa raiz, mesma correção.
  2. **Árvore não fechava no primeiro clique**: nó "aberto por padrão"
     (chave ausente do estado) calculava `!prev[key]` com `undefined`, que
     dava `true` de novo em vez de `false` — o primeiro clique não invertia
     o estado efetivo. Corrigido calculando o estado efetivo (`prev[key] !== false`)
     antes de inverter.
- **Validado com dado real**: 3 contas (2 verdes, 1 amarela com 14 alertas
  `account_status_change` abertos) — cores batendo entre Heatmap e Tabela,
  modal de detalhe correto nas 3 visualizações, conta com alerta corretamente
  amarela (não verde) nas 3 views + no KPI do topo.
- Definição de pronto: ✅ atingida — você consegue olhar a tela e identificar em poucos
  segundos quais contas têm problema, sem precisar ler a tabela linha por
  linha — esse era o objetivo central da especificação original.

---

### Fase 11 — Teste E2E + Manual de Uso Gerado
**Status: 🟡 código completo (2026-08-06), ⏳ pendente de rodar de verdade.**

- Origem: pergunta do usuário — como testar como um humano usaria (não só
  chamada de API), e como gerar manual com imagens sem manter isso manual pra
  sempre.
- **Insight central**: o mesmo teste resolve os dois problemas. Um teste E2E
  de verdade (Playwright, clica no navegador de verdade) tira 1 screenshot
  por etapa — essas imagens **são** o conteúdo do manual. Rodar o teste de
  novo regenera as imagens automaticamente; não existe manual desatualizado
  por esquecimento, só manual que ninguém rodou depois de mudar a UI (fácil
  de perceber, a imagem antiga continua existindo, só não bate mais).
- Escopo implementado:
  - `apps/web/playwright.config.js`, `apps/web/e2e/full-walkthrough.spec.js`
    — jornada completa: login/bootstrap → dashboard → cadastro de produto
    (com preview de Economics) → análise de mercado → rascunho de campanha
    → concorrência → contas (árvore/heatmap/tabela) → alertas. 17 screenshots
    nomeados, salvos em `docs/manual-screenshots/`.
  - `docs/MANUAL_DE_USO.md` — texto explicativo pra cada etapa, referenciando
    as imagens pelo nome exato que o script gera.
  - Scripts novos: `npm run e2e` (roda headless), `npm run e2e:ui` (roda com
    interface visual do Playwright, útil pra debugar).
- **Ressalvas importantes**:
  - O teste **não sobe os servidores sozinho** — API e frontend precisam
    estar rodando antes (`npm start` e `npm run dev`, dois terminais).
  - Etapas com IA (análise de mercado, rascunho de campanha) chamam a API da
    Anthropic de verdade — **custo real**, não é gratuito nem instantâneo.
    Não pensado pra virar parte de um CI que roda a cada commit sem
    considerar isso.
  - Seletores usam texto/rótulo visível (não `data-testid`), porque os
    formulários do projeto não têm `id`/`htmlFor` conectando label e input —
    funcional, mas mais frágil a mudança de texto na UI do que seria com
    atributos de teste dedicados. Se a UI mudar texto de botão/label, o
    teste pode quebrar — isso é esperado, é o sinal de "hora de atualizar o
    manual".
  - Nunca rodado de verdade a partir daqui (sem navegador real neste
    ambiente) — primeira execução real pode expor seletor que não bate
    exatamente, mesma categoria de risco de outras integrações novas do dia.
- Checklist de teste:
  - [ ] `npx playwright install` (baixa o navegador Chromium, só na primeira vez)
  - [ ] Rodar `npm run e2e --workspace=apps/web` com API e frontend de pé
  - [ ] Confirmar que os 17 screenshots foram gerados em `docs/manual-screenshots/`
  - [ ] Abrir `docs/MANUAL_DE_USO.md` e conferir se as imagens aparecem certas
  - [ ] Se algum seletor falhar, ajustar o texto no teste pra bater com a UI real
- Definição de pronto: o teste roda do início ao fim sem falhar, e o manual
  fica com as 17 imagens reais da sua instância, não placeholder.

---

### Fase 12 — Evidence Engine + Decision Engine (núcleo)
**Status: ✅ completa e testada com dado real (2026-08-06), com 2 bugs reais
encontrados e corrigidos no processo (intenção de keyword, moeda).**

- Origem: `docs/EVIDENCE_DECISION_ENGINE.md` (desenho aprovado) + spec de
  implementação controlada do usuário — só o núcleo, sem API nova, sem tela
  nova, sem refatoração geral.
- Princípio central: **2 scores nunca decidem sozinhos**. Opportunity Score
  (quão boa parece a oportunidade) e Confidence Score (quanta evidência real
  foi coletada) são calculados separadamente — a decisão final (`testar`/
  `investigar`/`descartar`) só considera os dois juntos. Isso existe
  especificamente pra impedir que 1 keyword genérica ruim descarte um produto
  que tem alternativa de cauda longa viável (achado real do dia com o
  Advanced Amino Formula).
- Escopo implementado:
  - `decision-engine/scoring.js` — núcleo **puro, sem SQL, sem IA**:
    `computeOpportunityScore()`, `computeConfidenceScore()`, `decide()`,
    `shouldStopPipeline()`. Testável isolado, 10 testes cobrindo os cenários
    pedidos (incluindo reprodução numérica do caso Advanced Amino Formula).
  - `decision-engine/service.js#evaluateProduct()` — orquestrador do
    pipeline: lê Economics+Compliance (já calculados no cadastro, nunca
    recalcula), chama Keyword genérico e Keyword comercial **só se ainda não
    tiverem rodado pra esse produto** (idempotência via
    `keyword_metrics.research_source`), para assim que uma decisão confiável
    for possível.
  - `decision-engine/repository.js` — reaproveita `opportunity_scores`
    (não criou tabela nova), com `model_version = 'evidence-engine-v1'`
    diferenciando das leituras antigas do Market Intelligence
    (`deterministic-v1`) na mesma tabela.
  - Migration 017: `opportunity_scores` ganhou `confidence_score`,
    `decision_status`, `evidence_stage`, `stopped_reason`; `keyword_metrics`
    ganhou `research_source` (`generic`/`commercial_intent`, default
    `generic` pra não quebrar linha antiga).
  - **Endpoints**: `POST /api/decision-engine/:productId/evaluate` (roda ou
    retoma o pipeline), `GET /api/decision-engine/:productId/status`
    (última decisão salva).
- **Fora de escopo nesta etapa, por pedido explícito**: LP Camada A/B e
  Concorrência entram no cálculo de Confidence (pesos já reservados: +15,
  +10, +10), mas o pipeline **não dispara essas etapas automaticamente**
  ainda — só Economics+Compliance+Keyword genérico+Keyword comercial. Sem
  tela nova, sem API nova (Trends/PAA/etc. seguem fora, como já registrado
  no relatório de riscos de escala).
- **Nota de calibração honesta**: os limiares (60 pra decidir, 60/35 pro
  veredito) vieram do desenho teórico — escrever os testes exigiu 3
  iterações pra achar valores de sinal que realmente cruzassem 60 quando o
  sinal de Economics genérico continua ruim (ele pesa 30%, o mais alto).
  Isso não é bug, é o sistema "lembrando" do sinal ruim em vez de esquecê-lo
  — mas os limiares merecem calibração com mais produtos reais, não só a
  teoria do desenho.
- **Bug real encontrado testando com dado real (2026-08-06), corrigido**:
  o primeiro teste real (Advanced Amino Formula) devolveu `descartar` quando
  o esperado era `testar`/`investigar` — o motivo: "advanced amino formula
  reviews" (o termo que deveria "resgatar" o produto) veio da **busca
  genérica** (Google devolveu como ideia relacionada ao seed = nome do
  produto), não da busca comercial — mas `bestCommercialKeywordRatio()`
  filtrava por `research_source === 'commercial_intent'`, confundindo **de
  qual busca a linha veio** com **que intenção o texto expressa**. Corrigido
  usando `classifyKeywordIntent()` (já existe, já testado na Fase 6) sobre o
  **texto** da keyword, não sobre a origem da busca — agora conta qualquer
  keyword com sinal de fundo de funil, não importa qual chamada trouxe ela.
  Funções puras (`bestCommercialKeywordRatio`, `demandScoreFromSearches`,
  `economicsMarginFromStatus`, `complianceScoreFromSensitivity`) também
  foram movidas de `service.js` pra `scoring.js` nesse processo — motivo
  técnico: `service.js` importa módulos que tocam banco, o que impedia
  testar essas funções isoladas sem banco de verdade; `scoring.js` continua
  100% puro. 2 testes novos reproduzindo o caso exato. 48/48 na suíte.
- **Segundo bug real, achado no reteste (2026-08-06)**: mesmo depois do fix
  acima, o score só subiu 22→24 (esperava mais) — o usuário mesmo
  diagnosticou a causa raiz: `bestCommercialKeywordRatio()` comparava o bid
  de leilão (vem na moeda da **conta** do Google Ads, ex: BRL) direto contra
  `cpc_maximo_calculado` (moeda do **produto**, ex: EUR), sem converter —
  **exatamente o mesmo bug de moeda já corrigido uma vez na Fase 2b
  (2026-08-04)**, reintroduzido no Decision Engine por eu não ter aplicado a
  mesma proteção. Corrigido com `convertKeywordBidsToProductCurrency()`
  (novo, em `service.js`), reaproveitando o `shared/fx.js` já existente e
  confiável — mesma fórmula que `researchKeywordsForProduct()` já usa.
  **Lição registrada**: toda comparação monetária nova precisa da mesma
  checagem de moeda, mesmo dentro de um módulo novo — não é suficiente ter
  corrigido isso uma vez em outro lugar do código.
- Checklist de teste:
  - [ ] Rodar a migration, confirmar as colunas novas nas 2 tabelas
  - [ ] `POST /api/decision-engine/1/evaluate` no Advanced Amino Formula
    (produto que já tem economics/compliance/keyword genérico/comercial
    calculados hoje) — confirmar que ele **não** reprocessa keyword (já tem
    `research_source` gravado) e retorna decisão a partir do dado existente
  - [ ] Rodar num produto **novo**, sem keyword nenhuma ainda, e confirmar
    que o pipeline chama as APIs certas na ordem certa, para na primeira
    decisão confiável
  - [ ] Chamar `evaluate` duas vezes seguidas no mesmo produto e confirmar
    que a segunda chamada não duplica linha em `keyword_metrics` nem
    dispara chamada nova ao Keyword Planner (idempotência, item 9 da spec)
  - [x] Conferir que `GET /api/market-intel/:id/score` (rota antiga) continua
    funcionando sem alteração — retrocompatibilidade da tabela reaproveitada
    (não quebrou em nenhum momento durante os testes de hoje)
  - [x] **Confirmado com dado real (2026-08-06)**: rodar `evaluate` 3 vezes
    no Advanced Amino Formula, uma por correção, mostrou a evolução completa
    — `22 (descartar) → 24 (descartar) → 45 (investigar)`. A correção de
    intenção (busca genérica com sinal comercial) e a de moeda (BRL vs EUR)
    juntas tiraram o produto da zona de descarte incorreto — mas o resultado
    final é **honestamente ambíguo** (`investigar`, zona cinzenta), não um
    "testar" forçado. Isso é o comportamento correto: o sistema tinha
    confiança suficiente (65) pra decidir, mas a evidência disponível dentro
    do escopo atual (sem LP, sem concorrência) genuinamente não aponta claro
    pra nenhum lado — reflete bem a realidade do produto, não esconde a
    incerteza atrás de um veredito falsamente confiante.
- Definição de pronto: ✅ atingida — testado com produto real, incluindo 2
  bugs reais achados e corrigidos no processo (intenção de keyword e moeda),
  e o resultado final é uma decisão honesta, não inflada.
- **Extensão — trava real (✅ implementada e testada com dado real, 2026-08-06,
  prioridade 1 do "próximo passo")**:
  até aqui, o Decision Engine calculava e salvava um veredito, mas nada no
  resto do sistema respeitava isso — dava pra gerar rascunho de campanha
  (Fase 6) de um produto marcado `descartar`, sem aviso nenhum. Corrigido em
  `campaignDrafts.js#createDraft()`:
  - `decision_status === 'descartar'` → **bloqueia** (HTTP 409), com a
    mensagem citando motivo/scores exatos. Não é trava dura tipo orçamento —
    aceita `overrideDecision: true` explícito no body pra seguir mesmo
    assim, porque às vezes o humano tem contexto que o sistema não tem.
  - `decision_status === 'investigar'` → **não bloqueia**, só avisa
    (`decisionWarning` na resposta) — bloquear algo que o próprio sistema já
    rotulou "ainda não sei" seria rigor demais.
  - Produto **nunca avaliado** pelo Decision Engine → não bloqueia (falha
    aberto) — não trava fluxo de quem ainda não usou essa fase.
  - Sem dependência circular: `campaignDrafts.js` importa só
    `decision-engine/repository.js` (leitura, sem `service.js`), que por sua
    vez não importa nada de `google-ads/` — checado explicitamente antes de
    fechar.
- Checklist de teste da trava:
  - [x] **Confirmado com dado real (2026-08-06)**: rascunho do Advanced Amino
    Formula (`investigar`) gerou normalmente, com `decisionWarning`
    presente citando o motivo (`zona_cinzenta`)
  - [x] Rascunho de produto marcado `descartar` bloqueou com HTTP 409,
    mensagem citando motivo/scores exatos (`oportunidade_baixa_com_confianca_alta`,
    opportunity=18, confidence=70)
  - [x] `overrideDecision: true` no mesmo produto gerou o rascunho normalmente
  - [x] **Achado real no teste**: a resposta do override vinha com
    `decisionWarning: null` — nenhum rastro de que o rascunho foi criado
    **contra** um veredito explícito de "descartar". Corrigido: override
    ignora o bloqueio, mas nunca ignora o aviso — a resposta agora sempre
    deixa registrado que uma decisão humana explícita superou o sistema, com
    o motivo original citado.
- **Extensão — badge visual (2026-08-06, prioridade 2 do "próximo passo")**:
  `discovery/repository.js#listProducts()` ganhou mais um `LEFT JOIN LATERAL`
  (mesma técnica já usada pra Economics/Compliance/LP), lendo a última
  decisão em `opportunity_scores` filtrada por `model_version = 'evidence-engine-v1'`
  — sem endpoint novo, sem N+1 chamada por produto. `ProductsPage.jsx` ganhou
  badge de decisão (🟢/🟡/🔴, reaproveitando classes de cor que já existiam —
  `worth-yes`/`medium`/`worth-no` — em vez de CSS novo) com score e motivo em
  tooltip, e botão "Avaliar oportunidade"/"Reavaliar" que chama
  `POST /decision-engine/:id/evaluate` direto da tela.
- Checklist de teste do badge:
  - [ ] Abrir a tela **Produtos**, confirmar que o produto já avaliado hoje
    (Advanced Amino Formula) mostra o badge 🟡 Investigar com o score
    (opportunity/confidence) visível
  - [ ] Clicar "Avaliar oportunidade" num produto nunca avaliado, confirmar
    que o badge aparece depois de recarregar
  - [ ] Clicar "Reavaliar" num produto já avaliado e confirmar que não
    dispara chamada nova ao Keyword Planner (mesma idempotência da Fase 12,
    só que agora acionada pela tela)
- **Correção de rótulo — comissão mínima (2026-08-06, esclarecimento do
  usuário)**: `DEFAULT_MIN_COMMISSION` (`market-intel/economics.js`) **já
  era 20** — o número nunca precisou mudar. O que estava errado era o
  **rótulo**: o comentário dizia "R$" (herdado do MVP original, nunca
  atualizado), mas os produtos reais cadastrados hoje são sempre EUR/USD,
  nunca BRL — a mensagem de rejeição sempre dizia "R$ 15,00" pra um produto
  em euro, por exemplo, o que é tecnicamente incorreto mesmo sem afetar o
  cálculo. Corrigido: `evaluateEconomics()` ganhou parâmetro `moeda` (só
  rótulo, não faz conversão nenhuma), as 2 chamadas que já tinham a moeda do
  produto disponível (`discovery/service.js`, `google-ads/service.js`) agora
  passam ela adiante. 2 testes novos garantindo que a mensagem nunca mais
  diga "R$" por engano, e que o valor 20 continua fixo. 50/50 na suíte.
- **Extensão — sinal de VSL (2026-08-07, regra externa trazida pelo usuário
  via mapa mental de qualificação de produto)**: `has_vsl` já existia na
  Auditoria de LP (Fase 3d) desde sempre, mas era só informativo — nunca
  afetava nada. A regra externa diz que página com vídeo de vendas "aumenta
  muito a fuga" numa estratégia de fundo de funil. Implementado:
  - `scoring.js#applyVslPenalty()` — função pura nova, reduz o Opportunity
    Score em 30% (`VSL_PENALTY_MULTIPLIER = 0.7`, valor inicial, marcado
    para calibrar com mais produtos reais depois) quando `has_vsl = true`.
    Aplicada **depois** do cálculo ponderado normal, não como 6º peso —
    escolha deliberada pra não mexer nos 5 pesos já calibrados e validados
    com dado real (Advanced Amino Formula).
  - `service.js#evaluateProduct()` ganhou checagem **oportunista** de
    Auditoria de LP — não dispara auditoria nova (LP continua fora do
    pipeline ativo, mesmo escopo já definido no núcleo). Só aproveita o que
    já existe: se alguém já rodou a auditoria pra esse produto em algum
    momento (fluxo manual, Fase 3d), usa esse dado real (inclusive credita
    `hasLpCamadaA`/`hasLpCamadaB` no Confidence Score, peso já reservado
    desde o desenho original) — nunca inventa.
  - 3 testes novos (`applyVslPenalty`), 53/53 na suíte completa.
  - **Confirmado com dado real (2026-08-07)**: produto id=3 sem auditoria de
    LP → `opportunity=90, testar`. Mesmo produto, depois de gravar auditoria
    manual com `has_vsl=true` → `opportunity=63 (=90×0.7, exato), testar`
    (penalidade aplicada corretamente, mas não derrubou a decisão sozinha —
    30% foi suficiente pra reduzir sem inverter o veredito nesse caso, o que
    é o comportamento esperado de uma penalidade, não de um descarte
    automático). Produto de controle (id=1, sem auditoria) permaneceu
    idêntico (`45, investigar`) — confirma que a checagem oportunista não
    afeta quem nunca rodou LP audit.
- **Registrado, mas não implementado ainda (aguardando confirmação/prioridade
  do usuário)**: distinção físico/digital com regra de qualificação própria
  (comissão mínima confirmada como igual pros dois — $20 — mas produtor
  forte/redes sociais pra digital, tráfego pago já rodando pra físico,
  seguem sem forma de checar automaticamente); "rastro na internet" como
  evidência mais barata que volume numérico (reforça a recomendação já
  registrada no relatório de riscos de escala — Google Autocomplete como
  próxima fonte, ainda não implementada); "consegue se afiliar" como
  checklist manual no cadastro (não existe hoje, nem deveria virar
  automação — aprovação de afiliação varia por rede).

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
3. ~~Single-user ou multi-user?~~ **RE-RESOLVIDO em 2026-08-05 (revisão da
   decisão anterior no mesmo dia)**: multi-user com JWT + 4 perfis
   (administrador/gerente/operador/visualizador) — decisão original ("`ADMIN_KEY`
   simples mantida") foi **revertida no mesmo dia**, no contexto do módulo de
   Governança guarda-chuva (Fase 8) e do pedido de uma tela de gestão de
   contingência estilo NOC/enterprise. Ver Fase 9 abaixo pro que foi
   implementado. `ADMIN_KEY` continua funcionando em paralelo (retrocompatível),
   não foi removida.
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
9. ~~(Novo, 2026-08-05) Orçamento máximo — Fase 6.~~ **RESOLVIDO em 2026-08-05**:
   R$ 50–100/dia (faixa escolhida) — implementado com teto de **R$ 100/dia**
   (`MAX_DAILY_BUDGET_HARD_CAP`), trava dura, não ajustável por chamada.
10. ~~(Novo, 2026-08-05) Copy do anúncio — Fase 6.~~ **RESOLVIDO em 2026-08-05**:
    IA sugere, usuário revisa antes de aprovar — implementado
    (`generateAdCopy()`, schema `adCopySuggestion`).
11. ~~(Novo, 2026-08-05) Single ou multi-conta de anúncio — Fase 7.~~
    **RESOLVIDO em 2026-08-05**: mais de uma conta, já ou em breve — base
    multi-conta implementada (`google_ads_accounts` completa, `googleAdsClient.js`
    refatorado pra aceitar conta específica, retrocompatível com o `.env` único
    de antes).

Assim que você responder as pendentes, eu fecho os detalhes de implementação da próxima fase e a
gente parte pro Cursor com escopo bem definido.
