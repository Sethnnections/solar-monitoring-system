const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify connection configuration
transporter.verify((error, success) => {
    if (error) {
        console.error(' Email configuration error:', error);
    } else {
        console.log(' Email server is ready to send messages');
    }
});

const sendEmail = async (to, subject, html, attachments = []) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'Solar Monitoring System <noreply@example.com>',
            to,
            subject,
            html,
            attachments,
        });
        
        console.log(` Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(' Email sending failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    transporter,
    sendEmail,
};