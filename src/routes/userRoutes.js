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

module.exports = router;