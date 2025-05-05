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

// 创建搜索引擎实例的工厂函数
function createSearchEngine(type: SearchEngineType): SearchEngine {
  console.info(`[CLI] 创建搜索引擎: "${type}"`);
  
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
  
高级选项:
  --model <模型名称>         指定LLM模型(默认: gpt-4)
  --format <格式>            输出格式(json, markdown, csv，默认: json)
  --help, -h                 显示帮助信息

示例:
  npx ts-node keywordIntent.ts "iphone"                   # 使用默认配置进行分析（包含用户旅程模拟）
  npx ts-node keywordIntent.ts "最佳笔记本" --proxy http://127.0.0.1:7890
  npx ts-node keywordIntent.ts "人工智能" --no-journey-sim  # 禁用用户旅程模拟
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
  outputFormat: string;
} {
  let keyword = '';
  let engineType: SearchEngineType = 'baidu'; // 默认使用百度
  let proxyServer: string | undefined = undefined;
  let outputFilename: string | undefined = undefined;
  let llmModel = config.llm.defaultModel;
  let enableJourneySim = true; // 默认开启用户旅程模拟
  let outputFormat = 'json';
  
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
  
  // 记录关键配置信息
  console.info(`[CLI] 关键词: "${keyword}", 搜索引擎: ${engineType}, 模型: ${llmModel}`);
  console.info(`[CLI] 启用的功能: ${[
    enableJourneySim ? '旅程模拟(含动态意图分析)' : ''
  ].filter(Boolean).join(', ')}`);
  
  if (proxyServer) {
    console.info(`[CLI] 使用代理: ${proxyServer}`);
  }
  
  return {
    keyword,
    engineType,
    proxyServer,
    outputFilename,
    llmModel,
    enableJourneySim,
    outputFormat
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
    
    // 使用系统浏览器（默认）
    searchEngine.useSystemBrowser(true);
    
    // 使用默认配置的 LLM 服务
    const llmService = new LLMServiceHub({
      model: options.llmModel,
      cacheExpiry: 24 * 60 * 60, // 默认24小时缓存过期时间（秒）
      verbose: false // 默认不启用详细日志
    });
    
    // 创建工作流控制器，使用默认配置
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      maxIterations: 3, // 使用固定值代替config.iterativeEngine.maxIterations
      satisfactionThreshold: 0.8, // 使用固定值代替config.iterativeEngine.defaultSatisfactionThreshold
      analysisDepth: 5, // 使用固定的默认分析深度
      outputFormat: options.outputFormat,
      enableJourneySim: options.enableJourneySim,
      verbose: false
    });
    
    // 设置输出文件名
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFilename = options.outputFilename || 
      path.join(outputDir, `keywordintent_${options.keyword}_${timestamp}.${options.outputFormat}`);
    
    console.info(`[CLI] 开始分析关键词: "${options.keyword}"`);
    console.info(`[CLI] 结果将保存到: ${outputFilename}`);
    
    // 执行工作流
    const result = await workflowController.executeWorkflow(options.keyword);
    
    // 保存结果
    fs.writeFileSync(outputFilename, 
      options.outputFormat === 'json' 
        ? JSON.stringify(result, null, 2) 
        : result.toString()
    );
    
    console.info(`[CLI] 分析完成! 结果已保存到: ${outputFilename}`);
    console.info(`[CLI] 发现关键词: ${result.summary.keywordCounts.total} 个`);
    
    // 关闭搜索引擎
    await searchEngine.close();
    
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
} 