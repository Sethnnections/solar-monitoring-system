const bcrypt = require('bcryptjs');
const { SYSTEM } = require('../config/constants');

class Helpers {
    // Password hashing
    static async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    }
    
    // Password comparison
    static async comparePassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }
    
    // Generate random string for passwords/reset tokens
    static generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Format date to readable string
    static formatDate(date, includeTime = true) {
        const d = new Date(date);
        const dateStr = d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        
        if (!includeTime) return dateStr;
        
        const timeStr = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
        
        return `${dateStr} at ${timeStr}`;
    }
    
    // Calculate time difference in human readable format
    static timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + ' year' + (interval > 1 ? 's' : '') + ' ago';
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + ' month' + (interval > 1 ? 's' : '') + ' ago';
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + ' day' + (interval > 1 ? 's' : '') + ' ago';
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + ' hour' + (interval > 1 ? 's' : '') + ' ago';
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + ' minute' + (interval > 1 ? 's' : '') + ' ago';
        
        return 'just now';
    }
    
    // Validate email format
    static isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // Format sensor data for display
    static formatSensorValue(value, unit) {
        if (value === null || value === undefined) return 'N/A';
        
        switch (unit) {
            case 'V':
                return `${value.toFixed(2)} V`;
            case 'A':
                return `${value.toFixed(3)} A`;
            case 'W':
                return `${value.toFixed(1)} W`;
            case 'kWh':
                return `${value.toFixed(3)} kWh`;
            case '°C':
                return `${value.toFixed(1)} °C`;
            default:
                return value;
        }
    }
    
    // Calculate energy from voltage and current
    static calculatePower(voltage, current) {
        return voltage * current; // Power in Watts
    }
    
    // Calculate energy (kWh) from power and time
    static calculateEnergy(powerWatts, hours) {
        return (powerWatts * hours) / 1000; // Convert to kWh
    }
    
    // Check if system is in maintenance window
    static isMaintenanceWindow() {
        const now = new Date();
        const hour = now.getHours();
        // Example: Maintenance window from 2 AM to 4 AM
        return hour >= 2 && hour < 4;
    }
    
    // Generate system health score (0-100)
    static calculateHealthScore(sensorData) {
        let score = 100;
        
        // Deduct points based on anomalies
        if (sensorData.voltage < 12) score -= 30; // Very low voltage
        else if (sensorData.voltage < 13) score -= 15; // Low voltage
        
        if (sensorData.current < 0.1) score -= 20; // Very low current
        else if (sensorData.current < 0.5) score -= 10; // Low current
        
        if (sensorData.temperature > 50) score -= 25; // High temperature
        
        // Ensure score is between 0 and 100
        return Math.max(0, Math.min(100, score));
    }
    
    // Validate API key (for ESP32 communication)
    static validateApiKey(apiKey) {
        // In production, validate against database
        // For now, use environment variable
        const validKeys = process.env.API_KEYS ? 
            process.env.API_KEYS.split(',') : 
            ['esp32_solar_monitoring_key'];
        
        return validKeys.includes(apiKey);
    }
    
    // Sanitize user input
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        // Remove potentially harmful characters
        return input
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/script/gi, '') // Remove script tags
            .trim();
    }
    
    // Create pagination metadata
    static createPagination(totalItems, currentPage, pageSize) {
        const totalPages = Math.ceil(totalItems / pageSize);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = currentPage > 1 ? currentPage - 1 : null;
        
        return {
            currentPage,
            pageSize,
            totalItems,
            totalPages,
            nextPage,
            prevPage,
            hasNext: nextPage !== null,
            hasPrev: prevPage !== null,
        };
    }
}

module.exports = Helpers;