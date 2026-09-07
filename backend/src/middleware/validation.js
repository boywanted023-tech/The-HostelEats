const Joi = require('joi');
const { errorResponse } = require('../utils/helpers');

const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  if (error) {
    const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
    return errorResponse(res, 'Validation failed', 400, errors);
  }
  if (source === 'body') req.body = value;
  else if (source === 'query') req.validatedQuery = value;
  else req.validatedParams = value;
  next();
};

const validateBody = (schema) => validate(schema, 'body');
const validateQuery = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

const objectIdParam = Joi.object({
  id: Joi.string().hex().length(24).required()
});

module.exports = { validate, validateBody, validateQuery, validateParams, objectIdParam };