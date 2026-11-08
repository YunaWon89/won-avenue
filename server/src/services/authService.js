const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const userService = require('./userService');

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

/**
 * Public registration creates a customer, or a restaurant owner ("manager")
 * who can then submit a restaurant for admin approval. Admins are never self-registered.
 */
async function register({ accountType, ...dto }) {
  const role = ['manager', 'courier'].includes(accountType) ? accountType : 'customer';
  const user = await userService.create({ ...dto, role });
  return { user, token: signToken(user) };
}

// Pre-computed hash so that unknown emails take as long as wrong passwords (timing-safe).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

async function login({ email, password }) {
  const record = await userService.findByEmailWithHash(email);
  const ok = await bcrypt.compare(password, record ? record.passwordHash : DUMMY_HASH);
  // Same message for unknown email and wrong password (no user enumeration).
  if (!record || !ok) throw ApiError.unauthorized('Invalid email or password', { code: 'INVALID_CREDENTIALS' });
  if (!record.isActive) throw ApiError.forbidden('Account is deactivated', { code: 'ACCOUNT_DISABLED' });
  const { passwordHash, ...user } = record;
  return { user, token: signToken(user) };
}

module.exports = { register, login, signToken };
