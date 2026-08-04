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
  return text.replace(/```json|```/g, '').trim();
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
 */
async function analyze({ schema, systemPrompt, context, provider, model }) {
  const schemaDef = loadSchema(schema);
  const validate = ajv.compile(schemaDef);

  const providerName = provider || process.env.DEFAULT_AI_PROVIDER || 'claude';
  const adapter = PROVIDERS[providerName];
  if (!adapter) throw new Error(`Provider de IA desconhecido: ${providerName}`);

  const userPrompt = JSON.stringify(context);

  async function callAndValidate(extraInstruction) {
    const finalSystemPrompt = extraInstruction ? `${systemPrompt}\n\n${extraInstruction}` : systemPrompt;
    const { text, model: usedModel, provider: usedProvider } = await adapter.complete({
      systemPrompt: finalSystemPrompt,
      userPrompt,
      model,
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
      return await callAndValidate(
        'Sua resposta anterior não seguiu o formato JSON exigido. Responda novamente, ' +
        'SOMENTE com o objeto JSON válido, sem nenhum texto fora dele.'
      );
    } catch (secondErr) {
      log.error('Retry também falhou', { error: secondErr.message });
      throw secondErr;
    }
  }
}

module.exports = { analyze };
