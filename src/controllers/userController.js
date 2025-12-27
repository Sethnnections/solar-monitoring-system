const { User } = require('../models');
const Helpers = require('../utils/helpers');
const { USER_ROLES } = require('../config/constants');

class UserController {
    // Render user management page (admin only)
    static async renderUsers(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.redirect('/dashboard');
            }
            
            const { page = 1, role, search } = req.query;
            
            // Build query
            const query = {};
            
            if (role && Object.values(USER_ROLES).includes(role)) {
                query.role = role;
            }
            
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ];
            }
            
            // Pagination
            const pageSize = 15;
            const skip = (parseInt(page) - 1) * pageSize;
            
            // Get total count
            const total = await User.countDocuments(query);
            
            // Get users
            const users = await User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize);
            
            // Calculate pagination
            const totalPages = Math.ceil(total / pageSize);
            const pagination = Helpers.createPagination(total, parseInt(page), pageSize);
            
            // Get user statistics
            const stats = {
                total: await User.countDocuments(),
                byRole: {
                    admin: await User.countDocuments({ role: USER_ROLES.ADMIN }),
                    technician: await User.countDocuments({ role: USER_ROLES.TECHNICIAN }),
                    viewer: await User.countDocuments({ role: USER_ROLES.VIEWER })
                },
                active: await User.countDocuments({ isActive: true }),
                inactive: await User.countDocuments({ isActive: false })
            };
            
            res.render('pages/users', {
                title: 'User Management - Solar Monitoring System',
                user: req.session.user,
                users,
                pagination,
                stats,
                filters: { role, search },
                userRoles: USER_ROLES,
                helpers: Helpers,
                success: req.query.success || null,
                error: req.query.error || null
            });
            
        } catch (error) {
            console.error('Render users error:', error);
            res.status(500).render('pages/users', {
                title: 'User Management - Solar Monitoring System',
                user: req.session.user,
                users: [],
                pagination: null,
                stats: null,
                filters: {},
                userRoles: USER_ROLES,
                helpers: Helpers,
                success: null,
                error: 'Failed to load users'
            });
        }
    }
    
    // Get user by ID (API)
    static async getUserById(req, res) {
        try {
            const { id } = req.params;
            
            // Check permissions
            if (req.session.user.role !== USER_ROLES.ADMIN && 
                req.session.user.id !== id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const user = await User.findById(id).select('-password');
            
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
            console.error('Get user by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user',
                error: error.message
            });
        }
    }
    
    // Update user (API)
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            // Check permissions
            if (req.session.user.role !== USER_ROLES.ADMIN && 
                req.session.user.id !== id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Non-admin users can only update certain fields
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                const allowedFields = ['name', 'phone', 'notificationPreferences'];
                const filteredUpdate = {};
                
                Object.keys(updateData).forEach(key => {
                    if (allowedFields.includes(key)) {
                        filteredUpdate[key] = updateData[key];
                    }
                });
                
                // Apply filtered update
                Object.assign(user, filteredUpdate);
            } else {
                // Admin can update all fields except password
                delete updateData.password;
                Object.assign(user, updateData);
            }
            
            await user.save();
            
            // Update session if updating own profile
            if (req.session.user.id === id) {
                req.session.user.name = user.name;
                req.session.user.phone = user.phone;
                if (user.role) {
                    req.session.user.role = user.role;
                }
            }
            
            res.json({
                success: true,
                message: 'User updated successfully',
                data: user
            });
            
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user',
                error: error.message
            });
        }
    }
    
    // Delete user (admin only - API)
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
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
                message: 'Failed to delete user',
                error: error.message
            });
        }
    }
    
    // Change user password (API)
    static async changePassword(req, res) {
        try {
            const { id } = req.params;
            const { currentPassword, newPassword, confirmPassword } = req.body;
            
            // Check permissions
            if (req.session.user.role !== USER_ROLES.ADMIN && 
                req.session.user.id !== id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const user = await User.findById(id).select('+password');
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Validate passwords
            const errors = [];
            
            if (!currentPassword && req.session.user.id === id) {
                errors.push('Current password is required');
            }
            
            if (!newPassword) {
                errors.push('New password is required');
            }
            
            if (newPassword.length < 6) {
                errors.push('New password must be at least 6 characters');
            }
            
            if (newPassword !== confirmPassword) {
                errors.push('New passwords do not match');
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: errors.join(', ')
                });
            }
            
            // Verify current password (except for admin resetting others' passwords)
            if (req.session.user.id === id) {
                const isCurrentPasswordValid = await user.comparePassword(currentPassword);
                if (!isCurrentPasswordValid) {
                    return res.status(400).json({
                        success: false,
                        message: 'Current password is incorrect'
                    });
                }
            }
            
            // Update password
            user.password = newPassword;
            await user.save();
            
            res.json({
                success: true,
                message: 'Password changed successfully'
            });
            
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to change password',
                error: error.message
            });
        }
    }
    
    // Get user activity logs (API)
    static async getUserActivity(req, res) {
        try {
            const { id } = req.params;
            const { days = 30 } = req.query;
            
            // Check permissions
            if (req.session.user.role !== USER_ROLES.ADMIN && 
                req.session.user.id !== id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // In a full implementation, you would have an ActivityLog model
            // For now, return basic user activity
            const activity = {
                lastLogin: user.lastLogin,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                loginCount: user.loginAttempts,
                isLocked: user.isLocked()
            };
            
            res.json({
                success: true,
                data: activity
            });
            
        } catch (error) {
            console.error('Get user activity error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user activity',
                error: error.message
            });
        }
    }
    
    // Get user statistics (admin only - API)
    static async getUserStatistics(req, res) {
        try {
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            const stats = {
                total: await User.countDocuments(),
                byRole: {
                    admin: await User.countDocuments({ role: USER_ROLES.ADMIN }),
                    technician: await User.countDocuments({ role: USER_ROLES.TECHNICIAN }),
                    viewer: await User.countDocuments({ role: USER_ROLES.VIEWER })
                },
                byStatus: {
                    active: await User.countDocuments({ isActive: true }),
                    inactive: await User.countDocuments({ isActive: false })
                },
                recent: {
                    last24Hours: await User.countDocuments({
                        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                    }),
                    last7Days: await User.countDocuments({
                        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                    })
                }
            };
            
            res.json({
                success: true,
                statistics: stats
            });
            
        } catch (error) {
            console.error('Get user statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user statistics',
                error: error.message
            });
        }
    }
    
    // Reset user password (admin only - API)
    static async resetUserPassword(req, res) {
        try {
            const { id } = req.params;
            const { newPassword, confirmPassword } = req.body;
            
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            // Validate passwords
            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'New password must be at least 6 characters'
                });
            }
            
            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Passwords do not match'
                });
            }
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Update password
            user.password = newPassword;
            // Reset login attempts and unlock account
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();
            
            res.json({
                success: true,
                message: 'User password reset successfully'
            });
            
        } catch (error) {
            console.error('Reset user password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reset user password',
                error: error.message
            });
        }
    }
    
    // Toggle user active status (admin only - API)
    static async toggleUserStatus(req, res) {
        try {
            const { id } = req.params;
            
            // Check if user is admin
            if (req.session.user.role !== USER_ROLES.ADMIN) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            
            // Prevent self-deactivation
            if (id === req.session.user.id) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate your own account'
                });
            }
            
            const user = await User.findById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            user.isActive = !user.isActive;
            await user.save();
            
            res.json({
                success: true,
                message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
                isActive: user.isActive
            });
            
        } catch (error) {
            console.error('Toggle user status error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to toggle user status',
                error: error.message
            });
        }
    }
    
    // Get users by role (API)
    static async getUsersByRole(req, res) {
        try {
            const { role } = req.params;
            
            if (!Object.values(USER_ROLES).includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role'
                });
            }
            
            const users = await User.find({ 
                role, 
                isActive: true 
            }).select('name email phone');
            
            res.json({
                success: true,
                count: users.length,
                data: users
            });
            
        } catch (error) {
            console.error('Get users by role error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get users by role',
                error: error.message
            });
        }
    }
    
    // Search users (API)
    static async searchUsers(req, res) {
        try {
            const { query, limit = 10 } = req.query;
            
            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query must be at least 2 characters'
                });
            }
            
            const users = await User.find({
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { email: { $regex: query, $options: 'i' } },
                    { phone: { $regex: query, $options: 'i' } }
                ],
                isActive: true
            })
            .select('name email role phone isActive')
            .limit(parseInt(limit));
            
            res.json({
                success: true,
                count: users.length,
                data: users
            });
            
        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to search users',
                error: error.message
            });
        }
    }
}

module.exports = UserController;