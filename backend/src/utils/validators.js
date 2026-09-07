const Joi = require('joi');
const { ROLES, HOSTEL_BLOCKS, CATEGORIES, SPICE_LEVELS, PAYMENT_METHODS } = require('./constants');

const objectId = Joi.string().hex().length(24).messages({
  'string.hex': 'Invalid id format',
  'string.length': 'Invalid id length'
});

const password = Joi.string()
  .min(6)
  .max(128)
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[0-9]/, 'digit')
  .required()
  .messages({
    'string.min': 'Password must be at least 6 characters',
    'string.pattern.name': 'Password must include {#name} character'
  });

const phone = Joi.string()
  .pattern(/^[0-9]{10}$/)
  .required()
  .messages({ 'string.pattern.base': 'Phone must be a 10-digit number' });

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password,
  phone,
  role: Joi.string().valid(...Object.values(ROLES)).default('customer')
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const twoFactorSchema = Joi.object({
  token: Joi.string().length(6).pattern(/^[0-9]+$/).required()
});

const orderSchema = Joi.object({
  vendorId: objectId.required(),
  items: Joi.array().items(
    Joi.object({
      menuItemId: objectId.required(),
      quantity: Joi.number().integer().min(1).max(50).required()
    })
  ).min(1).required(),
  deliveryAddress: Joi.object({
    block:      Joi.string().valid(...HOSTEL_BLOCKS).required(),
    floor:      Joi.string().trim().max(10).required(),
    roomNumber: Joi.string().trim().max(20).required(),
    landmark:   Joi.string().trim().max(100).allow('').default('')
  }).required(),
  paymentMethod:        Joi.string().valid(...PAYMENT_METHODS).required(),
  specialInstructions:  Joi.string().max(200).allow('').default('')
});

const orderStatusSchema = Joi.object({
  status: Joi.string().valid('Confirmed', 'Preparing', 'Ready', 'Picked', 'Delivered', 'Cancelled').required(),
  note:   Joi.string().max(200).allow('').default('')
});

const menuItemSchema = Joi.object({
  name:            Joi.string().trim().min(2).max(80).required(),
  description:     Joi.string().max(300).allow('').default(''),
  price:           Joi.number().min(0).required(),
  category:        Joi.string().valid(...CATEGORIES).required(),
  preparationTime: Joi.number().integer().min(1).max(120).required(),
  isVeg:           Joi.boolean().default(true),
  spiceLevel:      Joi.string().valid(...SPICE_LEVELS).default('Mild'),
  isAvailable:     Joi.boolean().default(true)
});

const vendorSchema = Joi.object({
  shopName:     Joi.string().trim().min(2).max(50).required(),
  description:  Joi.string().max(500).required(),
  hostelBlock:  Joi.string().valid(...HOSTEL_BLOCKS).required(),
  openingTime:  Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  closingTime:  Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required()
});

const profileSchema = Joi.object({
  name:  Joi.string().trim().min(2).max(50),
  phone: phone.optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().min(6).max(128).optional()
}).min(1);

const ratingSchema = Joi.object({
  rating:   Joi.number().min(1).max(5).required(),
  feedback: Joi.string().max(500).allow('').default('')
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  if (error) {
    const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }
  req.body = value;
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  refreshSchema,
  twoFactorSchema,
  orderSchema,
  orderStatusSchema,
  menuItemSchema,
  vendorSchema,
  profileSchema,
  ratingSchema
};