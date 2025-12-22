const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../config/constants');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // Don't return password in queries by default
    },
    role: {
        type: String,
        enum: Object.values(USER_ROLES),
        default: USER_ROLES.VIEWER
    },
    phone: {
        type: String,
        trim: true,
        match: [
            /^(\+?265|0)(\d{9}|\d{8})$/,
            'Please provide a valid Malawi phone number'
        ]
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    notificationPreferences: {
        emailAlerts: {
            type: Boolean,
            default: true
        },
        criticalAlerts: {
            type: Boolean,
            default: true
        },
        dailySummary: {
            type: Boolean,
            default: false
        },
        weeklyReport: {
            type: Boolean,
            default: true
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return this.name;
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
    // Only hash the password if it's modified (or new)
    if (!this.isModified('password')) return next();
    
    try {
        // Generate salt
        const salt = await bcrypt.genSalt(10);
        // Hash password
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

// Method to check if account is locked
UserSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Method to increment login attempts
UserSchema.methods.incLoginAttempts = async function() {
    // If we have a previous lock that has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    // Otherwise increment
    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock the account if we've reached max attempts
    if (this.loginAttempts + 1 >= 5) {
        updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 }; // 15 minutes
    }
    
    return await this.updateOne(updates);
};

// Method to reset login attempts on successful login
UserSchema.methods.resetLoginAttempts = async function() {
    return await this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 }
    });
};

// Static method to find user by email
UserSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active technicians
UserSchema.statics.findTechnicians = function() {
    return this.find({ 
        role: USER_ROLES.TECHNICIAN,
        isActive: true 
    }).select('name email phone');
};

// Static method to find administrators
UserSchema.statics.findAdmins = function() {
    return this.find({ 
        role: USER_ROLES.ADMIN,
        isActive: true 
    }).select('name email');
};

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

const User = mongoose.model('User', UserSchema);

module.exports = User;