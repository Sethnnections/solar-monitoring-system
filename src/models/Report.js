const mongoose = require('mongoose');
const { REPORT_TYPES } = require('../config/constants');

const ReportSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Report title is required'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    type: {
        type: String,
        required: [true, 'Report type is required'],
        enum: Object.values(REPORT_TYPES)
    },
    period: {
        startDate: {
            type: Date,
            required: [true, 'Start date is required']
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required']
        }
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Generator user is required']
    },
    filePath: {
        type: String,
        required: [true, 'File path is required'],
        trim: true
    },
    fileName: {
        type: String,
        required: [true, 'File name is required'],
        trim: true
    },
    fileSize: {
        type: Number,
        required: [true, 'File size is required'],
        min: [0, 'File size cannot be negative']
    },
    format: {
        type: String,
        required: [true, 'File format is required'],
        enum: ['pdf', 'excel', 'csv', 'json'],
        default: 'pdf'
    },
    summary: {
        totalEnergy: {
            type: Number,
            default: 0
        },
        avgVoltage: {
            type: Number,
            default: 0
        },
        avgCurrent: {
            type: Number,
            default: 0
        },
        peakPower: {
            type: Number,
            default: 0
        },
        maxTemperature: {
            type: Number,
            default: 0
        },
        efficiency: {
            type: Number,
            default: 0
        },
        dataPoints: {
            type: Number,
            default: 0
        }
    },
    metadata: {
        generationTime: {
            type: Number,
            default: 0
        },
        dataPointsUsed: {
            type: Number,
            default: 0
        },
        chartsIncluded: {
            type: Boolean,
            default: true
        },
        recommendationsCount: {
            type: Number,
            default: 0
        },
        anomaliesDetected: {
            type: Number,
            default: 0
        }
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentTo: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    emailSentAt: {
        type: Date
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tags: [{
        type: String,
        trim: true
    }],
    downloadCount: {
        type: Number,
        default: 0
    },
    lastDownloaded: {
        type: Date
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for formatted period
ReportSchema.virtual('formattedPeriod').get(function() {
    const start = this.period.startDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const end = this.period.endDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    return `${start} to ${end}`;
});

// Virtual for duration in days
ReportSchema.virtual('durationDays').get(function() {
    const diff = this.period.endDate - this.period.startDate;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for download URL
ReportSchema.virtual('downloadUrl').get(function() {
    return `/api/reports/download/${this._id}`;
});

// Virtual for preview URL
ReportSchema.virtual('previewUrl').get(function() {
    if (this.format === 'pdf') {
        return `/api/reports/preview/${this._id}`;
    }
    return null;
});

// Pre-save middleware to set expiration date (90 days from creation)
ReportSchema.pre('save', function(next) {
    if (!this.expiresAt) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 90);
        this.expiresAt = expirationDate;
    }
    next();
});

// Static method to generate title based on type and period
ReportSchema.statics.generateTitle = function(type, startDate, endDate) {
    const typeMap = {
        'daily': 'Daily Solar System Report',
        'weekly': 'Weekly Solar System Report',
        'monthly': 'Monthly Solar System Report',
        'custom': 'Custom Solar System Report'
    };
    
    const title = typeMap[type] || 'Solar System Report';
    
    if (type === 'custom') {
        const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${title} (${startStr} - ${endStr})`;
    }
    
    return `${title} - ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
};

// Static method to find reports by date range
ReportSchema.statics.findByDateRange = function(startDate, endDate, type = null) {
    const query = {
        'period.startDate': { $gte: startDate },
        'period.endDate': { $lte: endDate }
    };
    
    if (type) query.type = type;
    
    return this.find(query)
        .sort({ 'period.endDate': -1 })
        .populate('generatedBy', 'name email');
};

// Static method to get report statistics
ReportSchema.statics.getStatistics = async function() {
    const stats = {
        totalReports: 0,
        byType: {},
        byFormat: {},
        totalSize: 0,
        avgSize: 0,
        recentReports: 0
    };
    
    const reports = await this.find({});
    stats.totalReports = reports.length;
    
    if (reports.length === 0) return stats;
    
    let totalSize = 0;
    
    reports.forEach(report => {
        // Count by type
        stats.byType[report.type] = (stats.byType[report.type] || 0) + 1;
        
        // Count by format
        stats.byFormat[report.format] = (stats.byFormat[report.format] || 0) + 1;
        
        // Sum file sizes
        totalSize += report.fileSize;
        
        // Count recent reports (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (report.createdAt > thirtyDaysAgo) {
            stats.recentReports++;
        }
    });
    
    stats.totalSize = totalSize;
    stats.avgSize = Math.round(totalSize / reports.length);
    
    return stats;
};

// Static method to increment download count
ReportSchema.statics.incrementDownload = async function(reportId) {
    return await this.findByIdAndUpdate(
        reportId,
        {
            $inc: { downloadCount: 1 },
            $set: { lastDownloaded: new Date() }
        },
        { new: true }
    );
};

// Static method to get most downloaded reports
ReportSchema.statics.getMostDownloaded = function(limit = 10) {
    return this.find({})
        .sort({ downloadCount: -1 })
        .limit(limit)
        .populate('generatedBy', 'name')
        .select('title type format downloadCount createdAt');
};

// Method to check if report is downloadable
ReportSchema.methods.isDownloadable = function() {
    // Check if file exists (in a real implementation, you'd check the filesystem)
    // For now, just check if filePath is set and report hasn't expired
    return this.filePath && (!this.expiresAt || this.expiresAt > new Date());
};

// Method to get file extension
ReportSchema.methods.getFileExtension = function() {
    switch (this.format) {
        case 'pdf': return '.pdf';
        case 'excel': return '.xlsx';
        case 'csv': return '.csv';
        case 'json': return '.json';
        default: return '.pdf';
    }
};

// Method to get MIME type
ReportSchema.methods.getMimeType = function() {
    switch (this.format) {
        case 'pdf': return 'application/pdf';
        case 'excel': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        case 'csv': return 'text/csv';
        case 'json': return 'application/json';
        default: return 'application/pdf';
    }
};

// Indexes for performance
ReportSchema.index({ 'period.endDate': -1 });
ReportSchema.index({ type: 1, 'period.endDate': -1 });
ReportSchema.index({ generatedBy: 1, createdAt: -1 });
ReportSchema.index({ format: 1 });
ReportSchema.index({ tags: 1 });
ReportSchema.index({ downloadCount: -1 });
ReportSchema.index({ isPublic: 1 });
ReportSchema.index({ createdAt: -1 });

const Report = mongoose.model('Report', ReportSchema);

module.exports = Report;