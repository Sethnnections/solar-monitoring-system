const { sendEmail } = require('../config/mailer');
const { ALERT_SEVERITY } = require('../config/constants');

class EmailService {
    static async sendAlertEmail(alertData) {
        const { type, severity, message, timestamp, sensorValue, threshold } = alertData;
        
        let severityColor;
        switch (severity) {
            case ALERT_SEVERITY.CRITICAL:
                severityColor = '#dc3545'; // Red
                break;
            case ALERT_SEVERITY.HIGH:
                severityColor = '#fd7e14'; // Orange
                break;
            case ALERT_SEVERITY.MEDIUM:
                severityColor = '#ffc107'; // Yellow
                break;
            default:
                severityColor = '#28a745'; // Green
        }
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #007bff; color: white; padding: 20px; text-align: center; }
                    .alert-box { 
                        border: 2px solid ${severityColor}; 
                        border-radius: 5px; 
                        padding: 15px; 
                        margin: 20px 0;
                        background-color: #f8f9fa;
                    }
                    .severity-badge { 
                        display: inline-block; 
                        padding: 5px 10px; 
                        background-color: ${severityColor}; 
                        color: white; 
                        border-radius: 3px;
                        text-transform: uppercase;
                        font-weight: bold;
                    }
                    .footer { 
                        margin-top: 30px; 
                        padding-top: 20px; 
                        border-top: 1px solid #ddd; 
                        text-align: center;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔔 Solar System Alert</h1>
                        <p>Kadidi Health Center Monitoring System</p>
                    </div>
                    
                    <div class="alert-box">
                        <span class="severity-badge">${severity}</span>
                        <h2>${type.replace('_', ' ').toUpperCase()}</h2>
                        
                        <p><strong>Message:</strong> ${message}</p>
                        
                        <div style="margin: 20px 0;">
                            <p><strong>Sensor Value:</strong> ${sensorValue}</p>
                            ${threshold ? `<p><strong>Threshold:</strong> ${threshold}</p>` : ''}
                        </div>
                        
                        <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
                    </div>
                    
                    <p>Please check the system dashboard for more details:</p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" 
                       style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                        View Dashboard
                    </a>
                    
                    <div class="footer">
                        <p>This is an automated alert from the Solar Energy Monitoring System.</p>
                        <p>Kadidi Health Center, Lunzu, Blantyre</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const subject = `[${severity.toUpperCase()}] Solar Alert: ${type.replace('_', ' ')}`;
        
        // Get technicians' emails from database (we'll implement this later)
        const technicianEmails = await this.getTechnicianEmails();
        
        if (technicianEmails.length === 0) {
            console.warn('⚠️ No technician emails found for alert notification');
            return { success: false, error: 'No recipients found' };
        }
        
        return await sendEmail(technicianEmails.join(', '), subject, html);
    }
    
    static async sendWelcomeEmail(user) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #28a745; color: white; padding: 20px; text-align: center; }
                    .welcome-box { border: 1px solid #ddd; padding: 20px; margin: 20px 0; }
                    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Solar Monitoring System</h1>
                    </div>
                    
                    <div class="welcome-box">
                        <h2>Hello ${user.name},</h2>
                        <p>Your account has been created successfully.</p>
                        
                        <div style="background: #f8f9fa; padding: 15px; margin: 15px 0;">
                            <p><strong>Login Details:</strong></p>
                            <p>Email: ${user.email}</p>
                            <p>Role: ${user.role}</p>
                        </div>
                        
                        <p>You can access the system here:</p>
                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" 
                           style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none;">
                            Login to System
                        </a>
                    </div>
                    
                    <div class="footer">
                        <p><strong>Kadidi Health Center Solar Monitoring System</strong></p>
                        <p>This is an automated email. Please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await sendEmail(user.email, 'Welcome to Solar Monitoring System', html);
    }
    
    static async getTechnicianEmails() {
        // This will be implemented when we have the User model
        // For now, return a placeholder
        try {
            // We'll implement this later when User model is available
            // const technicians = await User.find({ role: 'technician' }).select('email');
            // return technicians.map(t => t.email);
            return ['technician@kadidihealthcenter.org']; // Placeholder
        } catch (error) {
            console.error('Error fetching technician emails:', error);
            return [];
        }
    }
    
    static async sendReportEmail(email, reportPath, reportType) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #6f42c1; color: white; padding: 20px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📊 Solar System Report</h1>
                    </div>
                    
                    <p>Hello,</p>
                    <p>Your ${reportType} solar system report is ready for download.</p>
                    
                    <p>Report generated on: ${new Date().toLocaleDateString()}</p>
                    
                    <p>You can also view the report in the system dashboard.</p>
                    
                    <div style="margin-top: 30px; padding: 15px; background: #f8f9fa;">
                        <p><strong>System Statistics:</strong></p>
                        <p>• Report Type: ${reportType}</p>
                        <p>• Date Range: Last ${reportType}</p>
                        <p>• Generated: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const subject = `Solar Monitoring ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
        
        return await sendEmail(email, subject, html, [
            {
                filename: `solar_report_${Date.now()}.pdf`,
                path: reportPath,
            },
        ]);
    }
}

module.exports = EmailService;