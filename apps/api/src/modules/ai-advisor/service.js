const aiProvider = require('../../shared/ai-provider');
const repo = require('./repository');

const CAMPAIGN_VERDICT_SYSTEM_PROMPT = `
Você é um analista sênior de mídia paga (Google Ads), especializado em decisões de
orçamento orientadas a dados. Sua tarefa é analisar o desempenho de UMA campanha
específica e recomendar UMA ação, com base apenas nos dados fornecidos.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON,
exatamente neste formato:
{
  "verdict": "increase_budget" | "maintain" | "decrease_budget" | "pause",
  "confidence": "low" | "medium" | "high",
  "cpa": number | null,
  "roas": number | null,
  "suggested_budget_change_pct": number,
  "reasoning": string
}

Regras de análise:
- Calcule CPA = custo / conversões e ROAS = receita / custo. Priorize a receita de
  afiliados como fonte de receita real quando houver volume razoável de conversões;
  use o valor de conversão do Google como apoio/comparação.
- Se o número total de conversões no período for baixo (ex: menos de 10), reduza a
  "confidence" para "low", evite recomendar mudanças bruscas de orçamento, e explique
  essa limitação estatística no "reasoning".
- Compare CPA e ROAS com as metas informadas (target_cpa, target_roas), quando existirem.
  Sem metas definidas, use como referência geral: ROAS abaixo de 1 é prejuízo direto;
  CPA subindo com conversões estáveis ou caindo é sinal de alerta.
- "pause" só deve ser recomendado quando os dados mostram prejuízo sustentado ao longo
  de vários dias, ou ROAS muito abaixo de 1 com volume suficiente de dados.
- "increase_budget" só deve ser recomendado quando CPA/ROAS estão consistentemente
  bons ao longo da série diária, com volume de conversões suficiente para confiança.
- "suggested_budget_change_pct": número (pode ser negativo). 0 quando o veredito for "maintain".
- "reasoning": no máximo 100 palavras, em português, direto, citando os números
  observados. Termine deixando claro que é recomendação de apoio à decisão.
`.trim();

const COMPLIANCE_SYSTEM_PROMPT = `
Você é um analista de compliance de marketing de afiliados, especializado em identificar
riscos de conta banida em plataformas de anúncios (Google Ads principalmente) antes de
qualquer campanha ser criada.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON:
{
  "niche_sensitivity": "normal" | "sensitive" | "black",
  "requires_presell_recommendation": boolean,
  "confidence": "low" | "medium" | "high",
  "risk_flags": string[],
  "reasoning": string
}

Regras de classificação:
- "normal": nicho sem restrição relevante em plataformas de anúncio mainstream.
- "sensitive": nicho que passa em revisão de anúncio mas costuma exigir cuidado extra
  (ex: suplementos com alegação de saúde forte, perda de peso, antienvelhecimento).
- "black": nicho que tipicamente é rejeitado ou banido em anúncios diretos no Google Ads
  (ex: alegações médicas não comprovadas, produtos regulados, esquemas de ganho fácil).
- "requires_presell_recommendation": true quando a página de vendas do produto, pelo que
  você consegue inferir da descrição, provavelmente não passaria direto numa revisão de
  anúncio — nesses casos, recomenda-se direcionar o anúncio pra uma página presell própria
  antes do link do produtor.
- "risk_flags": liste só riscos concretos que você identificou, no máximo 6. Lista vazia
  se não identificar risco relevante.
- "reasoning": no máximo 100 palavras, em português, direto, citando o que na descrição do
  produto motivou a classificação.
`.trim();

