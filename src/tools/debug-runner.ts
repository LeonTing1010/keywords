#!/usr/bin/env node
/**
 * KeywordNova 调试运行器
 * 提供调试工具和诊断功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { GoogleSearchEngine } from '../infrastructure/search/engines/GoogleSearchEngine';
import { BaiduSearchEngine } from '../infrastructure/search/engines/BaiduSearchEngine';
import { LLMServiceHub } from '../infrastructure/llm/LLMServiceHub';
import { config } from '../infrastructure/config/config';
import { AppError, ErrorType, handleError } from '../infrastructure/error/errorHandler';
import { logger } from '../infrastructure/error/logger';
import { WorkflowController } from '../application/services/WorkflowController';

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
  info: (message: string) => logger.info(message, { component: 'debug-runner' }),
  debug: (message: string) => logger.debug(message, { component: 'debug-runner' }),
  warn: (message: string) => logger.warn(message, { component: 'debug-runner' }),
  error: (message: string) => logger.error(message, { component: 'debug-runner' }),
  success: (message: string) => logger.info(`✓ ${message}`, { component: 'debug-runner' })
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
    await engine.initialize();
    
    // 执行一个简单查询
    log.debug('执行诊断查询...');
    const suggestions = await engine.getSuggestions('test query');
    
    log.success(`查询成功! 返回${suggestions.length}个结果.`);
    
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
  
  if (!process.env.OPENAI_API_KEY) {
    log.warn('未找到LLM API密钥，请设置环境变量OPENAI_API_KEY');
    return false;
  }
  
  try {
    // 创建LLM服务实例
    const llmService = new LLMServiceHub({
      model: config.llm.defaultModel
    });
    
    // 执行简单的提示
    log.debug('向LLM发送测试提示...');
    const response = await llmService.analyze('将关键词分类为三个类别', 
      { keywords: ['家居', '教育', '购物'] },
      {
        systemPrompt: '你是一个专业的关键词分析师。',
        format: 'json'
      }
    );
    
    log.debug('LLM响应成功');
    
    // 检查响应对象
    if (response && typeof response === 'object') {
      log.success('JSON响应格式正确!');
    } else {
      log.warn('响应不是有效的JSON对象');
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
    await engine.initialize();
    
    // 执行查询
    log.debug(`执行查询: "${keyword}"...`);
    const suggestions = await engine.getSuggestions(keyword);
    log.success(`查询成功! 返回${suggestions.length}个结果:`);
    suggestions.forEach((suggestion: any, index: number) => {
      log.info(`  ${index + 1}. ${suggestion.query}`);
    });

    // 新增：测试 getSearchResults（仅Baidu）
    if (engineType.toLowerCase() === 'baidu' && typeof engine.getSearchResults === 'function') {
      log.info('测试 getSearchResults...');
      const results = await engine.getSearchResults(keyword, { maxResults: 3 });
      results.forEach((item, idx) => {
        log.info(`Result #${idx + 1}:`);
        log.info(`  标题: ${item.title}`);
        log.info(`  摘要: ${item.snippet}`);
        log.info(`  URL: ${item.url}`);
      });
    }
    
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
 * 测试工作流控制器
 */
async function testWorkflowController(keyword: string = 'test') {
  log.info(`开始测试工作流控制器 (关键词: ${keyword})...`);
  
  try {
    // 创建搜索引擎实例
    const searchEngine = new BaiduSearchEngine();
    
    // 初始化引擎
    log.debug('初始化搜索引擎...');
    await searchEngine.initialize();
    
    // 创建LLM服务实例
    const llmService = new LLMServiceHub({
      model: config.llm.defaultModel
    });
    
    // 创建工作流控制器
    log.debug('创建工作流控制器...');
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      maxIterations: 2,
      satisfactionThreshold: 0.8,
      analysisDepth: 1,
      outputFormat: 'json',
      enableJourneySim: true,
      enableAutocomplete: true,
      verbose: true,
      outputDir: './output',
      language: 'zh',
      generateMarkdownReport: false
    });
    
    // 执行工作流
    log.debug(`执行工作流分析: "${keyword}"...`);
    const result = await workflowController.executeWorkflow(keyword);
    
    log.success('工作流执行成功!');
    log.info(`发现关键词数量: ${result.discoveredKeywords.length}`);
    log.info(`市场洞察数量: ${result.marketInsights.length}`);
    
    // 关闭搜索引擎
    await searchEngine.close();
    
    return true;
  } catch (error) {
    handleError(error);
    log.error(`工作流控制器测试失败: ${(error as Error).message}`);
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
      case 'workflow':
        if (params.length === 0) {
          await testWorkflowController();
        } else {
          await testWorkflowController(params[0]);
        }
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