// Logger simples e centralizado. Trocar por 'pino' se o volume de logs justificar
// mais estrutura (JSON logs, níveis configuráveis por env) — por ora, console
// estruturado é suficiente pro estágio da plataforma.

function withContext(context) {
  return {
    info: (msg, meta) => console.log(`[${context}] ${msg}`, meta ?? ''),
    warn: (msg, meta) => console.warn(`[${context}] ${msg}`, meta ?? ''),
    error: (msg, meta) => console.error(`[${context}] ${msg}`, meta ?? ''),
  };
}

module.exports = { withContext };
