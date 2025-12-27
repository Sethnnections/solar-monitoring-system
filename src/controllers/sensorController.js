const { SensorData, Alert } = require('../models');
const DataProcessor = require('../utils/dataProcessor');
const AlertChecker = require('../utils/alertChecker');
const Helpers = require('../utils/helpers');

class SensorController {
    // Receive sensor data from ESP32 (API)
    static async receiveSensorData(req, res) {
        try {
            // Validate API key
            const apiKey = req.headers['x-api-key'] || req.query.apiKey;
            
            if (!Helpers.validateApiKey(apiKey)) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid API key',
                    timestamp: new Date().toISOString()
                });
            }
            
            const rawData = req.body;
            
            // Validate required fields
            if (!rawData || typeof rawData !== 'object') {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data format',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Process sensor data
            const processedData = DataProcessor.processSensorData(rawData);
            
            if (!processedData) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to process sensor data',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Create sensor data document
            const sensorData = new SensorData({
                deviceId: rawData.deviceId || 'ESP32_SOLAR_01',
                timestamp: processedData.timestamp,
                voltage: { value: processedData.voltage },
                current: { value: processedData.current },
                temperature: { value: processedData.temperature },
                power: processedData.power ? { value: processedData.power } : undefined,
                batteryLevel: rawData.batteryLevel,
                status: processedData.status,
                location: rawData.location || 'Kadidi Health Center, Lunzu, Blantyre',
                panelId: rawData.panelId,
                batteryId: rawData.batteryId,
                inverterId: rawData.inverterId,
                metadata: {
                    signalStrength: rawData.signalStrength,
                    uptime: rawData.uptime,
                    freeMemory: rawData.freeMemory,
                    firmwareVersion: rawData.firmwareVersion
                },
                isAnomaly: processedData.status !== 'normal'
            });
            
            // Save to database
            await sensorData.save();
            
            // Get previous reading for comparison
            const previousData = await SensorData.findOne({
                deviceId: sensorData.deviceId,
                _id: { $ne: sensorData._id }
            }).sort({ timestamp: -1 });
            
            // Check for alerts
            const alerts = await AlertChecker.checkSensorData(
                {
                    voltage: sensorData.voltage.value,
                    current: sensorData.current.value,
                    temperature: sensorData.temperature.value
                },
                previousData ? {
                    voltage: previousData.voltage.value,
                    current: previousData.current.value,
                    temperature: previousData.temperature.value
                } : null
            );
            
            // If alerts were generated, link them to sensor data
            if (alerts && alerts.length > 0) {
                // In a full implementation, we would create Alert documents here
                console.log(`Generated ${alerts.length} alerts for sensor data ${sensorData._id}`);
            }
            
            // Prepare response
            const response = {
                success: true,
                message: 'Sensor data received successfully',
                dataId: sensorData._id,
                timestamp: sensorData.timestamp,
                alerts: alerts.length,
                recommendations: []
            };
            
            // Add recommendations based on data
            if (sensorData.voltage.value < 11.5) {
                response.recommendations.push('Low voltage detected. Check battery and connections.');
            }
            
            if (sensorData.temperature.value > 60) {
                response.recommendations.push('High temperature detected. Ensure proper ventilation.');
            }
            
            if (sensorData.current.value < 0.1 && sensorData.voltage.value > 12) {
                response.recommendations.push('Voltage present but low current. Check solar panel output.');
            }
            
            res.json(response);
            
        } catch (error) {
            console.error('Receive sensor data error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Get sensor data by ID (API)
    static async getSensorData(req, res) {
        try {
            const { id } = req.params;
            
            const sensorData = await SensorData.findById(id);
            
            if (!sensorData) {
                return res.status(404).json({
                    success: false,
                    message: 'Sensor data not found'
                });
            }
            
            res.json({
                success: true,
                data: sensorData
            });
            
        } catch (error) {
            console.error('Get sensor data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get sensor data',
                error: error.message
            });
        }
    }
    
    // Get sensor data with filters (API)
    static async getSensorDataByFilter(req, res) {
        try {
            const {
                deviceId,
                startDate,
                endDate,
                status,
                limit = 100,
                page = 1,
                sort = '-timestamp'
            } = req.query;
            
            // Build query
            const query = {};
            
            if (deviceId) query.deviceId = deviceId;
            if (status) query.status = status;
            
            // Date range
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }
            
            // Pagination
            const pageSize = parseInt(limit);
            const skip = (parseInt(page) - 1) * pageSize;
            
            // Get total count
            const total = await SensorData.countDocuments(query);
            
            // Get data
            const data = await SensorData.find(query)
                .sort(sort)
                .skip(skip)
                .limit(pageSize);
            
            // Calculate pagination metadata
            const totalPages = Math.ceil(total / pageSize);
            const pagination = Helpers.createPagination(total, parseInt(page), pageSize);
            
            res.json({
                success: true,
                pagination,
                count: data.length,
                total,
                data
            });
            
        } catch (error) {
            console.error('Get sensor data by filter error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get sensor data',
                error: error.message
            });
        }
    }
    
    // Delete sensor data (admin only - API)
    static async deleteSensorData(req, res) {
        try {
            const { id } = req.params;
            
            // In production, add admin check here
            // if (req.session.user.role !== USER_ROLES.ADMIN) {
            //     return res.status(403).json({
            //         success: false,
            //         message: 'Access denied'
            //     });
            // }
            
            const sensorData = await SensorData.findById(id);
            
            if (!sensorData) {
                return res.status(404).json({
                    success: false,
                    message: 'Sensor data not found'
                });
            }
            
            await sensorData.deleteOne();
            
            res.json({
                success: true,
                message: 'Sensor data deleted successfully'
            });
            
        } catch (error) {
            console.error('Delete sensor data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete sensor data',
                error: error.message
            });
        }
    }
    
    // Bulk delete sensor data (admin only - API)
    static async bulkDeleteSensorData(req, res) {
        try {
            const { ids, olderThan, deviceId } = req.body;
            
            // In production, add admin check here
            
            let query = {};
            
            if (ids && Array.isArray(ids) && ids.length > 0) {
                query._id = { $in: ids };
            } else if (olderThan) {
                query.timestamp = { $lt: new Date(olderThan) };
            }
            
            if (deviceId) {
                query.deviceId = deviceId;
            }
            
            // Prevent deleting all data
            if (!ids && !olderThan) {
                return res.status(400).json({
                    success: false,
                    message: 'Must specify ids or olderThan date'
                });
            }
            
            const result = await SensorData.deleteMany(query);
            
            res.json({
                success: true,
                message: `Deleted ${result.deletedCount} sensor data records`,
                deletedCount: result.deletedCount
            });
            
        } catch (error) {
            console.error('Bulk delete sensor data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete sensor data',
                error: error.message
            });
        }
    }
    
    // Get sensor statistics (API)
    static async getSensorStatistics(req, res) {
        try {
            const { deviceId, days = 30 } = req.query;
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            // Build query
            const query = {
                timestamp: { $gte: startDate, $lte: endDate }
            };
            
            if (deviceId) query.deviceId = deviceId;
            
            // Get data
            const data = await SensorData.find(query);
            
            if (data.length === 0) {
                return res.json({
                    success: true,
                    message: 'No data found for the specified period',
                    statistics: null
                });
            }
            
            // Calculate statistics
            const statistics = DataProcessor.calculateDailyStats(data);
            
            // Additional statistics
            const voltages = data.map(d => d.voltage.value);
            const currents = data.map(d => d.current.value);
            const temperatures = data.map(d => d.temperature.value);
            
            const stats = {
                period: {
                    start: startDate,
                    end: endDate,
                    days: parseInt(days)
                },
                summary: statistics,
                detailed: {
                    voltage: {
                        min: Math.min(...voltages),
                        max: Math.max(...voltages),
                        avg: statistics.avgVoltage,
                        stdDev: this.calculateStdDev(voltages)
                    },
                    current: {
                        min: Math.min(...currents),
                        max: Math.max(...currents),
                        avg: statistics.avgCurrent,
                        stdDev: this.calculateStdDev(currents)
                    },
                    temperature: {
                        min: Math.min(...temperatures),
                        max: statistics.maxTemperature,
                        avg: temperatures.reduce((a, b) => a + b, 0) / temperatures.length,
                        stdDev: this.calculateStdDev(temperatures)
                    }
                },
                anomalies: await SensorData.countDocuments({
                    ...query,
                    isAnomaly: true
                }),
                deviceCount: deviceId ? 1 : await SensorData.distinct('deviceId', query).then(devices => devices.length)
            };
            
            res.json({
                success: true,
                statistics: stats
            });
            
        } catch (error) {
            console.error('Get sensor statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get sensor statistics',
                error: error.message
            });
        }
    }
    
    // Calculate standard deviation
    static calculateStdDev(values) {
        if (values.length === 0) return 0;
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquareDiff);
    }
    
    // Get sensor data export (API)
    static async exportSensorData(req, res) {
        try {
            const { format = 'json', startDate, endDate, deviceId } = req.query;
            
            // Build query
            const query = {};
            
            if (deviceId) query.deviceId = deviceId;
            
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }
            
            // Limit to last 30 days if no date specified
            if (!startDate && !endDate) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                query.timestamp = { $gte: thirtyDaysAgo };
            }
            
            // Get data
            const data = await SensorData.find(query)
                .sort({ timestamp: 1 })
                .limit(10000); // Safety limit
            
            if (data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No data found for export'
                });
            }
            
            // Format data based on requested format
            let exportData;
            let contentType;
            let filename;
            
            switch (format.toLowerCase()) {
                case 'csv':
                    exportData = this.convertToCSV(data);
                    contentType = 'text/csv';
                    filename = `sensor_data_${new Date().toISOString().split('T')[0]}.csv`;
                    break;
                    
                case 'json':
                default:
                    exportData = JSON.stringify(data, null, 2);
                    contentType = 'application/json';
                    filename = `sensor_data_${new Date().toISOString().split('T')[0]}.json`;
                    break;
            }
            
            // Set headers for download
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            res.send(exportData);
            
        } catch (error) {
            console.error('Export sensor data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export sensor data',
                error: error.message
            });
        }
    }
    
    // Convert sensor data to CSV
    static convertToCSV(data) {
        const headers = [
            'Timestamp',
            'Device ID',
            'Voltage (V)',
            'Current (A)',
            'Temperature (°C)',
            'Power (W)',
            'Battery Level (%)',
            'Status',
            'Location'
        ];
        
        const rows = data.map(item => [
            item.timestamp.toISOString(),
            item.deviceId,
            item.voltage.value,
            item.current.value,
            item.temperature.value,
            item.power?.value || '',
            item.batteryLevel || '',
            item.status,
            item.location
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csvContent;
    }
    
    // Get sensor health check (API)
    static async getSensorHealth(req, res) {
        try {
            const deviceId = req.params.deviceId || 'ESP32_SOLAR_01';
            
            // Get latest data
            const latestData = await SensorData.findOne({ deviceId })
                .sort({ timestamp: -1 });
            
            if (!latestData) {
                return res.json({
                    success: true,
                    deviceId,
                    status: 'offline',
                    message: 'No data received from device',
                    lastUpdate: null,
                    recommendations: ['Check device connection and power']
                });
            }
            
            // Calculate time since last update
            const timeSinceUpdate = Date.now() - latestData.timestamp.getTime();
            const minutesSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60));
            
            // Determine health status
            let status = 'healthy';
            let message = 'Device operating normally';
            const recommendations = [];
            
            if (minutesSinceUpdate > 10) {
                status = 'offline';
                message = `Device offline for ${minutesSinceUpdate} minutes`;
                recommendations.push('Check device power and network connection');
                recommendations.push('Verify ESP32 is running and connected to WiFi');
            } else if (latestData.status === 'critical') {
                status = 'critical';
                message = 'Critical condition detected';
                recommendations.push('Immediate attention required');
            } else if (latestData.status === 'warning') {
                status = 'warning';
                message = 'Warning condition detected';
            }
            
            // Check signal strength if available
            if (latestData.metadata?.signalStrength) {
                if (latestData.metadata.signalStrength < 50) {
                    recommendations.push('Low WiFi signal strength. Consider moving device closer to router.');
                }
            }
            
            // Check free memory if available
            if (latestData.metadata?.freeMemory) {
                if (latestData.metadata.freeMemory < 10000) {
                    recommendations.push('Low free memory on device. Consider optimizing code.');
                }
            }
            
            res.json({
                success: true,
                deviceId,
                status,
                message,
                lastUpdate: latestData.timestamp,
                minutesSinceUpdate,
                data: {
                    voltage: latestData.voltage.value,
                    current: latestData.current.value,
                    temperature: latestData.temperature.value,
                    batteryLevel: latestData.batteryLevel
                },
                recommendations
            });
            
        } catch (error) {
            console.error('Get sensor health error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get sensor health',
                error: error.message
            });
        }
    }
}

module.exports = SensorController;