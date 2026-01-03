const express = require('express');
const router = express.Router();
const SensorController = require('../controllers/sensorController');
const { requireApiKey } = require('../middlewares/authMiddleware');
const { sensorDataValidators, validate, queryValidators, idParamValidator } = require('../middlewares/validationMiddleware');

// Public API routes (for ESP32)
router.post('/sensor-data', 
    requireApiKey,
    sensorDataValidators,
    validate,
    SensorController.receiveSensorData
);

// Sensor health check
router.get('/sensor-health/:deviceId?', SensorController.getSensorHealth);

// Protected API routes (for web interface)
router.get('/sensor-data/:id', 
    idParamValidator,
    validate,
    SensorController.getSensorData
);

router.get('/sensor-data', 
    [
        queryValidators.deviceId,
        queryValidators.startDate,
        queryValidators.endDate,
        queryValidators.status,
        queryValidators.limit,
        queryValidators.page,
        queryValidators.sort
    ],
    validate,
    SensorController.getSensorDataByFilter
);

router.delete('/sensor-data/:id', 
    idParamValidator,
    validate,
    SensorController.deleteSensorData
);

router.delete('/sensor-data', 
    SensorController.bulkDeleteSensorData
);

router.get('/sensor-statistics', 
    [
        queryValidators.deviceId,
        queryValidators.days
    ],
    validate,
    SensorController.getSensorStatistics
);

router.get('/export/sensor-data', 
    [
        queryValidators.format,
        queryValidators.startDate,
        queryValidators.endDate,
        queryValidators.deviceId
    ],
    validate,
    SensorController.exportSensorData
);

// System status endpoint
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: 'Solar Monitoring System API is running',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected', // Would check DB connection
            email: 'configured', // Would check email config
            sensors: 'active' // Would check sensor connections
        }
    });
});

module.exports = router;