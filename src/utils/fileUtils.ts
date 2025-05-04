import * as fs from 'fs-extra';
import * as path from 'path';
import { AppError, ErrorType } from './errorHandler';

/**
 * 默认输出目录
 */
export const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

/**
 * 确保输出目录存在
 */
export function ensureOutputDirectory(customDir?: string): string {
  try {
    const dir = customDir || OUTPUT_DIR;
    fs.ensureDirSync(dir);
    return dir;
  } catch (error) {
    throw new AppError(
      `无法创建输出目录: ${error instanceof Error ? error.message : String(error)}`,
      ErrorType.FILE_SYSTEM,
      error
    );
  }
}

/**
 * 写入文本文件
 */
export async function writeTextFile(
  filename: string,
  data: string, 
  customDir?: string
): Promise<string> {
  try {
    const outputDir = ensureOutputDirectory(customDir);
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, data, 'utf-8');
    return filePath;
  } catch (error) {
    throw new AppError(
      `写入文件失败 ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      ErrorType.FILE_SYSTEM,
      error
    );
  }
}

/**
 * 写入CSV文件
 */
export async function writeCsvFile(
  filename: string,
  headers: string[], 
  rows: string[][],
  customDir?: string
): Promise<string> {
  try {
    const outputDir = ensureOutputDirectory(customDir);
    const filePath = path.join(outputDir, filename);
    
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => row.join(','));
    const csvContent = [headerLine, ...dataLines].join('\n');
    
    await fs.writeFile(filePath, csvContent, 'utf-8');
    return filePath;
  } catch (error) {
    throw new AppError(
      `写入CSV文件失败 ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      ErrorType.FILE_SYSTEM,
      error
    );
  }
}

/**
 * 生成简单的CSV字符串
 */
export function generateSimpleCsv(headers: string[], data: string[]): string {
  return `${headers.join(',')}\n${data.join(',')}\n`;
}