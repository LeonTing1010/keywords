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
import { ensureOutputDirectory } from '../core/fileUtils';
import { IterativeDiscoveryEngine } from '../discovery/IterativeDiscoveryEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { IntentAnalyzer } from '../intent/IntentAnalyzer';
import { DomainExpertSystem } from '../domain/DomainExpertSystem';
import { UserJourneySim } from '../journey/UserJourneySim';
import { CrossDomainAnalyzer } from '../analyzer/CrossDomainAnalyzer';
import { KeywordValuePredictor } from '../analyzer/KeywordValuePredictor';
import { WorkflowController } from '../core/WorkflowController';
import { config } from '../config';

// 创建搜索引擎实例的工厂函数
function createSearchEngine(type: SearchEngineType) {
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
  const availableEngines = ['google', 'baidu']; // 更新为支持的引擎列表
  
  console.log(`
KeywordIntent - 高级用户意图挖掘与搜索行为分析系统 v3.0.0

使用方法:
  npx ts-node keywordIntent.ts <关键词> [选项]

搜索引擎选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: google)
                            可选值: ${availableEngines.join(', ')}
  --domain, -d <域名>        使用指定的搜索引擎域名(根据引擎有不同默认值)
  --proxy, -p <代理地址>     使用指定的代理服务器
  --temp-browser, -t         使用临时浏览器实例而非系统浏览器
  --max-results <数量>       查询最大结果数(默认: 300)
  --output, -o <文件路径>    指定输出文件路径

AI分析选项:
  --model <模型名称>         指定LLM模型(默认: gpt-4)
  --max-iterations <次数>    最大迭代次数(默认: 5)
  --satisfaction <值>        满意度阈值(0-1之间，默认: 0.85)

功能模块选项:
  --domain-expert            启用垂直领域专家系统
  --journey-sim              启用用户旅程模拟
  --cross-domain             启用跨域关联分析
  --value-predict            启用关键词价值预测
  --no-intent-analysis       禁用意图分析(默认启用)
  
高级选项:
  --depth <值>               分析深度(1-10，默认: 5)
  --cache <时间>             缓存过期时间(小时，默认: 24)
  --format <格式>            输出格式(json, markdown, csv，默认: json)
  --verbose                  启用详细日志输出
  --help, -h                 显示帮助信息

示例:
  npx ts-node keywordIntent.ts "iphone"                   # 使用默认配置进行分析
  npx ts-node keywordIntent.ts "网站设计" --journey-sim   # 启用用户旅程模拟
  npx ts-node keywordIntent.ts "机器学习" --depth 7       # 设置更深的分析深度
  npx ts-node keywordIntent.ts "最佳笔记本" --proxy http://127.0.0.1:7890
  npx ts-node keywordIntent.ts "人工智能" --domain-expert --cross-domain  # 启用多个高级功能
  `);
}

/**
 * 解析命令行参数
 */
