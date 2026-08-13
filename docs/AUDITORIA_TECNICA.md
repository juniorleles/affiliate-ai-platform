# Auditoria Técnica — Plataforma de Decisão de Compra de Tráfego (Google Ads)

Data: 2026-08-06. Metodologia: leitura direta do código-fonte e das migrations
(verdade do banco), não da memória da conversa — a sessão de hoje construiu
muita coisa, e uma auditoria que "lembra errado" não serve pra nada.

**Reformulação de objetivo, registrada aqui**: o projeto nasceu com um foco em
Economics/Compliance/Auditoria de LP (decisão de risco), e cresceu hoje pra
incluir Governança de contas e criação assistida de campanha. O documento
"ideal" trazido agora pede um foco mais forte em **pesquisa e classificação de
mercado** (Trends, Autocomplete, PAA, taxonomia de funil rica). São focos
complementares, não conflitantes — mas a auditoria abaixo é honesta sobre qual
lado está mais maduro.

---

## 1. Cadastro de Produto

**Pedido**: Nome, Landing Page, URL da VSL, Categoria.

| Campo | Status |
|---|---|
| Nome | Existe |
| Landing Page (`sales_page_url`) | Existe |
| Categoria | Existe |
| URL da VSL | Não existe como campo — só `has_vsl` (boolean, "a página tem VSL?") na auditoria manual (5.4 Nível 1). Nunca se guarda a URL do vídeo em si. |

- **Arquivos**: `apps/api/src/modules/discovery/service.js` (`addManualProduct`), migration `005_discovery.sql`, `010_compliance_lp_audit.sql`.
- **Componentes**: `apps/web/src/features/discovery/{ProductsPage,QuickAddModal,BulkAddModal}.jsx`.
- **Banco**: `products`, `landing_page_audits`.
- **Dificuldade pra fechar o que falta**: Baixa — 1 coluna nova (`vsl_url`) + 1 campo no formulário.

**Veredito**: Parcial (85% — falta só 1 campo).

---

## 2. Descoberta Automática (extrair marca, fabricante, benefícios, ingredientes, público)

**Pedido**: a partir da LP, extrair automaticamente esses atributos.

- **O que existe**: campo `description` livre (texto que você digita, usado como contexto pra IA de Compliance) — mas ninguém extrai nada automaticamente. `discovery/lpTextFetch.js` já busca o texto real da página (usado no Auditor de LP), mas o resultado só alimenta análise de copy/oferta, nunca uma extração estruturada de marca/fabricante/ingrediente/público.
- **O que pode ser reaproveitado**: a infraestrutura de fetch (`lpTextFetch.js`) e o padrão de schema JSON validado (`ai-provider/schemas/`) já existem prontos — isso reduz bastante o esforço de implementar, porque a parte "difícil" (buscar e limpar o HTML) já está feita.
- **Arquivos que precisariam mudar**: novo schema `productAttributeExtraction.schema.json`, nova função em `ai-advisor/service.js`, coluna(s) novas em `products` (ou tabela separada `product_attributes`).
- **Dificuldade**: Média — não é complexo tecnicamente, mas schema novo + validação + integração no fluxo de cadastro.

**Veredito**: Não existe (a infraestrutura de apoio existe, a funcionalidade em si não).

---

## 3. Pesquisa de Mercado (Keyword Planner, Trends, Autocomplete, Related Searches, PAA)

| Fonte | Status |
|---|---|
| Google Ads Keyword Planner | Existe — `google-ads/keywordResearch.js`, testado com dado real (Fase 2b) |
| Google Trends | Não existe — nenhuma integração |
| Google Autocomplete | Não existe |
| Related Searches | Não existe |
| People Also Ask | Não existe |

- **Arquivos (o que existe)**: `google-ads/keywordResearch.js`, `google-ads/service.js#researchKeywordsForProduct()`, tabela `keyword_metrics`.
- **APIs (o que falta)**: Trends não tem API pública oficial simples (o `pytrends`/scraping não-oficial é a via mais comum — risco de ToS, mesma categoria de problema que já rejeitamos hoje com ClickBank); Autocomplete e Related Searches têm endpoints não-documentados do Google (`suggestqueries.google.com`) — funcionam na prática, mas não são API oficial suportada; PAA não tem API oficial nenhuma (só scraping de SERP, que viola ToS do Google Search).
- **Dificuldade**: Autocomplete — Baixa (endpoint simples, mas não-oficial); Trends — Média/Alta (sem API oficial limpa); PAA/Related Searches — Alta (praticamente exige scraping, contra o princípio do projeto).

