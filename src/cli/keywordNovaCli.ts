#!/usr/bin/env node
/**
 * KeywordNova CLI界面
 * 意图挖掘与长尾关键词爆破系统命令行工具
 */
import { SearchEngine } from '../providers/SearchEngine';
import { GoogleSearchEngine } from '../providers/GoogleSearchEngine';
import { SearchEngineType, SearchOptions } from '../types';
import { handleError, ErrorType, AppError } from '../core/errorHandler';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../core/fileUtils';
import { IterativeDiscoveryEngine } from '../discovery/IterativeDiscoveryEngine';
import { LLMService } from '../intent/LLMService';
import { IntentAnalyzer } from '../intent/IntentAnalyzer';
import { config } from '../config';

// 创建搜索引擎实例的工厂函数
function createSearchEngine(type: SearchEngineType) {
  switch(type.toLowerCase()) {
    case 'google':
      return new GoogleSearchEngine();
    case 'baidu':
      throw new AppError(`百度搜索引擎尚未实现`, ErrorType.VALIDATION);
    default:
      throw new AppError(`不支持的搜索引擎类型: ${type}`, ErrorType.VALIDATION);
  }
}

/**
 * 使用说明
 */
function printHelp() {
  // 可用的搜索引擎
  const availableEngines = ['google']; // 目前只有Google
  
  console.log(`
KeywordNova - 意图挖掘与长尾关键词爆破系统 v2.0

使用方法:
  npx ts-node keywordNova.ts <关键词> [选项]

选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: google)
                            可选值: ${availableEngines.join(', ')}
  --domain, -d <域名>        使用指定的搜索引擎域名(根据引擎有不同默认值)
  --proxy, -p <代理地址>     使用指定的代理服务器
  --temp-browser, -t         使用临时浏览器实例而非系统浏览器
  --max-results <数量>       查询最大结果数(默认: 300)
  --output, -o <文件名>      指定输出文件名
  --help, -h                 显示帮助信息

AI分析选项:
  --no-llm                   禁用LLM增强分析功能(默认启用)
  --llm-model <模型名称>     指定LLM模型(默认: gpt-4)
  --max-iterations <次数>    最大迭代次数(默认: 5)
  --satisfaction <值>        满意度阈值(0-1之间，默认: 0.85)

示例:
  npx ts-node keywordNova.ts "iphone"                   # 使用默认配置进行迭代查询和AI分析
  npx ts-node keywordNova.ts "web design" --no-llm      # 禁用AI分析，仅使用迭代引擎
  npx ts-node keywordNova.ts "machine learning" --max-iterations 7   # 设置最大迭代次数
  npx ts-node keywordNova.ts "best laptops" --proxy http://127.0.0.1:7890
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
  useLLM: boolean;
  llmModel: string;
  maxIterations: number;
  satisfactionThreshold: number;
} {
  let keyword = '';
  let engineType: SearchEngineType = 'google'; // 默认使用Google
  let domain: string | undefined = undefined;
  let proxyServer: string | undefined = undefined;
  let useSystemBrowser = true;
  let outputFilename: string | undefined = undefined;
  let maxResults: number | undefined = undefined;
  let useLLM = true; // 默认启用LLM
  let llmModel = config.llm.defaultModel;
  let maxIterations = config.iterativeEngine.maxIterations;
  let satisfactionThreshold = config.iterativeEngine.defaultSatisfactionThreshold;
  
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
    } else if (arg === '--no-llm') {
      useLLM = false;
    } else if (arg === '--llm-model') {
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
    } else if (!arg.startsWith('-') && keyword === '') {
      keyword = arg;
    }
  }
  
  // 检查关键词
  if (!keyword) {
    throw new AppError('请提供一个搜索关键词', ErrorType.VALIDATION);
  }
  
  return {
    keyword,
    engineType,
    domain,
    proxyServer,
    useSystemBrowser,
    outputFilename,
    maxResults,
    useLLM,
    llmModel,
    maxIterations,
    satisfactionThreshold
  };
}

/**
 * 执行主流程
 */
export async function main() {
  try {
    const args = process.argv.slice(2);
    
    // 如果包含帮助参数或无参数，则显示帮助信息并退出
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    
    // 解析命令行参数
    const options = parseArguments(args);
    
    console.log(`KeywordNova - 意图挖掘与长尾关键词爆破系统`);
    console.log(`======================================`);
    console.log(`开始分析关键词: "${options.keyword}"`);
    
    // 创建搜索引擎实例
    const engine = createSearchEngine(options.engineType);
    
    // 准备搜索选项
    const searchOptions: SearchOptions = {
      domain: options.domain,
      proxyServer: options.proxyServer,
      useSystemBrowser: options.useSystemBrowser,
      maxResults: options.maxResults || config.searchDefaults.maxResults,
    };
    
    // 创建输出目录
    const outputDir = ensureOutputDirectory();
    
    // 确定输出文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `keywordnova_${options.keyword.replace(/\s+/g, '_')}_${timestamp}`;
    const outputFilename = options.outputFilename || defaultFilename;
    
    console.log(`使用意图挖掘与关键词爆破引擎进行分析...`);
    
    // 使用迭代发现引擎执行查询
    const iterativeEngine = new IterativeDiscoveryEngine(engine);
    
    const iterativeResult = await iterativeEngine.startDiscovery(
      options.keyword,
      {
        ...searchOptions,
        maxIterations: options.maxIterations,
        satisfactionThreshold: options.satisfactionThreshold,
        useLLM: options.useLLM,
        llmModel: options.useLLM ? options.llmModel : undefined
      }
    );
    
    // 保存最终结果
    const resultFilePath = path.join(
      outputDir, 
      `${outputFilename}.json`
    );
    fs.writeFileSync(
      resultFilePath,
      JSON.stringify(iterativeResult, null, 2),
      'utf-8'
    );
    
    console.log(`\n分析完成!`);
    console.log(`迭代次数: ${iterativeResult.totalIterations}`);
    console.log(`发现关键词总数: ${iterativeResult.totalKeywordsDiscovered}`);
    
    // 如果启用了LLM分析，展示关键分析结果
    if (options.useLLM && iterativeResult.intentAnalysis) {
      console.log(`\n意图分析结果:`);
      
      if (iterativeResult.highValueKeywords && iterativeResult.highValueKeywords.length > 0) {
        console.log(`\n高价值长尾关键词:`);
        iterativeResult.highValueKeywords.slice(0, 10).forEach((kw: string, index: number) => {
          console.log(`${index + 1}. ${kw}`);
        });
      }
      
      if (iterativeResult.summary) {
        console.log(`\n总结: ${iterativeResult.summary}`);
      }
    }
    
    // 清理资源
    await engine.close();
    
    console.log(`\n结果已保存至: ${resultFilePath}`);
    console.log(`可以在 ${outputDir} 目录下查看所有生成的文件`);
    
  } catch (error) {
    handleError(error);
    
    // 显示错误提示信息
    console.log(`\n执行出错，请参阅上方错误信息。可使用 --help 查看使用说明。`);
    
    // 异常退出
    process.exit(1);
  }
} 