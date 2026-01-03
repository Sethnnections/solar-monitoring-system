const express = require('express');
const router = express.Router();
const AlertController = require('../controllers/alertController');
const { requireAuth, requireTechnician } = require('../middlewares/authMiddleware');
const { validate, alertValidators, queryValidators, idParamValidator } = require('../middlewares/validationMiddleware');

// Apply authentication
router.use(requireAuth);
router.use(requireTechnician);

// Alert pages
router.get('/', AlertController.renderAlerts);

// API endpoints
router.get('/api/alerts', 
    [
        queryValidators.status,
        queryValidators.severity,
        queryValidators.type,
        queryValidators.startDate,
        queryValidators.endDate,
        queryValidators.limit,
        queryValidators.page,
        queryValidators.sort
    ],
    validate,
    AlertController.getAlerts
);

router.get('/api/alerts/:id', 
    idParamValidator,
    validate,
    AlertController.getAlertById
);

router.post('/api/alerts', 
    alertValidators,
    validate,
    AlertController.createAlert
);

router.put('/api/alerts/:id/acknowledge', 
    idParamValidator,
    validate,
    AlertController.acknowledgeAlert
);

router.put('/api/alerts/:id/resolve', 
    idParamValidator,
    validate,
    AlertController.resolveAlert
);

router.post('/api/alerts/bulk-acknowledge', 
    AlertController.bulkAcknowledgeAlerts
);

router.post('/api/alerts/bulk-resolve', 
    AlertController.bulkResolveAlerts
);

router.delete('/api/alerts/:id', 
    idParamValidator,
    validate,
    AlertController.deleteAlert
);

router.get('/api/alerts/stats', 
    queryValidators.days,
    validate,
    AlertController.getAlertStatistics
);

router.get('/api/alerts/active/count', 
    AlertController.getActiveAlertsCount
);

router.post('/api/alerts/test-email', 
    AlertController.sendTestAlertEmail
);

router.get('/api/alerts/trends', 
    queryValidators.days,
    validate,
    AlertController.getAlertTrends
);

module.exports = router;