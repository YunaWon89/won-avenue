const menuService = require('../services/menuService');
const { saveImage } = require('../middleware/upload');

exports.createCategory = async (req, res) => {
  res.status(201).json({ success: true, data: await menuService.createCategory(req.body, req.user) });
};

exports.updateCategory = async (req, res) => {
  res.json({ success: true, data: await menuService.updateCategory(req.params.id, req.body, req.user) });
};

exports.deleteCategory = async (req, res) => {
  await menuService.deleteCategory(req.params.id, req.user);
  res.json({ success: true, message: 'Category deleted' });
};

exports.getItem = async (req, res) => {
  res.json({ success: true, data: await menuService.findItem(req.params.id) });
};

exports.createItem = async (req, res) => {
  const imageUrl = await saveImage(req.file, req.user.id);
  res.status(201).json({ success: true, data: await menuService.createItem({ ...req.body, imageUrl }, req.user) });
};

exports.updateItem = async (req, res) => {
  const imageUrl = await saveImage(req.file, req.user.id);
  res.json({ success: true, data: await menuService.updateItem(req.params.id, { ...req.body, imageUrl }, req.user) });
};

exports.deleteItem = async (req, res) => {
  await menuService.deleteItem(req.params.id, req.user);
  res.json({ success: true, message: 'Menu item deleted' });
};
