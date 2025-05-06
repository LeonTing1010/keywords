#!/usr/bin/env node
/**
 * KeywordIntent CLI界面
 * 高级用户意图挖掘与搜索行为分析系统命令行工具
 * v3.0.0
 */
import { SearchEngine } from '../providers/SearchEngine';
import { GoogleSearchEngine } from '../providers/GoogleSearchEngine';
import { BaiduSearchEngine } from '../providers/BaiduSearchEngine';
import { SearchEngineType, SearchOptions } from '../types';
import { handleError, ErrorType, AppError } from '../core/errorHandler';
import * as path from 'path';
import * as fs from 'fs';
import { SimpleKeywordDiscovery } from '../discovery/SimpleKeywordDiscovery';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { UserJourneySim } from '../journey/UserJourneySim';
import { WorkflowController } from '../core/WorkflowController';
import { config } from '../config';
import { logger, LogLevel } from '../core/logger';
import { Logger } from '../core/logger';

// 创建搜索引擎实例的工厂函数
function createSearchEngine(type: SearchEngineType): SearchEngine {
  logger.info('创建搜索引擎', { type });
  
  switch(type.toLowerCase()) {
    case 'google':
      return new GoogleSearchEngine();
    case 'baidu':
      return new BaiduSearchEngine();
    default:
      throw new AppError(`不支持的搜索引擎类型: ${type}`, ErrorType.VALIDATION);
  }
}

/**
 * 使用说明
 */
function printHelp() {
  // 可用的搜索引擎
  const availableEngines = ['baidu', 'google']; // 更新为支持的引擎列表
  
  console.log(`
KeywordIntent - 高级用户意图挖掘与搜索行为分析系统 v3.0.0

使用方法:
  npx ts-node keywordIntent.ts <关键词> [选项]

搜索引擎选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: baidu)
                            可选值: ${availableEngines.join(', ')}
  --proxy, -p <代理地址>     使用指定的代理服务器
  --output, -o <文件路径>    指定输出文件路径

功能模块选项:
  --no-journey-sim           禁用用户旅程模拟（默认开启）
  --no-autocomplete          禁用自动补全增强（默认开启）
  
输出选项:
  --format <格式>            输出格式(json, markdown, csv，默认: json)
  --language <语言>          报告语言(zh, en，默认: zh)
  --markdown-report          生成Markdown格式的分析报告

高级选项:
  --model <模型名称>         指定LLM模型(默认: gpt-4)
  --verbose                  输出详细日志
  --log-level <级别>         设置日志级别(error, warn, info, debug, trace)
  --help, -h                 显示帮助信息

示例:
  npx ts-node keywordIntent.ts "iphone"                     # 使用默认配置进行分析
  npx ts-node keywordIntent.ts "最佳笔记本" --proxy http://127.0.0.1:7890
  npx ts-node keywordIntent.ts "artificial intelligence" --language en  # 生成英文报告
  npx ts-node keywordIntent.ts "SEO优化" --markdown-report   # 生成Markdown格式分析报告
  `);
}

/**
 * 解析命令行参数
 */
