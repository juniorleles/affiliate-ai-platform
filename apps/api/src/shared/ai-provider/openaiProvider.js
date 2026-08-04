const OpenAI = require('openai');

// NOTA: adapter existe pra cumprir o requisito do documento original (Claude + OpenAI),
// mas por padrão o sistema usa só o Claude (DEFAULT_AI_PROVIDER=claude no .env) — ver
// decisão em aberto na seção 9 do docs/ARQUITETURA.md sobre o motivo real de manter os
// dois (redundância vs. tarefas diferentes). Só ativar isso rodando com
// OPENAI_API_KEY configurada e DEFAULT_AI_PROVIDER=openai, ou passando { provider:
// 'openai' } explicitamente em uma chamada de analyze().
const DEFAULT_MODEL = 'gpt-4o';

let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada no .env.');
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

async function complete({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 800 }) {
  const response = await getClient().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = response.choices?.[0]?.message?.content || '';
  return { text, model, provider: 'openai' };
}

module.exports = { complete, DEFAULT_MODEL };
