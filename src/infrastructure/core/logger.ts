import * as pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';
import * as pinoms from 'pino-multi-stream';
// @ts-ignore - 缺少类型定义
import { createStream } from 'rotating-file-stream';

// 确保日志目录存在
const logsDir = path.join(process.cwd(), 'logs');
fs.existsSync(logsDir) || fs.mkdirSync(logsDir, { recursive: true });

// 生成日志文件名（按日期）
const filenameGenerator = (time: Date | number, index?: number): string => {
  if (!time) {
    time = new Date();
  }
  if (time instanceof Date) {
    const dateStr = time.toISOString().split('T')[0]; // YYYY-MM-DD
    return `app.${dateStr}.log`;
  }
  return `app.log`;
};

// 生成错误日志文件名（按日期）
const errorFilenameGenerator = (time: Date | number, index?: number): string => {
  if (!time) {
    time = new Date();
  }
  if (time instanceof Date) {
    const dateStr = time.toISOString().split('T')[0]; // YYYY-MM-DD
    return `error.${dateStr}.log`;
  }
  return `error.log`;
};

// 自定义时间格式化，与原Winston格式保持一致
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

// 创建主日志文件流（带自动切割）
const mainLogStream = createStream(filenameGenerator, {
  path: logsDir,
  size: '20M',       // 单文件最大尺寸
  interval: '1d',    // 按日切割
  maxFiles: 30,      // 保留30天的日志
  compress: false    // 不压缩
});

// 创建错误日志文件流（带自动切割）
const errorLogStream = createStream(errorFilenameGenerator, {
  path: logsDir,
  size: '20M',       // 单文件最大尺寸
  interval: '1d',    // 按日切割
  maxFiles: 30,      // 保留30天的日志
  compress: false    // 不压缩
});

// 自定义错误序列化函数
const errorSerializer = (err: any) => {
  if (!err || typeof err !== 'object') return err;
  
  const serialized: any = {
    message: err.message,
    name: err.name,
    stack: err.stack
  };
  
  // 复制其他自定义属性
  Object.keys(err).forEach(key => {
    if (!serialized[key]) {
      serialized[key] = err[key];
    }
  });
  
  return serialized;
};

// 过滤错误级别的流
const errorFilter = {
  write: (data: string) => {
    try {
      const log = JSON.parse(data);
      if (log.level === 'error' || log.level === 'fatal' || log.level >= 50) {
        errorLogStream.write(data + '\n'); // 确保每条日志有换行
      }
    } catch (err) {
      // 容错处理
      console.error('Error parsing log data:', err);
    }
  }
};

// 核心JSON格式化配置
const loggerOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  // 使用自定义时间格式
  timestamp: () => `,"timestamp":"${formatDateTime()}"`,
  base: { service: 'keywords-analysis' },
  serializers: {
    err: pino.stdSerializers.err,  // 完整错误堆栈捕获
    error: errorSerializer         // 自定义错误序列化
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
    // 确保所有元数据都被保留
    log: (object) => {
      return object;
    }
  },
  // 禁用Pino的一些默认字段，保持日志简洁
  messageKey: 'message',
};

// 创建日志实例
export const logger = pino.default({
  ...loggerOptions,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
}) as pino.Logger;

// 文件写入器
const streams = [
  { stream: mainLogStream },
  { stream: errorFilter }
];
const fileLogger = pino.default(loggerOptions, pinoms.multistream(streams));

// 确保日志API与Winston兼容
type LogFn = (msg: string | object, ...args: any[]) => void;
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// 定义可接受对象类型
interface LogObject {
  [key: string]: any;
  message?: string;
}

// 处理错误对象
function processErrorObject(obj: LogObject): LogObject {
  const result = { ...obj };
  
  // 处理error字段
  if (result.error instanceof Error) {
    result.error = errorSerializer(result.error);
  }
  
  // 处理err字段
  if (result.err instanceof Error) {
    result.err = errorSerializer(result.err);
  }
  
  return result;
}

// 覆盖原有方法
const logLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

logLevels.forEach(level => {
  if (typeof logger[level] === 'function') {
    const originalMethod = logger[level] as LogFn;
    // @ts-ignore - 重新定义方法
    logger[level] = function(msgOrObj: string | LogObject, ...args: any[]) {
      // 处理传入的对象和消息
      let message: string;
      let metadata: LogObject = {};
      
      if (typeof msgOrObj === 'string') {
        message = msgOrObj;
        // 如果args[0]是对象，将它作为元数据
        if (args.length > 0 && typeof args[0] === 'object') {
          metadata = args[0] as LogObject;
          args = args.slice(1);
        }
      } else {
        // 如果第一个参数是对象，从中提取message字段，其余作为元数据
        if (msgOrObj.message !== undefined) {
          message = msgOrObj.message;
          const { message: _, ...rest } = msgOrObj;
          metadata = rest;
        } else {
          message = '';
          metadata = msgOrObj;
        }
      }
      
      // 处理错误对象
      metadata = processErrorObject(metadata);
      
      // 合并所有元数据
      const finalMetadata = {
        ...metadata,
        message
      };
      
      // 控制台输出
      originalMethod.apply(logger, [finalMetadata]);
      
      // 文件日志记录
      if (fileLogger[level]) {
        (fileLogger[level] as LogFn)(finalMetadata);
      }
    };
  }
});