const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const DataProcessor = require('./dataProcessor');
const Helpers = require('./helpers');
const { REPORT_TYPES, UNITS } = require('../config/constants');

class ReportGenerator {
    static async generatePDFReport(reportData, options = {}) {
        const {
            title = 'Solar System Performance Report',
            period = 'Daily',
            filename = `solar_report_${Date.now()}.pdf`,
            outputPath = path.join(__dirname, '../../public/reports'),
        } = options;
        
        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        
        const filePath = path.join(outputPath, filename);
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
        
        // Add header
        this.addHeader(doc, title, period);
        
        // Add report period
        this.addPeriodInfo(doc, reportData.period);
        
        // Add summary section
        this.addSummarySection(doc, reportData.summary);
        
        // Add time series chart data (as table since PDF doesn't support dynamic charts)
        this.addTimeSeriesData(doc, reportData.timeSeries);
        
        // Add peak performance analysis
        this.addPeakPerformance(doc, reportData.peakPerformance);
        
        // Add recommendations
        this.addRecommendations(doc, reportData.recommendations || []);
        
        // Add footer
        this.addFooter(doc);
        
        doc.end();
        
        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve(filePath));
            stream.on('error', reject);
        });
    }
    
    static addHeader(doc, title, period) {
        // Logo placeholder
        doc.image(path.join(__dirname, '../../public/images/logo.png'), 50, 45, { width: 50 })
           .fillColor('#444444')
           .fontSize(20)
           .text(title, 110, 57)
           .fontSize(10)
           .text(`Kadidi Health Center - ${period} Report`, 110, 80)
           .moveDown();
        
        // Add line separator
        doc.moveTo(50, 110)
           .lineTo(550, 110)
           .strokeColor('#007bff')
           .lineWidth(2)
           .stroke();
        
        doc.moveDown(2);
    }
    
    static addPeriodInfo(doc, period) {
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Report Period:', { underline: true })
           .moveDown(0.5);
        
        doc.fontSize(10)
           .fillColor('#666666')
           .text(`Start: ${Helpers.formatDate(period.start, true)}`)
           .text(`End: ${Helpers.formatDate(period.end, true)}`)
           .text(`Duration: ${period.days} day${period.days !== 1 ? 's' : ''}`)
           .moveDown();
    }
    
    static addSummarySection(doc, summary) {
        doc.fontSize(12)
           .fillColor('#333333')
           .text('System Summary:', { underline: true })
           .moveDown(0.5);
        
        doc.fontSize(10)
           .fillColor('#666666')
           .text(`Total Energy Generated: ${summary.totalEnergy} ${UNITS.ENERGY}`)
           .text(`Average Voltage: ${summary.avgVoltage} ${UNITS.VOLTAGE}`)
           .text(`Average Current: ${summary.avgCurrent} ${UNITS.CURRENT}`)
           .text(`Peak Power: ${summary.peakPower} ${UNITS.POWER}`)
           .text(`Maximum Temperature: ${summary.maxTemperature} ${UNITS.TEMPERATURE}`)
           .text(`Minimum Voltage: ${summary.minVoltage} ${UNITS.VOLTAGE}`)
           .text(`System Efficiency: ${summary.efficiency}%`)
           .text(`Data Points Collected: ${summary.dataPoints}`)
           .moveDown();
        
        // Add health indicator
        const healthScore = Helpers.calculateHealthScore({
            voltage: summary.avgVoltage,
            current: summary.avgCurrent,
            temperature: summary.maxTemperature,
        });
        
        let healthColor, healthStatus;
        if (healthScore >= 80) {
            healthColor = '#28a745'; // Green
            healthStatus = 'Excellent';
        } else if (healthScore >= 60) {
            healthColor = '#ffc107'; // Yellow
            healthStatus = 'Good';
        } else if (healthScore >= 40) {
            healthColor = '#fd7e14'; // Orange
            healthStatus = 'Fair';
        } else {
            healthColor = '#dc3545'; // Red
            healthStatus = 'Poor';
        }
        
        doc.fillColor(healthColor)
           .text(`System Health Score: ${healthScore}/100 (${healthStatus})`)
           .fillColor('#666666')
           .moveDown(2);
    }
    
    static addTimeSeriesData(doc, timeSeries) {
        if (!timeSeries || timeSeries.length === 0) return;
        
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Performance Over Time:', { underline: true })
           .moveDown(0.5);
        
        // Create table header
        const tableTop = doc.y;
        const col1 = 50, col2 = 150, col3 = 250, col4 = 350, col5 = 450;
        
        doc.fontSize(9)
           .fillColor('#ffffff')
           .rect(col1, tableTop, 100, 20).fillAndStroke('#007bff', '#007bff')
           .text('Time', col1 + 5, tableTop + 5)
           
           .rect(col2, tableTop, 100, 20).fillAndStroke('#007bff', '#007bff')
           .text('Voltage (V)', col2 + 5, tableTop + 5)
           
           .rect(col3, tableTop, 100, 20).fillAndStroke('#007bff', '#007bff')
           .text('Current (A)', col3 + 5, tableTop + 5)
           
           .rect(col4, tableTop, 100, 20).fillAndStroke('#007bff', '#007bff')
           .text('Power (W)', col4 + 5, tableTop + 5)
           
           .rect(col5, tableTop, 100, 20).fillAndStroke('#007bff', '#007bff')
           .text('Temp (°C)', col5 + 5, tableTop + 5);
        
        // Add table rows
        let y = tableTop + 20;
        const rowsToShow = Math.min(timeSeries.length, 15); // Show first 15 entries
        
        timeSeries.slice(0, rowsToShow).forEach((data, index) => {
            const rowColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
            
            doc.fillColor('#333333')
               .rect(col1, y, 100, 20).fillAndStroke(rowColor, '#dee2e6')
               .text(data.timestamp, col1 + 5, y + 5)
               
               .rect(col2, y, 100, 20).fillAndStroke(rowColor, '#dee2e6')
               .text(data.voltage.toFixed(2), col2 + 5, y + 5)
               
               .rect(col3, y, 100, 20).fillAndStroke(rowColor, '#dee2e6')
               .text(data.current.toFixed(3), col3 + 5, y + 5)
               
               .rect(col4, y, 100, 20).fillAndStroke(rowColor, '#dee2e6')
               .text(data.power.toFixed(1), col4 + 5, y + 5)
               
               .rect(col5, y, 100, 20).fillAndStroke(rowColor, '#dee2e6')
               .text(data.temperature.toFixed(1), col5 + 5, y + 5);
            
            y += 20;
        });
        
        doc.y = y + 10;
        
        if (timeSeries.length > rowsToShow) {
            doc.fontSize(8)
               .fillColor('#666666')
               .text(`... and ${timeSeries.length - rowsToShow} more time points`, { align: 'center' })
               .moveDown();
        }
    }
    
    static addPeakPerformance(doc, peakData) {
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Peak Performance Analysis:', { underline: true })
           .moveDown(0.5);
        
        doc.fontSize(10)
           .fillColor('#666666');
        
        if (peakData.hour) {
            doc.text(`Peak Hour: ${peakData.hour.timestamp}`)
               .text(`  • Power: ${peakData.hour.power} ${UNITS.POWER}`)
               .text(`  • Voltage: ${peakData.hour.voltage} ${UNITS.VOLTAGE}`)
               .text(`  • Current: ${peakData.hour.current} ${UNITS.CURRENT}`);
        }
        
        if (peakData.day) {
            doc.moveDown(0.5)
               .text(`Best Day: ${peakData.day.date}`)
               .text(`  • Energy Generated: ${peakData.day.energy} ${UNITS.ENERGY}`)
               .text(`  • Data Points: ${peakData.day.dataPoints}`);
        }
        
        doc.moveDown();
    }
    
    static addRecommendations(doc, recommendations) {
        if (!recommendations || recommendations.length === 0) return;
        
        doc.fontSize(12)
           .fillColor('#333333')
           .text('Recommendations:', { underline: true })
           .moveDown(0.5);
        
        recommendations.forEach((rec, index) => {
            let priorityColor;
            switch (rec.priority) {
                case 'critical': priorityColor = '#dc3545'; break;
                case 'high': priorityColor = '#fd7e14'; break;
                case 'medium': priorityColor = '#ffc107'; break;
                default: priorityColor = '#28a745';
            }
            
            doc.fontSize(10)
               .fillColor(priorityColor)
               .text(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.type.toUpperCase()}`)
               .fillColor('#666666')
               .text(`   ${rec.message}`)
               .text(`   Action: ${rec.action}`)
               .moveDown(0.5);
        });
        
        doc.moveDown();
    }
    
    static addFooter(doc) {
        const pageWidth = 595.28; // A4 width in points
        const pageHeight = 841.89; // A4 height in points
        
        doc.fontSize(8)
           .fillColor('#666666')
           .text(
               'Kadidi Health Center Solar Monitoring System - Automated Report',
               (pageWidth - 400) / 2,
               pageHeight - 50,
               { width: 400, align: 'center' }
           )
           .text(
               `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
               (pageWidth - 400) / 2,
               pageHeight - 35,
               { width: 400, align: 'center' }
           )
           .text(
               'This report is generated automatically. For questions, contact system administrator.',
               (pageWidth - 400) / 2,
               pageHeight - 20,
               { width: 400, align: 'center' }
           );
    }
    
    static async generateExcelReport(reportData, options = {}) {
        const {
            title = 'Solar System Performance Report',
            period = 'Daily',
            filename = `solar_report_${Date.now()}.xlsx`,
            outputPath = path.join(__dirname, '../../public/reports'),
        } = options;
        
        // Ensure output directory exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        
        const filePath = path.join(outputPath, filename);
        const workbook = new ExcelJS.Workbook();
        
        // Add metadata
        workbook.creator = 'Kadidi Health Center Solar Monitoring System';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        this.createSummarySheet(summarySheet, reportData, title, period);
        
        // Time Series Sheet
        if (reportData.timeSeries && reportData.timeSeries.length > 0) {
            const timeSeriesSheet = workbook.addWorksheet('Time Series Data');
            this.createTimeSeriesSheet(timeSeriesSheet, reportData.timeSeries);
        }
        
        // Recommendations Sheet
        if (reportData.recommendations && reportData.recommendations.length > 0) {
            const recSheet = workbook.addWorksheet('Recommendations');
            this.createRecommendationsSheet(recSheet, reportData.recommendations);
        }
        
        // Raw Data Sheet (if available)
        if (reportData.rawData && reportData.rawData.length > 0) {
            const rawDataSheet = workbook.addWorksheet('Raw Sensor Data');
            this.createRawDataSheet(rawDataSheet, reportData.rawData);
        }
        
        // Save workbook
        await workbook.xlsx.writeFile(filePath);
        return filePath;
    }
    
    static createSummarySheet(sheet, reportData, title, period) {
        // Title
        sheet.mergeCells('A1:F1');
        sheet.getCell('A1').value = `${title} - ${period}`;
        sheet.getCell('A1').font = { size: 16, bold: true };
        sheet.getCell('A1').alignment = { horizontal: 'center' };
        
        // Period Information
        sheet.getCell('A3').value = 'Report Period:';
        sheet.getCell('A3').font = { bold: true };
        
        sheet.getCell('A4').value = 'Start Date:';
        sheet.getCell('B4').value = Helpers.formatDate(reportData.period.start, true);
        
        sheet.getCell('A5').value = 'End Date:';
        sheet.getCell('B5').value = Helpers.formatDate(reportData.period.end, true);
        
        sheet.getCell('A6').value = 'Duration:';
        sheet.getCell('B6').value = `${reportData.period.days} day${reportData.period.days !== 1 ? 's' : ''}`;
        
        // Summary Data
        const summary = reportData.summary;
        const summaryStartRow = 8;
        
        const summaryData = [
            ['Metric', 'Value', 'Unit'],
            ['Total Energy Generated', summary.totalEnergy, UNITS.ENERGY],
            ['Average Voltage', summary.avgVoltage, UNITS.VOLTAGE],
            ['Average Current', summary.avgCurrent, UNITS.CURRENT],
            ['Peak Power', summary.peakPower, UNITS.POWER],
            ['Maximum Temperature', summary.maxTemperature, UNITS.TEMPERATURE],
            ['Minimum Voltage', summary.minVoltage, UNITS.VOLTAGE],
            ['System Efficiency', `${summary.efficiency}%`, ''],
            ['Data Points Collected', summary.dataPoints, ''],
        ];
        
        summaryData.forEach((row, index) => {
            const rowNum = summaryStartRow + index;
            sheet.getCell(`A${rowNum}`).value = row[0];
            sheet.getCell(`B${rowNum}`).value = row[1];
            sheet.getCell(`C${rowNum}`).value = row[2];
            
            if (index === 0) {
                sheet.getCell(`A${rowNum}`).font = { bold: true };
                sheet.getCell(`B${rowNum}`).font = { bold: true };
                sheet.getCell(`C${rowNum}`).font = { bold: true };
            }
        });
        
        // Auto-size columns
        sheet.columns = [
            { key: 'A', width: 25 },
            { key: 'B', width: 20 },
            { key: 'C', width: 15 },
        ];
    }
    
    static createTimeSeriesSheet(sheet, timeSeries) {
        // Header
        sheet.addRow(['Timestamp', 'Voltage (V)', 'Current (A)', 'Power (W)', 'Temperature (°C)', 'Readings']);
        sheet.getRow(1).font = { bold: true };
        
        // Data
        timeSeries.forEach(data => {
            sheet.addRow([
                data.timestamp,
                data.voltage,
                data.current,
                data.power,
                data.temperature,
                data.readings,
            ]);
        });
        
        // Auto-size columns
        sheet.columns.forEach(column => {
            column.width = 20;
        });
        
        // Add some basic formatting
        const lastRow = sheet.rowCount;
        for (let i = 2; i <= lastRow; i++) {
            if (i % 2 === 0) {
                sheet.getRow(i).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0F0F0' },
                };
            }
        }
    }
    
    static createRecommendationsSheet(sheet, recommendations) {
        // Header
        sheet.addRow(['Priority', 'Type', 'Message', 'Recommended Action', 'Status']);
        sheet.getRow(1).font = { bold: true };
        
        // Data
        recommendations.forEach(rec => {
            sheet.addRow([
                rec.priority.toUpperCase(),
                rec.type,
                rec.message,
                rec.action,
                'Pending', // Default status
            ]);
        });
        
        // Apply conditional formatting for priority
        recommendations.forEach((rec, index) => {
            const row = sheet.getRow(index + 2);
            let color;
            
            switch (rec.priority) {
                case 'critical': color = 'FFFF0000'; break; // Red
                case 'high': color = 'FFFFA500'; break; // Orange
                case 'medium': color = 'FFFFFF00'; break; // Yellow
                default: color = 'FF90EE90'; // Light Green
            }
            
            row.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: color },
            };
        });
        
        // Auto-size columns
        sheet.columns.forEach(column => {
            column.width = 25;
        });
    }
    
    static createRawDataSheet(sheet, rawData) {
        // Header
        sheet.addRow(['Timestamp', 'Voltage (V)', 'Current (A)', 'Temperature (°C)', 'Power (W)', 'Status']);
        sheet.getRow(1).font = { bold: true };
        
        // Data
        rawData.forEach(data => {
            sheet.addRow([
                new Date(data.timestamp).toLocaleString(),
                data.voltage,
                data.current,
                data.temperature,
                data.power,
                data.status,
            ]);
        });
        
        // Auto-size columns
        sheet.columns.forEach(column => {
            column.width = 20;
        });
    }
    
    static async generateReport(sensorData, startDate, endDate, options = {}) {
        const {
            type = REPORT_TYPES.DAILY,
            format = 'pdf', // 'pdf' or 'excel'
            includeRawData = false,
        } = options;
        
        // Process the data
        const processedData = DataProcessor.generateSummaryReport(sensorData, startDate, endDate);
        
        // Add raw data if requested
        if (includeRawData) {
            processedData.rawData = sensorData;
        }
        
        // Generate the report in requested format
        let filePath;
        if (format.toLowerCase() === 'excel') {
            filePath = await this.generateExcelReport(processedData, {
                title: `Solar System ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
                period: type.charAt(0).toUpperCase() + type.slice(1),
            });
        } else {
            filePath = await this.generatePDFReport(processedData, {
                title: `Solar System ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
                period: type.charAt(0).toUpperCase() + type.slice(1),
            });
        }
        
        return {
            filePath,
            fileName: path.basename(filePath),
            fileSize: fs.statSync(filePath).size,
            generatedAt: new Date(),
            reportType: type,
            format,
            summary: processedData.summary,
        };
    }
    
    // Generate report for specific time period
    static async generatePeriodReport(sensorData, periodType) {
        const now = new Date();
        let startDate, endDate = now;
        
        switch (periodType) {
            case REPORT_TYPES.DAILY:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                break;
            case REPORT_TYPES.WEEKLY:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                break;
            case REPORT_TYPES.MONTHLY:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        }
        
        // Filter data for the period
        const periodData = sensorData.filter(data => 
            new Date(data.timestamp) >= startDate && 
            new Date(data.timestamp) <= endDate
        );
        
        if (periodData.length === 0) {
            throw new Error(`No data available for ${periodType} period`);
        }
        
        return await this.generateReport(periodData, startDate, endDate, {
            type: periodType,
        });
    }
}

module.exports = ReportGenerator;