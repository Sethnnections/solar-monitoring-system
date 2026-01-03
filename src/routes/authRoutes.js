const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validate, commonValidators } = require('../middlewares/validationMiddleware');
const { requireAuth, requireGuest, addUserToLocals } = require('../middlewares/authMiddleware');

// Apply middleware
router.use(addUserToLocals);

// Public routes
router.get('/login', requireGuest, AuthController.renderLogin);
router.post('/login', requireGuest, AuthController.login);

router.get('/register', requireAuth, AuthController.renderRegister);
router.post('/register', requireAuth, AuthController.register);

router.get('/forgot-password', requireGuest, AuthController.renderForgotPassword);
router.post('/forgot-password', requireGuest, AuthController.forgotPassword);

router.get('/reset-password/:token', requireGuest, AuthController.renderResetPassword);
router.post('/reset-password/:token', requireGuest, AuthController.resetPassword);

// Protected routes
router.get('/logout', requireAuth, AuthController.logout);
router.get('/profile', requireAuth, AuthController.renderProfile);
router.post('/profile', requireAuth, AuthController.updateProfile);

// API routes
router.get('/api/auth/me', requireAuth, AuthController.getCurrentUser);
router.get('/api/users', requireAuth, AuthController.getAllUsers);
router.put('/api/users/:id', requireAuth, AuthController.updateUser);
router.delete('/api/users/:id', requireAuth, AuthController.deleteUser);

module.exports = router;