async function analyzeCampaignBudget({ campaign, dailyMetrics, affiliateStats }) {
  const totals = dailyMetrics.reduce((acc, d) => {
    acc.cost += Number(d.cost);
    acc.clicks += Number(d.clicks);
    acc.impressions += Number(d.impressions);
    acc.googleConversions += Number(d.google_conversions);
    acc.googleConversionsValue += Number(d.google_conversions_value);
    return acc;
  }, { cost: 0, clicks: 0, impressions: 0, googleConversions: 0, googleConversionsValue: 0 });

  const context = {
    campanha: campaign.name,
    status_atual: campaign.status,
    meta_cpa: campaign.target_cpa,
    meta_roas: campaign.target_roas,
    periodo_dias: dailyMetrics.length,
    totais_periodo: {
      custo: Number(totals.cost.toFixed(2)),
      cliques: totals.clicks,
      impressoes: totals.impressions,
      conversoes_google: totals.googleConversions,
      valor_conversoes_google: Number(totals.googleConversionsValue.toFixed(2)),
    },
    dados_afiliados_periodo_total: {
      conversoes: Number(affiliateStats.conversions),
      receita: Number(Number(affiliateStats.revenue).toFixed(2)),
    },
    serie_diaria: dailyMetrics.map(d => ({
      data: d.date, custo: Number(d.cost), cliques: Number(d.clicks),
      conversoes_google: Number(d.google_conversions),
    })),
  };

  const { result, model, provider } = await aiProvider.analyze({
    schema: 'campaignVerdict',
    systemPrompt: CAMPAIGN_VERDICT_SYSTEM_PROMPT,
    context,
  });

  const saved = await repo.recordAnalysis({
    subjectType: 'campaign',
    subjectId: campaign.id,
    questionType: 'campaign_budget_verdict',
    provider,
    model,
    windowDays: dailyMetrics.length,
    verdict: result.verdict,
    confidence: result.confidence,
    response: result,
    reasoning: result.reasoning,
  });

  return saved;
}

/**
 * Classifica a sensibilidade de nicho de um produto (5.3). Chamado pelo módulo
 * discovery/compliance.js — este é o único lugar que fala com shared/ai-provider
 * pra esse tipo de pergunta, e é quem grava em ai_analyses (loop de aprendizado).
 */
async function classifyProductCompliance({ productId, name, category, description }) {
  const context = { nome: name, categoria: category ?? null, descricao: description ?? null };

  const { result, model, provider } = await aiProvider.analyze({
    schema: 'complianceClassification',
    systemPrompt: COMPLIANCE_SYSTEM_PROMPT,
    context,
  });

  const saved = await repo.recordAnalysis({
    subjectType: 'product',
    subjectId: productId,
    questionType: 'compliance_niche_classification',
    provider,
    model,
    verdict: result.niche_sensitivity,
    confidence: result.confidence,
    response: result,
    reasoning: result.reasoning,
  });

  return { analysis: saved, result };
}

const PRODUCT_OPPORTUNITY_SYSTEM_PROMPT = `
Você é um consultor de marketing de afiliados, especializado em decidir se vale a
pena investir em anunciar um produto específico via Google Ads, com base em dados
já coletados. NÃO reestime o que já foi calculado — use os números fornecidos.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON,
exatamente neste formato:
{
  "worth_advertising": boolean,
  "market_saturation": "low" | "medium" | "high",
  "max_recommended_cpa": number | null,
  "max_recommended_cpc": number | null,
  "suggested_initial_budget": number | null,
  "estimated_profit_chance": "low" | "medium" | "high",
  "confidence": "low" | "medium" | "high",
  "main_risks": string[],
  "roi_improvement_suggestions": string[],
  "reasoning": string
}

Regras:
- "max_recommended_cpc": se "cpc_maximo_calculado" estiver no contexto, USE ESSE
  VALOR exatamente — não recalcule do zero. Se não houver, retorne null.
- "max_recommended_cpa": derive de cpc_maximo_calculado e taxa_conversao_esperada
  (CPA máximo ≈ CPC máximo / taxa de conversão), quando os dois estiverem
  disponíveis no contexto. Sem esses dados, null.
- "worth_advertising": normalmente false se o status de economics for
  "rejeitado_por_comissao_minima" ou "rejeitado_por_economics" — A MENOS que os
  dados de keywords_principais mostrem uma alternativa clara com CPC menor que o
  teto; nesse caso, considere true e explique a alternativa específica no reasoning.
- "market_saturation": baseie-se no nível de competição e volume de busca das
  keywords_principais, quando disponíveis. Sem esse dado, responda "medium" e
  reduza a confidence.
- Leve em conta compliance (sensibilidade de nicho, recomendação de presell) e a
  auditoria de LP (CTA/VSL/preservação de parâmetro de afiliado) na avaliação de
  risco — parâmetro de afiliado não preservado é um risco financeiro direto
  (comissão perdida), não só um detalhe técnico.
- "suggested_initial_budget": um valor conservador pra testar a campanha por 1-2
  semanas, coerente com o CPC máximo e volume de busca disponível — orçamento de
  teste, não o ideal de longo prazo.
- "main_risks" e "roi_improvement_suggestions": no máximo 6 itens cada, específicos
  ao produto e aos dados fornecidos — não genéricos.
- "reasoning": no máximo 200 palavras, em português, citando os números reais do
  contexto. Termine deixando claro que é recomendação de apoio à decisão, a
  palavra final é de quem administra a verba.
`.trim();