function parseArguments(args: string[]): {
  keyword: string;
  engineType: SearchEngineType;
  domain?: string;
  proxyServer?: string;
  useSystemBrowser: boolean;
  outputFilename?: string;
  maxResults?: number;
  llmModel: string;
  maxIterations: number;
  satisfactionThreshold: number;
  enableDomainExpert: boolean;
  enableJourneySim: boolean;
  enableCrossDomain: boolean;
  enableValuePredict: boolean;
  enableIntentAnalysis: boolean;
  analysisDepth: number;
  cacheExpiry: number;
  outputFormat: string;
  verbose: boolean;
} {
  let keyword = '';
  let engineType: SearchEngineType = 'google'; // 默认使用Google
  let domain: string | undefined = undefined;
  let proxyServer: string | undefined = undefined;
  let useSystemBrowser = true;
  let outputFilename: string | undefined = undefined;
  let maxResults: number | undefined = undefined;
  let llmModel = config.llm.defaultModel;
  let maxIterations = config.iterativeEngine.maxIterations;
  let satisfactionThreshold = config.iterativeEngine.defaultSatisfactionThreshold;
  let enableDomainExpert = false;
  let enableJourneySim = false;
  let enableCrossDomain = false;
  let enableValuePredict = false;
  let enableIntentAnalysis = true;
  let analysisDepth = 5;
  let cacheExpiry = 24;
  let outputFormat = 'json';
  let verbose = false;
  
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
    } else if (arg === '--domain' || arg === '-d') {
      domain = args[++i];
    } else if (arg === '--proxy' || arg === '-p') {
      proxyServer = args[++i];
    } else if (arg === '--temp-browser' || arg === '-t') {
      useSystemBrowser = false;
    } else if (arg === '--max-results') {
      const count = parseInt(args[++i], 10);
      if (!isNaN(count) && count > 0) {
        maxResults = count;
      } else {
        throw new AppError(
          `最大结果数必须是正整数`, 
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--output' || arg === '-o') {
      outputFilename = args[++i];
    } else if (arg === '--model') {
      llmModel = args[++i];
    } else if (arg === '--max-iterations') {
      const value = parseInt(args[++i], 10);
      if (!isNaN(value) && value > 0) {
        maxIterations = value;
      } else {
        throw new AppError(
          `迭代次数必须是正整数`,
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--satisfaction') {
      const value = parseFloat(args[++i]);
      if (!isNaN(value) && value > 0 && value <= 1) {
        satisfactionThreshold = value;
      } else {
        throw new AppError(
          `满意度阈值必须在0到1之间`,
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--domain-expert') {
      enableDomainExpert = true;
    } else if (arg === '--journey-sim') {
      enableJourneySim = true;
    } else if (arg === '--cross-domain') {
      enableCrossDomain = true;
    } else if (arg === '--value-predict') {
      enableValuePredict = true;
    } else if (arg === '--no-intent-analysis') {
      enableIntentAnalysis = false;
    } else if (arg === '--depth') {
      const value = parseInt(args[++i], 10);
      if (!isNaN(value) && value >= 1 && value <= 10) {
        analysisDepth = value;
      } else {
        throw new AppError(
          `分析深度必须在1到10之间`,
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--cache') {
      const value = parseInt(args[++i], 10);
      if (!isNaN(value) && value >= 0) {
        cacheExpiry = value;
      } else {
        throw new AppError(
          `缓存过期时间必须是非负整数`,
          ErrorType.VALIDATION
        );
      }
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
    } else if (arg === '--verbose') {
      verbose = true;
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
  console.info(`[CLI] 迭代次数: ${maxIterations}, 分析深度: ${analysisDepth}`);
  console.info(`[CLI] 启用的功能: ${[
    enableIntentAnalysis ? '意图分析' : '',
    enableDomainExpert ? '领域专家' : '',
    enableJourneySim ? '旅程模拟' : '',
    enableCrossDomain ? '跨域分析' : '',
    enableValuePredict ? '价值预测' : ''
  ].filter(Boolean).join(', ')}`);
  
  if (proxyServer) {
    console.info(`[CLI] 使用代理: ${proxyServer}`);
  }
  
  return {
    keyword,
    engineType,
    domain,
    proxyServer,
    useSystemBrowser,
    outputFilename,
    maxResults,
    llmModel,
    maxIterations,
    satisfactionThreshold,
    enableDomainExpert,
    enableJourneySim,
    enableCrossDomain,
    enableValuePredict,
    enableIntentAnalysis,
    analysisDepth,
    cacheExpiry,
    outputFormat,
    verbose
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
    ensureOutputDirectory(outputDir);
    
    // 创建搜索引擎实例
    const searchEngine = createSearchEngine(options.engineType);
    
    // 配置代理服务器
    if (options.proxyServer) {
      searchEngine.setProxy(options.proxyServer);
    }
    
    // 配置浏览器
    searchEngine.useSystemBrowser(options.useSystemBrowser);
    
    // 配置自定义域名
    if (options.domain) {
      searchEngine.setDomain(options.domain);
    }
    
    // 创建 LLM 服务
    const llmService = new LLMServiceHub({
      model: options.llmModel,
      cacheExpiry: options.cacheExpiry * 60 * 60, // 转换为秒
      verbose: options.verbose
    });
    
    // 创建工作流控制器
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      maxIterations: options.maxIterations,
      satisfactionThreshold: options.satisfactionThreshold,
      analysisDepth: options.analysisDepth,
      outputFormat: options.outputFormat,
      enableDomainExpert: options.enableDomainExpert,
      enableJourneySim: options.enableJourneySim,
      enableCrossDomain: options.enableCrossDomain,
      enableValuePredict: options.enableValuePredict,
      enableIntentAnalysis: options.enableIntentAnalysis,
      verbose: options.verbose
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
    console.info(`[CLI] 发现意图: ${result.summary.intentCounts.total} 个`);
    console.info(`[CLI] 发现关键词: ${result.summary.keywordCounts.total} 个`);
    console.info(`[CLI] 平均价值评分: ${result.summary.averageValueScore.toFixed(2)}`);
    
    // 关闭搜索引擎
    await searchEngine.close();
    
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
} 