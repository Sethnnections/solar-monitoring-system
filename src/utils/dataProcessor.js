const { UNITS } = require('../config/constants');

class DataProcessor {
    // Process raw sensor data from ESP32
    static processSensorData(rawData) {
        try {
            const processed = {
                timestamp: new Date(),
                raw: rawData,
                voltage: null,
                current: null,
                temperature: null,
                power: null,
                energy: null,
                status: 'normal',
            };
            
            // Parse voltage (assuming rawData has voltage field)
            if (rawData.voltage !== undefined) {
                processed.voltage = parseFloat(rawData.voltage);
            }
            
            // Parse current
            if (rawData.current !== undefined) {
                processed.current = parseFloat(rawData.current);
            }
            
            // Parse temperature
            if (rawData.temperature !== undefined) {
                processed.temperature = parseFloat(rawData.temperature);
            }
            
            // Calculate power if both voltage and current are available
            if (processed.voltage !== null && processed.current !== null) {
                processed.power = processed.voltage * processed.current;
            }
            
            // Calculate energy (this would require time-based integration)
            // For now, we'll leave it null - it will be calculated elsewhere
            
            // Determine status based on values
            processed.status = this.determineStatus(processed);
            
            return processed;
        } catch (error) {
            console.error('Error processing sensor data:', error);
            return null;
        }
    }
    
    static determineStatus(data) {
        if (!data.voltage || data.voltage < 10) return 'critical';
        if (!data.current || data.current < 0.1) return 'warning';
        if (data.temperature && data.temperature > 60) return 'warning';
        return 'normal';
    }
    
    // Calculate energy consumption/generation over time
    static calculateEnergyConsumption(dataPoints) {
        if (!dataPoints || dataPoints.length < 2) return 0;
        
        let totalEnergy = 0;
        
        // Sort by timestamp
        dataPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        for (let i = 1; i < dataPoints.length; i++) {
            const prev = dataPoints[i - 1];
            const curr = dataPoints[i];
            
            // Calculate time difference in hours
            const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / (1000 * 3600);
            
            // Calculate average power
            const avgPower = ((prev.power || 0) + (curr.power || 0)) / 2;
            
            // Energy = Power × Time
            totalEnergy += avgPower * timeDiff;
        }
        
        // Convert to kWh
        return totalEnergy / 1000;
    }
    
    // Calculate daily statistics
    static calculateDailyStats(dataPoints) {
        if (!dataPoints || dataPoints.length === 0) {
            return {
                totalEnergy: 0,
                avgVoltage: 0,
                avgCurrent: 0,
                maxTemperature: 0,
                minVoltage: 0,
                peakPower: 0,
                efficiency: 0,
            };
        }
        
        let totalVoltage = 0;
        let totalCurrent = 0;
        let maxTemperature = -Infinity;
        let minVoltage = Infinity;
        let peakPower = 0;
        
        const validVoltagePoints = dataPoints.filter(d => d.voltage !== null);
        const validCurrentPoints = dataPoints.filter(d => d.current !== null);
        const validTemperaturePoints = dataPoints.filter(d => d.temperature !== null);
        
        validVoltagePoints.forEach(data => {
            totalVoltage += data.voltage;
            minVoltage = Math.min(minVoltage, data.voltage);
        });
        
        validCurrentPoints.forEach(data => {
            totalCurrent += data.current;
        });
        
        validTemperaturePoints.forEach(data => {
            maxTemperature = Math.max(maxTemperature, data.temperature);
        });
        
        // Calculate peak power
        dataPoints.forEach(data => {
            if (data.power && data.power > peakPower) {
                peakPower = data.power;
            }
        });
        
        // Calculate total energy for the day
        const totalEnergy = this.calculateEnergyConsumption(dataPoints);
        
        // Calculate efficiency (percentage of expected output)
        // Assuming ideal conditions: 5 hours of peak sun at rated power
        const ratedPower = 100; // Watts (example - should be configurable)
        const expectedEnergy = (ratedPower * 5) / 1000; // kWh
        const efficiency = expectedEnergy > 0 ? (totalEnergy / expectedEnergy) * 100 : 0;
        
        return {
            totalEnergy: parseFloat(totalEnergy.toFixed(3)),
            avgVoltage: validVoltagePoints.length > 0 ? 
                parseFloat((totalVoltage / validVoltagePoints.length).toFixed(2)) : 0,
            avgCurrent: validCurrentPoints.length > 0 ? 
                parseFloat((totalCurrent / validCurrentPoints.length).toFixed(3)) : 0,
            maxTemperature: maxTemperature !== -Infinity ? 
                parseFloat(maxTemperature.toFixed(1)) : 0,
            minVoltage: minVoltage !== Infinity ? 
                parseFloat(minVoltage.toFixed(2)) : 0,
            peakPower: parseFloat(peakPower.toFixed(1)),
            efficiency: parseFloat(efficiency.toFixed(1)),
            dataPoints: dataPoints.length,
        };
    }
    