**Veredito**: Parcial (25% — só 1 de 4 fontes, e é a mais robusta das quatro).

---

## 4. Pesquisa Comercial (buy, price, discount, coupon, official website, review, complaints, ingredients, does it work, side effects, before after, best, vs, alternative)

- **O que existe**: `google-ads/service.js#COMMERCIAL_INTENT_MODIFIERS` — 5 modificadores implementados: `buy`, `price`, `discount`, `coupon`, `where to buy`.
- **O que falta**: `official website`, `review` (parcialmente coberto — "reviews" está na lista de sinais do `keywordIntent.js`, mas não como seed de pesquisa), `complaints`, `ingredients`, `does it work`, `side effects`, `before after`, `best`, `vs`, `alternative` — 8 a 9 modificadores ausentes de ~14 pedidos.
- **Arquivos**: `google-ads/service.js` (a lista de modificadores é um array simples).
- **Dificuldade**: Baixa — é literalmente adicionar strings no array. Testar se cada um retorna resultado com bid (achado de hoje: keyword muito específica às vezes não tem bid) é o único trabalho real.

**Veredito**: Parcial (35% dos modificadores, mas a mecânica toda já existe e funciona — é a peça mais barata de completar de toda a auditoria).

---

## 5. Classificação das Palavras (Topo, Meio, Fundo, Compra, Marca, Comparação, Problema)

- **O que existe**: `google-ads/keywordIntent.js#classifyKeywordIntent()` — classificação binária: `bottom` (achou sinal de compra) ou `unclear` (não achou).
- **O que falta**: taxonomia de 6-7 categorias distintas (o pedido tem: topo, meio, fundo, compra, marca, comparação, problema — mais granular que "bottom vs resto"). Também falta: essa classificação não alimenta o Opportunity Score hoje — só é usada pra ordenar keyword na hora de montar rascunho de campanha (Fase 6).
- **Arquivos**: `google-ads/keywordIntent.js`, 9 testes unitários já existentes cobrindo o caso binário.
- **Dificuldade**: Média — expandir a lista de sinais por categoria é barato, mas desenhar critério de desambiguação entre categorias (uma keyword pode ter sinal de "comparação" E "compra" ao mesmo tempo — "best supplement vs xtend") exige mais cuidado que o binário atual.

**Veredito**: Parcial (uma categoria das 6-7 pedidas, e isolada — não conectada ao score).

---

## 6. Tendência (Crescimento, Sazonalidade, Interesse por Região)

- **O que existe**: colunas `trend_score` e `seasonality_score` na tabela `opportunity_scores` — sempre `NULL`, documentado explicitamente no código (`scoring.js`): "trend_score e seasonality_score não são calculados aqui — não temos fonte de dado de tendência integrada ainda".
- **Interesse por região**: não existe em lugar nenhum, nem como campo, nem como conceito.
- **Arquivos**: `market-intel/scoring.js` (schema pronto, cálculo ausente).
- **Dificuldade**: Alta — depende da mesma limitação do item 3 (sem API de Trends oficial e limpa). Sem essa fonte de dado, `trend_score` fica sempre `null` por design, não por bug.

**Veredito**: Não existe (schema esperando, dado nunca chega).

---

## 7. Concorrência (Número de anunciantes, Qualidade das LPs, Presença de afiliados, Grandes marcas)

