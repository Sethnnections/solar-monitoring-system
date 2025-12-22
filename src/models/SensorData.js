const mongoose = require('mongoose');
const { UNITS } = require('../config/constants');

const SensorDataSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: [true, 'Device ID is required'],
        trim: true,
        default: 'ESP32_SOLAR_01'
    },
    timestamp: {
        type: Date,
        required: [true, 'Timestamp is required'],
        default: Date.now,
        index: true
    },
    voltage: {
        value: {
            type: Number,
            required: [true, 'Voltage reading is required'],
            min: [0, 'Voltage cannot be negative'],
            max: [50, 'Voltage cannot exceed 50V']
        },
        unit: {
            type: String,
            default: UNITS.VOLTAGE
        }
    },
    current: {
        value: {
            type: Number,
            required: [true, 'Current reading is required'],
            min: [0, 'Current cannot be negative'],
            max: [30, 'Current cannot exceed 30A']
        },
        unit: {
            type: String,
            default: UNITS.CURRENT
        }
    },
    temperature: {
        value: {
            type: Number,
            required: [true, 'Temperature reading is required'],
            min: [-20, 'Temperature cannot be below -20°C'],
            max: [100, 'Temperature cannot exceed 100°C']
        },
        unit: {
            type: String,
            default: UNITS.TEMPERATURE
        }
    },
    power: {
        value: {
            type: Number,
            min: [0, 'Power cannot be negative'],
            max: [1500, 'Power cannot exceed 1500W']
        },
        unit: {
            type: String,
            default: UNITS.POWER
        }
    },
    energy: {
        value: {
            type: Number,
            min: [0, 'Energy cannot be negative']
        },
        unit: {
            type: String,
            default: UNITS.ENERGY
        }
    },
    batteryLevel: {
        type: Number,
        min: [0, 'Battery level cannot be negative'],
        max: [100, 'Battery level cannot exceed 100%']
    },
    status: {
        type: String,
        enum: ['normal', 'warning', 'critical', 'offline'],
        default: 'normal'
    },
    location: {
        type: String,
        default: 'Kadidi Health Center, Lunzu, Blantyre',
        trim: true
    },
    panelId: {
        type: String,
        trim: true,
        default: 'PANEL_01'
    },
    batteryId: {
        type: String,
        trim: true,
        default: 'BATTERY_01'
    },
    inverterId: {
        type: String,
        trim: true,
        default: 'INVERTER_01'
    },
    metadata: {
        signalStrength: {
            type: Number,
            min: [0, 'Signal strength cannot be negative'],
            max: [100, 'Signal strength cannot exceed 100%']
        },
        uptime: {
            type: Number,
            min: [0, 'Uptime cannot be negative']
        },
        freeMemory: {
            type: Number,
            min: [0, 'Free memory cannot be negative']
        },
        firmwareVersion: {
            type: String,
            trim: true
        }
    },
    isAnomaly: {
        type: Boolean,
        default: false
    },
    anomalyReason: {
        type: String,
        trim: true
    },
    processed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Calculate power before saving if not provided
SensorDataSchema.pre('save', function(next) {
    if (!this.power.value && this.voltage.value && this.current.value) {
        this.power = {
            value: this.voltage.value * this.current.value,
            unit: UNITS.POWER
        };
    }
    next();
});

