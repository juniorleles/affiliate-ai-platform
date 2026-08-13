const express = require('express');
const { requireAuth } = require('../../shared/auth/middleware');
const service = require('./service');

const router = express.Router();

function handleServiceError(res, err) {
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
}

// GET /api/staff/auth/status — o frontend usa isso pra decidir entre mostrar
// "login" ou "criar conta de administrador" (primeiro acesso).
router.get('/auth/status', async (req, res) => {
  const status = await service.getAuthStatus();
  res.json(status);
});

// POST /api/staff/auth/bootstrap — só funciona se NENHUM usuário existir ainda.
router.post('/auth/bootstrap', async (req, res) => {
  try {
    const result = await service.bootstrapFirstUser(req.body || {});
    res.status(201).json(result);
  } catch (err) { handleServiceError(res, err); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const result = await service.login(req.body || {});
    res.json(result);
  } catch (err) { handleServiceError(res, err); }
});

// --- Gestão de usuários (só administrador) ---

router.get('/users', requireAuth('administrador'), async (req, res) => {
  const users = await service.listUsers();
  res.json({ users });
});

router.post('/users', requireAuth('administrador'), async (req, res) => {
  try {
    const user = await service.createUserByAdmin(req.body || {});
    res.status(201).json({ user });
  } catch (err) { handleServiceError(res, err); }
});

router.patch('/users/:id', requireAuth('administrador'), async (req, res) => {
  try {
    const user = await service.updateUserByAdmin(req.params.id, req.body || {});
    res.json({ user });
  } catch (err) { handleServiceError(res, err); }
});

module.exports = router;
