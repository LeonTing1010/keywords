/**
 * logger/index.ts
 * 提供一个简洁的日志记录服务
 */

import pino from 'pino';
import path from 'path';
import fs from 'fs';
// @ts-ignore 忽略 createStream 的类型定义问题 (如果存在)
import { createStream } from 'rotating-file-stream';

// 日志目录
const logsDir = path.join(process.cwd(), 'logs');
fs.existsSync(logsDir) || fs.mkdirSync(logsDir, { recursive: true });

// 生成日志文件名（按日期）
// createStream 会将 logsDir 作为文件名前缀路径
const filenameGenerator = (time?: Date | number): string => {
  const now = time instanceof Date ? time : new Date(time || Date.now());
  const dateStr = now.toISOString().split('T')[0];
  return `app.${dateStr}.log`; // 例如: app.2024-05-09.log
};

// 创建轮替文件流 (所有级别的日志)
const rotatingLogStream = createStream(filenameGenerator, {
  path: logsDir,      // 日志文件存放的目录
  size: '20M',        // 当日志文件达到 20MB 时轮替
  interval: '1d',     // 每天轮替一次
  maxFiles: 15,       // 最多保留 15 个旧的日志文件
  compress: 'gzip',   // 压缩旧的日志文件 (例如: app.2024-05-08.log.gz)
});

// 日志级别优先级：DEBUG=true > LOG_LEVEL > (生产环境下 'info'，开发环境下 'debug')
const isExplicitDebug = process.env.DEBUG === 'true';
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
const logLevel = isExplicitDebug ? 'debug' : (process.env.LOG_LEVEL || defaultLogLevel);

// Pino 基础配置
const pinoOptions: pino.LoggerOptions = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime, // 使用 ISO 8601 时间戳
  messageKey: 'message', // 将消息内容放在 'message' 字段
  serializers: {
    err: pino.stdSerializers.err, // 标准错误序列化器
    error: pino.stdSerializers.err, // 也为 'error' 键使用标准错误序列化器
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }), // 日志级别大写 (例如 INFO, ERROR)
  },
  base: {
    pid: process.pid,
    service: process.env.SERVICE_NAME || 'NeuralMiner', // 可以通过环境变量配置服务名
  },
};

// 判断是否为开发环境
const isDev = process.env.NODE_ENV !== 'production';

// 创建 Pino Logger 实例
let logger: pino.Logger;

if (isDev) {
  // 开发环境: 输出到轮替文件流 和 美化后的控制台
  logger = pino(pinoOptions, pino.multistream(
    [
      { level: pinoOptions.level, stream: rotatingLogStream },
      {
        level: pinoOptions.level, // 控制台也遵循相同的级别
        stream: pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l', // 更易读的时间格式
            ignore: 'pid,hostname,service', // 开发时控制台可忽略这些
            messageKey: 'message',
          },
        }),
      },
    ],
    { dedupe: true } // 防止重复处理流
  ));
} else {
  // 生产环境: 输出到轮替文件流 和 标准的JSON到控制台 (如果需要，很多生产部署会收集stdout)
  logger = pino(pinoOptions, pino.multistream(
    [
      { level: pinoOptions.level, stream: rotatingLogStream },
      { level: pinoOptions.level, stream: process.stdout }, // JSON 输出到 stdout
    ],
    { dedupe: true }
  ));
}

export { logger };

// 使用示例:
// import { logger } from './logger';
//
// logger.debug({ data: { userId: 1 } }, 'User data for debugging.');
// logger.info('Application started successfully.');
// try {
//   throw new Error('Something went wrong!');
// } catch (e) {
//   logger.error({ err: e }, 'An error occurred during operation.');
// }
// logger.fatal('Critical system failure!');