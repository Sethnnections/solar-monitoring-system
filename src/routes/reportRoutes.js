const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { requireAuth, requireViewer } = require('../middlewares/authMiddleware');
const { validate, reportValidators, queryValidators, idParamValidator } = require('../middlewares/validationMiddleware');

// Apply authentication
router.use(requireAuth);
router.use(requireViewer);

// Report pages
router.get('/', ReportController.renderReports);

// API endpoints
router.get('/api/reports', 
    [
        queryValidators.type,
        queryValidators.startDate,
        queryValidators.endDate,
        queryValidators.format,
        queryValidators.limit,
        queryValidators.page,
        queryValidators.sort
    ],
    validate,
    ReportController.getReports
);

router.post('/api/reports/generate', 
    reportValidators,
    validate,
    ReportController.generateReport
);

router.get('/api/reports/:id', 
    idParamValidator,
    validate,
    ReportController.getReportById
);

router.get('/api/reports/download/:id', 
    idParamValidator,
    validate,
    ReportController.downloadReport
);

router.get('/api/reports/preview/:id', 
    idParamValidator,
    validate,
    ReportController.previewReport
);

router.put('/api/reports/:id', 
    [
        idParamValidator,
        ...reportValidators
    ],
    validate,
    ReportController.updateReport
);

router.delete('/api/reports/:id', 
    idParamValidator,
    validate,
    ReportController.deleteReport
);

router.post('/api/reports/:id/send-email', 
    idParamValidator,
    validate,
    ReportController.sendReportEmail
);

router.post('/api/reports/scheduled', 
    ReportController.generateScheduledReport
);

router.get('/api/reports/popular', 
    queryValidators.limit,
    validate,
    ReportController.getPopularReports
);

router.delete('/api/reports/cleanup', 
    queryValidators.days,
    validate,
    ReportController.cleanupOldReports
);

// Add these routes to reportRoutes.js

// Get report templates
router.get('/api/reports/templates', 
    ReportController.getReportTemplates
);

// Get report categories
router.get('/api/reports/categories', 
    ReportController.getReportCategories
);

// Get report trends
router.get('/api/reports/trends', 
    [
        queryValidators.days
    ],
    validate,
    ReportController.getReportTrends
);

// Clone report
router.post('/api/reports/:id/clone', 
    idParamValidator,
    validate,
    ReportController.cloneReport
);

// Schedule report
router.post('/api/reports/schedule', 
    ReportController.scheduleReport
);

// Get scheduled reports
router.get('/api/reports/scheduled', 
    ReportController.getScheduledReports
);

module.exports = router;