/**
 * Sub-scores determinísticos de oportunidade (Módulo 2). Função pura — sem
 * SQL, sem HTTP, 100% testável. A IA entra depois, só pra julgar o que não é
 * redutível a fórmula (ver docs/ARQUITETURA.md, seção 1, princípio "calculável
 * primeiro, IA depois").
 *
 * trend_score e seasonality_score não são calculados aqui — não temos fonte de
 * dado de tendência integrada ainda (nenhuma API de trends foi conectada).
 * Ficam null até isso existir; não inventamos número pra preencher a lacuna.
 */

function computeDemandScore(avgMonthlySearches) {
  if (avgMonthlySearches == null) return null;
  if (avgMonthlySearches <= 0) return 0;
  // Escala logarítmica: 100 buscas/mês ~20, 10 mil ~60, 450 mil ~90+
  return Math.max(0, Math.min(100, Math.round(20 * Math.log10(avgMonthlySearches + 1))));
}

function computeCompetitionScore(competitionLevel, competitionIndex) {
  if (competitionIndex != null) return Math.max(0, Math.min(100, 100 - competitionIndex));
  const map = { low: 80, medium: 50, high: 20 };
  return competitionLevel ? (map[competitionLevel] ?? null) : null;
}

function computeEconomicsScore(status) {
  if (!status) return null;
  const map = {
    viavel: 75,
    rejeitado_por_economics: 25, // rejeitado mas não catastrófico — pode ser questão de keyword/margem, não do produto em si
    rejeitado_por_comissao_minima: 0,
    dado_insuficiente: null,
    erro_avaliacao: null,
  };
  return map[status] ?? null;
}

function computeLpQualityScore({ hasCta, hasVsl, affiliateParamsPreserved } = {}) {
  if (hasCta == null && hasVsl == null && affiliateParamsPreserved == null) return null;
  let score = 40;
  if (hasCta) score += 20;
  if (hasVsl) score += 15;
  if (affiliateParamsPreserved === true) score += 25;
  if (affiliateParamsPreserved === false) score -= 40; // parâmetro quebrado é grave, penalidade forte
  return Math.max(0, Math.min(100, score));
}

/**
 * Combina os sub-scores disponíveis numa média ponderada, ignorando os que
 * são null (sem inventar valor pra lacuna de dado). Retorna null se não
 * houver NENHUM sub-score disponível.
 */
function computeOverallScore({ demand, competition, economics, lpQuality } = {}) {
  const weights = { demand: 0.25, competition: 0.20, economics: 0.35, lpQuality: 0.20 };
  const values = { demand, competition, economics, lpQuality };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(weights)) {
    if (values[key] != null) {
      weightedSum += values[key] * weights[key];
      totalWeight += weights[key];
    }
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

module.exports = {
  computeDemandScore,
  computeCompetitionScore,
  computeEconomicsScore,
  computeLpQualityScore,
  computeOverallScore,
};
