const { body, param, query, validationResult } = require('express-validator');
const { USER_ROLES, REPORT_TYPES, ALERT_TYPES, ALERT_SEVERITY } = require('../config/constants');
const Helpers = require('../utils/helpers');

// Common validation rules
const commonValidators = {
    email: body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    password: body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    
    name: body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    phone: body('phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^(\+?265|0)(\d{9}|\d{8})$/).withMessage('Please provide a valid Malawi phone number'),
    
    role: body('role')
        .optional()
        .isIn(Object.values(USER_ROLES)).withMessage('Invalid role'),
    
    currentPassword: body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    
    newPassword: body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    
    confirmPassword: body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Passwords do not match');
            }
            return true;
        })
};

// Sensor data validation
const sensorDataValidators = [
    body('voltage')
        .optional()
        .isFloat({ min: 0, max: 50 }).withMessage('Voltage must be between 0 and 50V'),
    
    body('current')
        .optional()
        .isFloat({ min: 0, max: 30 }).withMessage('Current must be between 0 and 30A'),
    
    body('temperature')
        .optional()
        .isFloat({ min: -20, max: 100 }).withMessage('Temperature must be between -20°C and 100°C'),
    
    body('deviceId')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Device ID must be between 1 and 50 characters'),
    
    body('batteryLevel')
        .optional()
        .isFloat({ min: 0, max: 100 }).withMessage('Battery level must be between 0% and 100%')
];

// Alert validation
const alertValidators = [
    body('type')
        .notEmpty().withMessage('Alert type is required')
        .isIn(Object.values(ALERT_TYPES)).withMessage('Invalid alert type'),
    
    body('severity')
        .notEmpty().withMessage('Alert severity is required')
        .isIn(Object.values(ALERT_SEVERITY)).withMessage('Invalid alert severity'),
    
    body('title')
        .trim()
        .notEmpty().withMessage('Alert title is required')
        .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
    
    body('message')
        .trim()
        .notEmpty().withMessage('Alert message is required')
        .isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters'),
    
    body('sensorValue')
        .optional()
        .isFloat().withMessage('Sensor value must be a number'),
    
    body('threshold')
        .optional()
        .isFloat().withMessage('Threshold must be a number'),
    
    body('unit')
        .optional()
        .trim()
        .isLength({ max: 10 }).withMessage('Unit must be at most 10 characters')
];

// Report validation
const reportValidators = [
    body('type')
        .notEmpty().withMessage('Report type is required')
        .isIn(Object.values(REPORT_TYPES)).withMessage('Invalid report type'),
    
    body('format')
        .optional()
        .isIn(['pdf', 'excel', 'csv', 'json']).withMessage('Invalid report format'),
    
    body('startDate')
        .optional()
        .isISO8601().withMessage('Start date must be a valid date')
        .toDate(),
    
    body('endDate')
        .optional()
        .isISO8601().withMessage('End date must be a valid date')
        .toDate()
        .custom((value, { req }) => {
            if (req.body.startDate && value < req.body.startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    body('emailRecipients')
        .optional()
        .isArray().withMessage('Email recipients must be an array')
        .custom((emails) => {
            if (emails) {
                emails.forEach(email => {
                    if (!Helpers.isValidEmail(email)) {
                        throw new Error(`Invalid email: ${email}`);
                    }
                });
            }
            return true;
        })
];

// Query parameter validation
const queryValidators = {
    page: query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    limit: query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    days: query('days')
        .optional()
        .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
        .toInt(),
    
    startDate: query('startDate')
        .optional()
        .isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    
    endDate: query('endDate')
        .optional()
        .isISO8601().withMessage('End date must be a valid ISO 8601 date')
        .custom((value, { req }) => {
            if (req.query.startDate && value < req.query.startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    deviceId: query('deviceId')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Device ID must be between 1 and 50 characters'),
    
    status: query('status')
        .optional()
        .isIn(['active', 'resolved', 'acknowledged', 'unacknowledged'])
        .withMessage('Status must be active, resolved, acknowledged, or unacknowledged'),
    
    severity: query('severity')
        .optional()
        .isIn(Object.values(ALERT_SEVERITY)).withMessage('Invalid severity level'),
    
    type: query('type')
        .optional()
        .isIn([...Object.values(ALERT_TYPES), ...Object.values(REPORT_TYPES)])
        .withMessage('Invalid type'),
    
    format: query('format')
        .optional()
        .isIn(['pdf', 'excel', 'csv', 'json', 'html']).withMessage('Invalid format'),
    
    interval: query('interval')
        .optional()
        .isIn(['minute', 'hour', 'day', 'week']).withMessage('Invalid interval'),
    
    period: query('period')
        .optional()
        .isIn(['1h', '6h', '12h', '24h', '7d', '30d']).withMessage('Invalid period')
};

// ID parameter validation
const idParamValidator = param('id')
    .notEmpty().withMessage('ID is required')
    .isMongoId().withMessage('Invalid ID format');

// Email parameter validation
const emailParamValidator = param('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format');

// Validation result handler
const validate = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg);
        
        // Check if it's an API request
        if (req.originalUrl.startsWith('/api')) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }
        
        // For web requests, render error page or redirect back with errors
        req.flash('error', errorMessages.join(', '));
        return res.redirect('back');
    }
    
    next();
};

// Sanitize input data
const sanitizeInput = (req, res, next) => {
    // Sanitize body
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = Helpers.sanitizeInput(req.body[key]);
            }
        });
    }
    
    // Sanitize query
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = Helpers.sanitizeInput(req.query[key]);
            }
        });
    }
    
    next();
};

// Validate file upload
const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }
    
    // Check file type
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'application/json'
    ];
    
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type'
        });
    }
    
    // Check file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
        return res.status(400).json({
            success: false,
            message: 'File size exceeds 5MB limit'
        });
    }
    
    next();
};

// Rate limiting (simplified version - in production use express-rate-limit)
const rateLimit = (options = {}) => {
    const { windowMs = 15 * 60 * 1000, max = 100 } = options; // 15 minutes window
    const requests = new Map();
    
    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean up old entries
        for (const [key, timestamp] of requests.entries()) {
            if (timestamp < windowStart) {
                requests.delete(key);
            }
        }
        
        // Count requests from this IP
        const requestCount = Array.from(requests.entries())
            .filter(([key]) => key.startsWith(ip))
            .length;
        
        if (requestCount >= max) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.'
            });
        }
        
        // Store this request
        requests.set(`${ip}-${now}`, now);
        
        next();
    };
};

// CORS configuration for API
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://kadidihealthcenter.org',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
};

module.exports = {
    commonValidators,
    sensorDataValidators,
    alertValidators,
    reportValidators,
    queryValidators,
    idParamValidator,
    emailParamValidator,
    validate,
    sanitizeInput,
    validateFileUpload,
    rateLimit,
    corsOptions
};