const Anthropic = require('@anthropic-ai/sdk');

// Sonnet é o equilíbrio custo/qualidade padrão. Trocar para 'claude-haiku-4-5-20251001'
// em tarefas de alto volume e baixo risco, ou 'claude-opus-4-8' em decisões de maior
// impacto financeiro (ex: aprovar orçamento inicial alto para um produto novo).
const DEFAULT_MODEL = 'claude-sonnet-5';

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada no .env.');
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function complete({ systemPrompt, userPrompt, model = DEFAULT_MODEL, maxTokens = 800, images }) {
  // `images`: array de { base64, mediaType } — usado pela Camada B do Auditor de LP
  // (5.4), a única parte do sistema que envia imagem em vez de só texto.
  const content = [];
  if (images?.length) {
    for (const img of images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 },
      });
    }
  }
  content.push({ type: 'text', text: userPrompt });

  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  return { text, model, provider: 'claude' };
}

module.exports = { complete, DEFAULT_MODEL };
