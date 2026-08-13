# Relatório de Riscos Arquiteturais — Escala de 5.000 produtos/dia

Visão de CTO, não de desenvolvedor. Objetivo: apontar onde o sistema quebra
antes de quebrar, não depois. Todos os achados abaixo foram confirmados
lendo o código real (não suposição) — cada um cita o arquivo/config exata.

**Contexto importante pra calibrar a leitura**: o sistema foi construído hoje
pra um volume de dezenas de produtos, com cadastro manual e decisão
supervisionada por 1 pessoa. 5.000/dia não é "mais volume do mesmo uso" — é
uma mudança de categoria de produto (de "assistente pessoal" pra "pipeline de
produção"). Boa parte do que está abaixo não são bugs — são decisões corretas
pro contexto de hoje que se tornam risco no contexto de 5.000/dia.

---

## 1. Performance

**Risco mais grave**: cada análise de produto (Compliance + Auditoria de LP
Camada A + Camada B + Market Intelligence) roda de forma síncrona, dentro do
ciclo de request/response HTTP — não existe fila entre a chamada da API e a
resposta pro usuário. Uma chamada de IA leva de 3 a 15 segundos (visto hoje em
teste real). Com 5.000 produtos, se alguém tentar rodar isso em sequência via
requisição HTTP, são horas de conexão HTTP aberta, não segundos — e qualquer
timeout de proxy/load balancer no caminho (padrão de 30-60s em muita infra)
mata a requisição no meio.

**Segundo risco**: `GET /api/products` (listagem principal) não tem paginação
nenhuma — `discovery/repository.js#listProducts()` sempre retorna todas as
linhas, com 4 `LEFT JOIN LATERAL` por linha (economics, compliance, LP audit).
Com dezenas de produtos isso é instantâneo; com 5.000, é uma consulta pesada
toda vez que alguém abre a tela de Produtos, e o payload JSON de resposta fica
grande o suficiente pra ser perceptível carregar e renderizar no navegador (a
tela hoje também renderiza a lista inteira de uma vez, sem virtualização).

---

## 2. Banco de Dados

**Pool de conexão sem limite configurado**: `shared/db/pool.js` cria o `Pool`
do `pg` sem especificar `max` — isso cai no padrão da biblioteca (10 conexões
simultâneas). Com processamento paralelo de milhares de produtos, esse teto
vai ser atingido rápido, e requisições começam a esperar em fila silenciosa
por conexão livre, sem log nem alerta indicando que esse é o gargalo — parece
lentidão genérica, mas é esgotamento de pool.

**Índices calibrados pro volume de hoje, não validados pro de amanhã**: as
tabelas críticas (`keyword_metrics`, `ai_analyses`, `opportunity_scores`) têm
índice por `product_id` + data, o que é correto — mas nunca foram testadas com
volume de milhares de linhas por produto (`keyword_metrics` sozinha, com
pesquisa de intenção comercial rodando pra 5.000 produtos × ~6 seeds × ~20
ideias, é possivelmente 600 mil linhas novas por dia). Índice que funciona bem
com centenas de linhas pode se comportar de forma bem diferente nessa ordem de
grandeza — isso não foi medido.

**Nenhuma estratégia de arquivamento/retenção**: `ai_analyses`,
`keyword_metrics`, `competitor_ad_snapshots` só crescem, nunca há expiração ou
compactação de histórico antigo. Em escala pessoal isso não importa; em
5.000/dia, o banco cresce rápido o bastante pra virar custo de storage
relevante e, eventualmente, degradar consulta mesmo com índice.

---

## 3. APIs Externas

Esta é a seção com os riscos mais concretos e já confirmados hoje, não
hipotéticos:

- **Google Ads Keyword Planner — risco de estourar cota, com número real**: o
  Acesso Básico do developer token tem limite de 15 mil operações/dia
  (confirmado na Fase 2b). A pesquisa de intenção comercial sozinha faz 5
  chamadas por produto (um seed por modificador: buy/price/discount/coupon/
  where-to-buy). Só isso, pra 5.000 produtos, são 25.000 chamadas — quase o
  dobro do limite diário, antes de contar a pesquisa de keyword genérica
  original (mais 1 chamada/produto) ou qualquer sync de campanha.
- **PageSpeed Insights — já vimos isso quebrar hoje com volume baixíssimo**: a
  cota anônima esgotou durante o teste de 1 produto só. Em 5.000/dia, mesmo
  com chave própria (cota mais alta, mas ainda finita e não documentada com
  precisão pelo Google pra uso em massa), é praticamente certo que estoura sem
  um controle de taxa dedicado.
- **ScreenshotOne — o plano atual é "100 capturas grátis/mês"**: a Camada B
  faz 2 capturas por produto (desktop + mobile). 5.000 produtos/dia = 10.000
  capturas/dia só nessa etapa — ordens de magnitude acima de qualquer plano
  que não seja enterprise, com custo real não orçado hoje.
- **Anthropic (Claude)**: cada produto passa por até 5 chamadas de IA
  (Compliance, LP Camada A, LP Camada B, Market Intelligence, e potencialmente
  Ad Copy/Policy se envolver campanha). 5.000 × 5 = 25.000 chamadas/dia. Isso
  é gerenciável em tokens-por-minuto se distribuído ao longo do dia com
  controle de taxa, mas o sistema hoje não tem nenhum limitador de taxa
  próprio — se alguém disparar processamento em lote sem throttling, o
  primeiro sintoma vai ser erro 429 da própria Anthropic, não um aviso nosso.

---

## 4. Filas (BullMQ)

**O achado mais importante desta seção**: o sistema já previu esse problema —
`shared/queue/queues.js` declara `discoverySyncQueue`, `marketIntelScoreQueue`
e `competitiveIntelScanQueue`, nomeadas exatamente pras operações pesadas de
Discovery/Market Intelligence/Competitive Intelligence. Nenhuma delas nunca
recebeu um job, e nenhum worker correspondente foi criado. Só as 3 filas
originais (sync de campanha, análise de campanha, monitoramento) são
realmente usadas — tudo que foi construído depois (Compliance, Auditoria de
LP, Market Intel scoring, Cadastro de campanha) roda fora da fila, direto no
handler HTTP.

Isso significa que em 5.000/dia, o sistema não tem nenhum mecanismo de retry,
backoff, ou controle de concorrência pra exatamente as operações que mais
precisam disso (as que chamam IA e APIs externas com cota limitada). O retry
de 3 tentativas com backoff exponencial que já existe (config em
`queues.js`) simplesmente nunca é acionado pra esse fluxo.

---

## 5. Escalabilidade

**Processo único, sem horizontalização**: a API roda como 1 processo Node
único (sem cluster mode, sem múltiplas réplicas atrás de um load balancer). O
cliente do Google Ads (`googleAdsClient.js#getClient()`) é um singleton em
memória do processo — reaproveitado entre chamadas, o que é bom pra
performance em 1 processo, mas significa que rodar múltiplas instâncias da
API (necessário pra escalar horizontalmente) precisaria de revisão de como
esse estado compartilhado se comporta.

**Banco e Redis como instância única**: `docker-compose.yml` sobe Postgres e
Redis como 1 container cada, sem réplica de leitura, sem cluster. Isso é
adequado pra ambiente de desenvolvimento/uso pessoal — em 5.000/dia com
processamento paralelo real, é um ponto único de falha e de gargalo de
leitura/escrita simultânea.

**n8n citado na arquitetura, nunca configurado de fato**: a pasta
`workflows/` está vazia — o orquestrador que a documentação descreve como
responsável por "quando" rodar cada pipeline nunca foi realmente montado.
Hoje quem dispara cada análise é sempre uma ação manual (clique na tela ou
chamada de API), o que não escala pra 5.000 produtos processados sem
intervenção humana constante.

---

## 6. Custos

**Nenhum teto de gasto existe em nenhuma camada do sistema.** Isso já foi
identificado e registrado como decisão consciente pro volume de hoje (a
análise diária automática de campanha está desligada até medir custo real) —
mas em 5.000/dia, a ausência de teto deixa de ser "aceitável por enquanto" e
vira risco financeiro direto: uma falha de lógica (loop, reprocessamento
acidental, retry mal configurado) pode gerar uma fatura de IA/APIs de terceiro
sem nenhum limite automático que interrompa.

**Custo por produto nunca foi calculado formalmente.** Com base no volume de
chamada por produto (5 chamadas de IA + 6 chamadas de Keyword Planner + 1
PageSpeed + 2 ScreenshotOne), multiplicar por 5.000 sem ter o custo unitário
real documentado é decidir no escuro — esse número deveria existir antes de
qualquer decisão de escala, não depois.

---

## 7. Cache

**Não existe camada de cache em lugar nenhum do sistema.** O Redis já está
rodando (usado exclusivamente pra fila), mas nunca é usado como cache. Isso
significa: pesquisar a mesma palavra-chave duas vezes custa 2 chamadas cheias
ao Keyword Planner; reanalisar o mesmo produto sem mudança nenhuma custa uma
chamada de IA inteira nova, do zero, sem checar se o resultado anterior ainda
é válido. Em volume pessoal isso não se nota. Em 5.000/dia, é dinheiro e cota
jogados fora em toda repetição evitável.

---

## 8. Paralelismo

**Chamadas sequenciais onde poderiam ser paralelas, sem necessidade**: a
pesquisa de intenção comercial (`researchCommercialIntentKeywords`) roda os 5
modificadores um de cada vez, num loop `for`, não em paralelo — cada produto
espera 5 chamadas de rede em sequência antes de terminar. Isso não é crítico
em uso individual, mas multiplicado por milhares de produtos é tempo de
parede desperdiçado que paralelismo controlado resolveria.

**Ao mesmo tempo, nenhum limite de paralelismo existe pra proteger contra o
oposto**: se alguém tentar processar muitos produtos "ao mesmo tempo"
(looping chamadas de API em paralelo sem throttling), não existe nenhum
semáforo/limitador no código que impeça isso de disparar centenas de chamadas
simultâneas pra Anthropic/Google Ads/PageSpeed/ScreenshotOne de uma vez. O
sistema está desprotegido nos dois extremos: lento demais quando processa 1
produto por vez em sequência interna, e sem proteção nenhuma se tentarem
paralelizar sem controle.

---

## 9. Rate Limits

**Zero rate limiting implementado, apesar de estar documentado desde o
início.** A seção 8 do documento de arquitetura promete, desde a primeira
versão: "Rate limiting e backoff exponencial em toda chamada a API externa".
Isso nunca foi implementado nos wrappers reais (`googleAdsClient.js`,
`pagespeed.js`, `screenshot.js`, `ai-provider/index.js`) — o único retry que
existe é o da camada de IA, e é especificamente pra resposta em formato
errado, não pra erro de limite de taxa (HTTP 429) ou falha transitória de
rede. Uma sequência de chamadas que bate num limite de taxa de qualquer uma
das 4 APIs externas hoje simplesmente falha e propaga o erro pro usuário, sem
esperar e tentar de novo.

---

## 10. Arquitetura

**O monólito modular foi a decisão certa pro estágio de hoje — mas o "módulo"
nem sempre bate com a "unidade de escala".** Discovery, Market Intelligence e
Google Ads estão desenhados como módulos separados no código, mas rodam todos
no mesmo processo, competindo pelo mesmo pool de conexão de banco e pelos
mesmos limites de taxa de API externa. Em 5.000/dia, "análise de mercado
pesada" e "leitura simples de listagem de produto" concorrem pelos mesmos
recursos — não há isolamento entre carga de trabalho pesada (IA, screenshot)
e carga de trabalho leve (listar, editar campo).

**Nenhum circuito de segurança entre módulos**: se a API do Google Ads
começar a falhar (cota estourada, por exemplo), não existe um "disjuntor"
(circuit breaker) que pare de tentar temporariamente e proteja o resto do
sistema — cada chamada nova vai continuar tentando e falhando, uma por uma,
sem sinalização centralizada de "essa integração está fora do ar agora".

---

## Síntese — os 3 riscos que eu resolveria antes de qualquer outro, se fosse CTO

Não é a lista mais longa, é a mais decisiva:

1. **Cota do Keyword Planner (15 mil operações/dia) já estoura
   matematicamente com 5.000 produtos, antes mesmo de qualquer outro gargalo
   aparecer.** Isso não é "vai dar problema eventualmente" — é aritmética
   simples que já não fecha hoje, com o desenho atual de 5-6 chamadas por
   produto.
2. **As filas que já existem por nome (discoverySyncQueue,
   marketIntelScoreQueue, competitiveIntelScanQueue) nunca foram conectadas
   ao código que realmente roda.** Isso é a diferença entre "o sistema tem
   proteção de retry/backoff/controle de concorrência" e "não tem nenhuma"
   pra exatamente as operações mais caras e mais sujeitas a falha externa.
3. **Nenhum teto de custo existe em lugar nenhum.** Antes de processar 5.000
   produtos por dia de qualquer jeito, o primeiro número que deveria existir
   é "quanto custa processar 1 produto", multiplicado, com um limite
   automático que impeça um erro de lógica virar uma fatura de 4 dígitos da
   noite pro dia.
