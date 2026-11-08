const restaurantService = require('../services/restaurantService');
const menuService = require('../services/menuService');
const reviewService = require('../services/reviewService');
const { saveImage } = require('../middleware/upload');

exports.list = async (req, res) => {
  res.json({ success: true, ...(await restaurantService.list(req.validQuery, req.user)) });
};

exports.cuisines = async (req, res) => {
  res.json({ success: true, data: await restaurantService.listCuisines() });
};

exports.get = async (req, res) => {
  res.json({ success: true, data: await restaurantService.getById(req.params.id, req.user) });
};

exports.create = async (req, res) => {
  const imageUrl = await saveImage(req.file, req.user.id);
  const restaurant = await restaurantService.create({ ...req.body, imageUrl }, req.user);
  res.status(201).json({ success: true, data: restaurant });
};

exports.update = async (req, res) => {
  const imageUrl = await saveImage(req.file, req.user.id);
  const restaurant = await restaurantService.update(req.params.id, { ...req.body, imageUrl }, req.user);
  res.json({ success: true, data: restaurant });
};

exports.remove = async (req, res) => {
  res.json({ success: true, ...(await restaurantService.remove(req.params.id)) });
};

exports.menuItems = async (req, res) => {
  res.json({ success: true, ...(await menuService.listItems(req.params.id, req.validQuery, req.user)) });
};

exports.reviews = async (req, res) => {
  res.json({ success: true, ...(await reviewService.listByRestaurant(req.params.id, req.validQuery, req.user)) });
};
