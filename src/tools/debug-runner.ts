#!/usr/bin/env node
/**
 * KeywordNova 调试运行器
 * 提供调试工具和诊断功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleSearchEngine } from '../providers/GoogleSearchEngine';
import { BaiduSearchEngine } from '../providers/BaiduSearchEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { config } from '../config';
import { AppError, ErrorType, handleError } from '../core/errorHandler';

// 创建日志目录
const LOG_DIR = path.join(process.cwd(), 'logs', 'debug');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 获取当前时间戳
const getTimestamp = () => {
  return new Date().toISOString().replace(/[:.]/g, '-');
};

// 创建日志文件名
const createLogFileName = (prefix: string) => {
  return path.join(LOG_DIR, `${prefix}_${getTimestamp()}.log`);
};

// 控制台日志功能
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  debug: (message: string) => console.log(`[DEBUG] ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  success: (message: string) => console.log(`[SUCCESS] ${message}`)
};

/**
 * 运行网络诊断
 */
async function runNetworkDiagnostics() {
  log.info('开始运行网络诊断...');
  
  try {
    // 创建百度搜索引擎实例
    const engine = new BaiduSearchEngine();
    
    // 初始化引擎
    log.debug('初始化搜索引擎...');
    await engine.initialize({
      useSystemBrowser: false
    });
    
    // 执行一个简单查询
    log.debug('执行诊断查询...');
    const result = await engine.getSuggestions('test query');
    
    log.success(`查询成功! 返回${result.suggestions.length}个结果.`);
    
    // 关闭引擎
    await engine.close();
    
    return true;
  } catch (error) {
    handleError(error);
    log.error(`网络诊断失败: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 运行LLM服务诊断
 */
async function runLLMDiagnostics() {
  log.info('开始运行LLM服务诊断...');
  
  if (!config.llm.apiKey) {
    log.warn('未找到LLM API密钥，请设置环境变量OPENAI_API_KEY');
    return false;
  }
  
  try {
    // 创建LLM服务实例
    const llmService = new LLMServiceHub({
      model: config.llm.defaultModel,
      apiKey: config.llm.apiKey
    });
    
    // 执行简单的提示
    log.debug('向LLM发送测试提示...');
    const response = await llmService.sendPrompt(
      '返回一个JSON，包含三个关键词类别：{"informational":["example"],"commercial":["example"],"educational":["example"]}',
      {
        systemPrompt: '你是一个专业的关键词分析师。',
        requireJson: true
      }
    );
    
    log.debug(`LLM响应: ${response.substring(0, 100)}...`);
    
    // 尝试解析JSON
    try {
      const parsedResponse = JSON.parse(response);
      log.success('JSON解析成功!');
    } catch (error) {
      log.warn(`JSON解析失败: ${(error as Error).message}`);
    }
    
    return true;
  } catch (error) {
    handleError(error);
    log.error(`LLM服务诊断失败: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 运行搜索引擎诊断
 */
async function runSearchEngineDiagnostics(keyword: string = 'test', engineType: string = 'baidu') {
  log.info(`开始运行搜索引擎诊断(搜索引擎: ${engineType}, 关键词: ${keyword})...`);
  
  try {
    // 创建搜索引擎实例
    const engine = engineType.toLowerCase() === 'google' 
      ? new GoogleSearchEngine() 
      : new BaiduSearchEngine();
    
    // 初始化引擎
    log.debug('初始化搜索引擎...');
    await engine.initialize({
      useSystemBrowser: false
    });
    
    // 执行查询
    log.debug(`执行查询: "${keyword}"...`);
    const result = await engine.getSuggestions(keyword);
    
    log.success(`查询成功! 返回${result.suggestions.length}个结果:`);
    result.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion}`);
    });
    
    // 关闭引擎
    await engine.close();
    
    return true;
  } catch (error) {
    handleError(error);
    log.error(`搜索引擎诊断失败: ${(error as Error).message}`);
    return false;
  }
}

/**
 * 运行综合诊断
 */
async function runFullDiagnostics() {
  log.info('开始运行综合诊断...');
  
  // 网络诊断
  const networkResult = await runNetworkDiagnostics();
  log.info(`网络诊断: ${networkResult ? '成功' : '失败'}`);
  
  // LLM服务诊断
  const llmResult = await runLLMDiagnostics();
  log.info(`LLM服务诊断: ${llmResult ? '成功' : '失败'}`);
  
  // 搜索引擎诊断
  const searchResult = await runSearchEngineDiagnostics();
  log.info(`搜索引擎诊断: ${searchResult ? '成功' : '失败'}`);
  
  // 总结
  if (networkResult && llmResult && searchResult) {
    log.success('所有诊断项目通过!');
    return true;
  } else {
    log.warn('部分诊断项目失败，请查看日志获取详细信息');
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  const command = args[0] || 'all';
  const params = args.slice(1);
  
  try {
    switch (command) {
      case 'network':
        await runNetworkDiagnostics();
        break;
      case 'llm':
        await runLLMDiagnostics();
        break;
      case 'search':
        await runSearchEngineDiagnostics(params[0]);
        break;
      case 'google':
        await runSearchEngineDiagnostics(params[0] || 'test', 'google');
        break;
      case 'baidu':
        await runSearchEngineDiagnostics(params[0] || 'test', 'baidu');
        break;
      case 'query':
        if (params.length === 0) {
          throw new AppError('缺少查询关键词参数', ErrorType.VALIDATION);
        }
        await runSearchEngineDiagnostics(params[0]);
        break;
      case 'all':
      default:
        await runFullDiagnostics();
        break;
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    handleError(error);
    process.exit(1);
  });
} 