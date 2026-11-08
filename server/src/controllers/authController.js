const env = require('../config/env');
const authService = require('../services/authService');
const userService = require('../services/userService');

const COOKIE = 'token';
const cookieOptions = () => ({
  httpOnly: true, // not readable from JS -> protects the session from XSS
  secure: env.isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

exports.register = async (req, res) => {
  const { user, token } = await authService.register(req.body);
  res.cookie(COOKIE, token, cookieOptions()).status(201).json({ success: true, data: user, token });
};

exports.login = async (req, res) => {
  const { user, token } = await authService.login(req.body);
  res.cookie(COOKIE, token, cookieOptions()).json({ success: true, data: user, token });
};

exports.logout = (req, res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(COOKIE, opts).json({ success: true, message: 'Logged out' });
};

exports.me = (req, res) => res.json({ success: true, data: req.user });

exports.updateMe = async (req, res) => {
  res.json({ success: true, data: await userService.updateProfile(req.user.id, req.body) });
};

exports.changePassword = async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  res.json({ success: true, message: 'Password changed' });
};
