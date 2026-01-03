const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: [true, 'Configuration key is required'],
        unique: true,
        trim: true,
        uppercase: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: [true, 'Configuration value is required']
    },
    type: {
        type: String,
        required: [true, 'Configuration type is required'],
        enum: ['string', 'number', 'boolean', 'array', 'object', 'json'],
        default: 'string'
    },
    category: {
        type: String,
        required: [true, 'Configuration category is required'],
        enum: [
            'system',
            'alert',
            'report',
            'email',
            'sensor',
            'user',
            'security',
            'maintenance',
            'notification',
            'general'
        ],
        default: 'general'
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    isEditable: {
        type: Boolean,
        default: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    minValue: {
        type: mongoose.Schema.Types.Mixed
    },
    maxValue: {
        type: mongoose.Schema.Types.Mixed
    },
    options: [{
        type: String,
        trim: true
    }],
    validationRegex: {
        type: String,
        trim: true
    },
    defaultValue: {
        type: mongoose.Schema.Types.Mixed
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    version: {
        type: Number,
        default: 1
    },
    metadata: {
        unit: String,
        helpText: String,
        group: String,
        order: Number,
        dependsOn: String
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Pre-save middleware to validate based on type
SystemConfigSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    
    // Type validation
    switch (this.type) {
        case 'number':
            if (typeof this.value !== 'number') {
                this.value = parseFloat(this.value);
                if (isNaN(this.value)) {
                    return next(new Error(`Value for ${this.key} must be a valid number`));
                }
            }
            break;
            
        case 'boolean':
            if (typeof this.value === 'string') {
                this.value = this.value.toLowerCase() === 'true';
            }
            break;
            
        case 'array':
            if (typeof this.value === 'string') {
                try {
                    this.value = JSON.parse(this.value);
                } catch (e) {
                    return next(new Error(`Value for ${this.key} must be a valid JSON array`));
                }
            }
            if (!Array.isArray(this.value)) {
                return next(new Error(`Value for ${this.key} must be an array`));
            }
            break;
            
        case 'object':
        case 'json':
            if (typeof this.value === 'string') {
                try {
                    this.value = JSON.parse(this.value);
                } catch (e) {
                    return next(new Error(`Value for ${this.key} must be valid JSON`));
                }
            }
            break;
    }
    
    // Range validation
    if (this.minValue !== undefined && this.maxValue !== undefined) {
        if (this.value < this.minValue || this.value > this.maxValue) {
            return next(new Error(
                `Value for ${this.key} must be between ${this.minValue} and ${this.maxValue}`
            ));
        }
    }
    
    // Options validation (for enums)
    if (this.options && this.options.length > 0) {
        if (!this.options.includes(this.value.toString())) {
            return next(new Error(
                `Value for ${this.key} must be one of: ${this.options.join(', ')}`
            ));
        }
    }
    
    // Regex validation
    if (this.validationRegex && typeof this.value === 'string') {
        const regex = new RegExp(this.validationRegex);
        if (!regex.test(this.value)) {
            return next(new Error(
                `Value for ${this.key} does not match required pattern`
            ));
        }
    }
    
    next();
});

// Static method to get configuration by key
SystemConfigSchema.statics.get = async function(key, defaultValue = null) {
    const config = await this.findOne({ key });
    
    if (!config) {
        if (defaultValue !== null) {
            // Create default configuration if it doesn't exist
            await this.set(key, defaultValue);
            return defaultValue;
        }
        return null;
    }
    
    return config.value;
};

// Static method to set configuration
SystemConfigSchema.statics.set = async function(key, value, userId = null) {
    let config = await this.findOne({ key });
    
    if (!config) {
        // Determine type from value
        let type = 'string';
        if (typeof value === 'number') type = 'number';
        else if (typeof value === 'boolean') type = 'boolean';
        else if (Array.isArray(value)) type = 'array';
        else if (typeof value === 'object' && value !== null) type = 'object';
        
        config = new this({
            key,
            value,
            type,
            updatedBy: userId,
            category: 'general'
        });
    } else {
        config.value = value;
        config.updatedBy = userId;
        config.version += 1;
    }
    
    await config.save();
    return config;
};

// Static method to get all configurations by category
SystemConfigSchema.statics.getByCategory = function(category) {
    return this.find({ category })
        .sort({ 'metadata.order': 1, key: 1 })
        .select('key value type description isEditable category metadata');
};

// Static method to get configuration as object
SystemConfigSchema.statics.getAllAsObject = async function() {
    const configs = await this.find({});
    const result = {};
    
    configs.forEach(config => {
        result[config.key] = config.value;
    });
    
    return result;
};

// Static method to initialize default configurations
SystemConfigSchema.statics.initializeDefaults = async function() {
    const defaults = [
        // System configurations
        {
            key: 'SYSTEM_NAME',
            value: 'Kadidi Health Center Solar Monitoring',
            type: 'string',
            category: 'system',
            description: 'Name of the solar monitoring system',
            isEditable: true,
            metadata: { group: 'System Information', order: 1 }
        },
        {
            key: 'SYSTEM_VERSION',
            value: '1.0.0',
            type: 'string',
            category: 'system',
            description: 'System version',
            isEditable: false,
            metadata: { group: 'System Information', order: 2 }
        },
        
        // Alert configurations
        {
            key: 'ALERT_VOLTAGE_LOW',
            value: 20,
            type: 'number',
            category: 'alert',
            description: 'Low voltage threshold (percentage of normal)',
            minValue: 0,
            maxValue: 100,
            isEditable: true,
            metadata: { unit: '%', group: 'Alert Thresholds', order: 1 }
        },
        {
            key: 'ALERT_VOLTAGE_CRITICAL',
            value: 10,
            type: 'number',
            category: 'alert',
            description: 'Critical voltage threshold (percentage of normal)',
            minValue: 0,
            maxValue: 100,
            isEditable: true,
            metadata: { unit: '%', group: 'Alert Thresholds', order: 2 }
        },
        {
            key: 'ALERT_CURRENT_LOW',
            value: 15,
            type: 'number',
            category: 'alert',
            description: 'Low current threshold (percentage of normal)',
            minValue: 0,
            maxValue: 100,
            isEditable: true,
            metadata: { unit: '%', group: 'Alert Thresholds', order: 3 }
        },
        {
            key: 'ALERT_TEMPERATURE_HIGH',
            value: 60,
            type: 'number',
            category: 'alert',
            description: 'High temperature threshold',
            minValue: 0,
            maxValue: 100,
            isEditable: true,
            metadata: { unit: '°C', group: 'Alert Thresholds', order: 4 }
        },
        {
            key: 'ALERT_CHECK_INTERVAL',
            value: 60,
            type: 'number',
            category: 'alert',
            description: 'Interval between alert checks (seconds)',
            minValue: 10,
            maxValue: 3600,
            isEditable: true,
            metadata: { unit: 'seconds', group: 'Alert Settings', order: 5 }
        },
        
        // Email configurations
        {
            key: 'EMAIL_ALERTS_ENABLED',
            value: true,
            type: 'boolean',
            category: 'email',
            description: 'Enable email alerts for critical issues',
            isEditable: true,
            metadata: { group: 'Email Settings', order: 1 }
        },
        {
            key: 'EMAIL_DAILY_SUMMARY',
            value: false,
            type: 'boolean',
            category: 'email',
            description: 'Send daily summary emails',
            isEditable: true,
            metadata: { group: 'Email Settings', order: 2 }
        },
        {
            key: 'EMAIL_WEEKLY_REPORT',
            value: true,
            type: 'boolean',
            category: 'email',
            description: 'Send weekly report emails',
            isEditable: true,
            metadata: { group: 'Email Settings', order: 3 }
        },
        
        // Report configurations
        {
            key: 'REPORT_RETENTION_DAYS',
            value: 90,
            type: 'number',
            category: 'report',
            description: 'Number of days to keep reports',
            minValue: 1,
            maxValue: 365,
            isEditable: true,
            metadata: { unit: 'days', group: 'Report Settings', order: 1 }
        },
        {
            key: 'AUTO_GENERATE_DAILY_REPORT',
            value: true,
            type: 'boolean',
            category: 'report',
            description: 'Automatically generate daily reports',
            isEditable: true,
            metadata: { group: 'Report Settings', order: 2 }
        },
        {
            key: 'AUTO_GENERATE_WEEKLY_REPORT',
            value: true,
            type: 'boolean',
            category: 'report',
            description: 'Automatically generate weekly reports',
            isEditable: true,
            metadata: { group: 'Report Settings', order: 3 }
        },
        
        // Sensor configurations
        {
            key: 'DATA_LOG_INTERVAL',
            value: 10,
            type: 'number',
            category: 'sensor',
            description: 'Interval between sensor readings (seconds)',
            minValue: 1,
            maxValue: 300,
            isEditable: true,
            metadata: { unit: 'seconds', group: 'Sensor Settings', order: 1 }
        },
        {
            key: 'NORMAL_VOLTAGE',
            value: 12,
            type: 'number',
            category: 'sensor',
            description: 'Normal system voltage',
            minValue: 0,
            maxValue: 50,
            isEditable: true,
            metadata: { unit: 'V', group: 'Sensor Settings', order: 2 }
        },
        {
            key: 'NORMAL_CURRENT',
            value: 5,
            type: 'number',
            category: 'sensor',
            description: 'Normal system current',
            minValue: 0,
            maxValue: 30,
            isEditable: true,
            metadata: { unit: 'A', group: 'Sensor Settings', order: 3 }
        },
        
        // User configurations
        {
            key: 'MAX_LOGIN_ATTEMPTS',
            value: 5,
            type: 'number',
            category: 'user',
            description: 'Maximum failed login attempts before lockout',
            minValue: 1,
            maxValue: 10,
            isEditable: true,
            metadata: { group: 'User Settings', order: 1 }
        },
        {
            key: 'LOCKOUT_DURATION',
            value: 15,
            type: 'number',
            category: 'user',
            description: 'Account lockout duration (minutes)',
            minValue: 1,
            maxValue: 1440,
            isEditable: true,
            metadata: { unit: 'minutes', group: 'User Settings', order: 2 }
        },
        {
            key: 'SESSION_TIMEOUT',
            value: 60,
            type: 'number',
            category: 'user',
            description: 'Session timeout duration (minutes)',
            minValue: 1,
            maxValue: 1440,
            isEditable: true,
            metadata: { unit: 'minutes', group: 'User Settings', order: 3 }
        }
    ];
    
    for (const defaultConfig of defaults) {
        const exists = await this.findOne({ key: defaultConfig.key });
        if (!exists) {
            await this.create(defaultConfig);
        }
    }
    
    console.log('✅ Default configurations initialized');
};

// Static method to reset to defaults
SystemConfigSchema.statics.resetToDefaults = async function() {
    await this.deleteMany({ isEditable: true });
    await this.initializeDefaults();
};

// Indexes for performance
SystemConfigSchema.index({ category: 1 });
SystemConfigSchema.index({ isEditable: 1 });
SystemConfigSchema.index({ isPublic: 1 });
SystemConfigSchema.index({ 'metadata.group': 1 });

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

module.exports = SystemConfig;