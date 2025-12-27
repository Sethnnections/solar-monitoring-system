const { User } = require('../models');
const Helpers = require('../utils/helpers');
const EmailService = require('../utils/emailService');
const { USER_ROLES, SYSTEM } = require('../config/constants');

class AuthController {
    // Render login page
    static async renderLogin(req, res) {
        try {
            // If user is already logged in, redirect to dashboard
            if (req.session.user) {
                return res.redirect('/dashboard');
            }
            
            res.render('pages/login', {
                title: 'Login - Solar Monitoring System',
                error: null,
                success: null,
                email: ''
            });
        } catch (error) {
            console.error('Render login error:', error);
            res.status(500).render('errors/500');
        }
    }
    
    // Handle login
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Validate input
            if (!email || !password) {
                return res.render('pages/login', {
                    title: 'Login - Solar Monitoring System',
                    error: 'Please provide email and password',
                    success: null,
                    email
                });
            }
            
            // Find user
            const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
            
            if (!user) {
                return res.render('pages/login', {
                    title: 'Login - Solar Monitoring System',
                    error: 'Invalid email or password',
                    success: null,
                    email
                });
            }
            
            // Check if user is active
            if (!user.isActive) {
                return res.render('pages/login', {
                    title: 'Login - Solar Monitoring System',
                    error: 'Account is deactivated. Please contact administrator.',
                    success: null,
                    email
                });
            }
            
            // Check if account is locked
            if (user.isLocked()) {
                const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
                return res.render('pages/login', {
                    title: 'Login - Solar Monitoring System',
                    error: `Account is locked. Try again in ${lockTime} minutes.`,
                    success: null,
                    email
                });
            }
            
            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            
            if (!isPasswordValid) {
                // Increment login attempts
                await user.incLoginAttempts();
                
                const attemptsLeft = SYSTEM.MAX_LOGIN_ATTEMPTS - user.loginAttempts - 1;
                
                if (attemptsLeft <= 0) {
                    return res.render('pages/login', {
                        title: 'Login - Solar Monitoring System',
                        error: 'Account locked due to too many failed attempts.',
                        success: null,
                        email
                    });
                }
                
                return res.render('pages/login', {
                    title: 'Login - Solar Monitoring System',
                    error: `Invalid email or password. ${attemptsLeft} attempts left.`,
                    success: null,
                    email
                });
            }
            
            // Reset login attempts on successful login
            await user.resetLoginAttempts();
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            
            // Create session
            req.session.user = {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
            };
            
            // Set session expiration
            req.session.cookie.maxAge = SYSTEM.SESSION_TIMEOUT * 60 * 1000;
            
            // Redirect based on role
            let redirectPath = '/dashboard';
            if (req.query.redirect) {
                redirectPath = req.query.redirect;
            }
            
