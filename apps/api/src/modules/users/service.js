const repo = require('./repository');
const { hashPassword, verifyPassword } = require('../../shared/auth/passwords');
const { signUserToken } = require('../../shared/auth/tokens');

const VALID_ROLES = ['administrador', 'gerente', 'operador', 'visualizador'];

/**
 * Se não existir NENHUM usuário ainda, permite criar o primeiro — sempre
 * como 'administrador', ignorando qualquer role pedido no body (você não
 * pode se auto-rebaixar no bootstrap). Depois do primeiro usuário, este
 * endpoint sempre recusa — só um administrador já autenticado pode criar
 * mais gente (routes.js).
 */
async function bootstrapFirstUser({ email, password, name }) {
  const existing = await repo.countUsers();
  if (existing > 0) {
    throw Object.assign(new Error('Já existe usuário cadastrado — use o login normal ou peça a um administrador pra te cadastrar.'), { status: 409 });
  }
  if (!email || !password) {
    throw Object.assign(new Error('email e password são obrigatórios.'), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error('Senha precisa de pelo menos 8 caracteres.'), { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const user = await repo.createUser({ email, passwordHash, name, role: 'administrador' });
  const token = signUserToken(user);
  return { user, token };
}

async function login({ email, password }) {
  if (!email || !password) {
    throw Object.assign(new Error('email e password são obrigatórios.'), { status: 400 });
  }

  const user = await repo.findByEmail(email);
  if (!user || !user.is_active) {
    throw Object.assign(new Error('E-mail ou senha inválidos.'), { status: 401 });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    throw Object.assign(new Error('E-mail ou senha inválidos.'), { status: 401 });
  }

  const token = signUserToken(user);
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
}

async function getAuthStatus() {
  const count = await repo.countUsers();
  return { hasUsers: count > 0 };
}

async function createUserByAdmin({ email, password, name, role }) {
  if (!email || !password) {
    throw Object.assign(new Error('email e password são obrigatórios.'), { status: 400 });
  }
  if (role && !VALID_ROLES.includes(role)) {
    throw Object.assign(new Error(`role inválido. Use um de: ${VALID_ROLES.join(', ')}`), { status: 400 });
  }
  const existing = await repo.findByEmail(email);
  if (existing) {
    throw Object.assign(new Error('Já existe usuário com esse e-mail.'), { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  return repo.createUser({ email, passwordHash, name, role: role || 'visualizador' });
}

async function updateUserByAdmin(id, { role, isActive, name }) {
  if (role && !VALID_ROLES.includes(role)) {
    throw Object.assign(new Error(`role inválido. Use um de: ${VALID_ROLES.join(', ')}`), { status: 400 });
  }
  const updated = await repo.updateUser(id, { role, isActive, name });
  if (!updated) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
  return updated;
}

module.exports = {
  bootstrapFirstUser,
  login,
  getAuthStatus,
  createUserByAdmin,
  updateUserByAdmin,
  listUsers: repo.listUsers,
  VALID_ROLES,
};
