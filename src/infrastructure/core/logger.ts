/**
 * Winston-based logger implementation that writes to both console and files
 */
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import 'winston-daily-rotate-file';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom formats
const humanReadableFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  // Format metadata for better readability
  let metaStr = '';
  if (Object.keys(meta).length) {
    // Exclude service from human-readable output to reduce noise
    const { service, ...restMeta } = meta;
    if (Object.keys(restMeta).length) {
      // Keep full details - no truncation
      metaStr = '\n  ' + Object.entries(restMeta)
        .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
        .join('\n  ');
    }
  }
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
});

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    humanReadableFormat
  ),
  defaultMeta: { service: 'keywords-analysis' },
  transports: [
    // Main application log with daily rotation
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'app.%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        humanReadableFormat
      )
    }),
    
    // Error logs in a separate file
    new winston.transports.DailyRotateFile({ 
      filename: path.join(logsDir, 'error.%DATE%.log'), 
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        humanReadableFormat
      )
    }),
    
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.colorize(),
        humanReadableFormat
      )
    })
  ]
}); 