#!/usr/bin/env node
/**
 * LangGraphCli.ts - NeedMiner系统基于LangGraph的命令行接口
 * 使用多Agent基于LangGraph架构的实现
 * 
 * 使用方法:
 * npm run analyze "关键词" [选项]
 */
import { createNeedMinerSystem } from '../../langgraph/NeedMinerSystem';
import { logger } from '../../infrastructure/core/logger';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// 优先加载.env.local文件
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true
});

// 确保环境变量加载完成
dotenv.config();

/**
 * CLI参数类型定义
 */
interface CliArgs {
  _: (string | number)[];
  [key: string]: unknown;
  keyword?: string;
  engine: string;
  format: string;
  language: string;
  verbose: boolean;
  proxy?: string;
  output: string;
  model: string;
  fast: boolean;
  'no-journey-sim': boolean;
  noJourneySim: boolean; // Alias for no-journey-sim
  details: boolean;
  concurrent: number;
  batch?: string;
  file?: string;
  $0: string;
}

/**
 * 解析命令行参数
 */
function parseArguments(): CliArgs {
  return yargs(hideBin(process.argv))
    .usage('使用方法: $0 <关键词> [选项]')
    .positional('keyword', {
      describe: '要分析的关键词',
      type: 'string'
    })
    .option('engine', {
      alias: 'e',
      describe: '搜索引擎',
      choices: ['baidu', 'google'],
      default: process.env.SEARCH_ENGINE || 'baidu'
    })
    .option('format', {
      alias: 'f',
      describe: '输出格式',
      choices: ['json', 'markdown'],
      default: process.env.OUTPUT_FORMAT || 'markdown'
    })
    .option('language', {
      alias: 'l',
      describe: '输出语言',
      choices: ['zh', 'en'],
      default: process.env.LANGUAGE || 'zh'
    })
    .option('verbose', {
      alias: 'v',
      describe: '输出详细日志',
      type: 'boolean',
      default: false
    })
    .option('proxy', {
      alias: 'p',
      describe: '代理服务器地址',
      type: 'string'
    })
    .option('output', {
      alias: 'o',
      describe: '输出目录',
      type: 'string',
      default: './output'
    })
    .option('model', {
      describe: 'LLM模型名称',
      type: 'string',
      default: process.env.LLM_MODEL || 'gpt-4'
    })
    .option('fast', {
      describe: '使用快速模式(简化分析流程)',
      type: 'boolean',
      default: false
    })
    .option('no-journey-sim', {
      describe: '禁用用户旅程模拟',
      type: 'boolean',
      default: false
    })
    .option('details', {
      describe: '在报告中包含详细信息',
      type: 'boolean',
      default: false
    })
    .option('concurrent', {
      describe: '并行处理数量(批处理时有效)',
      type: 'number',
      default: 1
    })
    .option('batch', {
      describe: '批量处理多个关键词(逗号分隔)',
      type: 'string'
    })
    .option('file', {
      describe: '从文件中读取关键词列表(每行一个)',
      type: 'string'
    })
    .demandCommand(1, '请提供要分析的关键词')
    .help()
    .parseSync();
}

/**
 * 从文件中读取关键词列表
 */
function readKeywordsFromFile(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    logger.error('Failed to read keywords from file', { filePath, error });
    throw new Error(`Failed to read keywords from file: ${filePath}`);
  }
}

/**
 * 处理单个关键词
 */
async function analyzeKeyword(keyword: string, args: CliArgs) {
  try {
    logger.info('Starting analysis for keyword', { keyword });
    
    // 创建NeedMiner系统实例
    const system = createNeedMinerSystem({
      outputDir: args.output,
      format: args.format as 'markdown' | 'json',
      language: args.language as 'zh' | 'en',
      verbose: args.verbose,
      modelName: args.model,
      enableJourneySim: !args.noJourneySim
    });
    
    // 执行分析
    const result = await system.analyzeKeyword(keyword, {
      fast: args.fast,
      includeDetails: args.details
    });
    
    logger.info('Analysis completed', {
      keyword,
      reportPath: result.reportPath
    });
    
    return result;
  } catch (error) {
    logger.error('Failed to analyze keyword', { keyword, error });
    throw error;
  }
}

/**
 * 批量处理多个关键词
 */
async function batchAnalyzeKeywords(keywords: string[], args: CliArgs) {
  try {
    logger.info('Starting batch analysis', { 
      keywordCount: keywords.length,
      concurrent: args.concurrent
    });
    
    // 创建NeedMiner系统实例
    const system = createNeedMinerSystem({
      outputDir: args.output,
      format: args.format as 'markdown' | 'json',
      language: args.language as 'zh' | 'en',
      verbose: args.verbose,
      modelName: args.model,
      enableJourneySim: !args.noJourneySim
    });
    
    // 执行批量分析
    const results = await system.batchAnalyzeKeywords(keywords, {
      fast: args.fast,
      includeDetails: args.details,
      concurrentLimit: args.concurrent
    });
    
    // 输出结果摘要
    const successCount = results.filter(r => r.success).length;
    console.log(`批量分析完成: 总共 ${keywords.length} 个关键词, 成功 ${successCount} 个`);
    
    return results;
  } catch (error) {
    logger.error('Failed to batch analyze keywords', { error });
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const args = parseArguments();
    
    // 设置日志级别
    if (args.verbose) {
      console.log('启用详细日志模式');
    }
    
    // 处理批量关键词
    if (args.batch || args.file) {
      let keywords: string[] = [];
      
      if (args.batch) {
        // 从命令行参数解析
        keywords = args.batch.split(',').map(k => k.trim());
      } else if (args.file) {
        // 从文件读取
        keywords = readKeywordsFromFile(args.file);
      }
      
      if (keywords.length === 0) {
        throw new Error('没有有效的关键词可分析');
      }
      
      // 批量处理
      await batchAnalyzeKeywords(keywords, args);
    } else {
      // 处理单个关键词
      const keyword = args._[0].toString();
      await analyzeKeyword(keyword, args);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('CLI执行出错', { error });
    console.error('分析过程出错:', error);
    process.exit(1);
  }
}

// 执行主函数
main().catch(error => {
  logger.error('未捕获的错误', { error });
  console.error('未处理错误:', error);
  process.exit(1);
}); 