# Parecer Arquitetural — Inversão de Fluxo: Decision Engine Primeiro

**Fluxo atual (como o código realmente se comporta hoje)**: não é exatamente
"Produto → Keyword Research → Score → Google Ads" de forma rígida — Economics
e Compliance já rodam automaticamente no cadastro, antes de qualquer coisa.
Mas na prática de uso (todo teste real de hoje seguiu essa ordem), Keyword
Research é o primeiro passo manual depois do cadastro, e o Score de Mercado
depende dele pra ter demand_score/competition_score preenchidos — então a
caracterização está certa em espírito, mesmo não sendo 100% literal no código.

**Fluxo proposto**: Produto → Decision Engine → Anunciar ou Não → Pesquisa de
Mercado → Keywords → Campanha.

**Avaliação geral, antes de entrar nas 7 perguntas**: essa inversão é uma boa
ideia, e não por acaso — ela ataca diretamente o risco #1 do relatório de
ontem (cota do Keyword Planner estourando matematicamente em escala). Um
portão barato antes das etapas caras significa que produto reprovado nunca
gasta cota de Keyword Planner, PageSpeed nem ScreenshotOne. Isso não era o
objetivo declarado da sua pergunta, mas é um efeito colateral real e positivo
que vale registrar.

---

## 1. Módulos que podem ser reaproveitados sem alteração

- **Economics** (`market-intel/economics.js`) — já é uma função pura, sem
  chamada de API, já roda automaticamente no cadastro. É exatamente o tipo de
  sinal barato que um Decision Engine deveria consumir primeiro. Zero mudança.
- **Compliance** (`discovery/compliance.js` + `ai-advisor#classifyProductCompliance`)
  — já roda no cadastro, 1 chamada de IA só (sem API de cota limitada por
  trás). Reaproveitável como está.
- **Mecânica de Keyword Research** (`keywordResearch.js`,
  `researchCommercialIntentKeywords`) — a lógica de chamar a API não muda
  nada; só muda quando ela é chamada no fluxo. Função em si, intacta.
- **Geração de rascunho de campanha e classificação de funil**
  (`campaignDrafts.js`, `keywordIntent.js`) — lógica interna não muda, só
  passa a ser acionada mais tarde no funil, depois de 2 aprovações em vez de 1.
- **Toda a infraestrutura de IA** (`ai-provider/index.js`, padrão de schema
  validado) — o Decision Engine, seja determinístico ou com IA, encaixa nesse
  mesmo padrão sem exigir nada novo na camada.
- **Governança, Monitoramento, Competitive Intelligence, Autenticação** —
  ortogonais a essa mudança, não tocam no fluxo produto→decisão→campanha.

---

## 2. Módulos que precisariam só de adaptação

- **`discovery/service.js#addManualProduct()`** — hoje já dispara Economics +
  Compliance no cadastro. Precisaria também invocar o Decision Engine logo em
  seguida (ou incorporar a lógica do gate aqui mesmo) — mudança de poucas
  linhas, não de desenho.
- **`market-intel/service.js#scoreProduct()`** — deixa de ser "o primeiro
  veredito real" pra virar "o veredito refinado, só depois de aprovado". A
  lógica de cálculo em si muda pouco; o que muda é o momento em que é
  chamado, e possivelmente passa a receber o resultado do Decision Engine
  como contexto extra em vez de decidir do zero.
- **`ai-advisor/service.js#evaluateProductOpportunity()`** — hoje essa função
  já produz um `worth_advertising`, que na prática é uma decisão parecida com
  o que o Decision Engine faria — só que tarde (depois de keyword research já
  ter rodado, com CPC real). No novo desenho, isso continuaria existindo como
  refinamento posterior (mais caro, mais preciso, usa dado real de leilão),
  não como a primeira decisão.
- **`google-ads/campaignDrafts.js#createDraft()`** — hoje não tem trava
  nenhuma: dá pra gerar rascunho de qualquer produto, mesmo um já
  `rejeitado_por_economics`. Precisaria de 1 checagem no início: "esse
  produto passou pelo Decision Engine e pelas etapas seguintes?" — pouca
  mudança de código, mudança real de comportamento.
