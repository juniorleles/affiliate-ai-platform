# Cronograma de Finalização — Plataforma de Afiliados + IA

Baseado em 3-4h/dia, escopo completo (Fase 3c → Fase 5). Estimativa calibrada pelo
ritmo real da sessão de 2026-08-04 — não é promessa fechada, é planejamento honesto
com folga pra imprevisto (hoje mesmo tivemos 3: bloqueio Digistore24, scraper
ClickBank rejeitado, bug de moeda — esse tipo de coisa volta a acontecer).

**Regra geral**: cada dia listado assume que o dia anterior foi concluído e testado
com dado real — igual ao padrão que seguimos o dia todo (nenhuma fase "pronta" sem
checklist real, não só código escrito).

---

## Semana 1 — Fase 3c (tela de cadastro) + decisões pendentes + segurança

| Dia | Foco | Entregável |
|---|---|---|
| 1 | Fase 3c — formulário de cadastro rápido | Campos essenciais (nome, rede, comissão, preço, conversão) + preview de Economics ao vivo (chama `/economics/evaluate` a cada mudança) |
| 2 | Fase 3c — segunda etapa + lista | Seção expansível de LP/Compliance, lista de produtos em cards com status visual (economics/compliance/LP pendente) |
| 3 | Testes reais da Fase 3c + decisões da seção 10 | Cadastrar 2-3 produtos pela tela nova (não mais via curl); resolver single/multi-user, hospedagem, Claude/OpenAI — mais decisão sua que trabalho técnico |
| 4 | Segurança de produção | Criptografia de credenciais em repouso (`pgcrypto` ou `node:crypto`); se decidiu multi-user no Dia 3, começar autenticação de usuário real aqui |
| 5 | Buffer da semana 1 | Ajustes do que não fechou nos dias 1-4 — **não conte com esse dia livre, ele quase sempre é usado** |

## Semana 2 — Fase 3d (Auditor de LP avançado)

| Dia | Foco | Entregável |
|---|---|---|
| 6 | Camada A — texto + PageSpeed | Schema de IA novo, fetch de HTML da LP, integração com PageSpeed Insights API (performance real, não estimada) |
| 7 | Camada A — teste real | Rodar no Advanced Amino Formula (já tem URL conhecida), calibrar o prompt até o relatório ficar específico, não genérico |
| 8 | Decisão de screenshot + setup | Mesma disciplina de hoje: pesquisar 2-3 opções antes de escolher (navegador headless próprio vs. serviço de terceiro oficial) |
| 9 | Camada B — visão | Captura de screenshot + análise visual/mobile via IA com visão, testar |
| 10 | Buffer + UI do relatório | Tela pra mostrar o relatório completo (isso também é frontend que ainda não existe) |

## Semana 3 — Fase 4 (Competitive Intelligence) + Fase 5 (expansão)

| Dia | Foco | Entregável |
|---|---|---|
| 11 | Fase 4 — decidir fonte de dado | Pesquisar SpyFu/SEMrush/Adbeat/BigSpy de verdade (preço, cobertura, API oficial confirmada) antes de criar conta |
| 12 | Fase 4 — connector | Integração com o provider escolhido, primeiro produto de teste |
| 13 | Fase 4 — teste de mudança ao longo do tempo | Rodar a coleta 2x com intervalo, confirmar que gera snapshot novo, não sobrescreve |
| 14 | Fase 5 — expansão de redes | Cadastrar produtos de mais 1-2 redes pela tela da Fase 3c, comparar scores — **sem código novo**, decisão de 2026-08-04 já tirou a automação de rede do escopo |
| 15 | Buffer final + revisão geral | Checklist geral do roadmap, ajustes finais, ponto de situação completo |

---

## ✅ Nota sobre a Fase 5 (Dia 14) — decisão já tomada em 2026-08-04

A automação de descoberta por rede foi **removida do escopo do projeto** (não é mais
"bloqueada", é uma decisão definitiva) — confirmado com Digistore24 (sem função de API
pra isso) e ClickBank (proibido em contrato). O Dia 14 agora é só usar a tela de
cadastro manual (Fase 3c) com produtos de outra rede — nenhum código novo necessário,
o `networkType` já é um campo livre.

## Total estimado

**~15 dias úteis de 3-4h/dia ≈ 3 semanas corridas**, contando só dias de trabalho —
mais se não for todo dia. Isso é o escopo completo (3c + 3d + Fase 4 + Fase 5).

Se em algum ponto quiser cortar escopo pra ir mais rápido: **Semana 1 sozinha já
destrava o uso contínuo do sistema** (cadastro pela tela, sem curl) — é o corte mais
natural se o tempo apertar.
