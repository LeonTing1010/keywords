#!/usr/bin/env node
/**
 * 关键词工具命令行界面
 * 整合了所有搜索引擎的功能，提供统一的命令行接口
 */
import { SearchEngine } from '../engines/SearchEngine';
import { GoogleSearchEngine } from '../engines/GoogleSearchEngine';
// import { BaiduSearchEngine } from '../engines/BaiduSearchEngine';
import { SearchEngineType, SearchOptions } from '../types';
import { handleError, ErrorType, AppError } from '../utils/errorHandler';
import { SecondaryQueryManager } from '../utils/secondaryQueryManager';
import * as path from 'path';
import * as fs from 'fs';
import { ensureOutputDirectory } from '../utils/fileUtils';
import { IterativeQueryEngine } from '../utils/iterativeQueryEngine';
import { LLMService } from '../utils/llmService';
import { KeywordAnalyzer } from '../utils/keywordAnalyzer';
import { config } from '../config';

// 创建搜索引擎实例的工厂函数
function createSearchEngine(type: SearchEngineType) {
  switch(type.toLowerCase()) {
    case 'google':
      return new GoogleSearchEngine();
    case 'baidu':
      // return new BaiduSearchEngine();
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
  const availableEngines = ['google']; // 暂时只有Google
  
  console.log(`
关键词搜索工具

使用方法:
  npx ts-node keywordsCli.ts <关键词> [选项]

选项:
  --engine, -e <引擎名称>     使用指定的搜索引擎(默认: google)
                            可选值: ${availableEngines.join(', ')}
  --domain, -d <域名>        使用指定的搜索引擎域名(根据引擎有不同默认值)
  --proxy, -p <代理地址>     使用指定的代理服务器
  --temp-browser, -t         使用临时浏览器实例而非系统浏览器(部分引擎可能不支持)
  --no-second-round          禁用二次查询(默认启用)
  --secondary-mode <模式>    指定二次查询模式(alphabets/keywords/both, 默认: alphabets)
  --batch-size <数量>        指定批处理大小(默认: 26或10，取决于查询模式)
  --retry-count <次数>       查询失败重试次数(默认: 1)
  --max-secondary <数量>     二次关键词最大提取数量(默认: 10)
  --max-results <数量>       二次查询最大结果数(默认: 300)
  --output, -o <文件名>      指定输出文件名
  --help, -h                 显示帮助信息

高级选项:
  --use-llm                  使用LLM增强分析功能
  --llm-model <模型名称>     指定LLM模型(默认: gpt-4)
  --iterative                启用迭代查询模式
  --max-iterations <次数>    最大迭代次数(默认: 5)
  --satisfaction-threshold <值>  满意度阈值(0-1之间，默认: 0.85)

示例:
  npx ts-node keywordsCli.ts "iphone"                     # 默认使用Google搜索引擎
  npx ts-node keywordsCli.ts "web design" --secondary-mode keywords  # 使用关键词模式进行二次查询
  npx ts-node keywordsCli.ts "machine learning" --engine google --domain https://www.google.co.uk
  npx ts-node keywordsCli.ts "best laptops" --proxy http://127.0.0.1:7890 --temp-browser
  npx ts-node keywordsCli.ts "android" --no-second-round
  npx ts-node keywordsCli.ts "yoga" --secondary-mode both --batch-size 15
  
高级示例:
  npx ts-node keywordsCli.ts "web design" --iterative --max-iterations 3  # 使用迭代查询模式
  npx ts-node keywordsCli.ts "machine learning" --use-llm                 # 使用LLM增强分析
  npx ts-node keywordsCli.ts "digital marketing" --iterative --use-llm    # 结合LLM和迭代查询
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
  enableSecondRound: boolean;
  secondaryMode: 'alphabets' | 'keywords' | 'both';
  outputFilename?: string;
  batchSize?: number;
  retryCount?: number;
  maxSecondaryKeywords?: number;
  maxResults?: number;
  useLLM: boolean;
  llmModel: string;
  enableIterative: boolean;
  maxIterations: number;
  satisfactionThreshold: number;
} {
  let keyword = '';
  let engineType: SearchEngineType = 'google'; // 默认使用Google
  let domain: string | undefined = undefined;
  let proxyServer: string | undefined = undefined;
  let useSystemBrowser = true;
  let enableSecondRound = true;
  let secondaryMode: 'alphabets' | 'keywords' | 'both' = 'alphabets';
  let outputFilename: string | undefined = undefined;
  let batchSize: number | undefined = undefined;
  let retryCount: number | undefined = undefined;
  let maxSecondaryKeywords: number | undefined = undefined;
  let maxResults: number | undefined = undefined;
  let useLLM = false;
  let llmModel = config.llm.defaultModel;
  let enableIterative = false;
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
    } else if (arg === '--no-second-round') {
      enableSecondRound = false;
    } else if (arg === '--secondary-mode') {
      const mode = args[++i];
      if (mode && (mode === 'alphabets' || mode === 'keywords' || mode === 'both')) {
        secondaryMode = mode as 'alphabets' | 'keywords' | 'both';
      } else {
        throw new AppError(
          `不支持的二次查询模式 "${mode}"，可选值: alphabets, keywords, both`, 
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--batch-size') {
      const size = parseInt(args[++i], 10);
      if (!isNaN(size) && size > 0) {
        batchSize = size;
      } else {
        throw new AppError(
          `批处理大小必须是正整数`, 
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--retry-count') {
      const count = parseInt(args[++i], 10);
      if (!isNaN(count) && count >= 0) {
        retryCount = count;
      } else {
        throw new AppError(
          `重试次数必须是非负整数`, 
          ErrorType.VALIDATION
        );
      }
    } else if (arg === '--max-secondary') {
      const count = parseInt(args[++i], 10);
      if (!isNaN(count) && count > 0) {
        maxSecondaryKeywords = count;
      } else {
        throw new AppError(
          `二次关键词数量必须是正整数`, 
          ErrorType.VALIDATION
        );
      }
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
    } else if (arg === '--use-llm') {
      useLLM = true;
    } else if (arg === '--llm-model') {
      llmModel = args[++i];
    } else if (arg === '--iterative') {
      enableIterative = true;
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
    } else if (arg === '--satisfaction-threshold') {
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
    enableSecondRound,
    secondaryMode,
    outputFilename,
    batchSize,
    retryCount,
    maxSecondaryKeywords,
    maxResults,
    useLLM,
    llmModel,
    enableIterative,
    maxIterations,
    satisfactionThreshold
  };
}

/**
 * 执行字母组合查询
 */
async function executeAlphabetsQuery(
  keyword: string,
  engine: SearchEngine,
  options: SearchOptions,
  outputFilename?: string
): Promise<string> {
  console.log(`开始字母组合查询: "${keyword}"...`);
  
  // 确保适合字母组合查询的批处理大小
  const alphabetOptions: SearchOptions = {
    ...options,
    batchSize: options.batchSize || 26, // 字母组合查询默认批处理大小为26
    persistBrowser: true // 强制使用持久化浏览器
  };
  
  // 执行查询
  return await engine.fetchAutocompleteWithAlphabets(
    keyword,
    alphabetOptions,
    outputFilename
  );
}

/**
 * 执行初始查询并返回建议数组
 */
async function executeInitialQuery(
  keyword: string, 
  engine: SearchEngine, 
  options: SearchOptions
): Promise<string[]> {
  try {
    console.log(`开始执行初始查询: "${keyword}"...`);
    
    // 设置初始查询选项，禁用二次查询
    const initialOptions = {
      ...options,
      enableSecondRound: false // 确保不会触发引擎内部的二次查询
    };
    
    // 执行查询
    const result = await engine.fetchAutocomplete(keyword, initialOptions);
    
    console.log(`初始查询完成，获取到 ${result.suggestions.length} 条建议`);
    return result.suggestions;
  } catch (error) {
    console.error(`初始查询失败: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 在初始查询基础上执行二次查询
 */
async function executeSecondaryQueryBasedOnInitial(
  keyword: string,
  initialSuggestions: string[],
  engine: SearchEngine, 
  options: SearchOptions,
  outputDir: string
): Promise<string> {
  if (!initialSuggestions || initialSuggestions.length === 0) {
    throw new Error("二次查询必须提供初始查询结果");
  }
  
  console.log(`开始基于初始结果执行二次查询，初始结果中有 ${initialSuggestions.length} 条建议...`);
  
  // 使用引擎的内置二次查询方法
  try {
    // 准备输出文件名
    const outputFileName = `${engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_secondary_suggestions.json`;
    const outputPath = path.join(outputDir, outputFileName);
    
    // 从初始建议中提取关键词
    const secondaryKeywords = (engine as any).extractNewKeywords(
      initialSuggestions, 
      keyword,
      {
        maxKeywords: options.maxSecondaryKeywords || 10,
        minLength: 5,
      }
    );
    
    console.log(`从初始查询结果中提取出 ${secondaryKeywords.length} 个二次关键词`);
    
    if (secondaryKeywords.length === 0) {
      console.log(`无法从初始结果中提取有效的二次关键词，将直接使用初始结果`);
      
      // 创建二次查询管理器保存结果
      const queryManager = new SecondaryQueryManager(engine, outputDir);
      const savedPath = queryManager.saveMergedResults(
        keyword,
        initialSuggestions,
        outputFileName
      );
      
      return savedPath;
    }
    
    // 使用引擎的二次查询功能
    console.log(`执行二次查询，将探索 ${secondaryKeywords.length} 个关键词...`);
    const secondaryOutputPath = await (engine as any).executeSecondaryQueries(
      keyword,
      options,
      outputFileName,
      secondaryKeywords // 传递已提取的二次关键词
    );
    
    console.log(`二次查询完成，结果保存在: ${secondaryOutputPath}`);
    return secondaryOutputPath;
    
  } catch (error) {
    console.error(`执行引擎内置二次查询失败: ${error instanceof Error ? error.message : String(error)}`);
    
    // 如果引擎内置方法失败，尝试使用查询管理器
    console.log(`尝试使用二次查询管理器作为备选方案...`);
    const queryManager = new SecondaryQueryManager(engine, outputDir);
    
    const secondarySuggestions = await queryManager.executeSecondaryQueries(
      keyword,
      options,
      initialSuggestions
    );
    
    // 合并结果
    const mergedSuggestions = queryManager.mergeSuggestions(
      initialSuggestions,
      secondarySuggestions
    );
    
    // 保存合并结果
    const outputFileName = `${engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_merged_suggestions.json`;
    const outputPath = queryManager.saveMergedResults(
      keyword,
      mergedSuggestions,
      outputFileName
    );
    
    console.log(`二次查询(备选方案)完成，结果保存在: ${outputPath}`);
    return outputPath;
  }
}

/**
 * 执行完整查询流程（包括可选的二次查询）
 */
async function executeFullQuery(
  keyword: string,
  engine: SearchEngine,
  options: SearchOptions,
  outputDir: string
): Promise<string> {
  // 计时开始
  const startTime = Date.now();
  
  try {
    // 首先执行初始查询
    console.log(`开始为 "${keyword}" 执行初始查询...`);
    
    const initialOutputFileName = `${engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_initial_suggestions.json`;
    const initialOutputPath = await engine.fetchAndSaveAutocomplete(
      keyword,
      { ...options, enableSecondRound: false }, // 确保初始查询不执行二次查询
      initialOutputFileName
    );
    
    console.log(`初始查询完成，结果保存在: ${initialOutputPath}`);
    
    // 读取初始查询结果
    let initialSuggestions: string[] = [];
    try {
      const data = JSON.parse(fs.readFileSync(initialOutputPath, 'utf-8'));
      if (data.suggestions && Array.isArray(data.suggestions)) {
        initialSuggestions = data.suggestions;
        console.log(`从文件加载初始查询结果: ${initialSuggestions.length} 条建议`);
      }
    } catch (error) {
      console.error(`读取初始查询结果失败: ${error instanceof Error ? error.message : String(error)}`);
      return initialOutputPath;
    }
    
    // 如果启用了二次查询
    if (options.enableSecondRound) {
      console.log(`正在准备执行二次查询...`);
      
      // 创建二次查询管理器
      const queryManager = new SecondaryQueryManager(engine, outputDir);
      
      // 准备二次查询选项
      const secondaryOptions: SearchOptions = {
        ...options,
        persistBrowser: true, // 强制使用持久化浏览器
        batchSize: options.batchSize || 5
      };
      
      // 基于初始查询结果执行二次查询
      console.log(`开始基于初始结果执行二次查询...`);
      const secondarySuggestions = await queryManager.executeSecondaryQueryBasedOnInitial(
        keyword,
        initialSuggestions,
        secondaryOptions
      );
      
      console.log(`二次查询完成，获取到 ${secondarySuggestions.length} 条建议`);
      
      // 合并结果
      const mergedSuggestions = queryManager.mergeSuggestions(
        initialSuggestions,
        secondarySuggestions
      );
      
      // 保存合并结果
      const outputFileName = `${engine.getName().toLowerCase()}_${keyword.replace(/\s+/g, '_')}_merged_suggestions.json`;
      const outputPath = queryManager.saveMergedResults(
        keyword,
        mergedSuggestions,
        outputFileName
      );
      
      console.log(`查询完成，最终结果保存在: ${outputPath} (共 ${mergedSuggestions.length} 条建议)`);
      
      // 计时结束
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // 秒
      console.log(`查询总耗时: ${duration.toFixed(2)} 秒`);
      
      return outputPath;
    } else {
      console.log(`二次查询未启用，仅返回初始查询结果`);
      return initialOutputPath;
    }
  } catch (error) {
    console.error(`查询失败: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 执行同时使用字母组合和关键词模式的查询
 */
async function executeBothModeQuery(
  keyword: string,
  engine: SearchEngine,
  options: SearchOptions,
  outputDir: string
): Promise<string> {
  console.log(`使用混合模式(字母+关键词)查询: "${keyword}"`);
  
  // 首先执行字母组合查询
  console.log(`1. 执行字母组合查询...`);
  const alphabetsOutput = await executeAlphabetsQuery(
    keyword,
    engine,
    options
  );
  
  // 读取字母组合查询结果
  const alphabetsData = JSON.parse(fs.readFileSync(alphabetsOutput, 'utf-8'));
  console.log(`字母组合查询完成，发现${alphabetsData.suggestions?.length || 0}个建议`);
  
  // 然后执行关键词模式查询
  console.log(`2. 执行关键词模式查询...`);
  const keywordsOutput = await executeFullQuery(
    keyword,
    engine,
    options,
    outputDir
  );
  
  // 读取关键词模式查询结果
  const keywordsData = JSON.parse(fs.readFileSync(keywordsOutput, 'utf-8'));
  console.log(`关键词模式查询完成，发现${keywordsData.suggestions?.length || 0}个建议`);
  
  // 合并结果
  const combinedSuggestions = new Set<string>();
  
  // 添加字母组合结果
  if (alphabetsData.suggestions && Array.isArray(alphabetsData.suggestions)) {
    alphabetsData.suggestions.forEach((suggestion: string) => {
      combinedSuggestions.add(suggestion);
    });
  }
  
  // 添加关键词模式结果
  if (keywordsData.suggestions && Array.isArray(keywordsData.suggestions)) {
    keywordsData.suggestions.forEach((suggestion: string) => {
      combinedSuggestions.add(suggestion);
    });
  }
  
  // 创建合并输出
  const combinedResult = {
    query: keyword,
    engine: engine.getName(),
    totalSuggestions: combinedSuggestions.size,
    suggestions: Array.from(combinedSuggestions),
    timestamp: new Date().toISOString(),
    options: {
      ...options,
      secondaryMode: 'both'
    }
  };
  
  // 保存合并结果
  const safeKeyword = keyword.replace(/\s+/g, '_');
  const outputPath = path.join(
    outputDir,
    `${engine.getName().toLowerCase()}_${safeKeyword}_combined.json`
  );
  
  fs.writeFileSync(outputPath, JSON.stringify(combinedResult, null, 2), 'utf-8');
  console.log(`混合模式查询完成，共发现${combinedSuggestions.size}个关键词建议`);
  
  return outputPath;
}

/**
 * 执行迭代查询
 */
async function executeIterativeQuery(
  keyword: string,
  engine: SearchEngine,
  options: SearchOptions & {
    maxIterations: number;
    satisfactionThreshold: number;
    llmModel?: string;
  }
): Promise<string> {
  console.log(`启动迭代关键词挖掘引擎: "${keyword}"...`);
  
  // 创建迭代查询引擎
  const iterativeEngine = new IterativeQueryEngine(engine);
  
  // 执行迭代查询
  const result = await iterativeEngine.startIterativeQuery(keyword, options);
  
  console.log(`迭代查询完成，共${result.totalIterations}次迭代，发现${result.totalKeywordsDiscovered}个关键词`);
  
  // 提取高价值关键词
  if (result.finalReport && result.finalReport.topKeywords) {
    console.log(`\n最有价值的长尾关键词:`);
    result.finalReport.topKeywords.slice(0, 5).forEach((kw: string, i: number) => {
      console.log(`${i + 1}. ${kw}`);
    });
  }
  
  // 报告分析结果
  if (result.finalReport && result.finalReport.summary) {
    console.log(`\n分析总结:`);
    console.log(result.finalReport.summary);
  }
  
  return 'success'; // 返回成功标志
}

/**
 * 执行LLM驱动的关键词分析
 */
async function executeLLMAnalysis(
  keyword: string,
  suggestions: string[],
  options: {
    llmModel?: string;
  }
): Promise<void> {
  console.log(`使用LLM分析 "${keyword}" 的关键词数据...`);
  
  try {
    // 创建LLM服务和关键词分析器
    const llmService = new LLMService({
      model: options.llmModel
    });
    const keywordAnalyzer = new KeywordAnalyzer(llmService);
    
    // 执行分类
    console.log(`正在对 ${suggestions.length} 条关键词进行分类...`);
    const categories = await keywordAnalyzer.identifyKeywordCategories(keyword, suggestions);
    
    console.log(`\n关键词分类结果:`);
    Object.entries(categories).forEach(([category, keywords]) => {
      if (Array.isArray(keywords) && keywords.length > 0) {
        console.log(`- ${category}: ${keywords.length}个关键词`);
      }
    });
    
    // 提取高价值关键词
    console.log(`\n选择高价值关键词...`);
    const highValueKeywords = keywordAnalyzer.selectHighValueKeywords(categories, keyword, 10);
    
    console.log(`\n最有价值的10个长尾关键词:`);
    highValueKeywords.forEach((kw, i) => {
      console.log(`${i + 1}. ${kw}`);
    });
    
    // 提取查询模式
    console.log(`\n提取查询模式...`);
    const patterns = await keywordAnalyzer.extractQueryPatterns(keyword, suggestions);
    
    console.log(`\n查询模式:`);
    patterns.slice(0, 5).forEach(pattern => {
      console.log(`- ${pattern}`);
    });
    
    // 生成战略查询建议
    console.log(`\n生成下一轮查询建议...`);
    const strategicQueries = await keywordAnalyzer.generateStrategicQueries(keyword, suggestions);
    
    console.log(`\n推荐的下一轮查询关键词:`);
    strategicQueries.slice(0, 5).forEach((query, i) => {
      console.log(`${i + 1}. ${query}`);
    });
    
  } catch (error) {
    console.error(`LLM分析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 主函数
 */
export async function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    
    // 显示帮助信息
    if (args.keyword === '--help' || args.keyword === '-h' || !args.keyword) {
      printHelp();
      return;
    }
    
    // 检查是否设置OpenAI API密钥
    if ((args.useLLM || args.enableIterative) && !process.env.OPENAI_API_KEY && !config.llm.apiKey) {
      throw new AppError('未设置OpenAI API密钥。请设置OPENAI_API_KEY环境变量或在配置中提供。', 
                      ErrorType.VALIDATION);
    }
    
    // 创建搜索引擎
    const engine = createSearchEngine(args.engineType);
    if (!engine) {
      console.error(`无效的搜索引擎类型: ${args.engineType}`);
      return;
    }
    
    console.log(`使用搜索引擎: ${engine.getName()}`);
    console.log(`查询关键词: "${args.keyword}"`);
    
    try {
      let result: string = '';
      
      if (args.enableIterative) {
        // 使用迭代查询引擎
        result = await executeIterativeQuery(
          args.keyword,
          engine,
          {
            ...args,
            llmModel: args.useLLM ? args.llmModel : undefined
          }
        );
      } else if (args.useLLM) {
        // 先执行标准查询
        let outputFilename;
        if (args.outputFilename) {
          outputFilename = args.outputFilename;
        }
        
        // 基于查询模式选择不同的执行方式
        if (args.secondaryMode === 'both' || args.secondaryMode === 'keywords') {
          result = await executeFullQuery(args.keyword, engine, args, ensureOutputDirectory());
        } else if (args.secondaryMode === 'alphabets') {
          result = await executeAlphabetsQuery(args.keyword, engine, args, outputFilename);
        } else {
          result = await executeFullQuery(args.keyword, engine, args, ensureOutputDirectory());
        }
        
        // 读取结果文件以获取建议
        const resultData = JSON.parse(fs.readFileSync(result, 'utf-8'));
        const suggestions = resultData.suggestions || [];
        
        // 使用LLM分析结果
        if (suggestions.length > 0) {
          await executeLLMAnalysis(
            args.keyword,
            suggestions,
            { llmModel: args.llmModel }
          );
        }
      } else {
        // 标准查询流程
        // 基于查询模式选择不同的执行方式
        if (args.secondaryMode === 'both') {
          result = await executeBothModeQuery(args.keyword, engine, args, ensureOutputDirectory());
        } else if (args.secondaryMode === 'keywords') {
          result = await executeFullQuery(args.keyword, engine, args, ensureOutputDirectory());
        } else if (args.secondaryMode === 'alphabets') {
          result = await executeAlphabetsQuery(args.keyword, engine, args, args.outputFilename);
        } else {
          // 默认为alphabets模式
          result = await executeAlphabetsQuery(args.keyword, engine, args, args.outputFilename);
        }
      }
      
      console.log(`关键词查询完成，结果已保存。`);
    } catch (error) {
      console.error(`查询过程中发生错误: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 清理资源
      await engine.cleanup();
    }
  } catch (error) {
    console.error(`程序执行失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 如果直接运行此文件，则执行主函数
if (require.main === module) {
  main();
}