- **Frontend (`ProductsPage`, `MarketIntelPage`)** — telas assumem hoje que
  cada ação (analisar, auditar, gerar rascunho) está sempre disponível, como
  botões soltos. Precisariam refletir estágio de funil (badge visual: "Em
  triagem" → "Aprovado, buscando mercado" → "Pontuado" → "Pronto pra
  campanha" → "Descartado").

---

## 3. Módulos que deixariam de ser centrais

- **Keyword Research (Fase 2b)** — hoje é praticamente a primeira etapa real
  depois do cadastro. No novo fluxo, vira uma etapa que só roda depois do
  gate aprovar — sua posição no funil muda de "quase sempre cedo" pra "só se
  já passou de fase".
- **Auditoria de LP (Camada A e B)** — hoje pode rodar a qualquer momento,
  desconectada do resto. Faz sentido, no novo desenho, também virar pós-gate
  — não vale gastar screenshot/PageSpeed num produto que Economics sozinho já
  reprovaria.
- **Competitive Intelligence** — já era periférico (cadastro manual, sem
  conexão automática com o score); continua periférico, isso não muda com a
  inversão.

---

## 4. Novos módulos necessários

- **O Decision Engine em si** — não existe hoje como entidade separada.
  Precisa de 2 decisões de desenho antes de qualquer implementação:
  - **Determinístico ou com IA?** Minha recomendação: começar
    determinístico, sem IA nenhuma — regras simples sobre o que já existe
    (`economics.status === 'rejeitado_por_comissao_minima'` → não investiga;
    `compliance.niche_sensitivity === 'black'` → não investiga; resto →
    investiga). Isso é radicalmente mais barato (zero chamada de IA, zero
    cota, resposta instantânea) e ataca o problema de custo do relatório de
    ontem com força total. IA nessa camada só se justificaria se as regras
    simples não bastarem na prática — decisão a revisitar com dado real, não
    a assumir de antemão.
  - **Onde grava o veredito?** Ou uma tabela nova pequena, ou (mais simples)
    um campo de "estágio de funil" na própria tabela `products` — não precisa
    de infraestrutura pesada nova.
- **Um conceito explícito de "estágio do funil" por produto** — hoje
  `products.status` é genérico (`active`). Não existe, hoje, uma forma de
  perguntar "esse produto já passou por qual etapa?" sem juntar várias
  tabelas na mão. Isso precisa existir de forma explícita pro fluxo novo
  fazer sentido.

---

## 5. O sistema atual consegue funcionar orientado por um Decision Engine?

Sim, com adaptação — não com reescrita. E a razão é uma coincidência
favorável: os dois sinais mais baratos e mais decisivos que existem
(Economics, Compliance) já rodam automaticamente no cadastro, antes de
qualquer coisa cara. Isso já é, sem ter sido planejado assim, uma boa base
pro Decision Engine — os ingredientes certos já são calculados na hora certa.
O que falta é (a) um lugar que consolide esses 2 sinais num veredito único de
"seguir ou não", e (b) uma trava que impeça as etapas caras de rodar sem esse
veredito ser positivo — hoje essa trava não existe em lugar nenhum.

---

## 6. Serviço independente ou módulo do backend existente?

Módulo do mesmo backend, não serviço separado — pelo menos por agora. Dado o
volume real de hoje (dezenas de produtos) e dado que o relatório de ontem já
concluiu que o monólito modular ainda é apropriado pro estágio atual, criar
um processo/serviço separado agora seria complexidade sem benefício
correspondente. Isso só mudaria de resposta se:

- O volume crescer de verdade pra milhares/dia (aí sim, isolar a carga do
  Decision Engine do resto faria sentido — conecta com o ponto do relatório
  de ontem sobre carga pesada competindo com carga leve no mesmo processo); ou
- O Decision Engine precisar de tecnologia ou runtime muito diferente do
  resto — não é o caso: é a mesma categoria de "calcular e decidir" que
  Economics e Compliance já fazem.

Novo módulo, mesmo padrão dos outros (`service.js` puro + `repository.js` +
`routes.js`), nada de infraestrutura nova.

---

## 7. Reorganização proposta, com máximo reaproveitamento

1. Cadastro continua igual — Economics + Compliance rodam automaticamente,
   sem mudar nada.
2. Novo: logo depois do cadastro, o Decision Engine roda — lê o que
   Economics/Compliance já calcularam (não recalcula nada do zero), aplica a
   regra, grava o veredito e atualiza o estágio de funil do produto.
3. Trava simples adicionada em cada etapa cara (Keyword Research, Auditoria
   de LP, Score de Mercado completo, Rascunho de Campanha): "o produto já foi
   aprovado no gate? Se não, recusa com erro claro." Pouca mudança de código
   por módulo, grande mudança de comportamento agregado.
4. Frontend ganha indicador de estágio de funil — orienta visualmente o
   usuário a seguir a ordem certa, em vez de qualquer botão estar sempre
   disponível a qualquer momento.
5. Efeito colateral bom, de graça: isso vira também um mecanismo de proteção
   de cota/custo — produto reprovado cedo nunca gasta Keyword Planner,
   PageSpeed ou ScreenshotOne. Resolve, em parte, o risco #1 do relatório de
   ontem sem ter sido esse o objetivo declarado da pergunta.

---

## Uma ressalva importante, que eu não esconderia de você

A inversão troca "decisão mais lenta e mais cara, porém mais precisa" por
"decisão rápida e barata, porém mais grosseira". Isso tem um risco concreto,
que já vimos acontecer hoje, com dado real: o Advanced Amino Formula foi
`rejeitado_por_economics` contra uma palavra-chave genérica, mas aprovado
quando testamos um termo de cauda longa mais barato ("advanced amino formula
reviews"). Se o Decision Engine reprovar esse produto antes de qualquer
pesquisa de keyword rodar, ele nunca teria a chance de descobrir essa
alternativa mais barata — porque `cpc_maximo_calculado` é uma estimativa da
fórmula, não o preço real de leilão.

Minha recomendação pra mitigar isso, sem abrir mão do benefício de custo: o
gate deveria ser rigoroso só pra reprovação óbvia (comissão abaixo do mínimo,
nicho `black`) — e mais permissivo com o caso de borda
(`rejeitado_por_economics` por pouco, como vimos hoje), deixando esse caso
passar pro Keyword Research antes de decidir de vez. Isso é uma calibração de
regra, não uma mudança de arquitetura — mas é o tipo de detalhe que decide se
a inversão economiza cota sem também jogar fora produto bom por decisão
prematura.
