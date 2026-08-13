const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const claudeProvider = require('./claudeProvider');
const openaiProvider = require('./openaiProvider');
const { withContext } = require('../logger');

const log = withContext('ai-provider');
const ajv = new Ajv({ allErrors: true });

const PROVIDERS = { claude: claudeProvider, openai: openaiProvider };

function loadSchema(schemaName) {
  const schemaPath = path.join(__dirname, 'schemas', `${schemaName}.schema.json`);
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw);
}

function cleanJsonText(text) {
  let cleaned = text.replace(/```json|```/g, '').trim();

  // Se ainda sobrar texto antes/depois do objeto JSON (a IA às vezes escreve uma
  // frase de preâmbulo mesmo sendo instruída a não fazer isso), extrai só o miolo
  // entre a primeira { e a última } — mais tolerante que exigir o texto inteiro
  // já vir limpo. Achado real em 2026-08-05, schema landingPageAuditReport.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace > 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/**
 * Chama a IA para uma tarefa estruturada e garante que a resposta bate com o schema
 * esperado antes de devolver. Se não bater, tenta 1 retry pedindo correção; se falhar
 * de novo, lança erro — nunca devolve/serve um payload fora do formato esperado.
 *
 * @param {object} params
 * @param {string} params.schema - nome do schema em ./schemas (sem extensão)
 * @param {string} params.systemPrompt - instruções fixas da tarefa
 * @param {object} params.context - dados da análise (será serializado como JSON no prompt)
 * @param {'claude'|'openai'} [params.provider] - default: process.env.DEFAULT_AI_PROVIDER
 * @param {string} [params.model] - override do modelo padrão do provider
 * @param {number} [params.maxTokens] - override do limite de tokens de saída. Schemas
 *   maiores (ex: productOpportunity, com 2 arrays + reasoning longo) precisam de mais
 *   espaço que um veredito simples — passar explícito por chamada evita pagar o custo
 *   de um limite alto em toda chamada só porque uma precisa (ver docs/ARQUITETURA.md,
 *   incidente de truncamento de 2026-08-04).
 * @param {Array<{base64: string, mediaType?: string}>} [params.images] - imagens
 *   (screenshot) pra análise visual — só suportado no provider Claude por ora
 *   (única parte do sistema que usa isso é a Camada B do Auditor de LP, 5.4).
 */
async function analyze({ schema, systemPrompt, context, provider, model, maxTokens, images }) {
  const schemaDef = loadSchema(schema);
  const validate = ajv.compile(schemaDef);

  const providerName = provider || process.env.DEFAULT_AI_PROVIDER || 'claude';
  const adapter = PROVIDERS[providerName];
  if (!adapter) throw new Error(`Provider de IA desconhecido: ${providerName}`);

  const userPrompt = JSON.stringify(context);

  // Achado real (2026-08-11, seguindo o Roteiro de Teste — Camada A do
  // Auditor de LP falhou com 7 campos obrigatórios ausentes na resposta):
  // o schema JSON nunca era mandado pro modelo, só usado pra VALIDAR a
  // resposta depois — a IA tinha que adivinhar o formato exato só pela
  // prosa do systemPrompt, que pode ficar desatualizada em relação ao
  // schema real (e ficou, nesse caso: 6 campos obrigatórios do schema nunca
  // eram mencionados no prompt). Corrigido de forma sistêmica, não só pra
  // esse prompt: o schema completo agora vai junto em TODA chamada, pra
  // qualquer um dos 7 schemas do projeto, não só o que quebrou — elimina
  // essa categoria de bug em vez de remendar 1 ocorrência.
  const schemaInstruction = `\n\nFormato de resposta EXIGIDO (JSON Schema, siga exatamente — todo campo ` +
    `listado em "required" é obrigatório, "additionalProperties: false" significa que nenhum campo ` +
    `fora do schema pode aparecer):\n${JSON.stringify(schemaDef)}`;

  async function callAndValidate(extraInstruction) {
    const finalSystemPrompt = `${systemPrompt}${schemaInstruction}${extraInstruction ? `\n\n${extraInstruction}` : ''}`;
    const { text, model: usedModel, provider: usedProvider } = await adapter.complete({
      systemPrompt: finalSystemPrompt,
      userPrompt,
      model,
      maxTokens,
      images,
    });

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch (err) {
      throw new Error(`Resposta da IA não é um JSON válido: ${text.slice(0, 200)}`);
    }

    if (!validate(parsed)) {
      const errors = ajv.errorsText(validate.errors, { separator: '; ' });
      throw new Error(`Resposta da IA não bate com o schema "${schema}": ${errors}`);
    }

    return { result: parsed, model: usedModel, provider: usedProvider };
  }

  try {
    return await callAndValidate();
  } catch (firstErr) {
    log.warn('Primeira tentativa falhou, tentando 1 retry com correção', { error: firstErr.message });
    try {
      // Achado real (2026-08-11): o retry mandava só "tente de novo", sem
      // dizer QUAIS campos faltaram — a IA repetia o mesmo erro, porque não
      // sabia o que tinha errado. Corrigido: o retry agora cita o erro real
      // do AJV (`firstErr.message`, que já inclui os campos ausentes/extras
      // específicos), não uma instrução genérica.
      return await callAndValidate(
        `Sua resposta anterior falhou nesta validação exata: "${firstErr.message}". ` +
        `Corrija especificamente esses campos e responda de novo, SOMENTE com o objeto ` +
        `JSON válido, sem nenhum texto fora dele.`
      );
    } catch (secondErr) {
      log.error('Retry também falhou', { error: secondErr.message });
      throw secondErr;
    }
  }
}

module.exports = { analyze };
