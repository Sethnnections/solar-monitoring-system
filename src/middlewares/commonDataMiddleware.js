const { SensorData, Alert, SystemConfig } = require('../models');
const Helpers = require('../utils/helpers');

async function commonDataMiddleware(req, res, next) {
    try {
        // Initialize all common variables with safe defaults
        res.locals.latestData = null;
        res.locals.recentAlerts = [];
        res.locals.activeAlertsCount = 0;
        res.locals.alertStats = null;
        res.locals.systemStatus = { status: 'offline', message: 'Loading...' };
        res.locals.dailySummary = null;
        
        // Only fetch data if user is logged in
        if (req.session && req.session.user) {
            
            // 1. Get latest sensor data
            try {
                const latest = await SensorData.getLatest();
                if (latest) {
                    // Ensure power is calculated
                    if (!latest.power || !latest.power.value) {
                        latest.power = {
                            value: latest.voltage.value * latest.current.value,
                            unit: 'W'
                        };
                    }
                    res.locals.latestData = latest;
                }
            } catch (sensorError) {
                console.error('Error fetching latest data:', sensorError);
            }
            
            // 2. Get recent alerts (for header)
            try {
                const alerts = await Alert.find({ resolved: false })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean();
                res.locals.recentAlerts = alerts || [];
            } catch (alertError) {
                console.error('Error fetching recent alerts:', alertError);
            }
            
            // 3. Get active alerts count
            try {
                const count = await Alert.countDocuments({ resolved: false });
                res.locals.activeAlertsCount = count || 0;
            } catch (countError) {
                console.error('Error counting alerts:', countError);
            }
            
            // 4. Get alert statistics (for sidebar)
            try {
                const stats = await Alert.getStatistics(7); // Last 7 days
                res.locals.alertStats = stats;
            } catch (statsError) {
                console.error('Error fetching alert stats:', statsError);
            }
            
            // 5. Get system status (for sidebar)
            try {
                const status = await SensorData.getSystemStatus();
                res.locals.systemStatus = status;
            } catch (statusError) {
                console.error('Error fetching system status:', statusError);
            }
            
            // 6. Get daily summary for today (for sidebar/dashboard)
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const summary = await SensorData.getDailySummary(today);
                res.locals.dailySummary = summary;
            } catch (summaryError) {
                console.error('Error fetching daily summary:', summaryError);
            }
        }
        
        // Add Helpers to all views (if not already added)
        res.locals.helpers = Helpers;
        
        // Add current time
        res.locals.currentTime = new Date().toLocaleTimeString();
        
        // Add year for footer
        res.locals.year = new Date().getFullYear();
        
        // Add app name
        res.locals.appName = 'Solar Monitoring System';
        
    } catch (error) {
        console.error('Common data middleware error:', error);
        // Ensure defaults are set even on error
        res.locals.latestData = null;
        res.locals.recentAlerts = [];
        res.locals.activeAlertsCount = 0;
        res.locals.alertStats = null;
        res.locals.systemStatus = { status: 'error', message: 'Failed to load system data' };
        res.locals.dailySummary = null;
        res.locals.helpers = Helpers || {};
        res.locals.currentTime = new Date().toLocaleTimeString();
        res.locals.year = new Date().getFullYear();
        res.locals.appName = 'Solar Monitoring System';
    }
    
    next();
}

module.exports = commonDataMiddleware;