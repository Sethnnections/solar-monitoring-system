const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const apiRoutes = require('./apiRoutes');
const alertRoutes = require('./alertRoutes');
const reportRoutes = require('./reportRoutes');
const userRoutes = require('./userRoutes');

// Mount routes
router.use('/', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/api', apiRoutes);
router.use('/alerts', alertRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);

// Export the main router
module.exports = router;