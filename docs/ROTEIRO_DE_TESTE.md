# Roteiro de Teste — Plataforma de Afiliados + IA

Roteiro pra rodar contra a aplicação de verdade (API + frontend no ar), na
ordem que faz sentido pro ciclo de vida real de um produto: cadastro →
decisão → campanha → contas → monitoramento. Cada bloco assume que o
anterior já rodou (produto criado num bloco é reaproveitado nos seguintes).

**Antes de começar**: confirme que a API está rodando (`npm start`), o
worker de fila está rodando (`npm run worker`, se for testar monitoramento
automático), e que você tem o `ADMIN_KEY` ou um JWT de administrador em mãos.

---

## Bloco 0 — Saúde básica

1. `GET /health` → esperado: `ok`
2. `GET /api/staff/auth/status` → confirma se já existe usuário (`hasUsers: true/false`)
3. Login (bootstrap se for o primeiro acesso, login normal se não)

---

## Bloco 1 — Cadastro de produto (do zero)

Cadastre um produto novo, diferente dos que já existem, pra testar o
pipeline inteiro limpo, sem depender de dado antigo.

1. `POST /api/products/manual` com nome, rede, categoria, comissão, taxa de
   conversão esperada, URL de página de vendas real
2. Confirme na resposta: `product.id` novo
3. `GET /api/products` — confirme que o produto aparece na lista, com
   `economics_status` e `niche_sensitivity` já preenchidos automaticamente
   (isso acontece no cadastro, sem chamada extra)

Esperado: Economics e Compliance rodam sozinhos no cadastro — se
`economics_status` ou `niche_sensitivity` vierem vazios, é bug, não
comportamento normal.

---

## Bloco 2 — Auditoria de LP (Camada A, com VSL)

1. `POST /api/products/:id/lp-audit/advanced` — roda a Camada A (texto + PageSpeed)
2. Se a página de vendas realmente tiver vídeo de vendas, confirme que
   `has_vsl: true` foi detectado corretamente
3. `GET /api/products` de novo — confirme que o card desse produto reflete a
   auditoria (`lp_audited_at` preenchido)

---

## Bloco 3 — Market Intelligence (sistema antigo, com IA)

1. Na tela Mercado, abra o produto, clique "Analisar oportunidade"
2. Confirme que retorna `worth_advertising`, `max_recommended_cpc`,
   `main_risks`, `reasoning` — sem `undefined` em nenhum campo

---

## Bloco 4 — Decision Engine (núcleo novo, sem IA)

1. `POST /api/decision-engine/:id/evaluate`
2. Anote o resultado: `opportunityScore`, `confidenceScore`, `decisionStatus`, `evidenceStage`
3. Se o produto tem VSL (Bloco 2): confirme que o `opportunityScore`
   reflete a penalidade de 30% (compare mentalmente com o que seria sem VSL)
4. Chame o mesmo `evaluate` de novo — confirme que o resultado é
   idêntico e que não dispara chamada nova ao Keyword Planner (idempotência)
5. Na tela Produtos, confirme que o badge (verde/amarelo/vermelho) aparece
   com o score certo, e que passar o mouse mostra o motivo em tooltip

---

## Bloco 5 — Trava do Decision Engine em Rascunho de Campanha

1. Se o produto do Bloco 4 ficou `investigar` ou `testar`: `POST /api/campaigns/drafts`
   com esse `productId` — deve gerar normalmente (com `decisionWarning` se for `investigar`)
2. Se ficou `descartar`: a mesma chamada deve vir HTTP 409, com mensagem
   citando o motivo. Repita com `overrideDecision: true` — deve gerar dessa
   vez, com `decisionWarning` explicando que foi uma decisão humana explícita

---

## Bloco 6 — Rascunho de Campanha (Fase 6 completa)

1. Confirme keywords com `funnelStage` marcado, headlines/descrições
   dentro do limite de caracteres (até 30 headline, até 90 descrição)
2. `GET /api/campaigns/drafts/:id/copy-text` — confirme que o texto vem
   formatado, pronto pra colar no Google Ads
3. `POST /api/campaigns/drafts/:id/approve` — confirme mudança de status

---

## Bloco 7 — Concorrência (Fase 4, manual)

1. Pesquise um concorrente real no Google Ads Transparency Center
   (adstransparency.google.com)
2. `POST /api/competitive-intel/manual` com o que encontrar
3. Cadastre o mesmo anúncio de novo — confirme que gera um snapshot novo
   (histórico), não duplicata

---

## Bloco 8 — Contas e Governança (Fase 8/9/10)

1. Tela Contas — confirme visualização em Árvore, Heatmap e Tabela,
   todas mostrando as mesmas contas com as mesmas cores de saúde
2. Se tiver MCC real cadastrada: clique "Sincronizar contas da MCC",
   confirme que reflete a hierarquia real do Google Ads
3. Clique numa conta em cada visualização — confirme que o modal de
   detalhe abre certo nas 3

---

## Bloco 9 — Monitoramento

1. `POST /api/monitoring/internal/check` — confirme que roda sem erro,
   mesmo que retorne 0 alertas novos
2. Se `ENABLE_INTERNAL_SCHEDULER_MONITORING=true`: confirme no log que o
   scheduler automático está rodando a cada 15 min

---

## Bloco 10 — Usuários e Perfis (Fase 9)

1. Como administrador, `POST /api/staff/users` criando um usuário `visualizador`
2. Login como esse usuário — confirme que a aba Usuários não aparece/fica bloqueada
3. Retrocompatibilidade: confirme que uma chamada com `x-admin-key` antiga
   (sem JWT nenhum) continua funcionando em qualquer endpoint

---

## Bloco 11 — Dashboard

1. Abra a tela inicial — confirme que os 6 KPIs da "Visão geral" batem com
   o que você vê nas telas individuais (produtos, rascunhos, concorrência, alertas)

---

## Bloco 12 — Teste E2E automatizado (se ainda não rodou nunca)

```bash
cd apps/web
npx playwright install chromium
npm run e2e
```

Confirme que os 17 screenshots foram gerados em `docs/manual-screenshots/` e
que `docs/MANUAL_DE_USO.md` reflete a tela real.

---

## Ao final, relate

Pra cada bloco: passou / passou com ressalva / falhou — com a mensagem de
erro exata se falhar. Não precisa rodar tudo de uma vez — pode ser em
etapas, um bloco por vez, se preferir revisar antes de seguir pro próximo.