            res.redirect(redirectPath);
            
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).render('pages/login', {
                title: 'Login - Solar Monitoring System',
                error: 'An error occurred during login. Please try again.',
                success: null,
                email: req.body.email || ''
            });
        }
    }
    
    // Render registration page (admin only)
    static async renderRegister(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.redirect('/dashboard');
            }
            
            res.render('pages/register', {
                title: 'Register User - Solar Monitoring System',
                error: null,
                success: null,
                userData: {},
                roles: Object.values(USER_ROLES)
            });
        } catch (error) {
            console.error('Render register error:', error);
            res.status(500).render('errors/500');
        }
    }
    
    // Handle user registration (admin only)
    static async register(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.redirect('/dashboard');
            }
            
            const { name, email, password, confirmPassword, role, phone } = req.body;
            
            // Validate input
            const errors = [];
            
            if (!name || name.trim().length < 2) {
                errors.push('Name must be at least 2 characters');
            }
            
            if (!email || !Helpers.isValidEmail(email)) {
                errors.push('Please provide a valid email');
            }
            
            if (!password || password.length < 6) {
                errors.push('Password must be at least 6 characters');
            }
            
            if (password !== confirmPassword) {
                errors.push('Passwords do not match');
            }
            
            if (!Object.values(USER_ROLES).includes(role)) {
                errors.push('Invalid role selected');
            }
            
            if (errors.length > 0) {
                return res.render('pages/register', {
                    title: 'Register User - Solar Monitoring System',
                    error: errors.join(', '),
                    success: null,
                    userData: { name, email, role, phone },
                    roles: Object.values(USER_ROLES)
                });
            }
            
            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.render('pages/register', {
                    title: 'Register User - Solar Monitoring System',
                    error: 'User with this email already exists',
                    success: null,
                    userData: { name, email, role, phone },
                    roles: Object.values(USER_ROLES)
                });
            }
            
            // Create user
            const user = new User({
                name,
                email: email.toLowerCase(),
                password,
                role,
                phone,
                createdBy: req.session.user.id,
                notificationPreferences: {
                    emailAlerts: true,
                    criticalAlerts: true,
                    dailySummary: role === USER_ROLES.TECHNICIAN,
                    weeklyReport: role === USER_ROLES.TECHNICIAN || role === USER_ROLES.ADMIN
                }
            });
            
            await user.save();
            
            // Send welcome email
            try {
                await EmailService.sendWelcomeEmail(user);
            } catch (emailError) {
                console.error('Failed to send welcome email:', emailError);
                // Don't fail registration if email fails
            }
            
            res.render('pages/register', {
                title: 'Register User - Solar Monitoring System',
                error: null,
                success: `User ${name} created successfully`,
                userData: {},
                roles: Object.values(USER_ROLES)
            });
            
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).render('pages/register', {
                title: 'Register User - Solar Monitoring System',
                error: 'An error occurred during registration',
                success: null,
                userData: req.body,
                roles: Object.values(USER_ROLES)
            });
        }
    }
    
    // Handle logout
    static async logout(req, res) {
        try {
            // Destroy session
            req.session.destroy((err) => {
                if (err) {
                    console.error('Logout error:', err);
                }
                res.redirect('/login');
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.redirect('/login');
        }
    }
    
    // Render profile page
    static async renderProfile(req, res) {
        try {
            const user = await User.findById(req.session.user.id);
            
            if (!user) {
                req.session.destroy();
                return res.redirect('/login');
            }
            
            res.render('pages/profile', {
                title: 'My Profile - Solar Monitoring System',
                user: user.toObject(),
                success: null,
                error: null
            });
        } catch (error) {
            console.error('Render profile error:', error);
            res.status(500).render('errors/500');
        }
    }
    
    // Update profile
    static async updateProfile(req, res) {
        try {
            const { name, phone, currentPassword, newPassword, confirmPassword } = req.body;
            const userId = req.session.user.id;
            
            const user = await User.findById(userId).select('+password');
            
            if (!user) {
                req.session.destroy();
                return res.redirect('/login');
            }
            
            const errors = [];
            
            // Update name and phone
            if (name && name.trim().length >= 2) {
                user.name = name.trim();
            } else if (name) {
                errors.push('Name must be at least 2 characters');
            }
            
            if (phone) {
                if (/^(\+?265|0)(\d{9}|\d{8})$/.test(phone)) {
                    user.phone = phone;
                } else {
                    errors.push('Please provide a valid Malawi phone number');
                }
            }
            
            // Update password if provided
            if (currentPassword || newPassword || confirmPassword) {
                if (!currentPassword) {
                    errors.push('Current password is required to change password');
                } else if (!newPassword) {
                    errors.push('New password is required');
                } else if (!confirmPassword) {
                    errors.push('Please confirm new password');
                } else if (newPassword.length < 6) {
                    errors.push('New password must be at least 6 characters');
                } else if (newPassword !== confirmPassword) {
                    errors.push('New passwords do not match');
                } else {
                    // Verify current password
                    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
                    if (!isCurrentPasswordValid) {
                        errors.push('Current password is incorrect');
                    } else {
                        user.password = newPassword;
                    }
                }
            }
            
            if (errors.length > 0) {
                return res.render('pages/profile', {
                    title: 'My Profile - Solar Monitoring System',
                    user: user.toObject(),
                    success: null,
                    error: errors.join(', ')
                });
            }
            
            await user.save();
            
            // Update session
            req.session.user.name = user.name;
            req.session.user.phone = user.phone;
            
            res.render('pages/profile', {
                title: 'My Profile - Solar Monitoring System',
                user: user.toObject(),
                success: 'Profile updated successfully',
                error: null
            });
            
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).render('pages/profile', {
                title: 'My Profile - Solar Monitoring System',
                user: req.user ? req.user.toObject() : {},
                success: null,
                error: 'An error occurred while updating profile'
            });
        }
    }
    
    // Render forgot password page
    static async renderForgotPassword(req, res) {
        try {
            if (req.session.user) {
                return res.redirect('/dashboard');
            }
            
            res.render('pages/forgot-password', {
                title: 'Forgot Password - Solar Monitoring System',
                error: null,
                success: null,
                email: ''
            });
        } catch (error) {
            console.error('Render forgot password error:', error);
            res.status(500).render('errors/500');
        }
    }
    
    // Handle forgot password request
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            
            if (!email || !Helpers.isValidEmail(email)) {
                return res.render('pages/forgot-password', {
                    title: 'Forgot Password - Solar Monitoring System',
                    error: 'Please provide a valid email address',
                    success: null,
                    email
                });
            }
            
            const user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                // Don't reveal that user doesn't exist (security)
                return res.render('pages/forgot-password', {
                    title: 'Forgot Password - Solar Monitoring System',
                    error: null,
                    success: 'If an account exists with this email, you will receive reset instructions.',
                    email: ''
                });
            }
            
            // Generate reset token
            const resetToken = Helpers.generateRandomString(40);
            const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
            
            user.resetPasswordToken = resetToken;
            user.resetPasswordExpire = resetTokenExpiry;
            await user.save();
            
            // Send reset email
            try {
                const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
                
                const html = `
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset for your Solar Monitoring System account.</p>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetUrl}">${resetUrl}</a>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                `;
                
                await EmailService.sendEmail(email, 'Password Reset Request', html);
                
            } catch (emailError) {
                console.error('Failed to send reset email:', emailError);
                // Don't reveal email failure to user
            }
            
            res.render('pages/forgot-password', {
                title: 'Forgot Password - Solar Monitoring System',
                error: null,
                success: 'If an account exists with this email, you will receive reset instructions.',
                email: ''
            });
            
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).render('pages/forgot-password', {
                title: 'Forgot Password - Solar Monitoring System',
                error: 'An error occurred. Please try again.',
                success: null,
                email: req.body.email || ''
            });
        }
    }
    
    // Render reset password page
    static async renderResetPassword(req, res) {
        try {
            const { token } = req.params;
            
            if (!token) {
                return res.redirect('/forgot-password');
            }
            
            // Find user with valid reset token
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpire: { $gt: Date.now() }
            });
            
            if (!user) {
                return res.render('pages/reset-password', {
                    title: 'Reset Password - Solar Monitoring System',
                    error: 'Password reset token is invalid or has expired.',
                    success: null,
                    token: null
                });
            }
            
            res.render('pages/reset-password', {
                title: 'Reset Password - Solar Monitoring System',
                error: null,
                success: null,
                token
            });
            
        } catch (error) {
            console.error('Render reset password error:', error);
            res.status(500).render('errors/500');
        }
    }
    
    // Handle password reset
    static async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password, confirmPassword } = req.body;
            
            if (!token) {
                return res.redirect('/forgot-password');
            }
            
            // Find user with valid reset token
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpire: { $gt: Date.now() }
            });
            
            if (!user) {
                return res.render('pages/reset-password', {
                    title: 'Reset Password - Solar Monitoring System',
                    error: 'Password reset token is invalid or has expired.',
                    success: null,
                    token: null
                });
            }
            
            // Validate passwords
            const errors = [];
            
            if (!password || password.length < 6) {
                errors.push('Password must be at least 6 characters');
            }
            
            if (password !== confirmPassword) {
                errors.push('Passwords do not match');
            }
            
            if (errors.length > 0) {
                return res.render('pages/reset-password', {
                    title: 'Reset Password - Solar Monitoring System',
                    error: errors.join(', '),
                    success: null,
                    token
                });
            }
            
            // Update password
            user.password = password;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            
            await user.save();
            
            res.render('pages/reset-password', {
                title: 'Reset Password - Solar Monitoring System',
                error: null,
                success: 'Password reset successful. You can now login with your new password.',
                token: null
            });
            
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).render('pages/reset-password', {
                title: 'Reset Password - Solar Monitoring System',
                error: 'An error occurred. Please try again.',
                success: null,
                token: req.params.token || null
            });
        }
    }
    
    // Get current user info (API)
    static async getCurrentUser(req, res) {
        try {
            const user = await User.findById(req.session.user.id).select('-password');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            res.json({
                success: true,
                data: user
            });
            
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user information'
            });
        }
    }
    
    // Get all users (admin only - API)
    static async getAllUsers(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            const users = await User.find()
                .select('-password')
                .sort({ createdAt: -1 });
            
            res.json({
                success: true,
                count: users.length,
                data: users
            });
            
        } catch (error) {
            console.error('Get all users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get users'
            });
        }
    }
    
    // Update user (admin only - API)
    static async updateUser(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            const { id } = req.params;
            const { name, email, role, phone, isActive, notificationPreferences } = req.body;
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Update fields
            if (name) user.name = name;
            if (email && Helpers.isValidEmail(email)) user.email = email.toLowerCase();
            if (role && Object.values(USER_ROLES).includes(role)) user.role = role;
            if (phone) user.phone = phone;
            if (typeof isActive === 'boolean') user.isActive = isActive;
            if (notificationPreferences) {
                user.notificationPreferences = {
                    ...user.notificationPreferences,
                    ...notificationPreferences
                };
            }
            
            await user.save();
            
            res.json({
                success: true,
                message: 'User updated successfully',
                data: user
            });
            
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user'
            });
        }
    }
    
    // Delete user (admin only - API)
    static async deleteUser(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            const { id } = req.params;
            
            // Prevent self-deletion
            if (id === req.session.user.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete your own account'
                });
            }
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Soft delete (deactivate)
            user.isActive = false;
            await user.save();
            
            res.json({
                success: true,
                message: 'User deactivated successfully'
            });
            
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user'
            });
        }
    }
}

module.exports = AuthController;