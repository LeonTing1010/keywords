#!/usr/bin/env node
/**
 * ProblemDiscoveryCli.ts - 问题发现框架命令行界面
 * 
 * 使用问题发现图实现高效的递归式问题发现和优化
 */
import { runProblemDiscovery } from '../graphs/problem-discovery/ProblemDiscoveryGraph';
import { logger } from '../infra/logger';
import { DiscoveryResult } from '../types/discovery';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
// 导入Agent跟踪组件
import { agentTrackingManager } from '../infra/core/AgentTracking';
// 导入Agent工具函数
import { instrumentAgent, instrumentAllAgents } from '../tools/utils/AgentInstrumenter';

// 导入全局跟踪器
import { globalTracker } from '../tools/utils/AgentTracker';
// 加载环境变量
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true
});
dotenv.config();

// 确保OPENAI_BASE_URL设置为LLM_BASE_URL
if (process.env.LLM_BASE_URL) {
  process.env.OPENAI_BASE_URL = process.env.LLM_BASE_URL;
  logger.info({ baseUrl: process.env.OPENAI_BASE_URL }, `设置OPENAI_BASE_URL为: ${process.env.OPENAI_BASE_URL}`);
}

/**
 * 运行问题发现CLI
 */
async function main() {
  // 解析命令行参数
  const args = await yargs(hideBin(process.argv))
    .option('keyword', {
      alias: 'k',
      type: 'string',
      description: '要分析的关键词',
      demandOption: true
    })
    .option('iterations', {
      alias: 'i',
      type: 'number',
      description: '迭代次数',
      default: 2
    })
    .option('problems', {
      alias: 'p',
      type: 'number',
      description: '每次最多处理的问题数量',
      default: 10
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出目录',
      default: './output'
    })
    .option('format', {
      alias: 'f',
      choices: ['markdown', 'json'] as const,
      description: '输出格式',
      default: 'markdown'
    })
    .option('language', {
      alias: 'l',
      choices: ['zh', 'en'] as const,
      description: '输出语言',
      default: 'zh'
    })
    .option('track-agents', {
      alias: 't',
      description: '是否跟踪Agent执行过程',
      type: 'boolean',
      default: true
    })
    .option('track-output', {
      description: '指定Agent跟踪日志输出目录',
      type: 'string',
      default: './logs/agent_tracker'
    })
    .help()
    .alias('help', 'h')
    .parseSync();
  
  try {
    // 打印启动信息
    console.log('\n');
    console.log('📊 问题发现框架 - 高效发现未被充分解决的问题');
    console.log('============================================');
    console.log(`关键词: ${args.keyword}`);
    console.log(`迭代次数: ${args.iterations}`);
    console.log(`最大问题数: ${args.problems}`);
    console.log(`输出目录: ${args.output}`);
    console.log(`输出格式: ${args.format}`);
    console.log(`输出语言: ${args.language}`);
    console.log(`Agent跟踪: ${args['track-agents']}-${args['track-output']}`);
    console.log('============================================\n');
    
    // 确保输出目录存在
    if (!fs.existsSync(args.output)) {
      fs.mkdirSync(args.output, { recursive: true });
    }
    
    // 创建Agent跟踪输出目录
    if (!fs.existsSync(args['track-output'])) {
      fs.mkdirSync(args['track-output'], { recursive: true });
    }
    
    // 初始化Agent跟踪系统
    if (args['track-agents']) {
      // 设置环境变量以便其他模块使用
      process.env.AGENT_TRACKING_ENABLED = "true";
      process.env.AGENT_TRACKING_DIR = args['track-output'];
      
      // 初始化跟踪管理器
      agentTrackingManager.initialize({
        enabled: true,
        outputDirectory: args['track-output'],
        includeAllMethods: true
      });
      
      // 确保对所有Agent进行跟踪
      instrumentAllAgents();
      

      // 显式设置全局跟踪器的输出目录
      globalTracker.setOutputDirectory(args['track-output']);
      logger.info(
        { outputDir: args['track-output'] }, 
        "已启用Agent跟踪功能"
      );
    } else {
      process.env.AGENT_TRACKING_ENABLED = "false";
      logger.info({}, "已禁用Agent跟踪功能");
    }
    
    // 运行问题发现流程
    console.log(`🔍 开始分析关键词 "${args.keyword}"...\n`);
    
    const startTime = Date.now();
    
    const result = await runProblemDiscovery({
      keyword: args.keyword,
      maxIterations: args.iterations,
      maxProblems: args.problems,
      outputDir: args.output,
      format: args.format as 'markdown' | 'json',
      language: args.language as 'zh' | 'en',
      trackAgents: args['track-agents'] // 明确传递跟踪配置
    });
    
    const duration = (Date.now() - startTime) / 1000;
    
    // 打印结果摘要
    console.log('\n✅ 分析完成!');
    console.log('============================================');
    console.log(`发现问题数量: ${result.discoveredProblems?.length || 0}`);
    console.log(`总迭代次数: ${result.processingMetrics?.totalIterations || 1}`);
    console.log(`总耗时: ${duration.toFixed(1)}秒`);
    console.log(`输出文件保存至: ${args.output}`);
    console.log('============================================\n');
    
    // 如果有问题，打印前3个问题摘要
    if (result.discoveredProblems && result.discoveredProblems.length > 0) {
      console.log('🔍 前3个主要问题:');
      result.discoveredProblems.slice(0, 3).forEach((problem, index) => {
        console.log(`${index + 1}. ${problem.currentFormulation}`);
        console.log(`   真实性: ${problem.qualityScore.authenticity}/10, 紧急性: ${problem.qualityScore.urgency}/10, 规模: ${problem.qualityScore.scale}/10`);
        console.log();
      });
    }
    
    return 0;
  } catch (error: any) {
    console.error('\n❌ 发生错误:');
    console.error(error.message);
    logger.error({ error }, 'CLI执行出错');
    return 1;
  }
}

// 执行主函数
main()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    logger.error({ error }, '未捕获的错误:');
    process.exit(1);
  }); 