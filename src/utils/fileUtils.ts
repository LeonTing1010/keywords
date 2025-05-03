import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * 默认输出目录
 */
export const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

/**
 * 确保输出目录存在
 */
export function ensureOutputDirectory(customDir?: string): string {
  const dir = customDir || OUTPUT_DIR;
  fs.ensureDirSync(dir);
  return dir;
}

/**
 * 写入文本文件
 */
export async function writeTextFile(
  filename: string,
  data: string, 
  customDir?: string
): Promise<string> {
  const outputDir = ensureOutputDirectory(customDir);
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, data, 'utf-8');
  return filePath;
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
  const outputDir = ensureOutputDirectory(customDir);
  const filePath = path.join(outputDir, filename);
  
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => row.join(','));
  const csvContent = [headerLine, ...dataLines].join('\n');
  
  await fs.writeFile(filePath, csvContent, 'utf-8');
  return filePath;
}

/**
 * 生成简单的CSV字符串
 */
export function generateSimpleCsv(headers: string[], data: string[]): string {
  return `${headers.join(',')}\n${data.join(',')}\n`;
} 