const { THRESHOLDS, ALERT_SEVERITY, ALERT_TYPES } = require('../config/constants');
const EmailService = require('./emailService');
const Helpers = require('./helpers');

class AlertChecker {
    static async checkSensorData(sensorData, previousData = null) {
        const alerts = [];
        
        if (!sensorData) return alerts;
        
        // Check voltage thresholds
        if (sensorData.voltage !== null && sensorData.voltage !== undefined) {
            const voltageAlerts = this.checkVoltage(sensorData.voltage);
            alerts.push(...voltageAlerts);
        }
        
        // Check current thresholds
        if (sensorData.current !== null && sensorData.current !== undefined) {
            const currentAlerts = this.checkCurrent(sensorData.current);
            alerts.push(...currentAlerts);
        }
        
        // Check temperature thresholds
        if (sensorData.temperature !== null && sensorData.temperature !== undefined) {
            const tempAlerts = this.checkTemperature(sensorData.temperature);
            alerts.push(...tempAlerts);
        }
        
        // Check for anomalies compared to previous data
        if (previousData) {
            const anomalyAlerts = this.checkAnomalies(sensorData, previousData);
            alerts.push(...anomalyAlerts);
        }
        
        // Check for system offline (no data for extended period)
        // This would be handled by a separate scheduled job
        
        // Process alerts
        if (alerts.length > 0) {
            await this.processAlerts(alerts, sensorData);
        }
        
        return alerts;
    }
    
    static checkVoltage(voltage) {
        const alerts = [];
        const normalVoltage = 12; // Normal system voltage for 12V system
        
        if (voltage < normalVoltage * (THRESHOLDS.VOLTAGE_CRITICAL / 100)) {
            alerts.push({
                type: ALERT_TYPES.VOLTAGE_DROP,
                severity: ALERT_SEVERITY.CRITICAL,
                message: `Critical voltage drop detected: ${voltage.toFixed(2)}V`,
                value: voltage,
                threshold: `${THRESHOLDS.VOLTAGE_CRITICAL}% of normal`,
                actionRequired: true,
            });
        } else if (voltage < normalVoltage * (THRESHOLDS.VOLTAGE_LOW / 100)) {
            alerts.push({
                type: ALERT_TYPES.VOLTAGE_DROP,
                severity: ALERT_SEVERITY.HIGH,
                message: `Low voltage detected: ${voltage.toFixed(2)}V`,
                value: voltage,
                threshold: `${THRESHOLDS.VOLTAGE_LOW}% of normal`,
                actionRequired: true,
            });
        } else if (voltage < normalVoltage * 0.8) {
            alerts.push({
                type: ALERT_TYPES.VOLTAGE_DROP,
                severity: ALERT_SEVERITY.MEDIUM,
                message: `Voltage below optimal level: ${voltage.toFixed(2)}V`,
                value: voltage,
                threshold: '80% of normal',
                actionRequired: false,
            });
        }
        
        return alerts;
    }
    
    static checkCurrent(current) {
        const alerts = [];
        const normalCurrent = 5; // Assuming normal current flow
        
        if (current < normalCurrent * (THRESHOLDS.CURRENT_LOW / 100)) {
            alerts.push({
                type: ALERT_TYPES.CURRENT_ANOMALY,
                severity: ALERT_SEVERITY.HIGH,
                message: `Low current detected: ${current.toFixed(3)}A`,
                value: current,
                threshold: `${THRESHOLDS.CURRENT_LOW}% of normal`,
                actionRequired: true,
            });
        }
        
        // Check for zero current when system should be producing
        const hour = new Date().getHours();
        if (current === 0 && hour >= 8 && hour <= 16) {
            alerts.push({
                type: ALERT_TYPES.CURRENT_ANOMALY,
                severity: ALERT_SEVERITY.MEDIUM,
                message: 'No current detected during daylight hours',
                value: current,
                threshold: 'Minimum current during daylight',
                actionRequired: true,
            });
        }
        
        return alerts;
    }
    
    static checkTemperature(temperature) {
        const alerts = [];
        
        if (temperature > THRESHOLDS.TEMPERATURE_HIGH) {
            alerts.push({
                type: ALERT_TYPES.TEMPERATURE_HIGH,
                severity: temperature > 70 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
                message: `High temperature detected: ${temperature.toFixed(1)}°C`,
                value: temperature,
                threshold: `${THRESHOLDS.TEMPERATURE_HIGH}°C`,
                actionRequired: true,
            });
        }
        
        return alerts;
    }
    
    static checkAnomalies(currentData, previousData) {
        const alerts = [];
        
        // Check for sudden drops
        if (currentData.voltage && previousData.voltage) {
            const voltageChange = previousData.voltage - currentData.voltage;
            if (voltageChange > 3) { // More than 3V drop
                alerts.push({
                    type: ALERT_TYPES.VOLTAGE_DROP,
                    severity: ALERT_SEVERITY.CRITICAL,
                    message: `Sudden voltage drop: ${voltageChange.toFixed(2)}V decrease`,
                    value: currentData.voltage,
                    previousValue: previousData.voltage,
                    actionRequired: true,
                });
            }
        }
        
        // Check for rapid temperature rise
        if (currentData.temperature && previousData.temperature) {
            const tempRise = currentData.temperature - previousData.temperature;
            if (tempRise > 10) { // More than 10°C rise
                alerts.push({
                    type: ALERT_TYPES.TEMPERATURE_HIGH,
                    severity: ALERT_SEVERITY.HIGH,
                    message: `Rapid temperature rise: +${tempRise.toFixed(1)}°C`,
                    value: currentData.temperature,
                    previousValue: previousData.temperature,
                    actionRequired: true,
                });
            }
        }
        
        return alerts;
    }
    
