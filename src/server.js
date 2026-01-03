const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const flash = require('connect-flash');
require('dotenv').config();

// Import middleware
const { addUserToLocals, checkSessionTimeout, corsOptions } = require('./middlewares/authMiddleware');
const { requestLogger, securityHeaders, maintenanceMode } = require('./middlewares/errorMiddleware');
const { errorHandler, notFoundHandler } = require('./middlewares/errorMiddleware');

// Import database connection
const connectDB = require('./config/database');

// Import routes
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(securityHeaders);
app.use(maintenanceMode);
app.use(requestLogger);

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 7 * 24 * 60 * 60, // 7 days
        autoRemove: 'native',
    }),
    cookie: {
        maxAge: parseInt(process.env.SESSION_LIFETIME) || 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    },
    name: 'solar_monitoring_session',
};

app.use(session(sessionConfig));
app.use(checkSessionTimeout);
app.use(flash());
app.use(addUserToLocals);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables for views
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentPath = req.path;
    res.locals.appName = 'Solar Monitoring System';
    res.locals.year = new Date().getFullYear();
    next();
});

// Mount routes
app.use('/', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler (should be last middleware)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Access at: http://localhost:${PORT}`);
    console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error(' Unhandled Promise Rejection:', err);
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(' Uncaught Exception:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(' SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('👋 Process terminated');
        process.exit(0);
    });
});

module.exports = app; // For testing