- **O que existe**: Fase 4 — cadastro manual de anúncio de concorrente via Google Ads Transparency Center, com histórico de mudança (snapshot). Testado com dado real (Vital Proteins/Nestlé).
- **O que falta**: nenhuma contagem/score agregado — é uma lista de anúncios, não uma métrica ("quantos anunciantes competem por esse produto?"). "Qualidade das LPs" dos concorrentes não é avaliada (só a sua própria, via Auditor de LP). "Presença de afiliados vs. grandes marcas" não é classificado — não dá pra saber, olhando o cadastro, se um concorrente é um afiliado como você ou o próprio fabricante anunciando direto.
- O `competition_score` que já existe no Opportunity Score vem do Keyword Planner (índice de competição de leilão), não da Fase 4 — são duas fontes de "concorrência" diferentes, nunca cruzadas.
- **Arquivos**: `competitive-intel/{repository,service,routes}.js`, tabelas `competitors`/`competitor_ads`/`competitor_ad_snapshots`.
- **Dificuldade**: Média — contar registros já cadastrados é trivial; classificar "é afiliado ou é a marca?" de forma confiável provavelmente precisa de mais um schema de IA (dado o texto do anúncio + domínio).

**Veredito**: Parcial (coleta funciona e é testada; análise/score sobre o que foi coletado não existe).

---

## 8. Score do Produto (Demanda, Intenção, Concorrência, CPC, Comissão, ROI esperado, Opportunity Score)

| Dimensão pedida | Status no `opportunity_scores`/Economics |
|---|---|
| Demanda | Existe — `demand_score`, calculado a partir do volume de busca (Keyword Planner) |
| Concorrência | Existe — `competition_score`, calculado a partir do índice de competição (Keyword Planner) |
| Intenção | Não existe — `keywordIntent.js` existe mas não entra no score |
| CPC | Parcial — existe em `product_economics.cpc_maximo_calculado`, mas não é um sub-score do Opportunity Score — é uma tabela separada, cruzada só narrativamente |
| Comissão | Parcial — idem, `product_economics.comissao_usada`, fora do score |
| ROI esperado | Parcial — idem, `product_economics.roi_estimado_pct`, fora do score |
| Opportunity Score (geral) | Existe — `scoring.js#computeOverallScore()`, testado (6 testes unitários) |

- **Arquivos**: `market-intel/scoring.js` (função pura, testada), `market-intel/repository.js`, `market-intel/service.js#scoreProduct()`.
- **Dificuldade pra fechar**: Média — os dados de CPC/Comissão/ROI/Intenção já existem no banco, só não estão sendo lidos e ponderados dentro do cálculo do score. É trabalho de integração, não de criar dado novo.

**Veredito**: Parcial (score geral funciona e é confiável pro que calcula; 3 das 7 dimensões pedidas existem em outra tabela mas não entram na conta).

---

## 9. Recomendação (Anunciar, Testar, Descartar)

- **O que existe**: `productOpportunity.schema.json#worth_advertising` — booleano (`true`/`false`), validado com dado real (contrato "usa o CPC calculado, não reestima" confirmado).
- **O que falta**: o estado intermediário "Testar" — hoje a IA só pode dizer sim ou não, não "talvez, com orçamento pequeno". Isso é uma mudança de schema (enum de 3 valores em vez de boolean) + ajuste de prompt.
- **Arquivos**: `ai-advisor/service.js#evaluateProductOpportunity()`, schema `productOpportunity.schema.json`.
- **Dificuldade**: Baixa — mudança de schema pequena, prompt já tem toda a lógica de reasoning que só precisa de mais uma opção de saída.

**Veredito**: Parcial (2 de 3 estados).

---

## 10. Dashboard (Resumo executivo, Motivos da decisão, Pontos fortes, Pontos fracos, Recomendações)

- **O que existe**: `MarketIntelDetail.jsx` mostra o score + as 8 respostas da IA — `reasoning` (motivo, existe), `main_risks` (pontos fracos, existe), `roi_improvement_suggestions` (recomendações, existe).
- **O que falta**: pontos fortes não existe como campo — só riscos, nunca "o que já está bom nesse produto". Não existe uma síntese executiva (um parágrafo curto tipo "veredito em 3 linhas") — a tela mostra dado bruto estruturado, não uma leitura corrida pronta pra decisão rápida.
- **Arquivos**: `apps/web/src/features/market-intel/{MarketIntelPage,MarketIntelDetail}.jsx`.
- **Dificuldade**: Baixa — é essencialmente 2 campos novos no schema (`strengths`, `executive_summary`) + ajuste de UI pra exibir.

**Veredito**: Parcial (dado existe, síntese executiva não).

