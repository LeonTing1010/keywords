/**
 * KeywordNova 文件工具模块
 * 处理文件系统操作
 */
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { ErrorType, AppError } from './errorHandler';

/**
 * 确保输出目录存在
 * @returns 输出目录路径
 */
export function ensureOutputDirectory(): string {
  const outputDir = config.output.dir;
  
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return outputDir;
  } catch (error) {
    throw new AppError(
      `无法创建输出目录 ${outputDir}: ${(error as Error).message}`,
      ErrorType.FILE_SYSTEM,
      error as Error
    );
  }
}

/**
 * 保存JSON数据到文件
 * @param data 要保存的数据
 * @param filePath 文件路径
 */
export function saveJsonToFile(data: any, filePath: string): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new AppError(
      `无法保存数据到文件 ${filePath}: ${(error as Error).message}`,
      ErrorType.FILE_SYSTEM,
      error as Error
    );
  }
}

/**
 * 从文件读取JSON数据
 * @param filePath 文件路径
 * @returns 解析后的JSON数据
 */
export function readJsonFromFile<T>(filePath: string): T {
  try {
    if (!fs.existsSync(filePath)) {
      throw new AppError(
        `文件不存在: ${filePath}`,
        ErrorType.FILE_SYSTEM
      );
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent) as T;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      `无法读取或解析文件 ${filePath}: ${(error as Error).message}`,
      ErrorType.FILE_SYSTEM,
      error as Error
    );
  }
}

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 * @returns 文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 创建唯一的时间戳文件名
 * @param prefix 文件名前缀
 * @param extension 文件扩展名
 * @returns 生成的文件名
 */
export function createTimestampedFilename(prefix: string, extension = 'json'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
} 