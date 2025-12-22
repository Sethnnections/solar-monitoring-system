#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * This script initializes the database with default users,
 * system configurations, and test data.
 * 
 * Usage:
 *   npm run init-db              # Initialize database
 *   npm run init-db -- --reset   # Reset and reinitialize
 *   npm run init-db -- --test    # Initialize with test data
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const { User, SensorData, Alert, Report, SystemConfig } = require('../models');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Helper function for colored output
const log = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    step: (msg) => console.log(`\n${colors.blue}▶ ${msg}${colors.reset}`)
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    reset: args.includes('--reset'),
    test: args.includes('--test'),
    help: args.includes('--help') || args.includes('-h')
};

// Show help if requested
if (options.help) {
    console.log(`
${colors.cyan}Database Initialization Script${colors.reset}
========================================

${colors.yellow}Usage:${colors.reset}
  npm run init-db [options]

${colors.yellow}Options:${colors.reset}
  --reset      Reset database before initialization
  --test       Add test data (sensor readings, alerts, reports)
  --help, -h   Show this help message

${colors.yellow}Examples:${colors.reset}
  npm run init-db              # Normal initialization
  npm run init-db -- --reset   # Reset and reinitialize
  npm run init-db -- --test    # Initialize with test data
`);
    process.exit(0);
}