---

## O que existe e NÃO estava no documento "ideal" — vale registrar

O projeto de hoje é mais forte em disciplina de decisão financeira e risco do que o documento ideal pede, e isso é o núcleo da missão ("plataforma de decisão de compra de tráfego"), não um extra:

- Economics (5.1): trava de comissão mínima, CPC máximo calculado, ROI estimado — testado, com bug de moeda real encontrado e corrigido.
- Compliance (5.3): classificação de sensibilidade de nicho por IA, testada com 3 produtos reais.
- Auditoria de LP avançada (Camada A + B): texto + visão, validada duas vezes com dado real.
- Fase 6 (rascunho de campanha): fecha o loop até "pronto pra colar no Google Ads", com correção de fundo de funil já testada.
- Fase 7 Parte A (revisão preventiva de anúncio): testada, diferencia risco low/high com achado específico.
- Fase 8 (Governança multi-conta): descoberta real de hierarquia MCC via API oficial, testada com conta real.
- Fase 9/10 (Auth + Painel NOC): JWT + perfis, árvore/heatmap de saúde de conta.

Nenhuma dessas 7 peças está no documento "ideal" que você trouxe agora — mas todas são centrais pra "decisão de compra de tráfego" de verdade, não só pesquisa de mercado.

---

## Matriz consolidada

| # | Funcionalidade | Status | Impacto | Esforço (1-5) | Dependências |
|---|---|---|---|---|---|
| 1 | Cadastro de Produto (campos básicos) | Existe | Alto | — | — |
| 1b | Campo URL da VSL | Não existe | Baixo | 1 | Nenhuma |
| 2 | Descoberta automática (marca/fabricante/ingrediente/público) | Não existe | Médio | 3 | lpTextFetch.js (já existe) |
| 3a | Keyword Planner | Existe | Alto | — | — |
| 3b | Google Trends | Não existe | Médio | 4 | Decisão de fonte (sem API oficial limpa) |
| 3c | Autocomplete | Não existe | Baixo | 2 | Endpoint não-oficial, avaliar risco |
| 3d | Related Searches / PAA | Não existe | Baixo | 5 | Praticamente exige scraping — contra o princípio do projeto |
| 4 | Pesquisa comercial (ampliar modificadores) | Parcial | Médio | 1 | Nenhuma — só adicionar strings |
| 5 | Classificação de funil (taxonomia rica) | Parcial | Médio | 3 | Nenhuma |
| 5b | Conectar classificação de funil ao Opportunity Score | Não existe | Alto | 2 | keywordIntent.js (já existe) |
| 6 | Tendência (crescimento/sazonalidade/região) | Não existe | Médio | 4 | Mesma limitação do item 3b |
| 7a | Coleta de concorrência | Existe | Médio | — | — |
| 7b | Score/contagem de concorrência | Não existe | Médio | 2 | Dado da Fase 4 (já existe) |
| 8a | Opportunity Score (geral) | Existe | Alto | — | — |
| 8b | Integrar CPC/Comissão/ROI/Intenção ao score | Parcial | Alto | 2 | product_economics + keywordIntent.js (ambos já existem) |
| 9 | Recomendação de 3 estados (Anunciar/Testar/Descartar) | Parcial | Alto | 1 | Nenhuma |
| 10 | Dashboard executivo (pontos fortes + síntese) | Parcial | Alto | 2 | Nenhuma |
| — | Economics, Compliance, Auditoria de LP, Fase 6/7/8/9/10 | Existe | Alto | — | — |

---

## Respostas obrigatórias

### 1. Quanto do projeto já está pronto?

Depende de contra o quê você mede — dando os dois números pra não mentir por omissão:

- Contra o documento "ideal" que você trouxe agora (os 10 módulos de pesquisa de mercado): ~38%. Forte em cadastro (item 1) e pesquisa de keyword pura (item 3a); fraco ou ausente em Trends/Autocomplete/PAA (item 3), tendência (item 6), e nas dimensões que cruzam score com dado que já existe em outra tabela (item 8).
- Contra a missão declarada ("plataforma de decisão de compra de tráfego"): ~65-70%. O que decide "vale a pena gastar dinheiro nisso" (Economics, Compliance, Auditoria de LP, Score, Rascunho de campanha) está construído e testado com dado real. O que falta é majoritariamente largura de pesquisa de mercado (mais fontes de dado), não a espinha dorsal de decisão.

