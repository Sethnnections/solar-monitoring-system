// Main JavaScript file for the Solar Monitoring System

// Wait for DOM to be fully loaded
$(document).ready(function() {
    initializeComponents();
    setupGlobalEventListeners();
});

// Initialize all components
function initializeComponents() {
    // Initialize sidebar toggle
    initializeSidebar();
    
    // Initialize user dropdown
    initializeUserDropdown();
    
    // Initialize notifications dropdown
    initializeNotifications();
    
    // Initialize back to top button
    initializeBackToTop();
    
    // Initialize tooltips
    initializeTooltips();
    
    // Check for system status updates
    checkSystemStatus();
    
    // Initialize real-time updates
    initializeRealTimeUpdates();
}

// Initialize sidebar toggle for mobile
function initializeSidebar() {
    const sidebar = $('#sidebar');
    const mobileMenuButton = $('#mobileMenuButton');
    const sidebarOverlay = $('#sidebarOverlay');
    
    if (mobileMenuButton.length && sidebar.length) {
        mobileMenuButton.click(function() {
            sidebar.toggleClass('-translate-x-0');
            sidebarOverlay.toggleClass('hidden');
            $('body').toggleClass('overflow-hidden');
        });
        
        sidebarOverlay.click(function() {
            sidebar.addClass('-translate-x-full');
            sidebarOverlay.addClass('hidden');
            $('body').removeClass('overflow-hidden');
        });
        
        // Close sidebar when clicking a link on mobile
        if (window.innerWidth < 768) {
            $('#sidebar a').click(function() {
                sidebar.addClass('-translate-x-full');
                sidebarOverlay.addClass('hidden');
                $('body').removeClass('overflow-hidden');
            });
        }
    }
}

// Initialize user dropdown
function initializeUserDropdown() {
    const userMenuButton = $('#userMenuButton');
    const userDropdown = $('#userDropdown');
    
    if (userMenuButton.length && userDropdown.length) {
        userMenuButton.click(function(e) {
            e.stopPropagation();
            userDropdown.toggleClass('hidden');
        });
        
        // Close dropdown when clicking outside
        $(document).click(function(e) {
            if (!$(e.target).closest('#userMenuButton, #userDropdown').length) {
                userDropdown.addClass('hidden');
            }
        });
    }
}

// Initialize notifications dropdown
function initializeNotifications() {
    const notificationBell = $('#notificationBell');
    const notificationDropdown = $('#notificationDropdown');
    
    if (notificationBell.length && notificationDropdown.length) {
        notificationBell.click(function(e) {
            e.stopPropagation();
            notificationDropdown.toggleClass('hidden');
            loadNotifications();
        });
        
        // Close dropdown when clicking outside
        $(document).click(function(e) {
            if (!$(e.target).closest('#notificationBell, #notificationDropdown').length) {
                notificationDropdown.addClass('hidden');
            }
        });
    }
}

// Load notifications via AJAX
function loadNotifications() {
    $.ajax({
        url: '/alerts/api/alerts?status=active&limit=5',
        method: 'GET',
        success: function(response) {
            if (response.success && response.data.length > 0) {
                updateNotificationList(response.data);
            } else {
                $('#notificationList').html(`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-check-circle text-2xl mb-3 text-green-500"></i>
                        <p>No new notifications</p>
                        <p class="text-sm mt-1">All systems are operating normally</p>
                    </div>
                `);
            }
        },
        error: function() {
            $('#notificationList').html(`
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-circle text-2xl mb-3 text-red-500"></i>
                    <p>Failed to load notifications</p>
                    <p class="text-sm mt-1">Please try again later</p>
                </div>
            `);
        }
    });
}

