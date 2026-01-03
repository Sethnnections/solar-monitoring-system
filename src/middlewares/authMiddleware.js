const { USER_ROLES } = require('../config/constants');

// Check if user is authenticated
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        // Store the original URL for redirect after login
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    next();
};

// Check if user is not authenticated (for login/register pages)
const requireGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

// Check if user has admin role
const requireAdmin = (req, res, next) => {
    if (!req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    
    if (req.session.user.role !== USER_ROLES.ADMIN) {
        return res.status(403).render('errors/403', {
            title: 'Access Denied',
            message: 'Admin privileges required'
        });
    }
    next();
};

// Check if user has technician or admin role
const requireTechnician = (req, res, next) => {
    if (!req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    
    if (req.session.user.role !== USER_ROLES.TECHNICIAN && 
        req.session.user.role !== USER_ROLES.ADMIN) {
        return res.status(403).render('errors/403', {
            title: 'Access Denied',
            message: 'Technician or admin privileges required'
        });
    }
    next();
};

// Check if user has viewer, technician or admin role
const requireViewer = (req, res, next) => {
    if (!req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    
    if (req.session.user.role !== USER_ROLES.VIEWER && 
        req.session.user.role !== USER_ROLES.TECHNICIAN && 
        req.session.user.role !== USER_ROLES.ADMIN) {
        return res.status(403).render('errors/403', {
            title: 'Access Denied',
            message: 'Viewer privileges required'
        });
    }
    next();
};

// Check API key for ESP32 communication
const requireApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({
            success: false,
            message: 'API key required',
            timestamp: new Date().toISOString()
        });
    }
    
    // Validate API key (simplified - in production, use proper validation)
    const validKeys = process.env.API_KEYS ? 
        process.env.API_KEYS.split(',') : 
        ['esp32_solar_monitoring_key'];
    
    if (!validKeys.includes(apiKey)) {
        return res.status(401).json({
            success: false,
            message: 'Invalid API key',
            timestamp: new Date().toISOString()
        });
    }
    
    next();
};

// Add user to response locals for views
const addUserToLocals = (req, res, next) => {
    if (req.session.user) {
        res.locals.user = req.session.user;
        res.locals.isAdmin = req.session.user.role === USER_ROLES.ADMIN;
        res.locals.isTechnician = req.session.user.role === USER_ROLES.TECHNICIAN;
        res.locals.isViewer = req.session.user.role === USER_ROLES.VIEWER;
    } else {
        res.locals.user = null;
        res.locals.isAdmin = false;
        res.locals.isTechnician = false;
        res.locals.isViewer = false;
    }
    next();
};

// Check session timeout
const checkSessionTimeout = (req, res, next) => {
    if (req.session.user && req.session.cookie.expires) {
        const now = new Date();
        if (now > new Date(req.session.cookie.expires)) {
            req.session.destroy();
            return res.redirect('/login?session=expired');
        }
    }
    next();
};

module.exports = {
    requireAuth,
    requireGuest,
    requireAdmin,
    requireTechnician,
    requireViewer,
    requireApiKey,
    addUserToLocals,
    checkSessionTimeout
};