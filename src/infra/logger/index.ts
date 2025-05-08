/**
 * logger/index.ts
 * 提供统一的日志记录服务
 */

import * as pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';
import * as pinoms from 'pino-multi-stream';
// @ts-ignore
import { createStream } from 'rotating-file-stream';

// 日志目录
const logsDir = path.join(process.cwd(), 'logs');
fs.existsSync(logsDir) || fs.mkdirSync(logsDir, { recursive: true });

// 生成日志文件名（按日期）
const filenameGenerator = (time: Date | number, index?: number): string => {
  if (!time) time = new Date();
  if (time instanceof Date) {
    const dateStr = time.toISOString().split('T')[0];
    return `app.${dateStr}.log`;
  }
  return 'app.log';
};
const errorFilenameGenerator = (time: Date | number, index?: number): string => {
  if (!time) time = new Date();
  if (time instanceof Date) {
    const dateStr = time.toISOString().split('T')[0];
    return `error.${dateStr}.log`;
  }
  return 'error.log';
};

// 自定义时间格式
const formatDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 主日志流
const mainLogStream = createStream(filenameGenerator, {
  path: logsDir,
  size: '20M',
  interval: '1d',
  maxFiles: 30,
  compress: false
});
// 错误日志流
const errorLogStream = createStream(errorFilenameGenerator, {
  path: logsDir,
  size: '20M',
  interval: '1d',
  maxFiles: 30,
  compress: false
});

// 错误序列化
const errorSerializer = (err: any) => {
  if (!err || typeof err !== 'object') return err;
  const serialized: any = {
    message: err.message,
    name: err.name,
    stack: err.stack
  };
  Object.keys(err).forEach(key => {
    if (!serialized[key]) serialized[key] = err[key];
  });
  return serialized;
};

// 只写 error 及以上级别到 error 日志
const errorFilter = {
  write: (data: string) => {
    try {
      const log = JSON.parse(data);
      if (log.level === 'error' || log.level === 'fatal' || log.level >= 50) {
        errorLogStream.write(data + '\n');
      }
    } catch (err) {
      // 容错
      console.error('Error parsing log data:', err);
    }
  }
};

// 日志级别优先级：DEBUG=true > LOG_LEVEL > info
const logLevel = process.env.DEBUG === 'true' ? 'debug' : (process.env.LOG_LEVEL || 'info');

const loggerOptions: pino.LoggerOptions = {
  level: logLevel,
  timestamp: () => `,"timestamp":"${formatDateTime()}` + '"',
  base: { service: 'keywords-analysis' },
  serializers: {
    err: pino.stdSerializers.err,
    error: errorSerializer
  },
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => object
  },
  messageKey: 'message',
};

// 判断是否为开发环境
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino.default({
  ...loggerOptions,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false
          }
        }
      }
    : {})
}) as pino.Logger;

// 文件流
const streams = [
  { stream: mainLogStream },
  { stream: errorFilter }
];
const fileLogger = pino.default(loggerOptions, pinoms.multistream(streams));

// 兼容 winston 风格
const logLevels = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = typeof logLevels[number];
type LogFn = (msg: string | object, ...args: any[]) => void;
interface LogObject { [key: string]: any; message?: string; }
function processErrorObject(obj: LogObject): LogObject {
  const result = { ...obj };
  if (result.error instanceof Error) result.error = errorSerializer(result.error);
  if (result.err instanceof Error) result.err = errorSerializer(result.err);
  return result;
}
logLevels.forEach(level => {
  if (typeof logger[level] === 'function') {
    const originalMethod = logger[level] as LogFn;
    // @ts-ignore
    logger[level] = function(msgOrObj: string | LogObject, ...args: any[]) {
      let message: string;
      let metadata: LogObject = {};
      if (typeof msgOrObj === 'string') {
        message = msgOrObj;
        if (args.length > 0 && typeof args[0] === 'object') {
          metadata = args[0] as LogObject;
          args = args.slice(1);
        }
      } else {
        if (msgOrObj.message !== undefined) {
          message = msgOrObj.message;
          const { message: _, ...rest } = msgOrObj;
          metadata = rest;
        } else {
          message = '';
          metadata = msgOrObj;
        }
      }
      metadata = processErrorObject(metadata);
      const finalMetadata = { ...metadata, message };
      originalMethod.apply(logger, [finalMetadata]);
      if (fileLogger[level]) {
        (fileLogger[level] as LogFn)(finalMetadata);
      }
    };
  }
}); 