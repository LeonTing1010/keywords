#!/usr/bin/env node
/**
 * 调试运行器
 * 专门用于调试搜索引擎的行为和解决问题
 */

import { GoogleSearchEngine } from '../engines/GoogleSearchEngine';
import { Logger, LogLevel } from '../utils/logger';
import { debugConfig } from '../config/debug.config';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// 创建专用的调试日志记录器
const logger = new Logger('DebugRunner', LogLevel.DEBUG);

// 初始化
async function init() {
  logger.info('初始化调试运行器...');
  
  // 确保调试目录结构存在
  ensureDebugDirectories();
  
  logger.debug(`调试配置: ${util.inspect(debugConfig)}`);
  
  // 注册进程退出处理
  process.on('exit', () => {
    logger.info('调试会话结束');
  });
  
  process.on('uncaughtException', (err) => {
    logger.error(`未捕获的异常: ${err.message}`, true);
    logger.error(err.stack || '没有可用的堆栈信息');
  });
  
  process.on('unhandledRejection', (reason) => {
    logger.error(`未处理的Promise拒绝: ${reason}`, true);
  });
}

// 确保调试目录结构
function ensureDebugDirectories() {
  // 创建截图目录
  fs.mkdirSync(debugConfig.screenshotPath, { recursive: true });
  
  // 创建日志目录
  fs.mkdirSync(debugConfig.logPath, { recursive: true });
  
  // 创建其他调试资源目录
  const networkLogsDir = path.join(debugConfig.logPath, 'network');
  fs.mkdirSync(networkLogsDir, { recursive: true });
  
  const performanceLogsDir = path.join(debugConfig.logPath, 'performance');
  fs.mkdirSync(performanceLogsDir, { recursive: true });
}

// 使用Google引擎运行调试查询
async function runGoogleDebugQuery(keyword: string) {
  logger.info(`开始调试Google搜索引擎查询: "${keyword}"`);
  
  // 实例化Google搜索引擎
  const engine = new GoogleSearchEngine();
  
  try {
    // 执行查询
    const startTime = Date.now();
    const result = await engine.fetchAutocomplete(keyword, {
      useSystemBrowser: false, // 使用临时浏览器更容易调试
      enableSecondRound: false // 初始调试仅执行一轮查询
    });
    const endTime = Date.now();
    
    // 记录执行时间
    logger.debug(`查询执行时间: ${endTime - startTime}ms`);
    
    // 记录结果统计
    logger.info(`查询完成，获取到 ${result.suggestions.length} 条建议`);
    logger.debug('查询结果:');
    result.suggestions.forEach((suggestion, index) => {
      logger.debug(`  ${index + 1}. ${suggestion}`);
    });
    
    // 保存结果到调试目录
    const resultsFile = path.join(
      debugConfig.logPath, 
      `google_${keyword.replace(/\s+/g, '_')}_debug_results.json`
    );
    fs.writeFileSync(
      resultsFile, 
      JSON.stringify(result, null, 2)
    );
    logger.info(`调试结果已保存到: ${resultsFile}`);
    
    return result;
  } catch (error) {
    logger.error(`调试查询失败: ${error instanceof Error ? error.message : String(error)}`, true);
    throw error;
  } finally {
    // 清理资源
    await engine.cleanup();
  }
}

// 诊断网络问题
async function diagnoseNetworkIssues() {
  logger.info('开始诊断网络连接问题...');
  
  try {
    // 检查常见的搜索引擎域名连接
    const domains = [
      'www.google.com',
      'www.google.co.uk',
      'www.google.com.hk',
      'www.bing.com',
      'cn.bing.com'
    ];
    
    // 使用Node的DNS模块检查DNS解析
    const dns = require('dns');
    const dnsPromises = dns.promises;
    
    for (const domain of domains) {
      try {
        logger.debug(`正在检查域名 ${domain} 的DNS解析...`);
        const result = await dnsPromises.lookup(domain);
        logger.debug(`域名 ${domain} 解析成功: ${result.address}`);
      } catch (error) {
        logger.error(`域名 ${domain} 解析失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.info('网络诊断完成');
  } catch (error) {
    logger.error(`网络诊断过程中出错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 主函数
async function main() {
  try {
    await init();
    
    // 获取命令行参数
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      // 没有参数时显示帮助信息
      console.log(`
调试运行器使用说明:
node debug-runner.ts <命令> [选项]

可用命令:
  query <关键词>    执行Google搜索引擎查询并收集调试信息
  network          诊断网络连接问题
  help             显示此帮助信息

示例:
  node debug-runner.ts query "iphone"
  node debug-runner.ts network
`);
      return;
    }
    
    const command = args[0];
    
    if (command === 'query') {
      const keyword = args[1] || 'test';
      await runGoogleDebugQuery(keyword);
    } else if (command === 'network') {
      await diagnoseNetworkIssues();
    } else if (command === 'help') {
      console.log(`
调试运行器使用说明:
node debug-runner.ts <命令> [选项]

可用命令:
  query <关键词>    执行Google搜索引擎查询并收集调试信息
  network          诊断网络连接问题
  help             显示此帮助信息

示例:
  node debug-runner.ts query "iphone"
  node debug-runner.ts network
`);
    } else {
      logger.error(`未知命令: ${command}`);
    }
  } catch (error) {
    logger.error(`执行调试运行器时出错: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 执行主函数
main(); 