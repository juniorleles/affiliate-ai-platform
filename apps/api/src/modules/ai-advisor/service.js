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

module.exports = {
  analyzeCampaignBudget,
  classifyProductCompliance,
  evaluateProductOpportunity,
  getHistory: repo.getHistory,
  getLatest: repo.getLatest,
  recordOutcome: repo.recordOutcome,
  getAccuracyStats: repo.getAccuracyStats,
};
