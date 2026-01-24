const WebSocket = require('ws');
const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { ALERT_SEVERITY } = require('../config/constants');

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.setupWebSocket();
        
        // Setup MongoDB change stream for real-time alerts
        this.setupChangeStream();
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection established');
            
            // Add client to set
            this.clients.add(ws);
            
            // Send initial data
            this.sendInitialData(ws);
            
            // Handle messages from client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });
            
            // Handle client disconnect
            ws.on('close', () => {
                console.log('WebSocket connection closed');
                this.clients.delete(ws);
            });
            
            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        console.log('WebSocket server initialized');
    }
    
    async sendInitialData(ws) {
        try {
            // Get active alerts count
            const activeAlerts = await Alert.countDocuments({ resolved: false });
            
            // Get alerts by severity
            const severityCounts = await Alert.aggregate([
                { $match: { resolved: false } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]);
            
            // Format severity counts
            const severityMap = {};
            severityCounts.forEach(item => {
                severityMap[item._id] = item.count;
            });
            
            // Get recent alerts
            const recentAlerts = await Alert.find({ resolved: false })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title severity type createdAt')
                .lean();
            
            const initialData = {
                type: 'initial',
                data: {
                    activeAlerts,
                    severityCounts: {
                        critical: severityMap.critical || 0,
                        high: severityMap.high || 0,
                        medium: severityMap.medium || 0,
                        low: severityMap.low || 0
                    },
                    recentAlerts,
                    timestamp: new Date().toISOString()
                }
            };
            
            ws.send(JSON.stringify(initialData));
        } catch (error) {
            console.error('Error sending initial data:', error);
        }
    }
    
    handleClientMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
                
            case 'subscribe':
                this.handleSubscription(ws, data);
                break;
                
            case 'unsubscribe':
                this.handleUnsubscription(ws, data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    handleSubscription(ws, data) {
        // Store subscription data in websocket if needed
        ws.subscriptions = ws.subscriptions || new Set();
        if (data.channel) {
            ws.subscriptions.add(data.channel);
        }
    }
    
    handleUnsubscription(ws, data) {
        if (ws.subscriptions && data.channel) {
            ws.subscriptions.delete(data.channel);
        }
    }
    
    setupChangeStream() {
        // Watch for changes in Alert collection
        const alertChangeStream = Alert.watch([], { fullDocument: 'updateLookup' });
        
        alertChangeStream.on('change', async (change) => {
            try {
                let alertData = null;
                
                switch (change.operationType) {
                    case 'insert':
                        alertData = change.fullDocument;
                        await this.broadcastAlert('new', alertData);
                        break;
                        
                    case 'update':
                        // Fetch the updated document
                        const updatedAlert = await Alert.findById(change.documentKey._id);
                        if (updatedAlert) {
                            await this.broadcastAlert('updated', updatedAlert);
                        }
                        break;
                        
                    case 'delete':
                        await this.broadcastAlert('deleted', { _id: change.documentKey._id });
                        break;
                }
                
                // Always broadcast stats update after any change
                await this.broadcastStatsUpdate();
                
            } catch (error) {
                console.error('Error processing change stream:', error);
            }
        });
        
        alertChangeStream.on('error', (error) => {
            console.error('Change stream error:', error);
        });
        
        console.log('MongoDB Change Stream initialized for real-time alerts');
    }
    
    async broadcastAlert(eventType, alert) {
        const message = {
            type: 'alert',
            event: eventType,
            data: alert,
            timestamp: new Date().toISOString()
        };
        
        this.broadcast(JSON.stringify(message));
    }
    
    async broadcastStatsUpdate() {
        try {
            // Get updated statistics
            const activeAlerts = await Alert.countDocuments({ resolved: false });
            
            const severityCounts = await Alert.aggregate([
                { $match: { resolved: false } },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]);
            
            const severityMap = {};
            severityCounts.forEach(item => {
                severityMap[item._id] = item.count;
            });
            
            const stats = {
                type: 'stats',
                data: {
                    activeAlerts,
                    severityCounts: {
                        critical: severityMap.critical || 0,
                        high: severityMap.high || 0,
                        medium: severityMap.medium || 0,
                        low: severityMap.low || 0
                    },
                    timestamp: new Date().toISOString()
                }
            };
            
            this.broadcast(JSON.stringify(stats));
        } catch (error) {
            console.error('Error broadcasting stats update:', error);
        }
    }
    
    broadcast(message) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    
    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}

module.exports = WebSocketServer;