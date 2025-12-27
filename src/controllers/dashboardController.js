const { SensorData, Alert, SystemConfig } = require('../models');
const DataProcessor = require('../utils/dataProcessor');
const Helpers = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');

class DashboardController {
    // Render main dashboard
    static async renderDashboard(req, res) {
        try {
            // Get latest sensor data
            const latestData = await SensorData.getLatest();
            
            // Get recent alerts
            const recentAlerts = await Alert.find({ resolved: false })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('acknowledgedBy', 'name')
                .populate('resolvedBy', 'name');
            
            // Get system status
            const systemStatus = await SensorData.getSystemStatus();
            
            // Get alert statistics
            const alertStats = await Alert.getStatistics(7); // Last 7 days
            
            // Get daily summary for today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dailySummary = await SensorData.getDailySummary(today);
            
            res.render('pages/dashboard', {
                title: 'Dashboard - Solar Monitoring System',
                user: req.session.user,
                latestData,
                recentAlerts,
                systemStatus,
                alertStats,
                dailySummary,
                helpers: Helpers,
                currentTime: new Date().toLocaleTimeString(),
                success: null,
                error: null
            });
            
        } catch (error) {
            console.error('Render dashboard error:', error);
            res.status(500).render('pages/dashboard', {
                title: 'Dashboard - Solar Monitoring System',
                user: req.session.user,
                latestData: null,
                recentAlerts: [],
                systemStatus: { status: 'error', message: 'Failed to load system data' },
                alertStats: null,
                dailySummary: null,
                helpers: Helpers,
                currentTime: new Date().toLocaleTimeString(),
                success: null,
                error: 'Failed to load dashboard data'
            });
        }
    }
    
