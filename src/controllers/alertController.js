const { Alert, User } = require('../models');
const EmailService = require('../utils/emailService');
const Helpers = require('../utils/helpers');
const { USER_ROLES, ALERT_SEVERITY, ALERT_TYPES } = require('../config/constants');

class AlertController {
    // Render alerts page
    static async renderAlerts(req, res) {
        try {
            const { status = 'active', severity, type, page = 1 } = req.query;
            
            // Build query
            const query = {};
            
            if (status === 'active') {
                query.resolved = false;
            } else if (status === 'resolved') {
                query.resolved = true;
            } else if (status === 'acknowledged') {
                query.acknowledged = true;
                query.resolved = false;
            } else if (status === 'unacknowledged') {
                query.acknowledged = false;
                query.resolved = false;
            }
            
            if (severity && Object.values(ALERT_SEVERITY).includes(severity)) {
                query.severity = severity;
            }
            
            if (type && Object.values(ALERT_TYPES).includes(type)) {
                query.type = type;
            }
            
            // Pagination
            const pageSize = 20;
            const skip = (parseInt(page) - 1) * pageSize;
            
            // Get total count
            const total = await Alert.countDocuments(query);
            
            // Get alerts
            const alerts = await Alert.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .populate('acknowledgedBy', 'name')
                .populate('resolvedBy', 'name');
            
            // Calculate pagination
            const totalPages = Math.ceil(total / pageSize);
            const pagination = Helpers.createPagination(total, parseInt(page), pageSize);
            
            // Get alert statistics
            const stats = await Alert.getStatistics(7);
            
            res.render('pages/alerts', {
                title: 'Alerts - Solar Monitoring System',
                user: req.session.user,
                alerts,
                pagination,
                stats,
                filters: {
                    status,
                    severity,
                    type
                },
                alertTypes: ALERT_TYPES,
                severityLevels: ALERT_SEVERITY,
                helpers: Helpers,
                success: req.query.success || null,
                error: req.query.error || null
            });
            
        } catch (error) {
            console.error('Render alerts error:', error);
            res.status(500).render('pages/alerts', {
                title: 'Alerts - Solar Monitoring System',
                user: req.session.user,
                alerts: [],
                pagination: null,
                stats: null,
                filters: {},
                alertTypes: ALERT_TYPES,
                severityLevels: ALERT_SEVERITY,
                helpers: Helpers,
                success: null,
                error: 'Failed to load alerts'
            });
        }
    }
    
