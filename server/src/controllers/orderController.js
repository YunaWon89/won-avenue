const orderService = require('../services/orderService');
const reviewService = require('../services/reviewService');
const paymentService = require('../services/paymentService');

// ----- orders -----
exports.createMany = async (req, res) => {
  res.status(201).json({ success: true, data: await orderService.createMany(req.user, req.body) });
};

exports.create = async (req, res) => {
  res.status(201).json({ success: true, data: await orderService.create(req.user, req.body) });
};
exports.list = async (req, res) => {
  res.json({ success: true, ...(await orderService.list(req.validQuery, req.user)) });
};
exports.get = async (req, res) => {
  res.json({ success: true, data: await orderService.getById(req.params.id, req.user) });
};
exports.claim = async (req, res) => {
  res.json({ success: true, data: await orderService.claim(req.params.id, req.user) });
};
exports.updateStatus = async (req, res) => {
  res.json({ success: true, data: await orderService.updateStatus(req.params.id, req.body.status, req.user) });
};

// ----- reviews -----
exports.createReview = async (req, res) => {
  res.status(201).json({ success: true, data: await reviewService.create(req.user, req.body, req.files || []) });
};
exports.listReviews = async (req, res) => {
  res.json({ success: true, ...(await reviewService.listAll(req.validQuery)) });
};
exports.moderateReview = async (req, res) => {
  res.json({ success: true, data: await reviewService.moderate(req.params.id, req.body.isApproved) });
};

// ----- saved cards -----
exports.listCards = async (req, res) => {
  res.json({ success: true, data: await paymentService.listMethods(req.user.id) });
};
exports.addCard = async (req, res) => {
  res.status(201).json({ success: true, data: await paymentService.addMethod(req.user, req.body) });
};
exports.setDefaultCard = async (req, res) => {
  await paymentService.setDefault(req.user.id, req.params.id);
  res.json({ success: true, data: await paymentService.listMethods(req.user.id) });
};
exports.removeCard = async (req, res) => {
  await paymentService.removeMethod(req.user.id, req.params.id);
  res.json({ success: true, message: 'Card removed' });
};
exports.paymentConfig = (req, res) => res.json({ success: true, data: paymentService.publicConfig(req.user) });