    static async processAlerts(alerts, sensorData) {
        try {
            // Filter out duplicate or similar recent alerts
            const uniqueAlerts = await this.filterRecentDuplicates(alerts);
            
            if (uniqueAlerts.length === 0) return;
            
            // Save alerts to database (will be implemented when models are ready)
            // const savedAlerts = await Alert.insertMany(uniqueAlerts.map(alert => ({
            //     ...alert,
            //     sensorDataId: sensorData._id,
            //     timestamp: new Date(),
            //     acknowledged: false,
            // })));
            
            // Send email for critical and high severity alerts
            const emailAlerts = uniqueAlerts.filter(
                alert => alert.severity === ALERT_SEVERITY.CRITICAL || 
                        alert.severity === ALERT_SEVERITY.HIGH
            );
            
            for (const alert of emailAlerts) {
                try {
                    await EmailService.sendAlertEmail({
                        ...alert,
                        timestamp: new Date(),
                        sensorValue: Helpers.formatSensorValue(alert.value, this.getUnitForAlert(alert.type)),
                    });
                    
                    console.log(`📧 Alert email sent: ${alert.type} - ${alert.severity}`);
                } catch (emailError) {
                    console.error('Failed to send alert email:', emailError);
                }
            }
            
            // TODO: Send SMS notifications for critical alerts
            // TODO: Update dashboard in real-time via WebSocket
            
            console.log(`Processed ${uniqueAlerts.length} alerts`);
            
        } catch (error) {
            console.error('Error processing alerts:', error);
        }
    }
    
    static async filterRecentDuplicates(alerts) {
        // In a real implementation, this would check the database
        // for similar alerts in the last hour
        const uniqueAlerts = [];
        const seenKeys = new Set();
        
        // Simple deduplication based on type and rounded value
        alerts.forEach(alert => {
            const key = `${alert.type}_${Math.round(alert.value * 10)}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueAlerts.push(alert);
            }
        });
        
        return uniqueAlerts;
    }
    
    static getUnitForAlert(alertType) {
        switch (alertType) {
            case ALERT_TYPES.VOLTAGE_DROP:
            case ALERT_TYPES.BATTERY_LOW:
                return 'V';
            case ALERT_TYPES.CURRENT_ANOMALY:
                return 'A';
            case ALERT_TYPES.TEMPERATURE_HIGH:
                return '°C';
            default:
                return '';
        }
    }
    
    // Check for system offline (to be called by scheduled job)
    static async checkSystemOffline() {
        try {
            // Get the most recent sensor data
            // const latestData = await SensorData.findOne().sort({ timestamp: -1 });
            
            // if (!latestData) {
            //     return {
            //         type: ALERT_TYPES.SYSTEM_OFFLINE,
            //         severity: ALERT_SEVERITY.CRITICAL,
            //         message: 'No data received from system',
            //         actionRequired: true,
            //     };
            // }
            
            // const timeSinceLastUpdate = new Date() - latestData.timestamp;
            // const offlineThreshold = 5 * 60 * 1000; // 5 minutes
            
            // if (timeSinceLastUpdate > offlineThreshold) {
            //     return {
            //         type: ALERT_TYPES.SYSTEM_OFFLINE,
            //         severity: timeSinceLastUpdate > 30 * 60 * 1000 ? 
            //                   ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
            //         message: `System offline for ${Math.round(timeSinceLastUpdate / (60 * 1000))} minutes`,
            //         lastUpdate: latestData.timestamp,
            //         actionRequired: true,
            //     };
            // }
            
            return null;
        } catch (error) {
            console.error('Error checking system offline:', error);
            return null;
        }
    }
    
    // Predict potential failures based on trends
    static async predictFailures(sensorDataHistory) {
        const predictions = [];
        
        if (!sensorDataHistory || sensorDataHistory.length < 10) {
            return predictions;
        }
        
        // Analyze voltage trend
        const voltageTrend = this.analyzeTrend(
            sensorDataHistory.map(d => d.voltage).filter(v => v !== null)
        );
        
        if (voltageTrend.slope < -0.1) { // Voltage declining over time
            predictions.push({
                type: 'battery_degradation',
                confidence: 70,
                message: 'Battery voltage showing declining trend',
                expectedFailure: 'Within 1-2 weeks',
                recommendation: 'Schedule battery maintenance check',
            });
        }
        
        // Analyze temperature trend
        const tempTrend = this.analyzeTrend(
            sensorDataHistory.map(d => d.temperature).filter(t => t !== null)
        );
        
        if (tempTrend.slope > 0.05) { // Temperature increasing over time
            predictions.push({
                type: 'overheating_risk',
                confidence: 60,
                message: 'Operating temperature trending upward',
                expectedFailure: 'Potential overheating in hot conditions',
                recommendation: 'Improve ventilation or add cooling',
            });
        }
        
        return predictions;
    }
    
    static analyzeTrend(data) {
        if (data.length < 2) return { slope: 0, r2: 0 };
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        data.forEach((y, i) => {
            const x = i;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });
        
        const n = data.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate R-squared
        let ssTot = 0, ssRes = 0;
        const meanY = sumY / n;
        
        data.forEach((y, i) => {
            const x = i;
            const predicted = slope * x + intercept;
            ssTot += Math.pow(y - meanY, 2);
            ssRes += Math.pow(y - predicted, 2);
        });
        
        const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
        
        return {
            slope: parseFloat(slope.toFixed(4)),
            intercept: parseFloat(intercept.toFixed(4)),
            r2: parseFloat(r2.toFixed(4)),
        };
    }
}

module.exports = AlertChecker;