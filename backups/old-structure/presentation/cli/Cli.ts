#!/usr/bin/env node
/**
 * StartupAnalysis CLI
 * 创业机会分析系统命令行工具
 * v1.0.0
 */
import { WorkflowController } from '../../application/services/WorkflowController';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { BaiduSearchEngine } from '../../infrastructure/search/engines/BaiduSearchEngine';
import { logger } from '../../infrastructure/core/logger';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { StartupAnalysisService } from '../../application/services/StartupAnalysisService';
import { KeywordReportService } from '../../application/services/KeywordReportService';

// 优先加载.env.local文件
dotenv.config({ 
  path: path.resolve(process.cwd(), '.env.local'),
  override: true // 确保.env.local中的变量覆盖系统环境变量
});

interface CliOptions {
  engine: 'baidu' | 'google';
  format: 'json' | 'markdown';
  language: 'zh' | 'en';
  verbose: boolean;
  proxy?: string;
  output?: string;
}

function parseArguments(): { keyword: string; options: CliOptions } {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    engine: (process.env.SEARCH_ENGINE as 'baidu' | 'google') || 'baidu',
    format: (process.env.OUTPUT_FORMAT as 'json' | 'markdown') || 'json',
    language: (process.env.LANGUAGE as 'zh' | 'en') || 'zh',
    verbose: false,
  };
  
  // 调试输出环境变量
  console.log(`解析参数: OUTPUT_FORMAT=${process.env.OUTPUT_FORMAT}, 使用format=${options.format}`);

  let keyword = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      switch (arg) {
        case '--engine':
          options.engine = args[++i] as 'baidu' | 'google';
          break;
        case '--format':
          options.format = args[++i] as 'json' | 'markdown';
          break;
        case '--language':
          options.language = args[++i] as 'zh' | 'en';
          break;
        case '--verbose':
          options.verbose = true;
          break;
        case '--proxy':
          options.proxy = args[++i];
          break;
        case '--output':
          options.output = args[++i];
          break;
      }
    } else if (!keyword) {
      keyword = arg;
    }
  }

  if (!keyword) {
    console.error('请提供要分析的关键词');
    process.exit(1);
  }

  return { keyword, options };
}

async function main() {
  try {
    // 调试环境变量
    console.log('环境变量调试:');
    console.log(`LLM_MODEL=${process.env.LLM_MODEL}`);
    console.log(`LLM_BASE_URL=${process.env.LLM_BASE_URL}`);
    
    // 解析命令行参数
    const { keyword, options } = parseArguments();

    // 设置日志级别
    if (options.verbose) {
      console.log('启用详细日志模式');
    }
    logger.info('启动分析系统', { keyword, options });

    // 创建搜索引擎实例
    const searchEngine = new BaiduSearchEngine();
    if (options.proxy) {
      searchEngine.setProxy(options.proxy);
    }

    // 创建LLM服务实例
    logger.info('准备初始化LLM服务', { modelFromEnv: process.env.LLM_MODEL });
    
    const llmService = new LLMServiceHub({
      model: process.env.LLM_MODEL || 'gpt-4'
    });
    
    // 获取并记录最终使用的模型
    const actualModel = llmService.getModelName();
    logger.info('LLM服务实际使用的模型', { model: actualModel });

    // 创建工作流控制器
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      verbose: options.verbose,
      maxIterations: 5,
      enableJourneySim: true,
      refinementCycles: 5
    });
    // 执行分析工作流
    const result = await workflowController.executeWorkflow(keyword);

    // 保存结果
    const formattedDate = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
    const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
    const uniqueId = Math.random().toString(36).substring(2, 6);
    const reportFileName = `AIKR_${safeKeyword}_${formattedDate}_${uniqueId}.${options.format}`;
    const outputPath = options.output || `./output/${reportFileName}`;
    let outputContent: string;
    
    // 根据输出格式处理内容
    logger.info(`使用输出格式: ${options.format}`);
    if (options.format === 'json') {
      outputContent = JSON.stringify(result, null, 2);
      await saveOutput(outputPath, outputContent);
      logger.info('分析完成', { outputPath });
      process.exit(0);
    } else {
      // 使用KeywordReportService生成markdown报告
      const keywordReportService = new KeywordReportService();
      const reportResult = await keywordReportService.generateKeywordReport(result, {
        format: options.format,
        language: options.language,
        engine: options.engine,
        model: llmService.getModelName(),
        temperature: 0.7,
        verbose: options.verbose,
        outputDir: path.dirname(outputPath)
      });
      
      logger.info('分析完成', { reportPath: reportResult.reportPath });
      process.exit(0);
    }

  } catch (error) {
    logger.error('系统执行出错', { error });
    process.exit(1);
  }
}

async function saveOutput(path: string, content: string): Promise<void> {
  const fs = require('fs').promises;
  const { dirname } = require('path');

  try {
    // 确保输出目录存在
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, content, 'utf8');
  } catch (error) {
    logger.error('保存输出失败', { error });
    throw error;
  }
}

// 执行主函数
main().catch(error => {
  logger.error('未捕获的错误', { error });
  process.exit(1);
}); 