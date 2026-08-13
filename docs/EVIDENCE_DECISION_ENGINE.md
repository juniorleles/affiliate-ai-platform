# Desenho Funcional — Evidence Engine + Decision Engine

Só desenho de lógica, como pedido — sem código, sem tela nova, sem API nova.
Tudo abaixo referencia dado/campo que já existe no sistema (marcado
explicitamente onde não existe ainda).

---

## Conceito central: 2 scores ortogonais, não 1

A pergunta errada é "esse produto é bom?" — essa pergunta sozinha é o que
causou o problema de hoje (keyword genérica quase descartou um produto que
tinha alternativa de cauda longa viável). A pergunta certa é 2 perguntas
separadas:

- Opportunity Score: dado o que sabemos até agora, quão boa parece a
  oportunidade? (pode mudar bastante conforme mais evidência chega)
- Confidence Score: quanta evidência real já foi coletada, e quão
  variada/robusta ela é? (só cresce conforme etapas rodam com dado real —
  nunca cai, nunca é "adivinhado")

A decisão nunca olha só o Opportunity Score. Um produto com Opportunity
baixo mas Confidence baixa não é "ruim" — é "ainda não sabemos". Só vira
DESCARTAR quando as duas coisas apontam junto: oportunidade ruim e confiança
alta de que essa leitura é real, não um artefato de 1 keyword ruim.

---

## Matriz de evidências, da mais barata pra mais cara

| Etapa | O que coleta | Fonte | Existe hoje? | Custo |
|---|---|---|---|---|
| 0 — Cadastro | Comissão, categoria, dados básicos | Cadastro manual | Existe | Zero |
| 0 — Economics | CPC máximo calculado, trava de comissão mínima | market-intel/economics.js | Existe, automático no cadastro | Zero (cálculo puro) |
| 0 — Compliance | Sensibilidade de nicho, precisa de presell | discovery/compliance.js + IA | Existe, automático no cadastro | Baixo (1 chamada de IA, sem cota externa limitada) |
| 1 — Keyword genérico | Volume de busca, CPC de leilão real, competição | google-ads/keywordResearch.js (Fase 2b) | Existe | Médio (1 chamada Keyword Planner) |
| 2 — Keyword de intenção comercial | Mesma coisa, mas em termos de "buy/price/discount/coupon/where to buy" | researchCommercialIntentKeywords() | Existe (5 modificadores hoje) | Médio-alto (5 chamadas Keyword Planner) |
| 3 — Auditoria de LP, Camada A | Copy, oferta, CTA, correspondência com anúncio, performance real (PageSpeed) | Fase 3d Camada A | Existe | Médio (1 chamada IA + 1 PageSpeed) |
| 4 — Auditoria de LP, Camada B | Primeira impressão visual, UX mobile | Fase 3d Camada B | Existe | Alto (2 screenshots + 1 chamada IA com visão) |
| 5 — Concorrência | Quantos concorrentes anunciam, qualidade da abordagem deles | Fase 4 (Competitive Intel) | Existe, mas manual — não é coletado automaticamente por produto | Zero (se já cadastrado) / Alto (se precisar pesquisar manualmente agora) |
| 6 — Tendência/Sazonalidade | Crescimento, sazonalidade, interesse por região | — | Não existe (sem API oficial limpa, ver auditoria de ontem) | N/A — fica de fora do cálculo, não inventa dado |

---

## 4. Ordem ideal das etapas (mais barata → mais cara)

1. Economics + Compliance (já automáticos, zero custo extra)
2. Keyword genérico (1 chamada)
3. Keyword de intenção comercial (5 chamadas — só roda se etapa 2 não já
   resolveu a decisão com confiança suficiente, ver critério de interrupção)
4. Auditoria de LP Camada A (texto + PageSpeed)
5. Auditoria de LP Camada B (visual) — só se ainda precisar de mais
   confiança depois da Camada A
6. Concorrência (se já tiver dado cadastrado; não dispara pesquisa nova)

---

## 5. Critério para avançar pra próxima etapa

Avança automaticamente só se:
- Não bateu em nenhuma regra de descarte imediato (ver item 9), e
- Ainda não atingiu confiança suficiente pra decidir (Confidence < 60), e
- Ainda existe etapa não coletada.

Se qualquer uma dessas 3 condições falhar, o funil para ali — não roda a
próxima etapa só porque existe.

---

## 6. Critério para interromper a análise

Interrompe (não continua gastando evidência) assim que:
- Confidence >= 60 e (Opportunity >= 60 ou Opportunity <= 35) — ou seja,
  assim que uma decisão confiável já é possível, nos dois sentidos (bom
  confiável, ou ruim confiável). Continuar coletando depois disso é gasto de
  cota sem ganho de decisão.
