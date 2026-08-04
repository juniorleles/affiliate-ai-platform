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

module.exports = {
  analyzeCampaignBudget,
  getHistory: repo.getHistory,
  getLatest: repo.getLatest,
};
