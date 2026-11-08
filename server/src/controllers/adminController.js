const userService = require('../services/userService');

exports.listUsers = async (req, res) => {
  res.json({ success: true, ...(await userService.list(req.validQuery)) });
};
exports.getUser = async (req, res) => {
  res.json({ success: true, data: await userService.getById(req.params.id) });
};
exports.createUser = async (req, res) => {
  res.status(201).json({ success: true, data: await userService.create(req.body) });
};
exports.updateUser = async (req, res) => {
  res.json({ success: true, data: await userService.adminUpdate(req.params.id, req.body, req.user) });
};
exports.stats = async (req, res) => {
  res.json({ success: true, data: await userService.stats() });
};