- Ou: todas as etapas disponíveis já rodaram (chegou no topo do funil de
  evidência) e a zona ainda é cinzenta — nesse caso força o estado final
  INVESTIGAR (nunca fica girando indefinidamente).

---

## 7. Critério para INVESTIGAR (amarelo)

Qualquer uma dessas condições:
- Confidence < 60 (não importa o que o Opportunity Score diga — ainda não
  sabemos o suficiente pra confiar na leitura).
- Confidence >= 60 e 35 < Opportunity < 60 (zona cinza real — dado
  suficiente, mas o resultado em si é ambíguo, nem claramente bom nem
  claramente ruim).
- Dado insuficiente numa etapa que deveria ter tido resultado (ex: keyword
  research retornou vazio) — trata como "ainda não sabemos", não como "ruim".

---

## 8. Critério para TESTAR (verde)

Opportunity >= 60 e Confidence >= 60. Explicitamente:
- Economics viável (ou rejeitado só no termo genérico, mas revertido por
  keyword de intenção comercial viável — ver item 11).
- Pelo menos 1 keyword de intenção comercial real com CPC de leilão dentro do
  teto calculado.
- Compliance não classificou como nicho black.
- Nenhum sinal de reprovação óbvia (comissão abaixo do mínimo).

---

## 9. Critério para DESCARTAR (vermelho)

Duas vias possíveis:

Descarte imediato (bypassa todo o funil de evidência, não precisa gastar
nada mais pra saber):
- economics.status === 'rejeitado_por_comissao_minima' — comissão abaixo do
  piso configurado, isso já é um fato determinístico, sem ambiguidade.
- compliance.niche_sensitivity === 'black' — risco de conta/política alto
  demais pra valer a pena investigar mais.

Descarte por evidência acumulada (só depois de coletar o suficiente):
- Opportunity <= 35 e Confidence >= 60 — ou seja, já olhamos keyword
  genérico e de intenção comercial (não só 1 keyword ruim isolada), e os
  dois continuam apontando ruim.

---

## 10. Como Opportunity Score e Confidence Score são calculados

Opportunity Score (0-100) — média ponderada dos sinais disponíveis até agora
(mesmo princípio já usado em market-intel/scoring.js: ignora o que ainda não
foi coletado, nunca inventa valor pra lacuna):

| Sinal | Peso | Fonte |
|---|---|---|
| Margem Economics (CPC máximo / CPC leilão real, quando já tiver leilão) | 30% | Economics + Keyword |
| Demanda (volume de busca) | 20% | Keyword |
| Melhor keyword de intenção comercial encontrada (CPC dela vs. teto) | 25% | Keyword comercial |
| Qualidade da LP (quando auditada) | 15% | Auditoria de LP |
| Compliance (nicho normal soma, sensitive neutro, black já descartou antes) | 10% | Compliance |

Confidence Score (0-100) — soma de pontos por etapa efetivamente concluída
com dado real (não por resultado bom ou ruim — só por ter sido checado):

| Etapa concluída | Pontos |
|---|---|
| Economics + Compliance (sempre, automático) | 20 |
| Keyword genérico com leilão real | +20 |
| Keyword de intenção comercial (pelo menos 2 modificadores com bid real) | +25 |
| Auditoria de LP Camada A | +15 |
| Auditoria de LP Camada B | +10 |
| Dado de concorrência cadastrado pra esse produto | +10 |

Máximo 100. Uma etapa que falhou ou voltou vazia (ex: nenhuma keyword com
bid encontrada) não soma pontos — mas também não subtrai. Fica "não
contado", igual ao princípio de computeOverallScore() que já existe.

---

## 11. Como evitar que 1 keyword genérica ruim descarte um produto bom

É exatamente o que a separação de 2 scores resolve por desenho, não por
regra especial: 1 keyword genérica ruim sozinha nunca gera Confidence >= 60
(ela só entrega 40 pontos de confiança: 20 do cadastro + 20 do keyword
genérico). Sem 60+ de confiança, o sistema não tem permissão de concluir
DESCARTAR, não importa quão ruim o Opportunity Score pareça nesse momento —
cai automaticamente em INVESTIGAR, que continua o funil pra etapa de
keyword de intenção comercial antes de qualquer descarte. Foi exatamente
esse o caso real de hoje (Advanced Amino Formula) — a regra existe pra
reproduzir, de propósito, o comportamento que só aconteceu hoje porque um
humano insistiu em testar mais um termo.

---

## 12. Como tratar dado insuficiente