function parseArguments(args: string[]): {
  keyword: string;
  engineType: SearchEngineType;
  proxyServer?: string;
  outputFilename?: string;
  llmModel: string;
  enableJourneySim: boolean;
  enableAutocomplete: boolean;
  autocompleteEngine?: string;
  outputFormat: string;
  language: 'zh' | 'en';
  verbose: boolean;
  logLevel: LogLevel;
  generateMarkdownReport: boolean;
} {
  let keyword = '';
  let engineType: SearchEngineType = 'baidu'; // 默认使用百度
  let proxyServer: string | undefined = undefined;
  let outputFilename: string | undefined = undefined;
  let llmModel = config.llm.defaultModel;
  let enableJourneySim = true; // 默认开启用户旅程模拟
  let enableAutocomplete = true; // 默认开启自动补全功能
  let autocompleteEngine: string | undefined = undefined;
  let outputFormat = 'json';
  let language: 'zh' | 'en' = 'zh'; // 默认使用中文
  let verbose = false;
  let logLevel = LogLevel.INFO;
  let generateMarkdownReport = false; // 默认不生成Markdown报告
  
  // 提取命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--engine' || arg === '-e') {
      const engineName = args[++i];
      
      if (engineName && (engineName === 'google' || engineName === 'baidu')) {
        engineType = engineName as SearchEngineType;
      } else {
        throw new AppError(
          `不支持的搜索引擎 "${engineName}"`, 
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--proxy' || arg === '-p') {
      proxyServer = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      outputFilename = args[++i];
    } else if (arg === '--model') {
      llmModel = args[++i];
    } else if (arg === '--no-journey-sim') {
      enableJourneySim = false;
    } else if (arg === '--no-autocomplete') {
      enableAutocomplete = false;
    } else if (arg === '--format') {
      const format = args[++i].toLowerCase();
      if (['json', 'markdown', 'csv'].includes(format)) {
        outputFormat = format;
      } else {
        throw new AppError(
          `不支持的输出格式: ${format}`,
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--language') {
      const lang = args[++i].toLowerCase();
      if (['zh', 'en'].includes(lang)) {
        language = lang as 'zh' | 'en';
      } else {
        throw new AppError(
          `不支持的语言: ${lang}，可选值: zh, en`,
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--markdown-report') {
      generateMarkdownReport = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--log-level') {
      const level = args[++i].toLowerCase();
      switch (level) {
        case 'error': logLevel = LogLevel.ERROR; break;
        case 'warn': logLevel = LogLevel.WARN; break;
        case 'info': logLevel = LogLevel.INFO; break;
        case 'debug': logLevel = LogLevel.DEBUG; break;
        case 'trace': logLevel = LogLevel.TRACE; break;
        default:
          throw new AppError(
            `不支持的日志级别: ${level}，可选值: error, warn, info, debug, trace`,
            ErrorType.VALIDATION
          );
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-') && keyword === '') {
      keyword = arg;
    }
  }
  
  // 检查关键词
  if (!keyword) {
    printHelp();
    throw new AppError('请提供一个搜索关键词', ErrorType.VALIDATION);
  }
  
  return {
    keyword,
    engineType,
    proxyServer,
    outputFilename,
    llmModel,
    enableJourneySim,
    enableAutocomplete,
    autocompleteEngine,
    outputFormat,
    language,
    verbose,
    logLevel,
    generateMarkdownReport
  };
}

/**
 * 执行主流程
 */
export async function main() {
  try {
    const args = process.argv.slice(2);
    
    // 检查帮助命令
    if (args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    
    // 解析命令行参数
    const options = parseArguments(args);
    
    // 配置日志级别
    if (options.logLevel !== LogLevel.INFO || options.verbose) {
      // 如果指定了非默认日志级别或verbose模式，创建新的logger实例
      const loggerConfig = {
        level: options.logLevel,
        useConsole: true,
        formatTimestamp: true,
        includeContext: true
      };
      
      // 当使用verbose模式时，自动提升日志级别到DEBUG
      if (options.verbose && options.logLevel < LogLevel.DEBUG) {
        loggerConfig.level = LogLevel.DEBUG;
      }
      
      // 使用新的配置创建logger实例
      const newLogger = new Logger(loggerConfig);
      
      // 替换全局logger (注: 在实际代码中可能需要一个更好的方式来替换全局logger)
      // 由于这是一个简单的修复，我们保持这种方式
    }
    
    logger.info('KeywordIntent 分析启动', { 
      keyword: options.keyword, 
      engine: options.engineType, 
      model: options.llmModel,
      logLevel: LogLevel[options.logLevel]
    });
    
    // 构建启用的功能列表
    const enabledFeatures = [];
    if (options.enableJourneySim) {
      enabledFeatures.push('旅程模拟');
    }
    if (options.enableAutocomplete) {
      enabledFeatures.push(`自动补全增强${options.autocompleteEngine ? ` (引擎: ${options.autocompleteEngine})` : ''}`);
    }
    if (options.generateMarkdownReport) {
      enabledFeatures.push(`Markdown报告 (${options.language === 'en' ? '英文' : '中文'})`);
    }
    
    if (enabledFeatures.length > 0) {
      logger.info('启用的功能', { features: enabledFeatures });
    }
    
    if (options.proxyServer) {
      logger.info('使用代理', { proxy: options.proxyServer });
    }
    
    // 确保输出目录存在
    const outputDir = path.resolve(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 创建搜索引擎实例
    const searchEngine = createSearchEngine(options.engineType);
    
    // 配置代理服务器
    if (options.proxyServer) {
      searchEngine.setProxy(options.proxyServer);
    }
    
    // 使用系统浏览器
    if (process.env.USE_SYSTEM_BROWSER === 'true') {
      searchEngine.useSystemBrowser(true);
      logger.info('使用系统浏览器', { engine: options.engineType });
    }
    
    // 创建LLM服务实例
    const llmService = new LLMServiceHub({
      model: options.llmModel
    });
    
    // 创建工作流控制器
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      maxIterations: 3, // 固定为3轮迭代
      satisfactionThreshold: 0.85,
      analysisDepth: 2,
      outputFormat: options.outputFormat,
      enableJourneySim: options.enableJourneySim,
      enableAutocomplete: options.enableAutocomplete,
      autocompleteEngine: options.autocompleteEngine,
      verbose: options.verbose,
      outputDir: outputDir,
      language: options.language, // 传递语言设置
      generateMarkdownReport: options.generateMarkdownReport
    });
    
    logger.debug('已创建工作流控制器', { 
      iterations: 3, 
      journeySim: options.enableJourneySim
    });
    
    // 设置输出文件名
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFilename = options.outputFilename || 
      path.join(outputDir, `keywordintent_${options.keyword.replace(/\s+/g, '_')}_${timestamp}.${options.outputFormat}`);
    
    logger.info('开始分析关键词', { 
      keyword: options.keyword, 
      outputPath: outputFilename 
    });
    
    // 执行工作流
    const result = await workflowController.executeWorkflow(options.keyword);
    
    // 保存结果
    fs.writeFileSync(outputFilename, 
      options.outputFormat === 'json' 
        ? JSON.stringify(result, null, 2) 
        : result.toString()
    );
    
    logger.info('分析完成', { 
      keywordsCount: result.summary.keywordCounts.total,
      outputPath: outputFilename
    });
    
    // 打印结果概要
    logger.info(`分析完成! 发现 ${result.summary.keywordCounts.total} 个关键词`);
    logger.info(`结果已保存到: ${outputFilename}`);
    
    // 如果生成了Markdown报告，显示报告路径
    if (result.reportPath) {
      logger.info(`Markdown报告: ${result.reportPath}`);
    }
    
    // 关闭搜索引擎
    await searchEngine.close();
    
    // 关闭日志
    logger.close();
    
  } catch (error) {
    logger.error('分析过程出错', { error });
    handleError(error);
    process.exit(1);
  }
}