### 2. As 10 funcionalidades mais importantes que faltam (ordenadas por impacto real na missão)

1. Conectar CPC/Comissão/ROI/Intenção ao Opportunity Score — o dado já existe, só não é usado. Maior retorno pelo menor esforço de toda a lista.
2. Recomendação de 3 estados (Anunciar/Testar/Descartar) — mudança pequena, aumenta muito a utilidade da decisão final.
3. Dashboard executivo (pontos fortes + síntese) — sem isso, "decisão" ainda exige você ler todo o reasoning bruto.
4. Score/contagem estruturada de concorrência — hoje é lista, precisa virar métrica.
5. Ampliar pesquisa comercial (mais modificadores) — barato, aumenta a base de keyword de fundo de funil.
6. Taxonomia rica de classificação de funil — melhora a base pro item 1.
7. Descoberta automática de atributos do produto (marca/ingrediente/público) — reduz trabalho manual de cadastro.
8. Google Autocomplete — única fonte de pesquisa de mercado nova com risco baixo de ToS.
9. Decisão consciente sobre Trends (usar API paga, ou aceitar que fica de fora) — hoje é uma lacuna silenciosa (null sem explicação clara pro usuário final).
10. VSL URL como campo do produto — pequeno, mas fecha o módulo 1 por completo.

### 3. Menor caminho pro MVP (dado o que a missão realmente precisa)

Não é construir os 10 módulos do documento ideal — é fechar o que já existe primeiro (itens 1, 2, 3 da lista acima), porque isso é dado que já está no banco, só não conectado. Isso é literalmente dias, não semanas, e aumenta a qualidade da decisão sem precisar de nenhuma API nova. Só depois disso eu investiria em fonte de dado nova (Autocomplete, mais modificadores de pesquisa comercial).

### 4. Em quantas fases eu dividiria isso

4 fases, nessa ordem, cada uma só começando depois da anterior validada com dado real (mesmo padrão do projeto até aqui):

- Fase A — Integração do que já existe: score completo (CPC/Comissão/ROI/Intenção), recomendação de 3 estados, dashboard executivo. Zero API nova.
- Fase B — Ampliação barata: mais modificadores de pesquisa comercial, taxonomia rica de funil, VSL URL, score de concorrência. Zero API nova, só mais lógica sobre dado já coletável.
- Fase C — Descoberta automática de atributos: extração de marca/fabricante/ingrediente/público via IA sobre o texto da LP (reaproveita lpTextFetch.js).
- Fase D — Fontes de mercado novas (a mais incerta, decisão primeiro): Autocomplete (baixo risco), e uma decisão explícita sobre Trends/PAA/Related Searches — usar API paga, aceitar a lacuna, ou não fazer.

### 5. Existe algo na arquitetura atual que vai impedir esse crescimento?

Não estruturalmente — mas 2 pontos merecem atenção antes de crescer mais:

- `opportunity_scores` e `product_economics` são tabelas separadas, nunca unidas numa única "visão de decisão". Isso não é um erro de design (faz sentido cada motor ter sua tabela), mas significa que "juntar tudo num score só" (pedido #8) vai exigir uma camada de agregação nova — hoje não existe um lugar único que leia as duas tabelas e produza 1 número. Não é bloqueio, é trabalho não feito ainda.
- Nenhuma fonte de pesquisa de mercado nova tem caminho oficial limpo (Trends, PAA, Related Searches) — isso não é limitação do código, é limitação real do que o Google expõe sem violar termos de uso. Qualquer crescimento nessa direção esbarra na mesma parede que já bateu hoje com ClickBank e Custom Search — é decisão de produto (aceitar a lacuna, ou pagar por API de terceiro), não algo que refatoração resolve.

Fora esses 2 pontos, a arquitetura modular (schemas de IA validados, função pura pra tudo calculável, tabela própria por módulo) suporta bem o crescimento pedido — a maior parte do trabalho é integração de dado que já existe, não reconstrução.