    // Get real-time data (API)
    static async getRealtimeData(req, res) {
        try {
            const latestData = await SensorData.getLatest();
            
            if (!latestData) {
                return res.json({
                    success: false,
                    message: 'No data available',
                    data: null
                });
            }
            
            // Calculate power if not already calculated
            if (!latestData.power || !latestData.power.value) {
                latestData.power = {
                    value: latestData.voltage.value * latestData.current.value,
                    unit: 'W'
                };
            }
            
            // Calculate health score
            const healthScore = Helpers.calculateHealthScore({
                voltage: latestData.voltage.value,
                current: latestData.current.value,
                temperature: latestData.temperature.value
            });
            
            const response = {
                success: true,
                timestamp: latestData.timestamp,
                data: {
                    voltage: {
                        value: latestData.voltage.value,
                        unit: latestData.voltage.unit,
                        status: latestData.voltage.value < 11.5 ? 'warning' : 'normal'
                    },
                    current: {
                        value: latestData.current.value,
                        unit: latestData.current.unit,
                        status: latestData.current.value < 0.5 ? 'warning' : 'normal'
                    },
                    temperature: {
                        value: latestData.temperature.value,
                        unit: latestData.temperature.unit,
                        status: latestData.temperature.value > 60 ? 'warning' : 'normal'
                    },
                    power: {
                        value: latestData.power.value,
                        unit: latestData.power.unit
                    },
                    batteryLevel: latestData.batteryLevel || 0,
                    status: latestData.status,
                    healthScore,
                    deviceId: latestData.deviceId,
                    location: latestData.location
                }
            };
            
            res.json(response);
            
        } catch (error) {
            console.error('Get realtime data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get real-time data',
                error: error.message
            });
        }
    }
    
    // Get historical data (API)
    static async getHistoricalData(req, res) {
        try {
            const { period = '24h', interval = 'hour', deviceId = 'ESP32_SOLAR_01' } = req.query;
            
            // Calculate time range
            let startDate = new Date();
            let endDate = new Date();
            
            switch (period) {
                case '1h':
                    startDate.setHours(startDate.getHours() - 1);
                    break;
                case '6h':
                    startDate.setHours(startDate.getHours() - 6);
                    break;
                case '12h':
                    startDate.setHours(startDate.getHours() - 12);
                    break;
                case '24h':
                    startDate.setDate(startDate.getDate() - 1);
                    break;
                case '7d':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                default:
                    startDate.setDate(startDate.getDate() - 1);
            }
            
            // Get data from database
            const data = await SensorData.getRange(startDate, endDate, deviceId);
            
            // Process data for charts
            const processedData = DataProcessor.generateTimeSeriesData(data, interval);
            
            res.json({
                success: true,
                period,
                interval,
                deviceId,
                startDate,
                endDate,
                count: data.length,
                data: processedData
            });
            
        } catch (error) {
            console.error('Get historical data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get historical data',
                error: error.message
            });
        }
    }
    
    // Get system statistics (API)
    static async getSystemStats(req, res) {
        try {
            // Get data for last 24 hours
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 1);
            
            const data = await SensorData.getRange(startDate, endDate);
            
            // Calculate statistics
            const stats = DataProcessor.calculateDailyStats(data);
            
            // Get alert count for today
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            
            const alertsToday = await Alert.countDocuments({
                createdAt: { $gte: todayStart, $lte: todayEnd }
            });
            
            // Get system uptime (percentage of time with data in last 24h)
            const expectedReadings = 24 * 6; // Every 10 minutes for 24 hours
            const uptime = data.length > 0 ? 
                Math.min(100, (data.length / expectedReadings) * 100) : 0;
            
            const response = {
                success: true,
                stats: {
                    ...stats,
                    alertsToday,
                    uptime: parseFloat(uptime.toFixed(1)),
                    dataCompleteness: `${data.length}/${expectedReadings} readings`
                }
            };
            
            res.json(response);
            
        } catch (error) {
            console.error('Get system stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system statistics',
                error: error.message
            });
        }
    }
    
    // Get device list (API)
    static async getDevices(req, res) {
        try {
            const devices = await SensorData.aggregate([
                {
                    $group: {
                        _id: '$deviceId',
                        lastSeen: { $max: '$timestamp' },
                        location: { $first: '$location' },
                        status: { $last: '$status' },
                        count: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        deviceId: '$_id',
                        lastSeen: 1,
                        location: 1,
                        status: 1,
                        count: 1,
                        isOnline: {
                            $cond: {
                                if: { $gt: [{ $subtract: [new Date(), '$lastSeen'] }, 5 * 60 * 1000] },
                                then: false,
                                else: true
                            }
                        }
                    }
                },
                { $sort: { lastSeen: -1 } }
            ]);
            
            res.json({
                success: true,
                count: devices.length,
                data: devices
            });
            
        } catch (error) {
            console.error('Get devices error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get device list',
                error: error.message
            });
        }
    }
    
    // Render live data page
    static async renderLiveData(req, res) {
        try {
            // Get latest data for all devices
            const latestReadings = await SensorData.aggregate([
                {
                    $sort: { timestamp: -1 }
                },
                {
                    $group: {
                        _id: '$deviceId',
                        latestData: { $first: '$$ROOT' }
                    }
                }
            ]);
            
            // Get system configuration for thresholds
            const voltageThreshold = await SystemConfig.get('ALERT_VOLTAGE_LOW', 20);
            const tempThreshold = await SystemConfig.get('ALERT_TEMPERATURE_HIGH', 60);
            
            res.render('pages/live-data', {
                title: 'Live Data - Solar Monitoring System',
                user: req.session.user,
                latestReadings,
                voltageThreshold,
                tempThreshold,
                helpers: Helpers,
                currentTime: new Date().toLocaleTimeString()
            });
            
        } catch (error) {
            console.error('Render live data error:', error);
            res.status(500).render('pages/live-data', {
                title: 'Live Data - Solar Monitoring System',
                user: req.session.user,
                latestReadings: [],
                voltageThreshold: 20,
                tempThreshold: 60,
                helpers: Helpers,
                currentTime: new Date().toLocaleTimeString(),
                error: 'Failed to load live data'
            });
        }
    }
    
    // Get data for specific device (API)
    static async getDeviceData(req, res) {
        try {
            const { deviceId } = req.params;
            const { limit = 100, sort = '-timestamp' } = req.query;
            
            const data = await SensorData.find({ deviceId })
                .sort(sort)
                .limit(parseInt(limit));
            
            res.json({
                success: true,
                deviceId,
                count: data.length,
                data
            });
            
        } catch (error) {
            console.error('Get device data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get device data',
                error: error.message
            });
        }
    }
    
    // Get energy production summary (API)
    static async getEnergySummary(req, res) {
        try {
            const { days = 7 } = req.query;
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            // Get daily summaries
            const dailySummaries = [];
            let currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
                const summary = await SensorData.getDailySummary(currentDate);
                if (summary) {
                    dailySummaries.push(summary);
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Calculate total energy
            const totalEnergy = dailySummaries.reduce((sum, day) => sum + day.totalEnergy, 0);
            
            // Calculate average daily energy
            const avgDailyEnergy = dailySummaries.length > 0 ? 
                totalEnergy / dailySummaries.length : 0;
            
            // Find best and worst days
            const bestDay = dailySummaries.reduce((best, day) => 
                day.totalEnergy > best.totalEnergy ? day : best, 
                { totalEnergy: 0 }
            );
            
            const worstDay = dailySummaries.reduce((worst, day) => 
                day.totalEnergy < worst.totalEnergy ? day : worst, 
                { totalEnergy: Infinity }
            );
            
            res.json({
                success: true,
                period: {
                    start: startDate,
                    end: endDate,
                    days: parseInt(days)
                },
                summary: {
                    totalEnergy: parseFloat(totalEnergy.toFixed(3)),
                    avgDailyEnergy: parseFloat(avgDailyEnergy.toFixed(3)),
                    bestDay: bestDay.totalEnergy > 0 ? bestDay : null,
                    worstDay: worstDay.totalEnergy < Infinity ? worstDay : null,
                    daysWithData: dailySummaries.length,
                    efficiency: dailySummaries.length > 0 ? 
                        dailySummaries.reduce((sum, day) => sum + day.efficiency, 0) / dailySummaries.length : 0
                },
                dailySummaries
            });
            
        } catch (error) {
            console.error('Get energy summary error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get energy summary',
                error: error.message
            });
        }
    }
    
    // Get predictive maintenance insights (API)
    static async getPredictiveInsights(req, res) {
        try {
            // Get last 7 days of data
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            const data = await SensorData.getRange(startDate, endDate);
            
            if (data.length < 10) {
                return res.json({
                    success: true,
                    message: 'Insufficient data for predictive analysis',
                    insights: []
                });
            }
            
            // Analyze trends
            const insights = [];
            
            // Check voltage trend
            const voltageTrend = DataProcessor.analyzeTrend(
                data.map(d => d.voltage.value).filter(v => v !== null)
            );
            
            if (voltageTrend.slope < -0.05) {
                insights.push({
                    type: 'battery_degradation',
                    severity: 'medium',
                    confidence: Math.abs(voltageTrend.slope * 1000),
                    message: 'Battery voltage showing declining trend',
                    recommendation: 'Schedule battery maintenance check',
                    expectedImpact: 'Reduced backup capacity'
                });
            }
            
            // Check temperature trend
            const tempTrend = DataProcessor.analyzeTrend(
                data.map(d => d.temperature.value).filter(t => t !== null)
            );
            
            if (tempTrend.slope > 0.1) {
                insights.push({
                    type: 'overheating_risk',
                    severity: 'high',
                    confidence: tempTrend.slope * 100,
                    message: 'Operating temperature trending upward',
                    recommendation: 'Improve ventilation or add cooling',
                    expectedImpact: 'Reduced component lifespan'
                });
            }
            
            // Check for efficiency decline
            const efficiencies = data.map(d => {
                if (d.voltage.value && d.current.value) {
                    const expectedPower = 12 * 5; // Assuming 12V, 5A normal
                    const actualPower = d.voltage.value * d.current.value;
                    return (actualPower / expectedPower) * 100;
                }
                return null;
            }).filter(e => e !== null);
            
            if (efficiencies.length > 10) {
                const efficiencyTrend = DataProcessor.analyzeTrend(efficiencies);
                if (efficiencyTrend.slope < -0.5) {
                    insights.push({
                        type: 'performance_degradation',
                        severity: 'high',
                        confidence: Math.abs(efficiencyTrend.slope * 20),
                        message: 'System efficiency declining',
                        recommendation: 'Clean solar panels and check connections',
                        expectedImpact: 'Reduced energy production'
                    });
                }
            }
            
            res.json({
                success: true,
                insights,
                dataPoints: data.length,
                analysisPeriod: '7 days'
            });
            
        } catch (error) {
            console.error('Get predictive insights error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get predictive insights',
                error: error.message
            });
        }
    }
    
    // Get weather impact analysis (API)
    static async getWeatherImpact(req, res) {
        try {
            // This would integrate with weather API in production
            // For now, simulate based on time of year and time of day
            
            const now = new Date();
            const month = now.getMonth(); // 0-11
            const hour = now.getHours();
            
            // Simulate weather conditions based on Malawi climate
            const seasons = {
                0: 'Rainy',  // Jan
                1: 'Rainy',  // Feb
                2: 'Rainy',  // Mar
                3: 'Cool',   // Apr
                4: 'Cool',   // May
                5: 'Cool',   // Jun
                6: 'Cool',   // Jul
                7: 'Hot',    // Aug
                8: 'Hot',    // Sep
                9: 'Hot',    // Oct
                10: 'Rainy', // Nov
                11: 'Rainy'  // Dec
            };
            
            const season = seasons[month];
            let weatherImpact = 0;
            let recommendation = '';
            
            switch (season) {
                case 'Rainy':
                    weatherImpact = -30; // 30% reduction due to clouds/rain
                    recommendation = 'Expect reduced output during rainy season';
                    break;
                case 'Hot':
                    weatherImpact = -10; // 10% reduction due to heat
                    recommendation = 'High temperatures may reduce panel efficiency';
                    break;
                case 'Cool':
                    weatherImpact = 5; // 5% improvement in cool weather
                    recommendation = 'Optimal conditions for solar production';
                    break;
            }
            
            // Adjust based on time of day
            if (hour < 6 || hour > 18) {
                weatherImpact = -100; // Night
                recommendation = 'No solar production at night';
            } else if (hour >= 10 && hour <= 14) {
                weatherImpact += 20; // Peak sun hours
            }
            
            res.json({
                success: true,
                weather: {
                    season,
                    currentHour: hour,
                    impactPercentage: weatherImpact,
                    recommendation,
                    expectedOutput: weatherImpact > -100 ? 'Reduced' : 'None',
                    notes: 'Based on seasonal patterns in Malawi'
                }
            });
            
        } catch (error) {
            console.error('Get weather impact error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get weather impact analysis',
                error: error.message
            });
        }
    }
}

module.exports = DashboardController;