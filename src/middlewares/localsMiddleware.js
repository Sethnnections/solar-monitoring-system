const { Alert, SensorData } = require('../models');

async function addCommonLocals(req, res, next) {
    try {
        // Only add data if user is authenticated
        if (req.session && req.session.user) {
            // Get latest sensor data for header
            const latestData = await SensorData.getLatest();
            
            // Get recent alerts for header
            const recentAlerts = await Alert.find({ resolved: false })
                .sort({ createdAt: -1 })
                .limit(5);
            
            // Get active alerts count
            const activeAlertsCount = await Alert.countDocuments({ resolved: false });
            
            // Add to locals for all views
            res.locals.latestData = latestData;
            res.locals.recentAlerts = recentAlerts || [];
            res.locals.activeAlertsCount = activeAlertsCount || 0;
        } else {
            // Default values for non-authenticated users
            res.locals.latestData = null;
            res.locals.recentAlerts = [];
            res.locals.activeAlertsCount = 0;
        }
        
    } catch (error) {
        console.error('Middleware error:', error);
        // Set default values on error
        res.locals.latestData = null;
        res.locals.recentAlerts = [];
        res.locals.activeAlertsCount = 0;
    }
    
    next();
}

module.exports = addCommonLocals;