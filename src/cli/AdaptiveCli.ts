#!/usr/bin/env node
/**
 * AdaptiveCli.ts - NeuralMiner自适应多Agent工作流命令行界面
 * 
 * 使用AdaptiveKeywordGraph实现高效的多Agent协作分析
 */
import { createAdaptiveWorkflow } from '../graphs/keyword-analysis/AdaptiveKeywordGraph';
import { MarketNeedExplorerAgent } from '../agents/MarketNeedExplorerAgent';
import { SolutionEvaluatorAgent } from '../agents/SolutionEvaluatorAgent';
import { UserJourneySimulatorAgent } from '../agents/UserJourneySimulatorAgent'; 
import { OpportunityStrategistAgent } from '../agents/OpportunityStrategistAgent';
import { logger } from '../infra/logger';
import { MultiSearchTools } from '../tools/search/MultiSearchTools';
import { SearchTools } from '../tools/search/SearchTools';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// 加载环境变量
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true
});
dotenv.config();

// 确保OPENAI_BASE_URL设置为LLM_BASE_URL，解决API URL问题
if (process.env.LLM_BASE_URL) {
  process.env.OPENAI_BASE_URL = process.env.LLM_BASE_URL;
  logger.info(`设置OPENAI_BASE_URL为: ${process.env.LLM_BASE_URL}`);
}

// 定义命令行参数类型
interface CliArgs {
  keyword: string;
  fast: boolean;
  concurrent: number;
  'prioritize-discovery': boolean;
  output: string;
  format: 'markdown' | 'json';
  language: 'zh' | 'en';
  [x: string]: unknown;
}

// 解析命令行参数
const argv = yargs(hideBin(process.argv))
  .option('keyword', {
    alias: 'k',
    description: '要分析的关键词',
    type: 'string',
  })
  .option('fast', {
    alias: 'f',
    description: '使用快速模式，简化分析流程',
    type: 'boolean',
    default: false
  })
  .option('concurrent', {
    alias: 'c',
    description: '并行处理的数量',
    type: 'number',
    default: 3
  })
  .option('prioritize-discovery', {
    alias: 'p',
    description: '优先关键词发现',
    type: 'boolean',
    default: false
  })
  .option('output', {
    alias: 'o',
    description: '指定输出目录',
    type: 'string',
    default: './output'
  })
  .option('format', {
    description: '指定输出格式 (markdown/json)',
    type: 'string',
    choices: ['markdown', 'json'],
    default: 'markdown'
  })
  .option('language', {
    alias: 'l',
    description: '指定输出语言 (zh/en)',
    type: 'string',
    choices: ['zh', 'en'],
    default: 'zh'
  })
  .demandOption(['keyword'], '请提供要分析的关键词')
  .help()
  .parse() as CliArgs;

async function main() {
  try {
    const startTime = Date.now();
    
    logger.info(`开始分析关键词: "${argv.keyword}"`);
    logger.info(`模式: ${argv.fast ? '快速模式' : '完整模式'}`);
    
    // 确保输出目录存在
    if (!fs.existsSync(argv.output)) {
      fs.mkdirSync(argv.output, { recursive: true });
    }
    
    // 创建多搜索引擎工具实例
    const multiSearchTools = new MultiSearchTools({
      enabledEngines: process.env.ENABLED_ENGINES ? 
        process.env.ENABLED_ENGINES.split(',') : ['baidu'],
      defaultEngine: process.env.DEFAULT_ENGINE || 'baidu',
      proxyServer: process.env.PROXY_SERVER
    });
    
    // 初始化搜索引擎
    await multiSearchTools.initialize();
    
    // 获取默认搜索引擎用于向后兼容
    const searchEngine = multiSearchTools.getDefaultEngine();
    
    // 创建自适应工作流
    const workflow = createAdaptiveWorkflow(
      {
        marketNeedExplorerAgent: new MarketNeedExplorerAgent({ 
          enableQuantification: true,
          enableCategorization: !argv.fast,
          maxKeywords: argv.fast ? 20 : 50,
          searchEngine // 为了向后兼容
        }) as any,
        userJourneySimulatorAgent: new UserJourneySimulatorAgent({
          maxSteps: 3,
          // searchTools: multiSearchTools.getSearchTools('web'),
          searchEngine // 为了向后兼容
        }) as any,
        solutionEvaluatorAgent: new SolutionEvaluatorAgent({
          maxContentSamples: 3,
          // searchTools: multiSearchTools.getSearchTools('baidu'),
          searchEngine // 为了向后兼容
        }) as any,
        opportunityStrategistAgent: new OpportunityStrategistAgent({
          format: argv.format as any,
          language: argv.language as any,
          outputDir: argv.output
        }) as any
      },
      {
        fastMode: argv.fast,
        maxConcurrentAgents: argv.concurrent,
        prioritizeKeywordDiscovery: argv['prioritize-discovery'],
        outputDir: argv.output,
        format: argv.format as any,
        language: argv.language as any
      }
    );
    
    // 执行工作流
    const result = await workflow.run({
      keyword: argv.keyword,
      options: {
        includeDetails: !argv.fast,
        fast: argv.fast,
        maxKeywords: 30,
        maxRetries: 3
      }
    });
    
    // 输出结果
    const duration = (Date.now() - startTime) / 1000;
    logger.info(`分析完成! 用时: ${duration.toFixed(2)}秒`);
    
    // 关闭搜索引擎资源
    await searchEngine.close();
    
    return 0;
  } catch (error) {
    logger.error('分析过程中出现错误:', error);
    return 1;
  }
}

// 执行主函数
main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    logger.error('未捕获的错误:', error);
    process.exit(1);
  }); 