    // Calculate weekly/monthly statistics
    static calculatePeriodStats(dataByDay, period = 'weekly') {
        const stats = {
            totalEnergy: 0,
            avgDailyEnergy: 0,
            peakDailyEnergy: 0,
            bestDay: null,
            worstDay: null,
            consistency: 0, // Percentage of days with energy production
            daysWithData: 0,
            totalDays: dataByDay.length,
        };
        
        if (dataByDay.length === 0) return stats;
        
        let totalEnergy = 0;
        let peakEnergy = 0;
        let bestDayData = null;
        let worstDayData = null;
        let daysWithProduction = 0;
        
        dataByDay.forEach(dayData => {
            const dayEnergy = dayData.totalEnergy || 0;
            totalEnergy += dayEnergy;
            
            if (dayEnergy > peakEnergy) {
                peakEnergy = dayEnergy;
                bestDayData = dayData;
            }
            
            if (worstDayData === null || dayEnergy < (worstDayData.totalEnergy || 0)) {
                worstDayData = dayData;
            }
            
            if (dayEnergy > 0) {
                daysWithProduction++;
            }
        });
        
        stats.totalEnergy = parseFloat(totalEnergy.toFixed(3));
        stats.avgDailyEnergy = parseFloat((totalEnergy / dataByDay.length).toFixed(3));
        stats.peakDailyEnergy = parseFloat(peakEnergy.toFixed(3));
        stats.bestDay = bestDayData;
        stats.worstDay = worstDayData;
        stats.daysWithData = daysWithProduction;
        stats.consistency = parseFloat(((daysWithProduction / dataByDay.length) * 100).toFixed(1));
        
        return stats;
    }
    
