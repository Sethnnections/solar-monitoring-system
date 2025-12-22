#!/usr/bin/env node

/**
 * Database Backup Script
 * 
 * Creates backups of the solar monitoring database.
 * 
 * Usage:
 *   npm run backup                 # Create backup
 *   npm run backup -- --restore    # Restore from latest backup
 *   npm run backup -- --list       # List available backups
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const os = require('os');

// Promisify exec
const execPromise = util.promisify(exec);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
};

// Helper function for colored output
const log = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    step: (msg) => console.log(`\n${colors.blue}▶ ${msg}${colors.reset}`)
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    restore: args.includes('--restore'),
    list: args.includes('--list'),
    help: args.includes('--help') || args.includes('-h'),
    force: args.includes('--force'),
    date: null
};

// Extract date from arguments if provided
args.forEach(arg => {
    if (arg.startsWith('--date=')) {
        options.date = arg.split('=')[1];
    }
});

// Show help if requested
if (options.help) {
    console.log(`
${colors.cyan}Database Backup Script${colors.reset}
=============================

${colors.yellow}Usage:${colors.reset}
  npm run backup [options]

${colors.yellow}Options:${colors.reset}
  --restore           Restore from latest backup
  --restore --date=YYYYMMDD  Restore from specific backup
  --list              List available backups
  --force             Force restore without confirmation
  --help, -h          Show this help message

${colors.yellow}Examples:${colors.reset}
  npm run backup                    # Create backup
  npm run backup -- --restore       # Restore from latest backup
  npm run backup -- --list          # List available backups
  npm run backup -- --restore --date=20240315  # Restore specific backup
`);
    process.exit(0);
}

// Configuration
const config = {
    backupDir: path.join(__dirname, '../../backups'),
    mongodumpPath: 'mongodump', // Assumes mongodump is in PATH
    mongorestorePath: 'mongorestore', // Assumes mongorestore is in PATH
    maxBackups: 30, // Keep last 30 backups
    compressBackups: true
};

// Ensure backup directory exists
const ensureBackupDir = () => {
    if (!fs.existsSync(config.backupDir)) {
        fs.mkdirSync(config.backupDir, { recursive: true });
        log.info(`Created backup directory: ${config.backupDir}`);
    }
};

// Get MongoDB URI
const getMongoUri = () => {
    let uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/solar_monitoring';
    
    // Remove query parameters for mongodump
    uri = uri.split('?')[0];
    
    return uri;
};

// Get database name from URI
const getDatabaseName = (uri) => {
    const match = uri.match(/\/([^/?]+)(?:\?|$)/);
    return match ? match[1] : 'solar_monitoring';
};

// Generate backup filename
const generateBackupFilename = () => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `backup_${dateStr}_${timeStr}`;
};

// List available backups
const listBackups = () => {
    ensureBackupDir();
    
    log.step('Available Backups');
    console.log('=' .repeat(50));
    
    const backups = fs.readdirSync(config.backupDir)
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();
    
    if (backups.length === 0) {
        console.log('No backups found.');
        return;
    }
    
    backups.forEach((backup, index) => {
        const backupPath = path.join(config.backupDir, backup);
        const stats = fs.statSync(backupPath);
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        const date = new Date(stats.mtime);
        
        console.log(`${index + 1}. ${backup}`);
        console.log(`   Size: ${size} MB`);
        console.log(`   Date: ${date.toLocaleString()}`);
        console.log(`   Path: ${backupPath}`);
        console.log();
    });
    
    console.log(`Total backups: ${backups.length}`);
};

// Create backup
const createBackup = async () => {
    log.step('Creating database backup...');
    
    ensureBackupDir();
    
    const uri = getMongoUri();
    const dbName = getDatabaseName(uri);
    const backupName = generateBackupFilename();
    const backupPath = path.join(config.backupDir, backupName);
    
    log.info(`Database: ${dbName}`);
    log.info(`Backup to: ${backupPath}`);
    
    try {
        // Build mongodump command
        let command = `${config.mongodumpPath} --uri="${uri}" --out="${backupPath}"`;
        
        if (config.compressBackups) {
            command += ' --gzip';
        }
        
        log.info(`Running: ${command}`);
        
        const { stdout, stderr } = await execPromise(command);
        
        if (stdout) log.info(stdout);
        if (stderr) log.warn(stderr);
        
        // Check if backup was successful
        const dumpDir = path.join(backupPath, dbName);
        if (fs.existsSync(dumpDir)) {
            const stats = fs.statSync(dumpPath);
            const size = (stats.size / (1024 * 1024)).toFixed(2);
            
            log.success(`Backup created successfully: ${backupName} (${size} MB)`);
            
            // Clean up old backups
            await cleanupOldBackups();
            
            return backupPath;
        } else {
            throw new Error('Backup directory not created');
        }
        
    } catch (error) {
        log.error(`Backup failed: ${error.message}`);
        
        // Clean up failed backup directory if it exists
        if (fs.existsSync(backupPath)) {
            fs.rmSync(backupPath, { recursive: true, force: true });
        }
        
        throw error;
    }
};

// Clean up old backups
const cleanupOldBackups = async () => {
    const backups = fs.readdirSync(config.backupDir)
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();
    
    if (backups.length > config.maxBackups) {
        const backupsToDelete = backups.slice(config.maxBackups);
        
        log.info(`Cleaning up ${backupsToDelete.length} old backups...`);
        
        backupsToDelete.forEach(backup => {
            const backupPath = path.join(config.backupDir, backup);
            try {
                fs.rmSync(backupPath, { recursive: true, force: true });
                log.info(`Deleted: ${backup}`);
            } catch (error) {
                log.warn(`Failed to delete ${backup}: ${error.message}`);
            }
        });
        
        log.success('Cleanup completed');
    }
};

// Find backup by date
const findBackupByDate = (dateStr) => {
    const backups = fs.readdirSync(config.backupDir)
        .filter(file => file.startsWith('backup_'))
        .sort()
        .reverse();
    
    if (!dateStr) {
        // Return latest backup
        return backups.length > 0 ? backups[0] : null;
    }
    
    // Find backup matching date
    const matchingBackup = backups.find(backup => backup.includes(dateStr));
    return matchingBackup || null;
};

// Restore backup
const restoreBackup = async (backupName) => {
    log.step(`Restoring from backup: ${backupName}`);
    
    const backupPath = path.join(config.backupDir, backupName);
    const uri = getMongoUri();
    const dbName = getDatabaseName(uri);
    
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
    }
    
    // Check if the backup contains the expected database
    const dumpDir = path.join(backupPath, dbName);
    if (!fs.existsSync(dumpDir)) {
        // Try to find any database in the backup
        const dirs = fs.readdirSync(backupPath).filter(item => {
            const itemPath = path.join(backupPath, item);
            return fs.statSync(itemPath).isDirectory();
        });
        
        if (dirs.length === 0) {
            throw new Error('No database found in backup');
        }
        
        log.warn(`Expected database ${dbName} not found in backup. Found: ${dirs.join(', ')}`);
        log.warn('Attempting to restore first found database...');
    }
    
    // Ask for confirmation unless forced
    if (!options.force) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise((resolve) => {
            rl.question(`${colors.yellow}WARNING: This will overwrite the current database. Continue? (yes/no): ${colors.reset}`, resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            log.info('Restore cancelled.');
            process.exit(0);
        }
    }
    
    try {
        // Build mongorestore command
        let command = `${config.mongorestorePath} --uri="${uri}" --drop `;
        
        if (config.compressBackups) {
            command += '--gzip ';
        }
        
        command += `"${backupPath}"`;
        
        log.info(`Running: ${command}`);
        
        const { stdout, stderr } = await execPromise(command);
        
        if (stdout) log.info(stdout);
        if (stderr) log.warn(stderr);
        
        log.success(`Database restored successfully from ${backupName}`);
        
    } catch (error) {
        log.error(`Restore failed: ${error.message}`);
        throw error;
    }
};

// Main function
const main = async () => {
    try {
        // List backups if requested
        if (options.list) {
            listBackups();
            process.exit(0);
        }
        
        // Restore backup if requested
        if (options.restore) {
            ensureBackupDir();
            
            const backupName = findBackupByDate(options.date);
            if (!backupName) {
                log.error(`No backup found${options.date ? ` for date ${options.date}` : ''}`);
                listBackups();
                process.exit(1);
            }
            
            await restoreBackup(backupName);
            process.exit(0);
        }
        
        // Default action: create backup
        await createBackup();
        process.exit(0);
        
    } catch (error) {
        log.error(`Operation failed: ${error.message}`);
        process.exit(1);
    }
};

// Handle process termination
process.on('SIGINT', () => {
    log.warn('Process interrupted by user');
    process.exit(0);
});

// Check for mongodump/mongorestore availability
const checkTools = async () => {
    try {
        await execPromise(`${config.mongodumpPath} --version`);
        await execPromise(`${config.mongorestorePath} --version`);
        return true;
    } catch (error) {
        log.error('MongoDB tools (mongodump/mongorestore) not found in PATH');
        log.error('Please install MongoDB Database Tools:');
        log.error('  https://www.mongodb.com/try/download/database-tools');
        
        if (os.platform() === 'win32') {
            log.error('Or add them to your PATH after installation.');
        }
        
        return false;
    }
};

// Run main function
(async () => {
    const toolsAvailable = await checkTools();
    if (!toolsAvailable) {
        process.exit(1);
    }
    
    await main();
})();