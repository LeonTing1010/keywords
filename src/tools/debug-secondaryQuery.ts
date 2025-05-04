#!/usr/bin/env node
/**
 * 二次查询调试工具
 * 专门用于调试执行二次查询的流程
 */

import { GoogleSearchEngine } from '../engines/GoogleSearchEngine';
import { SearchEngine } from '../engines/SearchEngine';
import { Logger, LogLevel } from '../utils/logger';
import { debugConfig } from '../config/debug.config';
import { SecondaryQueryManager } from '../utils/secondaryQueryManager';
import { SearchOptions } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// 创建专用的调试日志记录器
const logger = new Logger('SecondaryQueryDebugger', LogLevel.DEBUG);

// 确保输出目录存在
function ensureOutputDirectory(): string {
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

// 调试初始查询
async function debugInitialQuery(keyword: string, options?: SearchOptions): Promise<string[]> {
  logger.info(`开始执行初始查询: "${keyword}"`);
  
  // 实例化Google搜索引擎
  const engine = new GoogleSearchEngine();
  
  try {
    // 设置选项，启用二次查询标志
    const searchOptions: SearchOptions = {
      useSystemBrowser: false,
      enableSecondRound: true,
      ...options
    };
    
    // 执行初始查询
    logger.info(`使用选项: ${JSON.stringify(searchOptions)}`);
    const result = await engine.fetchAutocomplete(keyword, searchOptions);
    
    // 记录结果
    logger.info(`初始查询完成，共获取 ${result.suggestions.length} 条建议`);
    logger.debug(`初始查询结果: ${JSON.stringify(result.suggestions)}`);
    
    // 检查是否设置了二次查询标志
    logger.debug(`选项中的enableSecondRound值: ${searchOptions.enableSecondRound}`);
    
    // 返回结果建议
    return result.suggestions;
  } catch (error) {
    logger.error(`初始查询失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// 调试二次查询
async function debugSecondaryQuery(keyword: string, initialSuggestions: string[], options?: SearchOptions): Promise<void> {
  logger.info(`开始执行二次查询调试: "${keyword}"`);
  
  // 实例化Google搜索引擎
  const engine = new GoogleSearchEngine();
  const outputDir = ensureOutputDirectory();
  
  try {
    // 设置二次查询选项
    const secondaryOptions: SearchOptions = {
      useSystemBrowser: false,
      enableSecondRound: true,
      retryCount: 1,
      maxSecondaryKeywords: 3, // 调试时使用较小的值
      persistBrowser: true,
      batchSize: 3,
      ...options
    };
    
    // 使用基类的executeSecondaryQueries方法（直接方式）
    logger.info(`方法1: 直接调用搜索引擎的executeSecondaryQueries方法`);
    try {
      logger.debug(`调用engine.executeSecondaryQueries...`);
      const outputPath = await engine.executeSecondaryQueries(
        keyword, 
        secondaryOptions,
        `direct_secondary_${keyword.replace(/\s+/g, '_')}.json`
      );
      logger.info(`直接调用成功，结果保存在: ${outputPath}`);
    } catch (error) {
      logger.error(`直接调用executeSecondaryQueries失败: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 使用SecondaryQueryManager（CLI使用的方式）
    logger.info(`方法2: 使用SecondaryQueryManager`);
    try {
      const queryManager = new SecondaryQueryManager(engine, outputDir);
      logger.debug(`调用queryManager.executeSecondaryQueries...`);
      
      const secondarySuggestions = await queryManager.executeSecondaryQueries(
        keyword,
        secondaryOptions,
        initialSuggestions
      );
      
      logger.info(`使用SecondaryQueryManager成功，共获取 ${secondarySuggestions.length} 条建议`);
      
      // 合并并保存结果
      const mergedSuggestions = queryManager.mergeSuggestions(
        initialSuggestions,
        secondarySuggestions
      );
      
      const outputPath = queryManager.saveMergedResults(
        keyword,
        mergedSuggestions,
        `manager_secondary_${keyword.replace(/\s+/g, '_')}.json`
      );
      
      logger.info(`合并结果保存在: ${outputPath}`);
    } catch (error) {
      logger.error(`使用SecondaryQueryManager失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    logger.error(`二次查询调试过程失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // 清理资源
    await engine.cleanup();
  }
}

// 检查引擎是否实现了executeSecondaryQueries方法
function checkEngineImplementation(): void {
  const engine = new GoogleSearchEngine();
  logger.info('检查引擎的方法实现...');
  
  // 检查executeSecondaryQueries方法
  if (typeof (engine as any).executeSecondaryQueries === 'function') {
    logger.info('✅ 引擎实现了executeSecondaryQueries方法');
  } else {
    logger.error('❌ 引擎未实现executeSecondaryQueries方法');
  }
  
  // 显示引擎的配置
  logger.info(`引擎配置: ${JSON.stringify(engine.getConfig())}`);
  
  // 检查supportsSecondRound标志
  if (engine.getConfig().supportsSecondRound) {
    logger.info('✅ 引擎的supportsSecondRound标志已设置为true');
  } else {
    logger.error('❌ 引擎的supportsSecondRound标志设置为false');
  }
}

// 主函数
async function main() {
  try {
    logger.info('启动二次查询调试工具...');
    logger.debug(`调试配置: ${util.inspect(debugConfig)}`);
    
    // 首先检查引擎实现
    checkEngineImplementation();
    
    // 获取命令行参数
    const args = process.argv.slice(2);
    const keyword = args[0] || 'test';
    
    // 执行完整的调试流程
    logger.info(`使用关键词: "${keyword}"`);
    
    // 1. 调试初始查询
    const initialSuggestions = await debugInitialQuery(keyword);
    
    // 2. 调试二次查询
    await debugSecondaryQuery(keyword, initialSuggestions);
    
    logger.info('二次查询调试完成！');
  } catch (error) {
    logger.error(`调试工具执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // 确保关闭全局浏览器实例
    logger.info('关闭全局浏览器实例...');
    await GoogleSearchEngine.closeGlobalBrowser ? 
      GoogleSearchEngine.closeGlobalBrowser() : 
      SearchEngine.closeGlobalBrowser();
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

export { debugInitialQuery, debugSecondaryQuery }; 