/**
 * Responde as 8 perguntas originais do documento sobre um produto (Módulo 4),
 * usando Economics + Keyword + Compliance + Auditoria de LP como fatos já
 * calculados — a IA julga o que não é redutível a fórmula (saturação, risco
 * qualitativo, sugestões de melhoria), não reinventa CPC máximo do zero.
 */
async function evaluateProductOpportunity({ productId, product, economics, keywordMetrics, compliance, lpAudit, deterministicScore }) {
  const topKeywords = (keywordMetrics || [])
    .slice()
    .sort((a, b) => (Number(b.avg_monthly_searches) || 0) - (Number(a.avg_monthly_searches) || 0))
    .slice(0, 5)
    .map(k => ({
      termo: k.keyword_text,
      buscas_mensais: k.avg_monthly_searches,
      competicao: k.competition_level,
      cpc_topo_pagina_baixo: k.top_of_page_bid_low,
      cpc_topo_pagina_alto: k.top_of_page_bid_high,
    }));

  const context = {
    produto: { nome: product.name, categoria: product.category, moeda: product.currency },
    economics: economics ? {
      comissao_usada: Number(economics.comissao_usada),
      taxa_conversao_esperada: Number(economics.taxa_conversao_esperada),
      cpc_maximo_calculado: economics.cpc_maximo_calculado != null ? Number(economics.cpc_maximo_calculado) : null,
      status: economics.status,
    } : null,
    keywords_principais: topKeywords,
    compliance: compliance ? {
      sensibilidade_nicho: compliance.niche_sensitivity,
      requer_presell: compliance.requires_presell,
      notas: compliance.compliance_notes,
    } : null,
    auditoria_lp: lpAudit ? {
      tem_cta: lpAudit.has_cta,
      tem_vsl: lpAudit.has_vsl,
      parametro_afiliado_preservado: lpAudit.affiliate_params_preserved,
    } : null,
    score_deterministico: deterministicScore ? {
      score_geral: deterministicScore.score,
      demanda: deterministicScore.demand_score,
      competicao: deterministicScore.competition_score,
      qualidade_lp: deterministicScore.sales_page_quality_score,
    } : null,
  };

  const { result, model, provider } = await aiProvider.analyze({
    schema: 'productOpportunity',
    systemPrompt: PRODUCT_OPPORTUNITY_SYSTEM_PROMPT,
    context,
    maxTokens: 2048, // schema maior (2 arrays + reasoning de até 200 palavras) — 800 (padrão) truncava, ver docs/ARQUITETURA.md
  });

  const saved = await repo.recordAnalysis({
    subjectType: 'product',
    subjectId: productId,
    questionType: 'product_opportunity',
    provider,
    model,
    verdict: result.worth_advertising ? 'worth_advertising' : 'not_worth_advertising',
    confidence: result.confidence,
    response: result,
    reasoning: result.reasoning,
  });

  return saved;
}

