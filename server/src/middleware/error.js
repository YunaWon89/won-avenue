const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

// Consistent error format: { success: false, message, code?, errors? }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    const tooMany = err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE';
    error = ApiError.badRequest(tooLarge ? 'File is too large (max 2 MB)' : tooMany ? 'Too many photos (max 3)' : err.message, {
      code: tooLarge ? 'FILE_TOO_LARGE' : tooMany ? 'TOO_MANY_PHOTOS' : 'UPLOAD_ERROR',
    });
  } else if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body', { code: 'INVALID_JSON' });
  } else if (err.code === '23505') {
    error = ApiError.conflict('Resource already exists', { code: 'DUPLICATE' });
  } else if (err.code === '23503') {
    error = ApiError.conflict('Related resource is missing or still in use', { code: 'FOREIGN_KEY' });
  } else if (err.code === '22P02' || err.code === '23514') {
    error = ApiError.badRequest('Invalid input value', { code: 'INVALID_INPUT' });
  }

  if (!(error instanceof ApiError)) {
    if (env.nodeEnv !== 'test') console.error(err);
    error = new ApiError(500, env.isProd ? 'Internal server error' : err.message || 'Internal server error', {
      code: 'INTERNAL_ERROR',
    });
  }

  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.errors) body.errors = error.errors;
  if (err.restaurantId) body.restaurantId = err.restaurantId; // multi-restaurant checkout: which part failed
  res.status(error.status).json(body);
}

module.exports = { notFound, errorHandler };