Mesmo princípio já estabelecido no projeto (Economics já tem
dado_insuficiente como estado explícito, não um erro): uma etapa sem dado
suficiente não conta pontos de confiança, e o sinal correspondente não entra
no cálculo do Opportunity Score (nem como 0, nem como neutro — é
literalmente ignorado no peso, redistribuindo entre os sinais que existem).
O resultado natural é: dado insuficiente mantém o produto em zona de baixa
confiança, o que empurra pra INVESTIGAR, nunca pra DESCARTAR ou TESTAR por
engano.

---

## 13. Conjunto mínimo de evidência pra recomendar TESTE

- Economics calculado (automático).
- Compliance calculado, não-black (automático).
- Pelo menos 1 keyword de intenção comercial real, com CPC de leilão dentro
  do teto — isso sozinho já entrega Confidence = 65 (20+20+25), o suficiente
  pra cruzar o limiar de decisão confiável.

Isso é o "MVP de evidência" — dá pra recomendar teste sem nunca ter rodado
Auditoria de LP.

## 14. Conjunto de evidência pra recomendar teste com confiança ALTA

Tudo do item 13, mais:
- Auditoria de LP Camada A completa (confirma que a página converte o
  tráfego, não só que o tráfego é comprável).
- Mais de 1 keyword de intenção comercial viável (não depende de 1 só).
- Idealmente, dado de concorrência cadastrado (mostra que você sabe contra
  quem está competindo, não só que a matemática fecha).

Isso leva Confidence a 90-100 — recomendação com o maior grau de certeza
que o sistema consegue oferecer sem inventar dado (Trends/sazonalidade fica
de fora por design, não por lacuna escondida).

---

## 15. Exemplo completo — Advanced Amino Formula, com os números reais de hoje

| Etapa | O que aconteceu (dado real, testado hoje) | Opportunity após | Confidence após |
|---|---|---|---|
| 0 — Cadastro | Comissão EUR 60,05, CPC máximo calculado EUR 2,94 | ~50 (neutro, sem leilão ainda) | 20 |
| 0 — Compliance | sensitive, requires_presell: true | ~48 (leve penalidade por risco de nicho) | 20 (já contava no mesmo pacote) |
| 1 — Keyword genérico | Seed "amino acid supplement" -> leilão médio convertido EUR 8,38 -> muito acima do teto -> rejeitado_por_economics | ~28 (cai forte — parece ruim) | 40 |
| Ponto de decisão 1 | Opportunity=28, Confidence=40 -> Confidence < 60 -> não pode descartar ainda, mesmo com Opportunity baixo | — | — |
| 2 — Keyword de intenção comercial | 5 modificadores rodados — "advanced amino formula reviews" veio com CPC convertido dentro do teto; outras (buy/price/discount/coupon) sem dado de leilão, mas com sinal de fundo de funil confirmado | ~63 (recupera — achou alternativa viável) | 65 |
| Ponto de decisão 2 | Opportunity=63 >= 60 e Confidence=65 >= 60 -> critério de TESTAR atingido -> funil pode parar aqui | TESTAR | — |
| 3 — Auditoria de LP Camada A (opcional, pra subir confiança) | Testado com anúncio realista: correspondencia_google_ads boa, score textual 76 | ~66 | 80 |
| 4 — Auditoria de LP Camada B (opcional) | Score visual 76, validado ponto a ponto pelo usuário contra a página real | ~68 | 90 |

Resultado final, se rodar até o fim: TESTAR, com confiança alta (90) —
recomendação: seguir pra Fase 6 (rascunho de campanha), usando a keyword
"advanced amino formula reviews" como âncora de fundo de funil, não a
genérica "amino acid supplement" que teria descartado o produto se o sistema
tivesse parado na etapa 1.

O que teria acontecido com o desenho antigo (score único, sem separação):
provavelmente rejeitado_por_economics na etapa 1 já seria o veredito final —
exatamente o que quase aconteceu hoje, e só não aconteceu porque um humano
decidiu manualmente testar mais um termo. O Evidence Engine formaliza esse
instinto humano como regra do sistema.

---

## Fluxo final

```
Produto
  |
  v
Evidence Engine
  (coleta em etapas, do mais barato pro mais caro - para assim que
   confianca suficiente for atingida, nunca gasta evidencia a toa)
  |
  v
Evidence Score  (= as evidencias agregadas viram 2 leituras paralelas)
  |                                    |
  v                                    v
Opportunity Score                Confidence Score
  |                                    |
  +---------------+-------------------+
                  |
                  v
           Decision Engine
      (regra sobre os 2 scores juntos -
       nunca decide com so 1 dos dois)
                  |
                  v
      TESTAR / INVESTIGAR / DESCARTAR
```