const LP_AUDIT_SYSTEM_PROMPT = `
Você atua como um gestor sênior de Google Ads + especialista em CRO (Conversion Rate
Optimization) + copywriter + especialista em UX. Sua tarefa é analisar uma landing page
e responder: "essa página está preparada pra transformar tráfego pago do Google Ads em
conversão?" — não é uma avaliação estética, é uma avaliação de conversão.

Você recebe o TEXTO extraído da página (não uma imagem — não avalie design, cores,
contraste de botão, layout visual, espaçamento nem experiência mobile visual; isso
está fora do que você consegue avaliar com o dado fornecido). Se o texto sugerir
ausência de algo (ex: nenhum depoimento visível no texto), trate como ausente, mas
deixe claro na análise que é baseado no texto disponível, não em inspeção visual.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON,
seguindo exatamente o schema fornecido.

Regras:
- "landing_page_conversion_score": 0-100. Faixas: 90-100 excelente, 80-89 muito boa,
  70-79 boa (com oportunidades), 60-69 precisa de melhorias, 40-59 fraca, 0-39 crítica.
  Este score reflete SÓ as dimensões avaliáveis por texto (copy, oferta, CTA, prova
  social, correspondência com o anúncio) — não inclui design/visual/mobile, que exigem
  análise de imagem (não disponível aqui). Sempre mencione essa limitação em
  "limitacoes_da_analise".
- "correspondencia_google_ads": null se não houver dados de anúncio/keyword no contexto.
  Quando houver, compare Keyword → Anúncio → Landing Page e avalie se a promessa do
  anúncio é cumprida na página.
- "proposta_de_valor.sugestoes_headline": só preencha se "forca" for "fraca", "confusa"
  ou "generica". Gere até 3 alternativas baseadas em Benefício + Público + Problema/
  Solução + Diferencial, usando as informações reais fornecidas — nunca invente
  característica, depoimento, número de clientes ou resultado que não foi fornecido.
- "confianca_prova_social.objecoes_nao_respondidas": objeções de compra comuns que o
  texto da página não trata.
- "principais_problemas": priorize por impacto potencial na conversão, não por
  quantidade. Cada item precisa de recomendação prática, não só "está ruim".
- "limitacoes_da_analise": SEMPRE inclua ao menos a limitação de que design visual, UX
  mobile real e caminho até o checkout (quando a URL de checkout não foi fornecida ou
  não pôde ser lida) não foram avaliados nesta análise. Se algum outro dado não estava
  disponível (ex: performance/PageSpeed ausente), declare isso também — nunca invente
  dado que não recebeu.
- "reasoning": no máximo 150 palavras, em português, direto, citando trechos/números
  reais do contexto fornecido. Use linguagem de "potencial de melhoria"/"provável
  impacto" — nunca afirme que uma mudança vai necessariamente aumentar conversão.
`.trim();

/**
 * Auditor de LP avançado — Camada A (texto + performance real via PageSpeed,
 * sem análise visual). Ver docs/ARQUITETURA.md seção 5.4, Fase 3d.
 */
async function analyzeLandingPageText({ productId, pageText, pageSpeed, product, adInfo, targetInfo }) {
  const context = {
    produto: { nome: product?.name, descricao: product?.description ?? null, categoria: product?.category ?? null },
    publico_alvo: targetInfo?.publicoAlvo ?? null,
    pais_destino: targetInfo?.pais ?? null,
    palavra_chave_principal: targetInfo?.keywordPrincipal ?? null,
    palavras_chave_secundarias: targetInfo?.keywordsSecundarias ?? null,
    anuncio_google_ads: adInfo ? {
      headline: adInfo.headline ?? null,
      descricao: adInfo.description ?? null,
      cta: adInfo.cta ?? null,
    } : null,
    performance_real_pagespeed: pageSpeed ? {
      score: pageSpeed.performanceScore,
      lcp_ms: pageSpeed.largestContentfulPaintMs,
      cls: pageSpeed.cumulativeLayoutShift,
      estrategia: pageSpeed.strategy,
    } : null,
    texto_da_pagina: pageText,
  };

  const { result, model, provider } = await aiProvider.analyze({
    schema: 'landingPageAuditReport',
    systemPrompt: LP_AUDIT_SYSTEM_PROMPT,
    context,
    maxTokens: 8192, // schema mais rico que productOpportunity; 4096 ainda truncava na 1ª tentativa (2026-08-05)
  });

  const saved = await repo.recordAnalysis({
    subjectType: 'product',
    subjectId: productId,
    questionType: 'lp_audit_camada_a',
    provider,
    model,
    verdict: result.score_classification,
    confidence: result.landing_page_conversion_score >= 70 ? 'medium' : 'low', // score baixo com análise só de texto pede mais cautela
    response: result,
    reasoning: result.reasoning,
  });

  return { analysis: saved, result };
}

