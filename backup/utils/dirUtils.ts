/**
 * KeywordNova 目录工具
 * 处理目录创建和确保目录存在的操作
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

/**
 * 确保所有必要的目录结构存在
 */
export function ensureDirectoryStructure(): void {
  // 确保输出目录存在
  ensureDir(config.output.dir);
  
  // 确保日志目录存在
  const logsDir = path.join(process.cwd(), 'logs');
  ensureDir(logsDir);
  
  // 确保调试日志目录存在
  const debugLogsDir = path.join(logsDir, 'debug');
  ensureDir(debugLogsDir);
  
  // 确保网络日志目录存在
  ensureDir(path.join(debugLogsDir, 'network'));
  
  // 确保性能日志目录存在
  ensureDir(path.join(debugLogsDir, 'performance'));
  
  // 确保截图目录存在
  ensureDir(path.join(debugLogsDir, 'screenshots'));
}

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取相对于项目根目录的路径
 * @param relativePath 相对路径
 * @returns 完整路径
 */
export function getProjectPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

/**
 * 创建带有时间戳的文件名
 * @param prefix 文件名前缀
 * @param extension 文件扩展名
 * @returns 带时间戳的文件名
 */
export function getTimestampedFilename(prefix: string, extension: string = 'json'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * 创建带有时间戳的文件路径
 * @param directory 目录路径
 * @param prefix 文件名前缀
 * @param extension 文件扩展名
 * @returns 完整的文件路径
 */
export function getTimestampedFilePath(
  directory: string,
  prefix: string,
  extension: string = 'json'
): string {
  const filename = getTimestampedFilename(prefix, extension);
  return path.join(directory, filename);
} 