const jwt = require('jsonwebtoken');
const { verifyUserToken } = require('./tokens');

// Hierarquia de perfil (2026-08-05) — usada por requireAuth(minRole). Quanto
// maior o número, mais acesso. Sem enum no banco (mesmo padrão do projeto),
// a hierarquia vive só aqui.
const ROLE_RANK = { visualizador: 0, operador: 1, gerente: 2, administrador: 3 };

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

/**
 * Novo middleware de autenticação por perfil (2026-08-05). Uso:
 * router.get('/rota', requireAuth('gerente'), handler) — exige perfil
 * "gerente" ou superior (administrador também passa; operador/visualizador não).
 */
function requireAuth(minRole = 'visualizador') {
  return (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Token não informado.' });

    try {
      const payload = verifyUserToken(token);
      const userRank = ROLE_RANK[payload.role] ?? -1;
      const neededRank = ROLE_RANK[minRole] ?? 0;
      if (userRank < neededRank) {
        return res.status(403).json({ error: `Acesso negado — requer perfil "${minRole}" ou superior.` });
      }
      req.user = payload;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
  };
}

/**
 * Retrocompatível de propósito (2026-08-05): continua aceitando a ADMIN_KEY
 * antiga (nenhuma rota existente precisa mudar), e AGORA também aceita um
 * token JWT de usuário com perfil "administrador". As duas formas convivem —
 * migrar as rotas existentes pra JWT-only é decisão separada, não forçada
 * nesta mudança (risco desnecessário mexer em tudo de uma vez).
 */
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key && key === process.env.ADMIN_KEY) return next();

  const token = extractBearerToken(req);
  if (token) {
    try {
      const payload = verifyUserToken(token);
      if (payload.role === 'administrador') {
        req.user = payload;
        return next();
      }
    } catch (err) {
      // cai no 401 abaixo
    }
  }

  return res.status(401).json({ error: 'Acesso admin não autorizado (ADMIN_KEY ou token de administrador).' });
}

function requireAffiliate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Token não informado.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.affiliateId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Protege rotas internas chamadas pelo n8n (webhooks de orquestração — ver seção 5).
// Usa a mesma ADMIN_KEY por simplicidade no estágio atual; considerar um segredo
// separado (INTERNAL_JOBS_KEY) se o n8n for exposto além da rede local.
function requireInternal(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Chamada interna não autorizada.' });
  }
  next();
}

module.exports = { requireAdmin, requireAuth, requireAffiliate, requireInternal, ROLE_RANK };
