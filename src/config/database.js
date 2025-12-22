const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const uri = process.env.NODE_ENV === 'test' 
            ? process.env.MONGO_TEST_URI 
            : process.env.MONGODB_URI;
        
        const conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log(` MongoDB Connected: ${conn.connection.host}`);
        
        // Connection event handlers
        mongoose.connection.on('error', (err) => {
            console.error(` MongoDB connection error: ${err}`);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log(' MongoDB disconnected');
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log(' MongoDB connection closed due to app termination');
            process.exit(0);
        });
        
    } catch (error) {
        console.error(` MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;