// Database connection
const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/solar_monitoring';
        
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        log.success(`Connected to MongoDB: ${mongoose.connection.host}`);
        return mongoose.connection;
    } catch (error) {
        log.error(`Failed to connect to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

// Reset database if requested
const resetDatabase = async () => {
    try {
        log.step('Resetting database...');
        
        // Drop collections
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
        
        log.success('Database reset completed');
    } catch (error) {
        log.error(`Failed to reset database: ${error.message}`);
        throw error;
    }
};

// Create default users
const createDefaultUsers = async () => {
    log.step('Creating default users...');
    
    const users = [
        {
            name: 'System Administrator',
            email: 'admin@kadidihealthcenter.org',
            password: 'Admin@123', // In production, this should be changed immediately
            role: 'admin',
            phone: '+265881234567',
            isActive: true,
            emailVerified: true,
            notificationPreferences: {
                emailAlerts: true,
                criticalAlerts: true,
                dailySummary: false,
                weeklyReport: true
            }
        },
        {
            name: 'John Banda',
            email: 'john.banda@kadidihealthcenter.org',
            password: 'Technician@123',
            role: 'technician',
            phone: '+265992345678',
            isActive: true,
            emailVerified: true,
            notificationPreferences: {
                emailAlerts: true,
                criticalAlerts: true,
                dailySummary: true,
                weeklyReport: true
            }
        },
        {
            name: 'Mary Phiri',
            email: 'mary.phiri@kadidihealthcenter.org',
            password: 'Viewer@123',
            role: 'viewer',
            phone: '+265993456789',
            isActive: true,
            emailVerified: true,
            notificationPreferences: {
                emailAlerts: false,
                criticalAlerts: true,
                dailySummary: false,
                weeklyReport: false
            }
        },
        {
            name: 'Chikondi Mwale',
            email: 'chikondi.mwale@kadidihealthcenter.org',
            password: 'Technician@456',
            role: 'technician',
            phone: '+265884567890',
            isActive: true,
            emailVerified: true,
            notificationPreferences: {
                emailAlerts: true,
                criticalAlerts: true,
                dailySummary: true,
                weeklyReport: true
            }
        }
    ];
    
    const createdUsers = [];
    
    for (const userData of users) {
        try {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });
            
            if (existingUser) {
                log.warn(`User ${userData.email} already exists, skipping...`);
                createdUsers.push(existingUser);
                continue;
            }
            
            // Create user
            const user = new User(userData);
            await user.save();
            
            createdUsers.push(user);
            log.info(`Created user: ${user.name} (${user.email})`);
        } catch (error) {
            log.error(`Failed to create user ${userData.email}: ${error.message}`);
        }
    }
    
    log.success(`Created/verified ${createdUsers.length} users`);
    return createdUsers;
};

// Initialize system configurations
const initializeSystemConfigs = async () => {
    log.step('Initializing system configurations...');
    
    try {
        await SystemConfig.initializeDefaults();
        log.success('System configurations initialized');
    } catch (error) {
        log.error(`Failed to initialize system configurations: ${error.message}`);
        throw error;
    }
};

// Create test sensor data
const createTestSensorData = async () => {
    log.step('Creating test sensor data...');
    
    const testData = [];
    const now = new Date();
    const deviceId = 'ESP32_SOLAR_01';
    
    // Create 48 hours of test data (every 10 minutes)
    for (let i = 96; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 10 * 60 * 1000));
        const hour = timestamp.getHours();
        
        // Simulate solar panel behavior:
        // - Night: low voltage, no current
        // - Morning: increasing voltage and current
        // - Midday: peak performance
        // - Evening: decreasing performance
        
        let voltage, current, temperature;
        
        if (hour >= 6 && hour <= 18) {
            // Daytime hours
            const hourProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
            const sineValue = Math.sin(hourProgress * Math.PI); // Sine curve for daily pattern
            
            voltage = 12 + (sineValue * 2); // 12-14V
            current = 3 + (sineValue * 4); // 3-7A
            temperature = 25 + (sineValue * 15); // 25-40°C
            
            // Add some random variation
            voltage += (Math.random() - 0.5) * 0.5;
            current += (Math.random() - 0.5) * 0.3;
            temperature += (Math.random() - 0.5) * 2;
        } else {
            // Nighttime hours
            voltage = 11.5 + (Math.random() * 0.5); // 11.5-12V
            current = 0.1 + (Math.random() * 0.1); // Minimal current
            temperature = 20 + (Math.random() * 5); // 20-25°C
        }
        
        // Create sensor data entry
        const sensorData = new SensorData({
            deviceId,
            timestamp,
            voltage: { value: parseFloat(voltage.toFixed(2)) },
            current: { value: parseFloat(current.toFixed(3)) },
            temperature: { value: parseFloat(temperature.toFixed(1)) },
            batteryLevel: 85 + (Math.random() * 15), // 85-100%
            status: 'normal',
            location: 'Kadidi Health Center, Lunzu, Blantyre',
            metadata: {
                signalStrength: 85 + (Math.random() * 15),
                uptime: 86400 + (Math.random() * 86400), // 1-2 days
                freeMemory: 20000 + (Math.random() * 30000) // 20-50KB
            }
        });
        
        // Calculate power
        sensorData.power = {
            value: parseFloat((voltage * current).toFixed(1))
        };
        
        testData.push(sensorData);
    }
    
    try {
        // Insert in batches of 50
        const batchSize = 50;
        for (let i = 0; i < testData.length; i += batchSize) {
            const batch = testData.slice(i, i + batchSize);
            await SensorData.insertMany(batch);
        }
        
        log.success(`Created ${testData.length} test sensor readings`);
        return testData;
    } catch (error) {
        log.error(`Failed to create test sensor data: ${error.message}`);
        return [];
    }
};

// Create test alerts
const createTestAlerts = async (sensorData) => {
    log.step('Creating test alerts...');
    
    const testAlerts = [
        {
            type: 'voltage_drop',
            severity: 'critical',
            title: 'Critical Voltage Drop Detected',
            message: 'System voltage dropped below 10V. Immediate attention required.',
            deviceId: 'ESP32_SOLAR_01',
            sensorValue: 9.8,
            threshold: 10,
            unit: 'V',
            acknowledged: true,
            acknowledgedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            resolved: true,
            resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            resolutionNotes: 'Battery replaced. System back to normal operation.',
            emailSent: true,
            emailSentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            autoGenerated: true
        },
        {
            type: 'temperature_high',
            severity: 'high',
            title: 'High Temperature Warning',
            message: 'Solar panel temperature reached 65°C. Risk of reduced efficiency.',
            deviceId: 'ESP32_SOLAR_01',
            sensorValue: 65.2,
            threshold: 60,
            unit: '°C',
            acknowledged: true,
            acknowledgedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
            resolved: false,
            emailSent: true,
            emailSentAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            autoGenerated: true
        },
        {
            type: 'current_anomaly',
            severity: 'medium',
            title: 'Current Fluctuation Detected',
            message: 'Unusual current fluctuations detected. Possible connection issue.',
            deviceId: 'ESP32_SOLAR_01',
            sensorValue: 0.5,
            threshold: 1,
            unit: 'A',
            acknowledged: false,
            resolved: false,
            emailSent: true,
            emailSentAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            autoGenerated: true
        },
        {
            type: 'system_offline',
            severity: 'high',
            title: 'System Communication Lost',
            message: 'No data received from ESP32 device for 15 minutes.',
            deviceId: 'ESP32_SOLAR_01',
            sensorValue: 0,
            threshold: 900, // 15 minutes in seconds
            unit: 'seconds',
            acknowledged: false,
            resolved: false,
            emailSent: true,
            emailSentAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            autoGenerated: true
        }
    ];
    
    // Link alerts to sensor data if available
    if (sensorData && sensorData.length > 0) {
        testAlerts.forEach((alert, index) => {
            if (index < sensorData.length) {
                alert.sensorDataId = sensorData[index]._id;
            }
        });
    }
    
    try {
        await Alert.insertMany(testAlerts);
        log.success(`Created ${testAlerts.length} test alerts`);
        return testAlerts;
    } catch (error) {
        log.error(`Failed to create test alerts: ${error.message}`);
        return [];
    }
};

// Create test reports
const createTestReports = async () => {
    log.step('Creating test reports...');
    
    const now = new Date();
    const testReports = [
        {
            title: 'Daily Solar System Report - March 15, 2024',
            type: 'daily',
            period: {
                startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
                endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
            },
            filePath: '/reports/daily_20240315.pdf',
            fileName: 'daily_report_20240315.pdf',
            fileSize: 1024 * 250, // 250KB
            format: 'pdf',
            summary: {
                totalEnergy: 4.2,
                avgVoltage: 13.2,
                avgCurrent: 4.8,
                peakPower: 85.6,
                maxTemperature: 42.5,
                efficiency: 78.5,
                dataPoints: 864
            },
            metadata: {
                generationTime: 5.2,
                dataPointsUsed: 864,
                chartsIncluded: true,
                recommendationsCount: 2,
                anomaliesDetected: 1
            },
            emailSent: true,
            emailSentTo: ['john.banda@kadidihealthcenter.org'],
            emailSentAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
            isPublic: true,
            downloadCount: 3,
            lastDownloaded: new Date(now.getTime() - 6 * 60 * 60 * 1000) // 6 hours ago
        },
        {
            title: 'Weekly Solar System Report - March 2024 Week 2',
            type: 'weekly',
            period: {
                startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
                endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
            },
            filePath: '/reports/weekly_2024w11.pdf',
            fileName: 'weekly_report_2024w11.pdf',
            fileSize: 1024 * 512, // 512KB
            format: 'pdf',
            summary: {
                totalEnergy: 28.7,
                avgVoltage: 13.1,
                avgCurrent: 4.6,
                peakPower: 88.2,
                maxTemperature: 45.2,
                efficiency: 76.8,
                dataPoints: 6048
            },
            metadata: {
                generationTime: 12.5,
                dataPointsUsed: 6048,
                chartsIncluded: true,
                recommendationsCount: 5,
                anomaliesDetected: 3
            },
            emailSent: true,
            emailSentTo: [
                'admin@kadidihealthcenter.org',
                'john.banda@kadidihealthcenter.org',
                'chikondi.mwale@kadidihealthcenter.org'
            ],
            emailSentAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 day ago
            isPublic: true,
            downloadCount: 7,
            lastDownloaded: new Date(now.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago
        },
        {
            title: 'Monthly Solar System Report - February 2024',
            type: 'monthly',
            period: {
                startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                endDate: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
            },
            filePath: '/reports/monthly_202402.xlsx',
            fileName: 'monthly_report_202402.xlsx',
            fileSize: 1024 * 1024, // 1MB
            format: 'excel',
            summary: {
                totalEnergy: 112.5,
                avgVoltage: 13.0,
                avgCurrent: 4.5,
                peakPower: 90.1,
                maxTemperature: 48.7,
                efficiency: 75.2,
                dataPoints: 25920
            },
            metadata: {
                generationTime: 25.8,
                dataPointsUsed: 25920,
                chartsIncluded: true,
                recommendationsCount: 8,
                anomaliesDetected: 12
            },
            emailSent: true,
            emailSentTo: ['admin@kadidihealthcenter.org'],
            emailSentAt: new Date(now.getFullYear(), now.getMonth(), 1, 8, 0, 0), // 1st of month at 8 AM
            isPublic: false,
            downloadCount: 2,
            lastDownloaded: new Date(now.getFullYear(), now.getMonth(), 1, 10, 0, 0) // 1st of month at 10 AM
        }
    ];
    
    try {
        // Get admin user to assign as generatedBy
        const admin = await User.findOne({ email: 'admin@kadidihealthcenter.org' });
        
        if (admin) {
            testReports.forEach(report => {
                report.generatedBy = admin._id;
            });
        }
        
        await Report.insertMany(testReports);
        log.success(`Created ${testReports.length} test reports`);
        return testReports;
    } catch (error) {
        log.error(`Failed to create test reports: ${error.message}`);
        return [];
    }
};

// Verify database setup
const verifyDatabase = async () => {
    log.step('Verifying database setup...');
    
    const checks = [
        { model: User, name: 'Users', minCount: 1 },
        { model: SystemConfig, name: 'System Configurations', minCount: 10 },
    ];
    
    if (options.test) {
        checks.push(
            { model: SensorData, name: 'Sensor Data', minCount: 50 },
            { model: Alert, name: 'Alerts', minCount: 1 },
            { model: Report, name: 'Reports', minCount: 1 }
        );
    }
    
    let allPassed = true;
    
    for (const check of checks) {
        try {
            const count = await check.model.countDocuments();
            
            if (count >= check.minCount) {
                log.info(`${check.name}: ${count} records ✓`);
            } else {
                log.warn(`${check.name}: ${count} records (expected at least ${check.minCount}) ✗`);
                allPassed = false;
            }
        } catch (error) {
            log.error(`Failed to check ${check.name}: ${error.message}`);
            allPassed = false;
        }
    }
    
    if (allPassed) {
        log.success('Database verification passed');
    } else {
        log.warn('Database verification failed - some checks did not pass');
    }
    
    return allPassed;
};

// Display summary
const displaySummary = async () => {
    log.step('Database Initialization Summary');
    console.log('=' .repeat(50));
    
    const counts = {
        users: await User.countDocuments(),
        configs: await SystemConfig.countDocuments(),
        sensorData: await SensorData.countDocuments(),
        alerts: await Alert.countDocuments(),
        reports: await Report.countDocuments()
    };
    
    console.log(`
${colors.green}✅ Database Initialization Complete${colors.reset}

${colors.cyan}Collections Summary:${colors.reset}
  • Users: ${counts.users}
  • System Configurations: ${counts.configs}
  ${options.test ? `• Sensor Data: ${counts.sensorData}` : ''}
  ${options.test ? `• Alerts: ${counts.alerts}` : ''}
  ${options.test ? `• Reports: ${counts.reports}` : ''}

${colors.cyan}Default Login Credentials:${colors.reset}
  • Admin: admin@kadidihealthcenter.org / Admin@123
  • Technician: john.banda@kadidihealthcenter.org / Technician@123
  • Viewer: mary.phiri@kadidihealthcenter.org / Viewer@123

${colors.yellow}Important Security Note:${colors.reset}
  Change default passwords immediately after first login!

${colors.cyan}Next Steps:${colors.reset}
  1. Start the server: ${colors.green}npm run dev${colors.reset}
  2. Login with admin credentials
  3. Change default passwords
  4. Configure system settings as needed
  5. Test ESP32 sensor integration

${colors.cyan}Access URLs:${colors.reset}
  • Web Dashboard: http://localhost:${process.env.PORT || 3000}
  • API Documentation: http://localhost:${process.env.PORT || 3000}/api/docs
    `);
};

// Main initialization function
const initializeDatabase = async () => {
    try {
        log.step('Starting database initialization...');
        
        // Connect to database
        const connection = await connectDB();
        
        // Reset database if requested
        if (options.reset) {
            await resetDatabase();
        }
        
        // Initialize system configurations
        await initializeSystemConfigs();
        
        // Create default users
        await createDefaultUsers();
        
        // Create test data if requested
        let testSensorData = [];
        let testAlerts = [];
        let testReports = [];
        
        if (options.test) {
            testSensorData = await createTestSensorData();
            testAlerts = await createTestAlerts(testSensorData);
            testReports = await createTestReports();
        }
        
        // Verify setup
        await verifyDatabase();
        
        // Display summary
        await displaySummary();
        
        // Close connection
        await mongoose.connection.close();
        log.success('Database connection closed');
        
        process.exit(0);
        
    } catch (error) {
        log.error(`Database initialization failed: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    log.warn('Process interrupted by user');
    await mongoose.connection.close();
    process.exit(0);
});

// Run initialization
initializeDatabase();