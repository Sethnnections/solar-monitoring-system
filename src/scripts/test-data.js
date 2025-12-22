#!/usr/bin/env node

/**
 * Test Data Generator Script
 * 
 * Generates realistic test data for development and testing purposes.
 * 
 * Usage:
 *   npm run seed                 # Generate test data
 *   npm run seed -- --days=7     # Generate 7 days of data
 *   npm run seed -- --clean      # Clean existing test data first
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { faker } = require('@faker-js/faker');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const { SensorData, Alert } = require('../models');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
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
    days: 7,
    clean: false,
    help: false
};

args.forEach(arg => {
    if (arg.startsWith('--days=')) {
        options.days = parseInt(arg.split('=')[1]);
    } else if (arg === '--clean') {
        options.clean = true;
    } else if (arg === '--help' || arg === '-h') {
        options.help = true;
    }
});

// Show help if requested
if (options.help) {
    console.log(`
${colors.cyan}Test Data Generator Script${colors.reset}
====================================

${colors.yellow}Usage:${colors.reset}
  npm run seed [options]

${colors.yellow}Options:${colors.reset}
  --days=N      Generate N days of test data (default: 7)
  --clean       Clean existing test data before generation
  --help, -h    Show this help message

${colors.yellow}Examples:${colors.reset}
  npm run seed                    # Generate 7 days of test data
  npm run seed -- --days=30       # Generate 30 days of test data
  npm run seed -- --clean         # Clean and regenerate test data
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

// Clean existing test data
const cleanTestData = async () => {
    log.step('Cleaning existing test data...');
    
    try {
        // Delete sensor data created by this script (marked with isTestData)
        const sensorResult = await SensorData.deleteMany({ isTestData: true });
        log.info(`Deleted ${sensorResult.deletedCount} test sensor records`);
        
        // Delete test alerts
        const alertResult = await Alert.deleteMany({ isTestData: true });
        log.info(`Deleted ${alertResult.deletedCount} test alerts`);
        
        log.success('Test data cleaned successfully');
    } catch (error) {
        log.error(`Failed to clean test data: ${error.message}`);
        throw error;
    }
};

// Generate realistic solar panel data for a given timestamp
const generateSolarData = (timestamp) => {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    // Base values for a 12V solar system
    const baseVoltage = 12.0;
    const baseCurrent = 5.0;
    const baseTemperature = 25.0;
    
    // Solar intensity based on time of day (sine curve)
    let solarIntensity = 0;
    if (hour >= 6 && hour <= 18) {
        // Daytime: 6 AM to 6 PM
        const hourProgress = (hour - 6) / 12; // 0 at 6am, 1 at 6pm
        solarIntensity = Math.sin(hourProgress * Math.PI);
    }
    
    // Seasonal variation (higher in summer, lower in winter)
    // Assuming location in Malawi (southern hemisphere)
    const seasonalFactor = 0.8 + 0.4 * Math.sin((dayOfYear / 365) * 2 * Math.PI - Math.PI/2);
    
    // Calculate voltage (12-14V during day, 11-12V at night)
    let voltage;
    if (solarIntensity > 0) {
        voltage = baseVoltage + (solarIntensity * 2 * seasonalFactor);
    } else {
        voltage = baseVoltage - 0.5 + (Math.random() * 1);
    }
    
    // Calculate current (0 at night, up to 10A during peak sun)
    let current = solarIntensity * baseCurrent * seasonalFactor;
    
    // Calculate temperature (ambient + solar heating)
    const ambientTemp = 20 + 10 * Math.sin((dayOfYear / 365) * 2 * Math.PI);
    let temperature = ambientTemp + (solarIntensity * 25);
    
    // Add some random noise (±10%)
    voltage += voltage * (Math.random() - 0.5) * 0.1;
    current += current * (Math.random() - 0.5) * 0.1;
    temperature += temperature * (Math.random() - 0.5) * 0.05;
    
    // Ensure minimum values
    voltage = Math.max(11, Math.min(15, voltage));
    current = Math.max(0, Math.min(10, current));
    temperature = Math.max(15, Math.min(70, temperature));
    
    // Calculate power
    const power = voltage * current;
    
    // Calculate battery level (simulates charging during day, discharging at night)
    let batteryLevel;
    const hourOfDay = hour + minute / 60;
    
    if (hourOfDay >= 6 && hourOfDay <= 18) {
        // Charging during day
        batteryLevel = 50 + (solarIntensity * 40) + (Math.random() * 10);
    } else {
        // Discharging at night
        batteryLevel = 30 + (Math.random() * 20);
    }
    batteryLevel = Math.max(20, Math.min(100, batteryLevel));
    
    // Determine status
    let status = 'normal';
    if (voltage < 11.5) status = 'warning';
    if (voltage < 11) status = 'critical';
    if (temperature > 60) status = 'warning';
    if (temperature > 70) status = 'critical';
    if (batteryLevel < 30) status = 'warning';
    if (batteryLevel < 20) status = 'critical';
    
    return {
        voltage: parseFloat(voltage.toFixed(2)),
        current: parseFloat(current.toFixed(3)),
        temperature: parseFloat(temperature.toFixed(1)),
        power: parseFloat(power.toFixed(1)),
        batteryLevel: parseFloat(batteryLevel.toFixed(1)),
        status
    };
};

// Generate sensor data for a time period
const generateSensorData = async (startDate, endDate, intervalMinutes = 10) => {
    log.step(`Generating sensor data from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}...`);
    
    const sensorData = [];
    const deviceIds = ['ESP32_SOLAR_01', 'ESP32_SOLAR_02', 'ESP32_SOLAR_03'];
    const locations = [
        'Main Building Roof',
        'Clinic Roof',
        'Staff Quarters Roof'
    ];
    
    let currentTime = new Date(startDate);
    let dataCount = 0;
    
    while (currentTime <= endDate) {
        for (let i = 0; i < deviceIds.length; i++) {
            const solarData = generateSolarData(currentTime);
            
            const sensorReading = new SensorData({
                deviceId: deviceIds[i],
                timestamp: new Date(currentTime),
                voltage: { value: solarData.voltage },
                current: { value: solarData.current },
                temperature: { value: solarData.temperature },
                power: { value: solarData.power },
                batteryLevel: solarData.batteryLevel,
                status: solarData.status,
                location: locations[i],
                panelId: `PANEL_${i + 1}`,
                batteryId: `BATTERY_${i + 1}`,
                inverterId: `INVERTER_${i + 1}`,
                metadata: {
                    signalStrength: 70 + Math.random() * 30,
                    uptime: 86400 + Math.random() * 86400,
                    freeMemory: 15000 + Math.random() * 35000,
                    firmwareVersion: '1.2.3'
                },
                isTestData: true,
                isAnomaly: solarData.status !== 'normal'
            });
            
            if (solarData.status !== 'normal') {
                sensorReading.anomalyReason = `Auto-generated ${solarData.status} condition`;
            }
            
            sensorData.push(sensorReading);
            dataCount++;
            
            // Insert in batches to avoid memory issues
            if (sensorData.length >= 1000) {
                await SensorData.insertMany(sensorData);
                sensorData.length = 0; // Clear array
                log.info(`Generated ${dataCount} sensor readings...`);
            }
        }
        
        // Move to next time interval
        currentTime.setMinutes(currentTime.getMinutes() + intervalMinutes);
    }
    
    // Insert any remaining data
    if (sensorData.length > 0) {
        await SensorData.insertMany(sensorData);
    }
    
    log.success(`Generated ${dataCount} sensor readings`);
    return dataCount;
};

// Generate test alerts based on sensor data
const generateTestAlerts = async () => {
    log.step('Generating test alerts...');
    
    // Get recent sensor data with anomalies
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const anomalyData = await SensorData.find({
        isAnomaly: true,
        timestamp: { $gte: oneWeekAgo },
        isTestData: true
    }).limit(20);
    
    const alertTemplates = [
        {
            type: 'voltage_drop',
            severity: 'critical',
            title: 'Critical Voltage Drop',
            message: 'System voltage dropped below safe operating level.'
        },
        {
            type: 'voltage_drop',
            severity: 'warning',
            title: 'Low Voltage Warning',
            message: 'Voltage is lower than expected. Monitor system performance.'
        },
        {
            type: 'temperature_high',
            severity: 'high',
            title: 'High Temperature Alert',
            message: 'System temperature exceeded safe operating range.'
        },
        {
            type: 'temperature_high',
            severity: 'medium',
            title: 'Elevated Temperature',
            message: 'Temperature is higher than normal. Check ventilation.'
        },
        {
            type: 'current_anomaly',
            severity: 'medium',
            title: 'Current Fluctuation',
            message: 'Unusual current pattern detected.'
        },
        {
            type: 'battery_low',
            severity: 'high',
            title: 'Low Battery Capacity',
            message: 'Battery capacity is below recommended level.'
        },
        {
            type: 'panel_fault',
            severity: 'critical',
            title: 'Panel Performance Degradation',
            message: 'Solar panel output has significantly decreased.'
        }
    ];
    
    const alerts = [];
    
    // Create alerts for anomaly data
    anomalyData.forEach((data, index) => {
        const template = alertTemplates[index % alertTemplates.length];
        const severityLevels = ['low', 'medium', 'high', 'critical'];
        const randomSeverity = severityLevels[Math.floor(Math.random() * severityLevels.length)];
        
        const alert = new Alert({
            type: template.type,
            severity: randomSeverity,
            title: template.title,
            message: `${template.message} Detected at ${data.location}.`,
            deviceId: data.deviceId,
            sensorDataId: data._id,
            sensorValue: data.voltage.value || data.temperature.value || data.current.value,
            threshold: template.type === 'voltage_drop' ? 11.5 : 
                      template.type === 'temperature_high' ? 60 : 
                      template.type === 'battery_low' ? 30 : 0,
            unit: template.type === 'voltage_drop' ? 'V' : 
                  template.type === 'temperature_high' ? '°C' : 
                  template.type === 'battery_low' ? '%' : 'A',
            location: data.location,
            acknowledged: Math.random() > 0.5,
            resolved: Math.random() > 0.7,
            emailSent: Math.random() > 0.3,
            autoGenerated: true,
            isTestData: true,
            metadata: {
                previousValue: (data.voltage.value || data.temperature.value || data.current.value) * 0.9,
                rateOfChange: Math.random() * 10,
                duration: 30 + Math.random() * 120 // 30-150 minutes
            }
        });
        
        if (alert.acknowledged) {
            alert.acknowledgedAt = new Date(data.timestamp.getTime() + 30 * 60 * 1000);
        }
        
        if (alert.resolved) {
            alert.resolvedAt = new Date(data.timestamp.getTime() + 60 * 60 * 1000);
            alert.resolutionNotes = 'Issue resolved automatically. System back to normal operation.';
        }
        
        if (alert.emailSent) {
            alert.emailSentAt = new Date(data.timestamp.getTime() + 5 * 60 * 1000);
        }
        
        alerts.push(alert);
    });
    
    // Insert alerts
    if (alerts.length > 0) {
        await Alert.insertMany(alerts);
        log.success(`Generated ${alerts.length} test alerts`);
    } else {
        log.warn('No anomaly data found to generate alerts from');
    }
    
    return alerts.length;
};

// Display statistics
const displayStatistics = async () => {
    log.step('Test Data Statistics');
    console.log('=' .repeat(50));
    
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - options.days);
    
    const stats = {
        totalSensorData: await SensorData.countDocuments({ isTestData: true }),
        recentSensorData: await SensorData.countDocuments({
            isTestData: true,
            timestamp: { $gte: weekAgo }
        }),
        totalAlerts: await Alert.countDocuments({ isTestData: true }),
        recentAlerts: await Alert.countDocuments({
            isTestData: true,
            createdAt: { $gte: weekAgo }
        }),
        criticalAlerts: await Alert.countDocuments({
            isTestData: true,
            severity: 'critical'
        }),
        unresolvedAlerts: await Alert.countDocuments({
            isTestData: true,
            resolved: false
        })
    };
    
    console.log(`
${colors.green}✅ Test Data Generation Complete${colors.reset}

${colors.cyan}Data Overview:${colors.reset}
  • Total Sensor Readings: ${stats.totalSensorData}
  • Recent Sensor Readings (last ${options.days} days): ${stats.recentSensorData}
  • Total Alerts: ${stats.totalAlerts}
  • Recent Alerts: ${stats.recentAlerts}
  • Critical Alerts: ${stats.criticalAlerts}
  • Unresolved Alerts: ${stats.unresolvedAlerts}

${colors.cyan}Data Characteristics:${colors.reset}
  • Time Period: ${options.days} days
  • Interval: 10 minutes between readings
  • Devices: 3 ESP32 devices simulated
  • Locations: Main building, clinic, and staff quarters
  • Includes: Day/night cycles, seasonal variations, random anomalies

${colors.cyan}Sample Queries to Try:${colors.reset}
  1. View real-time dashboard
  2. Check recent alerts
  3. Generate daily/weekly reports
  4. Test email notifications
  5. Explore system analytics

${colors.yellow}Note:${colors.reset} This is test data for development purposes only.
    `);
};

// Main function
const generateTestData = async () => {
    try {
        log.step('Starting test data generation...');
        
        // Connect to database
        await connectDB();
        
        // Clean existing test data if requested
        if (options.clean) {
            await cleanTestData();
        }
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - options.days);
        
        // Generate sensor data
        await generateSensorData(startDate, endDate, 10); // 10-minute intervals
        
        // Generate alerts
        await generateTestAlerts();
        
        // Display statistics
        await displayStatistics();
        
        // Close connection
        await mongoose.connection.close();
        log.success('Database connection closed');
        
        process.exit(0);
        
    } catch (error) {
        log.error(`Test data generation failed: ${error.message}`);
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

// Install faker if not already installed
try {
    require('@faker-js/faker');
} catch (error) {
    log.error('@faker-js/faker package is required. Please install it:');
    console.log(`  npm install @faker-js/faker`);
    process.exit(1);
}

// Run test data generation
generateTestData();