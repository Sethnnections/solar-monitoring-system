const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { requireAuth, requireViewer } = require('../middlewares/authMiddleware');
const { validate, queryValidators } = require('../middlewares/validationMiddleware');

// Apply authentication to all dashboard routes
router.use(requireAuth);
router.use(requireViewer);

// Dashboard pages
router.get('/', DashboardController.renderDashboard);
router.get('/live-data', DashboardController.renderLiveData);

// API endpoints for dashboard data
router.get('/api/realtime', DashboardController.getRealtimeData);

router.get('/api/historical', 
    [
        queryValidators.period,
        queryValidators.interval,
        queryValidators.deviceId
    ],
    validate,
    DashboardController.getHistoricalData
);

router.get('/api/stats', 
    queryValidators.days,
    validate,
    DashboardController.getSystemStats
);

router.get('/api/devices', DashboardController.getDevices);

router.get('/api/device/:deviceId', 
    [
        queryValidators.limit,
        queryValidators.page
    ],
    validate,
    DashboardController.getDeviceData
);

router.get('/api/energy-summary', 
    queryValidators.days,
    validate,
    DashboardController.getEnergySummary
);

router.get('/api/predictive-insights', DashboardController.getPredictiveInsights);
router.get('/api/weather-impact', DashboardController.getWeatherImpact);

module.exports = router;