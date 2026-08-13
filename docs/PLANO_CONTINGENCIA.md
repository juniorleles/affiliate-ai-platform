# Plano de Continuidade — Estrutura Guarda-Chuva

Documento vivo, parte do módulo de Governança (2026-08-05). Cada procedimento
abaixo referencia telas/endpoints que **já existem de verdade** no projeto —
não é um checklist genérico copiado de um artigo, é ancorado no que você
realmente tem pra usar quando o problema acontecer.

**Princípio inegociável, herdado do resto do projeto**: nada aqui existe pra
burlar suspensão, criar conta pra contornar bloqueio, ou continuar anunciando
depois de uma conta suspensa. É visibilidade e isolamento de risco dentro das
políticas do Google Ads — não workaround.

---

## 1. Falha no método de pagamento

**Sintoma**: campanha para de gastar sem aviso, ou você recebe e-mail do
Google sobre cobrança recusada.

**Antes de precisar disso**: cadastre o `payment_method_label` de cada conta
(tela **Contas**) — um rótulo simples tipo "Cartão A"/"Cartão B". Isso não
integra com dado real de cobrança (a API do Google Ads não expõe isso de
forma simples), mas te deixa ver **quantas contas quebram juntas** se um
método falhar. A própria tela já avisa quando 5+ contas dependem do mesmo rótulo.

**Quando acontecer**:
1. Abra a tela **Contas**, veja quais contas têm o mesmo `payment_method_label`
   da que falhou — essas são as afetadas.
2. Verifique o status real de cada uma: botão "Atualizar status"
   (`POST /api/campaigns/accounts/refresh-status`) — consulta a API do Google
   de verdade, não confia em cache.
3. Corrija o método de pagamento diretamente no Google Ads (fora do nosso
   sistema — não temos, nem deveríamos ter, acesso a dado de cartão).
4. Depois de corrigir, rode "Atualizar status" de novo pra confirmar.

---

## 2. Alteração de política do Google Ads

**Sintoma**: anúncio que sempre foi aprovado começa a ser reprovado, ou você
lê sobre mudança de política nas notícias.

**O que já monitora isso**: `checkAdDisapprovals()` (Fase 7, Parte A) roda a
cada 15 minutos (se `ENABLE_INTERNAL_SCHEDULER_MONITORING=true`), gera alerta
`ad_disapproved` na tela **Alertas** assim que detecta.

**Quando acontecer**:
1. Veja o alerta na tela **Alertas** — ele já cita a campanha e o anúncio.
2. Antes de criar o próximo rascunho de campanha (tela **Rascunhos de
   Campanha**), rode a revisão preventiva: `POST /api/campaigns/drafts/:id/review-policy`
   — já testamos que ela diferencia risco `low`/`high` com achado específico,
   não genérico.
3. Se a mudança de política for ampla (não só 1 anúncio), revise o
   `producer_compliance` (tela **Produtos**) dos produtos no nicho afetado —
   pode precisar reclassificar.

---

## 3. Reprovação em massa de anúncios

**Sintoma**: vários anúncios reprovados ao mesmo tempo, em contas diferentes.

**Quando acontecer**:
1. Tela **Alertas** — filtre por `ad_disapproved`, veja se está concentrado
   numa `operacao`/`marca`/região específica (tela **Contas** cruza isso).
2. Se for 1 conta só: provavelmente problema pontual daquela conta/nicho.
3. Se for várias contas da mesma operação/região: mais provável ser mudança
   de política ampla (item 2) ou padrão de copy comum entre elas — revise o
   prompt de `reviewAdPolicy` pra esse padrão específico.
4. Pause a criação de novos rascunhos até entender a causa — não adianta
   gerar mais rascunho com o mesmo problema.

---

## 4. Mudança de domínio

**Sintoma**: você troca a URL de destino de um produto (nova página de
vendas, novo domínio).

**Quando acontecer**:
1. Recadastre o produto (tela **Produtos**, `salesPageUrl` novo) — o upsert
   já preserva o resto do histórico (bug de `sales_page_url` não atualizar
   foi corrigido em 2026-08-05).
2. Rode a Auditoria de LP de novo (Camada A e B, tela **Produtos** →
   "Auditar página") — o domínio novo pode ter estrutura/velocidade/UX
   diferente do antigo, não assuma que continua igual.
3. Se já existir rascunho de campanha (tela **Rascunhos**) apontando pro
   domínio antigo, gere um rascunho novo — não tem edição de rascunho
   existente hoje, é gerar de novo.
4. Atualize `dominio` na tela **Contas**, se esse domínio estiver associado
   a uma conta específica (rastreamento de isolamento de marca).

---

## 5. Rotatividade de funcionário com acesso administrativo

**Sintoma**: alguém com acesso sai da operação (você, se for só você; ou
alguém que você deu acesso).

**Estado real do projeto (seja honesto com você mesmo aqui)**: hoje o sistema
usa 1 `ADMIN_KEY` única pra tudo — decisão registrada, single-user (seção 10
item 3 do documento de arquitetura). Não existe usuário individual, não
existe permissão por pessoa. Se você deu essa chave pra alguém, revogá-la
significa girar a chave pra todo mundo, não só pra 1 pessoa.

**Quando acontecer**:
1. Gere uma `ADMIN_KEY` nova, atualize no `.env`, reinicie a API.
2. Revise todas as credenciais que essa pessoa pode ter visto (Google Ads
   refresh token, chave Anthropic, ScreenshotOne, PageSpeed) — a recomendação
   de girar credencial que passou por texto já é prática estabelecida neste
   projeto, mesma lógica aqui.
3. Se a operação crescer a ponto de precisar de acesso por pessoa de
   verdade, revisitar a decisão single-user (seção 10, item 3) — não é algo
   pra fazer no meio de uma saída de funcionário, é decisão de arquitetura
   que merece calma.

---

## O que este plano NÃO cobre (por decisão consciente)

- **Apelação de suspensão de conta** — Fase 7 Parte B foi cortada
  conscientemente (ver `docs/ARQUITETURA.md`, decisão de 2026-08-05, baseada
  em taxa de sucesso real de apelação). Se uma conta for suspensa, o caminho
  é o processo oficial de recurso do Google — este projeto não automatiza
  isso e não promete resultado.
- **Criação automática de conta/MCC nova** — não existe, e não deveria
  existir. Esse plano é sobre reagir bem a um problema numa estrutura
  legítima já existente, não sobre gerar conta nova pra contornar bloqueio.
