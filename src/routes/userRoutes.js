const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const { validate, commonValidators, queryValidators, idParamValidator } = require('../middlewares/validationMiddleware');

// Apply authentication to all user routes
router.use(requireAuth);

// User management page (admin only)
router.get('/', requireAdmin, UserController.renderUsers);

// API endpoints
router.get('/api/users/:id', 
    [
        idParamValidator,
        validate
    ],
    UserController.getUserById
);

router.put('/api/users/:id', 
    [
        idParamValidator,
        ...Object.values(commonValidators)
    ],
    validate,
    UserController.updateUser
);

router.delete('/api/users/:id', 
    [
        idParamValidator,
        validate
    ],
    requireAdmin,
    UserController.deleteUser
);

router.put('/api/users/:id/password', 
    [
        idParamValidator,
        commonValidators.newPassword,
        commonValidators.confirmPassword
    ],
    validate,
    UserController.changePassword
);

router.get('/api/users/:id/activity', 
    [
        idParamValidator,
        queryValidators.days
    ],
    validate,
    UserController.getUserActivity
);

router.get('/api/users/statistics', 
    requireAdmin,
    UserController.getUserStatistics
);

router.post('/api/users/:id/reset-password', 
    [
        idParamValidator,
        commonValidators.newPassword,
        commonValidators.confirmPassword
    ],
    validate,
    requireAdmin,
    UserController.resetUserPassword
);

router.put('/api/users/:id/toggle-status', 
    idParamValidator,
    validate,
    requireAdmin,
    UserController.toggleUserStatus
);

router.get('/api/users/role/:role', 
    UserController.getUsersByRole
);

router.get('/api/users/search', 
    [
        queryValidators.limit
    ],
    validate,
    UserController.searchUsers
);

// Add these routes to userRoutes.js

// User statistics
router.get('/api/users/statistics', 
    requireAdmin,
    UserController.getUserStatistics
);

// User activity log
router.get('/api/users/:id/activity-log',
    [
        idParamValidator,
        queryValidators.limit,
        queryValidators.page
    ],
    validate,
    UserController.getUserActivityLog
);

// Update user preferences
router.put('/api/users/:id/preferences',
    [
        idParamValidator,
        validate
    ],
    UserController.updateUserPreferences
);

// Bulk update users
router.post('/api/users/bulk-update',
    requireAdmin,
    UserController.bulkUpdateUsers
);

// Export users
router.get('/api/users/export',
    [
        queryValidators.format
    ],
    validate,
    requireAdmin,
    UserController.exportUsers
);

// Get user sessions (if you implement session tracking)
router.get('/api/users/:id/sessions',
    [
        idParamValidator,
        validate
    ],
    requireAdmin,
    async (req, res) => {
        // Implementation for session tracking
        res.json({
            success: true,
            message: 'Session tracking endpoint'
        });
    }
);

module.exports = router;