// Virtual for formatted timestamp
SensorDataSchema.virtual('formattedTime').get(function() {
    return this.timestamp.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

// Virtual for hour of day (for grouping)
SensorDataSchema.virtual('hourOfDay').get(function() {
    return this.timestamp.getHours();
});

// Virtual for day of week
SensorDataSchema.virtual('dayOfWeek').get(function() {
    return this.timestamp.getDay();
});

// Static method to get latest reading
SensorDataSchema.statics.getLatest = function(deviceId = 'ESP32_SOLAR_01') {
    return this.findOne({ deviceId })
        .sort({ timestamp: -1 })
        .limit(1);
};

// Static method to get readings within time range
SensorDataSchema.statics.getRange = function(start, end, deviceId = 'ESP32_SOLAR_01') {
    return this.find({
        deviceId,
        timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });
};

// Static method to get daily summary
SensorDataSchema.statics.getDailySummary = async function(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    const data = await this.find({
        timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: 1 });
    
    if (data.length === 0) {
        return null;
    }
    
    // Calculate statistics
    const voltages = data.map(d => d.voltage.value).filter(v => v != null);
    const currents = data.map(d => d.current.value).filter(c => c != null);
    const temperatures = data.map(d => d.temperature.value).filter(t => t != null);
    const powers = data.map(d => d.power?.value).filter(p => p != null);
    
    const avgVoltage = voltages.length > 0 ? 
        voltages.reduce((a, b) => a + b, 0) / voltages.length : 0;
    
    const avgCurrent = currents.length > 0 ? 
        currents.reduce((a, b) => a + b, 0) / currents.length : 0;
    
    const maxTemperature = temperatures.length > 0 ? 
        Math.max(...temperatures) : 0;
    
    const minVoltage = voltages.length > 0 ? 
        Math.min(...voltages) : 0;
    
    const peakPower = powers.length > 0 ? 
        Math.max(...powers) : 0;
    
    // Calculate energy (approximate)
    let totalEnergy = 0;
    for (let i = 1; i < data.length; i++) {
        const timeDiff = (data[i].timestamp - data[i-1].timestamp) / (1000 * 3600); // hours
        const avgPower = ((data[i-1].power?.value || 0) + (data[i].power?.value || 0)) / 2;
        totalEnergy += avgPower * timeDiff;
    }
    totalEnergy = totalEnergy / 1000; // Convert to kWh
    
    return {
        date: start.toISOString().split('T')[0],
        totalEnergy: parseFloat(totalEnergy.toFixed(3)),
        avgVoltage: parseFloat(avgVoltage.toFixed(2)),
        avgCurrent: parseFloat(avgCurrent.toFixed(3)),
        maxTemperature: parseFloat(maxTemperature.toFixed(1)),
        minVoltage: parseFloat(minVoltage.toFixed(2)),
        peakPower: parseFloat(peakPower.toFixed(1)),
        dataPoints: data.length,
        firstReading: data[0].timestamp,
        lastReading: data[data.length - 1].timestamp
    };
};

// Static method to check for recent anomalies
SensorDataSchema.statics.getRecentAnomalies = function(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.find({
        isAnomaly: true,
        timestamp: { $gte: cutoff }
    }).sort({ timestamp: -1 }).limit(100);
};

// Static method to get system status
SensorDataSchema.statics.getSystemStatus = async function() {
    const latest = await this.getLatest();
    
    if (!latest) {
        return {
            status: 'offline',
            lastUpdate: null,
            message: 'No data received from system'
        };
    }
    
    const timeSinceLastUpdate = Date.now() - latest.timestamp.getTime();
    const minutesSinceUpdate = Math.floor(timeSinceLastUpdate / (60 * 1000));
    
    let status = latest.status;
    let message = 'System operating normally';
    
    if (minutesSinceUpdate > 10) {
        status = 'offline';
        message = `System offline for ${minutesSinceUpdate} minutes`;
    } else if (latest.status === 'critical') {
        message = 'Critical issue detected';
    } else if (latest.status === 'warning') {
        message = 'Warning condition detected';
    }
    
    return {
        status,
        lastUpdate: latest.timestamp,
        minutesSinceUpdate,
        voltage: latest.voltage.value,
        current: latest.current.value,
        temperature: latest.temperature.value,
        power: latest.power?.value || 0,
        batteryLevel: latest.batteryLevel || 0,
        message
    };
};

// Indexes for performance
SensorDataSchema.index({ timestamp: -1 });
SensorDataSchema.index({ deviceId: 1, timestamp: -1 });
SensorDataSchema.index({ status: 1, timestamp: -1 });
SensorDataSchema.index({ isAnomaly: 1, timestamp: -1 });
SensorDataSchema.index({ 'voltage.value': 1 });
SensorDataSchema.index({ 'current.value': 1 });
SensorDataSchema.index({ 'temperature.value': 1 });
SensorDataSchema.index({ createdAt: -1 });

// Compound indexes for common queries
SensorDataSchema.index({ deviceId: 1, status: 1 });
SensorDataSchema.index({ timestamp: 1, deviceId: 1 });

const SensorData = mongoose.model('SensorData', SensorDataSchema);

module.exports = SensorData;