// Update notification list
function updateNotificationList(notifications) {
    const notificationItems = notifications.map(notification => `
        <div class="border-l-4 ${notification.severity === 'critical' ? 'border-red-500 bg-red-50' : 
                              notification.severity === 'high' ? 'border-orange-500 bg-orange-50' : 
                              notification.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' : 
                              'border-blue-500 bg-blue-50'} p-3 rounded-r mb-2">
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-medium text-gray-800">${notification.title}</p>
                    <p class="text-sm text-gray-600 mt-1">${notification.message}</p>
                </div>
                <span class="text-xs px-2 py-1 rounded-full ${notification.severity === 'critical' ? 'bg-red-100 text-red-800' : 
                                                         notification.severity === 'high' ? 'bg-orange-100 text-orange-800' : 
                                                         notification.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                                                         'bg-blue-100 text-blue-800'}">
                    ${notification.severity}
                </span>
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-gray-500">
                    <i class="far fa-clock mr-1"></i>
                    ${formatTimeAgo(new Date(notification.createdAt))}
                </span>
                ${!notification.acknowledged ? `
                    <button class="text-xs text-blue-600 hover:text-blue-800" onclick="acknowledgeNotification('${notification._id}')">
                        Acknowledge
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    $('#notificationList').html(notificationItems);
}

// Acknowledge notification
function acknowledgeNotification(notificationId) {
    $.ajax({
        url: `/alerts/api/alerts/${notificationId}/acknowledge`,
        method: 'PUT',
        success: function() {
            toastr.success('Notification acknowledged');
            loadNotifications();
            
            // Update notification badge
            const badge = $('#notificationBell span');
            if (badge.length) {
                const currentCount = parseInt(badge.text()) || 0;
                if (currentCount > 1) {
                    badge.text(currentCount - 1);
                } else {
                    badge.hide();
                }
            }
        },
        error: function() {
            toastr.error('Failed to acknowledge notification');
        }
    });
}

// Initialize back to top button
function initializeBackToTop() {
    const backToTopButton = $('#backToTop');
    
    if (backToTopButton.length) {
        // Show/hide button based on scroll position
        $(window).scroll(function() {
            if ($(this).scrollTop() > 300) {
                backToTopButton.removeClass('opacity-0').addClass('opacity-100');
            } else {
                backToTopButton.removeClass('opacity-100').addClass('opacity-0');
            }
        });
        
        // Scroll to top when clicked
        backToTopButton.click(function() {
            $('html, body').animate({ scrollTop: 0 }, 'smooth');
        });
    }
}

// Initialize tooltips
function initializeTooltips() {
    // Initialize tooltips for elements with data-tooltip attribute
    $('[data-tooltip]').hover(
        function() {
            const tooltipText = $(this).data('tooltip');
            $(this).append(`<div class="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg tooltip-content">${tooltipText}</div>`);
        },
        function() {
            $(this).find('.tooltip-content').remove();
        }
    );
}

// Check system status
function checkSystemStatus() {
    $.ajax({
        url: '/dashboard/api/status',
        method: 'GET',
        success: function(response) {
            if (response.success) {
                updateSystemStatusDisplay(response.data);
            }
        },
        error: function() {
            console.error('Failed to fetch system status');
        }
    });
}

// Update system status display
function updateSystemStatusDisplay(statusData) {
    const statusElement = $('#systemStatus');
    if (statusElement.length) {
        statusElement.removeClass('bg-green-100 bg-yellow-100 bg-red-100 text-green-800 text-yellow-800 text-red-800');
        
        if (statusData.healthScore >= 80) {
            statusElement.addClass('bg-green-100 text-green-800').text('Healthy');
        } else if (statusData.healthScore >= 60) {
            statusElement.addClass('bg-yellow-100 text-yellow-800').text('Warning');
        } else {
            statusElement.addClass('bg-red-100 text-red-800').text('Critical');
        }
    }
}

// Initialize real-time updates
function initializeRealTimeUpdates() {
    // Check for new notifications every 60 seconds
    setInterval(checkForNewNotifications, 60000);
    
    // Update system status every 30 seconds
    setInterval(checkSystemStatus, 30000);
}

// Check for new notifications
function checkForNewNotifications() {
    $.ajax({
        url: '/alerts/api/alerts/unread-count',
        method: 'GET',
        success: function(response) {
            if (response.success) {
                updateNotificationBadge(response.count);
            }
        },
        error: function() {
            console.error('Failed to check for new notifications');
        }
    });
}

// Update notification badge
function updateNotificationBadge(count) {
    const badge = $('#notificationBell span');
    if (badge.length) {
        if (count > 0) {
            badge.text(count > 9 ? '9+' : count).show();
        } else {
            badge.hide();
        }
    }
}

// Setup global event listeners
function setupGlobalEventListeners() {
    // Handle form submissions with loading state
    $('form[data-loading]').submit(function() {
        const form = $(this);
        const submitButton = form.find('button[type="submit"]');
        const originalText = submitButton.text();
        
        submitButton.prop('disabled', true);
        submitButton.html('<i class="fas fa-spinner fa-spin mr-2"></i>Processing...');
        
        // Re-enable button after 30 seconds even if request fails
        setTimeout(() => {
            submitButton.prop('disabled', false);
            submitButton.text(originalText);
        }, 30000);
    });
    
    // Handle confirmation dialogs
    $('[data-confirm]').click(function(e) {
        const message = $(this).data('confirm') || 'Are you sure you want to proceed?';
        if (!confirm(message)) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    // Handle tooltips on touch devices
    if ('ontouchstart' in window) {
        $(document).on('touchstart', '[data-tooltip]', function() {
            const tooltipText = $(this).data('tooltip');
            alert(tooltipText);
        });
    }
}

// Utility function: Format time ago
function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
        return interval + ' year' + (interval > 1 ? 's' : '') + ' ago';
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
        return interval + ' month' + (interval > 1 ? 's' : '') + ' ago';
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
        return interval + ' day' + (interval > 1 ? 's' : '') + ' ago';
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
        return interval + ' hour' + (interval > 1 ? 's' : '') + ' ago';
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
        return interval + ' minute' + (interval > 1 ? 's' : '') + ' ago';
    }
    
    return 'just now';
}

// Utility function: Show loading overlay
function showLoading(message = 'Loading...') {
    const overlay = $('#loadingOverlay');
    if (overlay.length) {
        overlay.find('p').text(message);
        overlay.removeClass('hidden');
    }
}

// Utility function: Hide loading overlay
function hideLoading() {
    const overlay = $('#loadingOverlay');
    if (overlay.length) {
        overlay.addClass('hidden');
    }
}

// Utility function: Format bytes to human readable
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Utility function: Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Utility function: Format date
function formatDate(date, includeTime = false) {
    const d = new Date(date);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return d.toLocaleDateString('en-US', options);
}

// Export utility functions for use in other scripts
window.utils = {
    formatTimeAgo,
    showLoading,
    hideLoading,
    formatBytes,
    validateEmail,
    formatDate
};

// Initialize when document is ready
$(document).ready(function() {
    // Check if user is logged in
    const userLoggedIn = typeof window.user !== 'undefined' && window.user;
    
    if (userLoggedIn) {
        // Start periodic updates
        initializeRealTimeUpdates();
    }
    
    // Handle browser visibility changes
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && userLoggedIn) {
            // Refresh data when page becomes visible again
            checkSystemStatus();
            checkForNewNotifications();
        }
    });
    
    // Handle offline/online status
    window.addEventListener('offline', function() {
        toastr.warning('You are offline. Some features may not work properly.');
    });
    
    window.addEventListener('online', function() {
        toastr.success('Connection restored.');
        if (userLoggedIn) {
            checkSystemStatus();
        }
    });
});