// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user: req.session?.user?.email || 'Anonymous'
    });
    
    // Determine status code
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        statusCode = 401;
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
    } else if (err.name === 'MongoError' && err.code === 11000) {
        statusCode = 409; // Duplicate key error
        err.message = 'Duplicate entry found';
    } else if (err.name === 'CastError') {
        statusCode = 400;
        err.message = 'Invalid ID format';
    }
    
    // Set response status
    res.status(statusCode);
    
    // Check if it's an API request
    const isApiRequest = req.originalUrl.startsWith('/api');
    
    if (isApiRequest) {
        // JSON response for API
        res.json({
            success: false,
            message: err.message || 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            timestamp: new Date().toISOString()
        });
    } else {
        // HTML response for web
        const errorPage = statusCode === 404 ? 'errors/404' : 'errors/500';
        
        // Ensure required variables are defined
        const renderData = {
            title: `Error ${statusCode}`,
            statusCode,
            message: err.message || 'Something went wrong',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            user: req.session?.user || null,
            isAdmin: req.session?.user?.role === 'admin' || false,
            isTechnician: req.session?.user?.role === 'technician' || false,
            isViewer: req.session?.user?.role === 'viewer' || false,
            pageStyles: '', // Add empty string to avoid undefined
            headScripts: '', // Add empty string to avoid undefined
            pageScripts: '', // Add empty string to avoid undefined
            locals: {
                systemStatus: 'checking',
                unreadAlerts: 0
            }
        };
        
        res.render(errorPage, renderData);
    }
};

// 404 Not Found handler
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.name = 'NotFoundError';
    
    // Check if it's an API request
    const isApiRequest = req.originalUrl.startsWith('/api');
    
    if (isApiRequest) {
        res.status(404).json({
            success: false,
            message: `Endpoint ${req.originalUrl} not found`,
            timestamp: new Date().toISOString()
        });
    } else {
        const renderData = {
            title: 'Page Not Found',
            message: 'The page you are looking for does not exist.',
            user: req.session?.user || null,
            isAdmin: req.session?.user?.role === 'admin' || false,
            isTechnician: req.session?.user?.role === 'technician' || false,
            isViewer: req.session?.user?.role === 'viewer' || false,
            pageStyles: '',
            headScripts: '',
            pageScripts: '',
            locals: {
                systemStatus: 'checking',
                unreadAlerts: 0
            }
        };
        
        res.status(404).render('errors/404', renderData);
    }
};

// Async handler wrapper (eliminates try-catch blocks)
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Request logger middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request details
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${req.ip}`);
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (adjust for your needs)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' https://cdn.jsdelivr.net; " +
            "connect-src 'self' https://api.kadidihealthcenter.org;"
        );
    }
    
    next();
};

// Maintenance mode middleware
const maintenanceMode = (req, res, next) => {
    const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    
    if (isMaintenanceMode && !req.originalUrl.startsWith('/maintenance')) {
        // Allow API requests for critical operations
        if (req.originalUrl.startsWith('/api/sensor-data') || 
            req.originalUrl.startsWith('/api/health')) {
            return next();
        }
        
        // Redirect to maintenance page
        return res.status(503).render('errors/maintenance', {
            title: 'Maintenance Mode',
            message: 'The system is currently undergoing maintenance. Please check back later.'
        });
    }
    
    next();
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    requestLogger,
    securityHeaders,
    maintenanceMode
};