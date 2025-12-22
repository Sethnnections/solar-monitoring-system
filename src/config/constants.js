module.exports = {
    // Alert Severity Levels
    ALERT_SEVERITY: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical',
    },
    
    // Alert Types
    ALERT_TYPES: {
        VOLTAGE_DROP: 'voltage_drop',
        CURRENT_ANOMALY: 'current_anomaly',
        TEMPERATURE_HIGH: 'temperature_high',
        SYSTEM_OFFLINE: 'system_offline',
        BATTERY_LOW: 'battery_low',
        PANEL_FAULT: 'panel_fault',
    },
    
    // User Roles
    USER_ROLES: {
        ADMIN: 'admin',
        TECHNICIAN: 'technician',
        VIEWER: 'viewer',
    },
    
    // Sensor Units
    UNITS: {
        VOLTAGE: 'V',
        CURRENT: 'A',
        POWER: 'W',
        ENERGY: 'kWh',
        TEMPERATURE: '°C',
    },
    
    // Report Types
    REPORT_TYPES: {
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        CUSTOM: 'custom',
    },
    
    // Default Thresholds (percentage of normal)
    THRESHOLDS: {
        VOLTAGE_LOW: parseFloat(process.env.VOLTAGE_THRESHOLD_LOW) || 20,
        VOLTAGE_CRITICAL: parseFloat(process.env.VOLTAGE_THRESHOLD_CRITICAL) || 10,
        CURRENT_LOW: parseFloat(process.env.CURRENT_THRESHOLD_LOW) || 15,
        TEMPERATURE_HIGH: parseFloat(process.env.TEMPERATURE_THRESHOLD_HIGH) || 60,
    },
    
    // System Constants
    SYSTEM: {
        DATA_LOG_INTERVAL: parseInt(process.env.DATA_LOG_INTERVAL) || 10, // seconds
        ALERT_CHECK_INTERVAL: parseInt(process.env.ALERT_CHECK_INTERVAL) || 60, // seconds
        REPORT_RETENTION_DAYS: parseInt(process.env.REPORT_RETENTION_DAYS) || 90,
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
    },
};