    // Get alerts (API)
    static async getAlerts(req, res) {
        try {
            const {
                status,
                severity,
                type,
                startDate,
                endDate,
                limit = 50,
                page = 1,
                sort = '-createdAt'
            } = req.query;
            
            // Build query
            const query = {};
            
            if (status === 'active') {
                query.resolved = false;
            } else if (status === 'resolved') {
                query.resolved = true;
            } else if (status === 'acknowledged') {
                query.acknowledged = true;
                query.resolved = false;
            } else if (status === 'unacknowledged') {
                query.acknowledged = false;
                query.resolved = false;
            }
            
            if (severity && Object.values(ALERT_SEVERITY).includes(severity)) {
                query.severity = severity;
            }
            
            if (type && Object.values(ALERT_TYPES).includes(type)) {
                query.type = type;
            }
            
            // Date range
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }
            
            // Pagination
            const pageSize = parseInt(limit);
            const skip = (parseInt(page) - 1) * pageSize;
            
            // Get total count
            const total = await Alert.countDocuments(query);
            
            // Get alerts
            const alerts = await Alert.find(query)
                .sort(sort)
                .skip(skip)
                .limit(pageSize)
                .populate('acknowledgedBy', 'name email')
                .populate('resolvedBy', 'name email');
            
            // Calculate pagination metadata
            const totalPages = Math.ceil(total / pageSize);
            const pagination = Helpers.createPagination(total, parseInt(page), pageSize);
            
            res.json({
                success: true,
                pagination,
                count: alerts.length,
                total,
                data: alerts
            });
            
        } catch (error) {
            console.error('Get alerts error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get alerts',
                error: error.message
            });
        }
    }
    
    // Get alert by ID (API)
    static async getAlertById(req, res) {
        try {
            const { id } = req.params;
            
            const alert = await Alert.findById(id)
                .populate('acknowledgedBy', 'name email')
                .populate('resolvedBy', 'name email')
                .populate('sensorDataId');
            
            if (!alert) {
                return res.status(404).json({
                    success: false,
                    message: 'Alert not found'
                });
            }
            
            res.json({
                success: true,
                data: alert
            });
            
        } catch (error) {
            console.error('Get alert by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get alert',
                error: error.message
            });
        }
    }
    
    // Acknowledge alert (API)
    static async acknowledgeAlert(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;
            const userId = req.session.user.id;
            
            const alert = await Alert.findById(id);
            
            if (!alert) {
                return res.status(404).json({
                    success: false,
                    message: 'Alert not found'
                });
            }
            
            if (alert.resolved) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot acknowledge a resolved alert'
                });
            }
            
            alert.acknowledged = true;
            alert.acknowledgedBy = userId;
            alert.acknowledgedAt = new Date();
            
            if (notes) {
                alert.resolutionNotes = notes;
            }
            
            await alert.save();
            
            res.json({
                success: true,
                message: 'Alert acknowledged successfully',
                data: alert
            });
            
        } catch (error) {
            console.error('Acknowledge alert error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to acknowledge alert',
                error: error.message
            });
        }
    }
    
    // Resolve alert (API)
    static async resolveAlert(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;
            const userId = req.session.user.id;
            
            const alert = await Alert.findById(id);
            
            if (!alert) {
                return res.status(404).json({
                    success: false,
                    message: 'Alert not found'
                });
            }
            
            alert.resolved = true;
            alert.resolvedBy = userId;
            alert.resolvedAt = new Date();
            
            if (notes) {
                alert.resolutionNotes = notes;
            }
            
            // If not already acknowledged, acknowledge it
            if (!alert.acknowledged) {
                alert.acknowledged = true;
                alert.acknowledgedBy = userId;
                alert.acknowledgedAt = new Date();
            }
            
            await alert.save();
            
            res.json({
                success: true,
                message: 'Alert resolved successfully',
                data: alert
            });
            
        } catch (error) {
            console.error('Resolve alert error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resolve alert',
                error: error.message
            });
        }
    }
    
    // Bulk acknowledge alerts (API)
    static async bulkAcknowledgeAlerts(req, res) {
        try {
            const { ids } = req.body;
            const userId = req.session.user.id;
            
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide alert IDs'
                });
            }
            
            const result = await Alert.acknowledgeAlerts(ids, userId);
            
            res.json({
                success: true,
                message: `${result.modifiedCount} alerts acknowledged`,
                modifiedCount: result.modifiedCount
            });
            
        } catch (error) {
            console.error('Bulk acknowledge alerts error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to acknowledge alerts',
                error: error.message
            });
        }
    }
    
    // Bulk resolve alerts (API)
    static async bulkResolveAlerts(req, res) {
        try {
            const { ids, notes } = req.body;
            const userId = req.session.user.id;
            
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide alert IDs'
                });
            }
            
            const result = await Alert.resolveAlerts(ids, userId, notes);
            
            res.json({
                success: true,
                message: `${result.modifiedCount} alerts resolved`,
                modifiedCount: result.modifiedCount
            });
            
        } catch (error) {
            console.error('Bulk resolve alerts error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resolve alerts',
                error: error.message
            });
        }
    }
    
    // Create manual alert (API)
    static async createAlert(req, res) {
        try {
            const {
                type,
                severity,
                title,
                message,
                deviceId,
                sensorValue,
                threshold,
                unit,
                location
            } = req.body;
            
            const userId = req.session.user.id;
            
            // Validate required fields
            if (!type || !severity || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Type, severity, title, and message are required'
                });
            }
            
            // Validate enum values
            if (!Object.values(ALERT_TYPES).includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert type'
                });
            }
            
            if (!Object.values(ALERT_SEVERITY).includes(severity)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid alert severity'
                });
            }
            
            // Create alert
            const alert = new Alert({
                type,
                severity,
                title,
                message,
                deviceId: deviceId || 'ESP32_SOLAR_01',
                sensorValue: sensorValue || 0,
                threshold,
                unit,
                location: location || 'Kadidi Health Center',
                acknowledged: false,
                resolved: false,
                autoGenerated: false,
                createdBy: userId
            });
            
            await alert.save();
            
            // Send email for critical/high severity alerts
            if (severity === ALERT_SEVERITY.CRITICAL || severity === ALERT_SEVERITY.HIGH) {
                try {
                    await EmailService.sendAlertEmail({
                        type,
                        severity,
                        message,
                        timestamp: alert.createdAt,
                        sensorValue,
                        threshold
                    });
                    
                    alert.emailSent = true;
                    alert.emailSentAt = new Date();
                    await alert.save();
                } catch (emailError) {
                    console.error('Failed to send alert email:', emailError);
                }
            }
            
            res.status(201).json({
                success: true,
                message: 'Alert created successfully',
                data: alert
            });
            
        } catch (error) {
            console.error('Create alert error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create alert',
                error: error.message
            });
        }
    }
    
    // Delete alert (admin only - API)
    static async deleteAlert(req, res) {
        try {
            const { id } = req.params;
            
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            const alert = await Alert.findById(id);
            
            if (!alert) {
                return res.status(404).json({
                    success: false,
                    message: 'Alert not found'
                });
            }
            
            await alert.deleteOne();
            
            res.json({
                success: true,
                message: 'Alert deleted successfully'
            });
            
        } catch (error) {
            console.error('Delete alert error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete alert',
                error: error.message
            });
        }
    }
    
    // Get alert statistics (API)
    static async getAlertStatistics(req, res) {
        try {
            const { days = 30 } = req.query;
            
            const stats = await Alert.getStatistics(parseInt(days));
            
            res.json({
                success: true,
                period: `${days} days`,
                statistics: stats
            });
            
        } catch (error) {
            console.error('Get alert statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get alert statistics',
                error: error.message
            });
        }
    }
    
    // Get active alerts count (API)
    static async getActiveAlertsCount(req, res) {
        try {
            const count = await Alert.countDocuments({ resolved: false });
            
            // Breakdown by severity
            const severityCounts = await Alert.aggregate([
                { $match: { resolved: false } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]);
            
            const severityMap = {};
            severityCounts.forEach(item => {
                severityMap[item._id] = item.count;
            });
            
            res.json({
                success: true,
                total: count,
                bySeverity: {
                    critical: severityMap.critical || 0,
                    high: severityMap.high || 0,
                    medium: severityMap.medium || 0,
                    low: severityMap.low || 0
                }
            });
            
        } catch (error) {
            console.error('Get active alerts count error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get active alerts count',
                error: error.message
            });
        }
    }
    
    // Send test alert email (API)
    static async sendTestAlertEmail(req, res) {
        try {
            // Check if user is admin or technician
            if (req.session.user.role !== USER_ROLES.ADMIN && 
                req.session.user.role !== USER_ROLES.TECHNICIAN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const { severity = 'medium', email } = req.body;
            
            const testAlert = {
                type: 'test_alert',
                severity,
                message: 'This is a test alert to verify email notifications are working.',
                timestamp: new Date(),
                sensorValue: 12.5,
                threshold: 12
            };
            
            const recipientEmail = email || req.session.user.email;
            
            const result = await EmailService.sendAlertEmail(testAlert);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: `Test alert email sent to ${recipientEmail}`
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to send test email',
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('Send test alert email error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send test alert email',
                error: error.message
            });
        }
    }
    
    // Get alert trends (API)
    static async getAlertTrends(req, res) {
        try {
            const { days = 30 } = req.query;
            
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));
            
            // Get alerts grouped by day
            const alertsByDay = await Alert.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        total: { $sum: 1 },
                        critical: {
                            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
                        },
                        high: {
                            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
                        },
                        medium: {
                            $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] }
                        },
                        low: {
                            $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
            
            // Fill in missing days
            const allDays = [];
            let currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                const dayData = alertsByDay.find(d => d._id === dateStr);
                
                allDays.push({
                    date: dateStr,
                    total: dayData ? dayData.total : 0,
                    critical: dayData ? dayData.critical : 0,
                    high: dayData ? dayData.high : 0,
                    medium: dayData ? dayData.medium : 0,
                    low: dayData ? dayData.low : 0
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            // Calculate trends
            let trend = 'stable';
            if (allDays.length >= 7) {
                const lastWeek = allDays.slice(-7);
                const previousWeek = allDays.slice(-14, -7);
                
                const lastWeekTotal = lastWeek.reduce((sum, day) => sum + day.total, 0);
                const previousWeekTotal = previousWeek.reduce((sum, day) => sum + day.total, 0);
                
                if (previousWeekTotal > 0) {
                    const change = ((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100;
                    
                    if (change > 20) trend = 'increasing';
                    else if (change < -20) trend = 'decreasing';
                }
            }
            
            res.json({
                success: true,
                period: {
                    start: startDate,
                    end: endDate,
                    days: parseInt(days)
                },
                trends: {
                    daily: allDays,
                    overallTrend: trend
                }
            });
            
        } catch (error) {
            console.error('Get alert trends error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get alert trends',
                error: error.message
            });
        }
    }
}

module.exports = AlertController;