const LP_VISUAL_SYSTEM_PROMPT = `
Você atua como especialista em UX e CRO analisando o SCREENSHOT de uma landing page
(desktop e mobile). Diferente de uma análise de texto, aqui você está vendo a página
de verdade — avalie primeira impressão visual, hierarquia, contraste do CTA, e UX
mobile real. Não repita análise de copy/texto (isso já foi feito em outra camada) —
foque só no que é possível avaliar VENDO a página.

Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto fora do JSON,
seguindo exatamente o schema fornecido.

Regras:
- "score_visual_parcial": 0-100, reflete SÓ a dimensão visual (não é o score geral da LP).
- "primeira_impressao": o que salta aos olhos nos primeiros segundos — clareza do que
  está sendo vendido, profissionalismo do design, excesso de elementos que distraem.
- "hierarquia_visual": o CTA principal está visível sem precisar rolar a página
  (acima da dobra)? O contraste dele em relação ao fundo é bom o suficiente pra
  chamar atenção?
- "ux_mobile": baseado no screenshot mobile — legibilidade do texto, tamanho/
  espaçamento dos botões, indício de scroll excessivo antes de chegar no CTA.
- "problemas_visuais": só problemas que você consegue justificar pelo que vê nas
  imagens — não invente problema que não dá pra confirmar visualmente.
- "limitacoes_da_analise": declare qualquer coisa que não deu pra avaliar bem pela
  imagem (ex: página cortada, elemento não carregou, screenshot com qualidade baixa).
- "reasoning": no máximo 120 palavras, em português, citando o que você viu nas
  imagens especificamente — nunca genérico.
`.trim();

/**
 * Auditor de LP avançado — Camada B (visão, via screenshot desktop+mobile).
 * Complementa a Camada A (texto) — não substitui, os dois relatórios convivem
 * (ver docs/ARQUITETURA.md seção 10, item 8, decisão de 2026-08-04).
 */
async function analyzeLandingPageVisual({ productId, desktopBase64, mobileBase64, product }) {
  const context = {
    produto: { nome: product?.name, categoria: product?.category ?? null },
    nota: 'A primeira imagem é o screenshot desktop, a segunda é o screenshot mobile.',
  };

  const { result, model, provider } = await aiProvider.analyze({
    schema: 'landingPageVisualAudit',
    systemPrompt: LP_VISUAL_SYSTEM_PROMPT,
    context,
    images: [
      { base64: desktopBase64, mediaType: 'image/jpeg' },
      { base64: mobileBase64, mediaType: 'image/jpeg' },
    ],
    maxTokens: 3000,
  });

  const saved = await repo.recordAnalysis({
    subjectType: 'product',
    subjectId: productId,
    questionType: 'lp_audit_camada_b',
    provider,
    model,
    verdict: result.score_visual_parcial >= 70 ? 'boa' : result.score_visual_parcial >= 40 ? 'precisa_melhorias' : 'fraca',
    confidence: 'medium',
    response: result,
    reasoning: result.reasoning,
  });

  return { analysis: saved, result };
}

module.exports = {
  analyzeCampaignBudget,
  classifyProductCompliance,
  evaluateProductOpportunity,
  analyzeLandingPageText,
  analyzeLandingPageVisual,
  getHistory: repo.getHistory,
  getLatest: repo.getLatest,
  recordOutcome: repo.recordOutcome,
  getAccuracyStats: repo.getAccuracyStats,
};