    // Generate time-series data for charts
    static generateTimeSeriesData(dataPoints, interval = 'hour') {
        const timeSeries = [];
        
        if (!dataPoints || dataPoints.length === 0) return timeSeries;
        
        // Group data by time interval
        const grouped = {};
        
        dataPoints.forEach(data => {
            const date = new Date(data.timestamp);
            let key;
            
            switch (interval) {
                case 'hour':
                    key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:00`;
                    break;
                case 'day':
                    key = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
                    break;
                case 'week':
                    const weekNumber = Math.ceil(date.getDate() / 7);
                    key = `${date.getFullYear()}-W${weekNumber}`;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }
            
            if (!grouped[key]) {
                grouped[key] = {
                    timestamp: key,
                    voltages: [],
                    currents: [],
                    temperatures: [],
                    powers: [],
                };
            }
            
            if (data.voltage) grouped[key].voltages.push(data.voltage);
            if (data.current) grouped[key].currents.push(data.current);
            if (data.temperature) grouped[key].temperatures.push(data.temperature);
            if (data.power) grouped[key].powers.push(data.power);
        });
        
        // Calculate averages for each time interval
        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            const avgVoltage = group.voltages.length > 0 ? 
                group.voltages.reduce((a, b) => a + b, 0) / group.voltages.length : 0;
            const avgCurrent = group.currents.length > 0 ? 
                group.currents.reduce((a, b) => a + b, 0) / group.currents.length : 0;
            const avgTemperature = group.temperatures.length > 0 ? 
                group.temperatures.reduce((a, b) => a + b, 0) / group.temperatures.length : 0;
            const avgPower = group.powers.length > 0 ? 
                group.powers.reduce((a, b) => a + b, 0) / group.powers.length : 0;
            
            timeSeries.push({
                timestamp: key,
                voltage: parseFloat(avgVoltage.toFixed(2)),
                current: parseFloat(avgCurrent.toFixed(3)),
                temperature: parseFloat(avgTemperature.toFixed(1)),
                power: parseFloat(avgPower.toFixed(1)),
                readings: group.voltages.length,
            });
        });
        
        // Sort by timestamp
        timeSeries.sort((a, b) => {
            if (a.timestamp < b.timestamp) return -1;
            if (a.timestamp > b.timestamp) return 1;
            return 0;
        });
        
        return timeSeries;
    }
    
    // Detect anomalies in sensor data
    static detectAnomalies(dataPoint, previousData) {
        const anomalies = [];
        
        if (!dataPoint) return anomalies;
        
        // Check for sudden voltage drop
        if (previousData && dataPoint.voltage && previousData.voltage) {
            const voltageDrop = previousData.voltage - dataPoint.voltage;
            if (voltageDrop > 2) { // More than 2V drop
                anomalies.push({
                    type: 'voltage_drop',
                    severity: voltageDrop > 5 ? 'critical' : 'warning',
                    message: `Sudden voltage drop detected: ${voltageDrop.toFixed(2)}V`,
                    value: dataPoint.voltage,
                    previous: previousData.voltage,
                });
            }
        }
        
        // Check for zero current when voltage is present
        if (dataPoint.voltage && dataPoint.voltage > 12 && dataPoint.current < 0.1) {
            anomalies.push({
                type: 'zero_current',
                severity: 'warning',
                message: 'Voltage present but no current detected',
                value: dataPoint.current,
            });
        }
        
        // Check for high temperature
        if (dataPoint.temperature && dataPoint.temperature > 50) {
            anomalies.push({
                type: 'high_temperature',
                severity: dataPoint.temperature > 60 ? 'critical' : 'warning',
                message: `High temperature detected: ${dataPoint.temperature.toFixed(1)}°C`,
                value: dataPoint.temperature,
            });
        }
        
        return anomalies;
    }
    
    // Generate summary report data
    static generateSummaryReport(dataPoints, startDate, endDate) {
        const dailyStats = this.calculateDailyStats(dataPoints);
        const timeSeries = this.generateTimeSeriesData(dataPoints, 'hour');
        
        return {
            period: {
                start: startDate,
                end: endDate,
                days: Math.ceil((endDate - startDate) / (1000 * 3600 * 24)),
            },
            summary: dailyStats,
            timeSeries: timeSeries,
            peakPerformance: {
                hour: this.findPeakHour(timeSeries),
                day: this.findPeakDay(dataPoints),
            },
            recommendations: this.generateRecommendations(dailyStats),
        };
    }
    
    static findPeakHour(timeSeries) {
        if (!timeSeries || timeSeries.length === 0) return null;
        
        let peakHour = timeSeries[0];
        timeSeries.forEach(hour => {
            if (hour.power > peakHour.power) {
                peakHour = hour;
            }
        });
        
        return peakHour;
    }
    
    static findPeakDay(dataPoints) {
        // Group by day and find day with highest total energy
        const byDay = {};
        
        dataPoints.forEach(data => {
            const date = new Date(data.timestamp).toISOString().split('T')[0];
            if (!byDay[date]) byDay[date] = [];
            byDay[date].push(data);
        });
        
        let peakDay = null;
        let peakEnergy = 0;
        
        Object.keys(byDay).forEach(date => {
            const dayEnergy = this.calculateEnergyConsumption(byDay[date]);
            if (dayEnergy > peakEnergy) {
                peakEnergy = dayEnergy;
                peakDay = {
                    date,
                    energy: dayEnergy,
                    dataPoints: byDay[date].length,
                };
            }
        });
        
        return peakDay;
    }
    
    static generateRecommendations(stats) {
        const recommendations = [];
        
        if (stats.efficiency < 70) {
            recommendations.push({
                type: 'efficiency',
                priority: 'high',
                message: 'System efficiency is low. Consider cleaning solar panels or checking connections.',
                action: 'Clean panels and inspect wiring',
            });
        }
        
        if (stats.minVoltage < 11.5) {
            recommendations.push({
                type: 'voltage',
                priority: 'critical',
                message: 'Low voltage detected. Battery may need replacement or charging system check.',
                action: 'Check battery health and charge controller',
            });
        }
        
        if (stats.maxTemperature > 55) {
            recommendations.push({
                type: 'temperature',
                priority: 'medium',
                message: 'High operating temperature detected. Ensure proper ventilation.',
                action: 'Improve ventilation around equipment',
            });
        }
        
        if (stats.dataPoints < 100) {
            recommendations.push({
                type: 'data',
                priority: 'low',
                message: 'Limited data points collected. Consider increasing data collection frequency.',
                action: 'Adjust ESP32 data transmission interval',
            });
        }
        
        return recommendations;
    }
}

module.exports = DataProcessor;