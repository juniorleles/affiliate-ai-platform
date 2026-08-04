const jwt = require('jsonwebtoken');

// NOTA: continua usando ADMIN_KEY simples (single-user), como no MVP anterior.
// Trocar por autenticação de usuário completa (tabela `users`, já existe na migration
// 001) quando a decisão da seção 9 do docs/ARQUITETURA.md ("single-user ou multi-user?")
// for confirmada como multi-user.

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Acesso admin não autorizado.' });
  }
  next();
}

function requireAffiliate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
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

module.exports = { requireAdmin, requireAffiliate, requireInternal };
