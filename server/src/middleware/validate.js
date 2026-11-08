const ApiError = require('../utils/ApiError');

const formatIssues = (issues) => issues.map((i) => ({ field: i.path.join('.'), message: i.message }));

/**
 * Validate request parts against Zod schemas (our DTOs).
 * Parsed values are written to req.body, req.params and req.validQuery
 * (in Express 5 req.query is read-only).
 */
const validate = ({ body, query, params } = {}) => (req, res, next) => {
  const errors = [];
  const run = (schema, value, assign) => {
    if (!schema) return;
    const result = schema.safeParse(value ?? {});
    if (result.success) assign(result.data);
    else errors.push(...formatIssues(result.error.issues));
  };
  run(params, req.params, (v) => { req.params = v; });
  run(query, req.query, (v) => { req.validQuery = v; });
  run(body, req.body, (v) => { req.body = v; });
  if (errors.length) return next(ApiError.badRequest('Validation failed', { code: 'VALIDATION_ERROR', errors }));
  next();
};

module.exports = validate;
