const jwt = require('jsonwebtoken');

const EXPIRES_IN = '12h';

function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function verifyUserToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signUserToken, verifyUserToken };
