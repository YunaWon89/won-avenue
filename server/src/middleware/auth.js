const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const userService = require('../services/userService');

function extractToken(req) {
  if (req.cookies?.token) return req.cookies.token;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Session expired or token is invalid', { code: 'INVALID_TOKEN' });
  }
  const user = await userService.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists', { code: 'INVALID_TOKEN' });
  if (!user.isActive) throw ApiError.forbidden('Account is deactivated', { code: 'ACCOUNT_DISABLED' });
  return user;
}

/** Requires a valid JWT (httpOnly cookie or Bearer header). */
const authenticate = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (!user) throw ApiError.unauthorized();
    req.user = user;
    next();
  } catch (err) { next(err); }
};

/** Attaches req.user when a valid token is present, otherwise continues as guest. */
const optionalAuth = async (req, res, next) => {
  try {
    req.user = await resolveUser(req);
  } catch {
    req.user = null;
  }
  next();
};

/** Role guard: allow only listed roles. Must be used after authenticate. */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

module.exports = { authenticate, optionalAuth, requireRole };
