#!/usr/bin/env node
/**
 * KeywordAlchemist CLI 🧪
 * 命令行工具，帮助用户将普通关键词转化为高价值商业洞察与未解决问题
 */

import { Command } from 'commander';
import { ProblemMiner } from '../agents/roles/ProblemMiner';
import { MockLLMService } from '../test/mocks/MockLLMService';
import { MockToolFactory } from '../test/mocks/MockToolFactory';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

// 创建命令行程序
const program = new Command();

// 设置程序基本信息
program
  .name('keyword-alchemist')
  .description('🧪 将普通关键词转化为高价值商业洞察与未解决问题的智能系统')
  .version('1.1.0');

/**
 * 执行关键词分析
 * @param keyword 关键词
 * @param options 选项
 */
async function discoverProblems(keyword: string, options: any) {
  // 显示启动信息
  console.log(chalk.cyan(`\n🧪 启动KeywordAlchemist - 分析关键词: "${keyword}"\n`));
  
  const spinner = ora('正在初始化服务...').start();
  
  try {
    // 创建LLM服务
    const llmService = options.mockMode 
      ? new MockLLMService() 
      : new MockLLMService(); // 后续可替换为真实LLM服务
    
    // 创建工具工厂
    const toolFactory = new MockToolFactory();
    
    // 创建问题挖掘Agent
    spinner.text = '创建关键词分析Agent...';
    const problemMiner = new ProblemMiner(llmService, {
      maxProblems: options.maxProblems,
      maxProblemsToReturn: options.maxProblems,
      useAutocomplete: !options.disableAutocomplete,
      minConfidenceScore: options.minConfidence,
      filterThreshold: options.filterThreshold
    });
    
    // 注册工具
    spinner.text = '注册分析工具...';
    problemMiner.registerTool(toolFactory.createSearchCompletionTool());
    problemMiner.registerTool(toolFactory.createCommunityInsightTool());
    
    // 收集所有注册的工具名称
    const allTools = problemMiner.getRegisteredTools();
    
    // 创建执行上下文
    const workflowContext = {
      workflowId: uuidv4(),
      state: {
        input: {
          keyword,
          options: {
            fast: options.fast,
            maxProblems: options.maxProblems
          }
        },
        currentNodeId: 'ProblemMiner',
        completedNodeIds: [],
        nodeOutputs: {},
        executionMetadata: {
          startTime: Date.now(),
          currentTime: Date.now(),
          errors: []
        }
      },
      sharedMemory: {},
      availableTools: allTools
    };
    
    // 开始分析关键词
    spinner.text = '分析关键词，提炼潜在洞察...';
    const result = await problemMiner.execute({
      data: { keyword },
      context: workflowContext
    });
    
    spinner.succeed('关键词分析完成!');
    
    if (result.status !== 'success') {
      console.error(chalk.red(`\n❌ 关键词分析失败: ${result.error}`));
      return;
    }
    
    // 显示结果
    const data = result.data as any;
    const problems = data.problems;
    
    console.log(
      chalk.green(`\n✅ 提炼出 ${problems.length} 个商业洞察 (从 ${data.totalPotentialProblems} 个初步发现中筛选)\n`)
    );
    
    // 输出问题详情
    problems.forEach((problem: any, index: number) => {
      console.log(chalk.bold.blue(`\n洞察 ${index + 1}: ${problem.title}`));
      console.log(chalk.gray(`类别: ${problem.category.join(', ')}`));
      console.log(`${problem.description}`);
      
      if (problem.evidence && problem.evidence.length > 0) {
        console.log(chalk.yellow(`\n支持依据 (${problem.evidence.length}条):`));
        console.log(`- ${problem.evidence[0].text}`);
        if (problem.evidence.length > 1) {
          console.log(`- ${problem.evidence[1].text}`);
        }
      }
      
      if (problem.value) {
        console.log(chalk.green(`\n价值评分: ${problem.value.overall}/100`));
      }
      
      console.log(chalk.gray('-------------------------------------------'));
    });
    
    // 保存结果
    if (options.output) {
      const outputFormat = options.format || 'json';
      const outputPath = options.output;
      
      let outputContent = '';
      if (outputFormat === 'json') {
        outputContent = JSON.stringify(problems, null, 2);
      } else if (outputFormat === 'markdown') {
        outputContent = convertToMarkdown(keyword, problems);
      } else if (outputFormat === 'text') {
        outputContent = convertToText(keyword, problems);
      }
      
      fs.writeFileSync(outputPath, outputContent);
      console.log(chalk.green(`\n✅ 结果已保存至: ${outputPath}`));
    }
    
    // 显示执行时间
    const executionTime = Date.now() - workflowContext.state.executionMetadata.startTime;
    console.log(chalk.gray(`\n总执行时间: ${executionTime}ms`));
    
  } catch (error) {
    spinner.fail('执行失败');
    console.error(chalk.red(`\n❌ 错误: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * 将洞察列表转换为Markdown格式
 * @param keyword 关键词
 * @param problems 洞察列表
 * @returns Markdown内容
 */
function convertToMarkdown(keyword: string, problems: any[]): string {
  let markdown = `# 关键词"${keyword}"的商业洞察分析 🧪\n\n`;
  
  markdown += `## 发现的洞察 (${problems.length}个)\n\n`;
  
  problems.forEach((problem: any, index: number) => {
    markdown += `### ${index + 1}. ${problem.title}\n\n`;
    markdown += `**类别**: ${problem.category.join(', ')}\n\n`;
    markdown += `${problem.description}\n\n`;
    
    if (problem.evidence && problem.evidence.length > 0) {
      markdown += `**支持依据**:\n\n`;
      problem.evidence.slice(0, 3).forEach((evidence: any) => {
        markdown += `- ${evidence.text}\n`;
      });
      markdown += '\n';
    }
    
    if (problem.value) {
      markdown += `**价值评分**: ${problem.value.overall}/100\n\n`;
    }
    
    markdown += '---\n\n';
  });
  
  markdown += `\n> 生成时间: ${new Date().toISOString()} | 由KeywordAlchemist提供`;
  
  return markdown;
}

/**
 * 将洞察列表转换为纯文本格式
 * @param keyword 关键词
 * @param problems 洞察列表
 * @returns 文本内容
 */
function convertToText(keyword: string, problems: any[]): string {
  let text = `关键词"${keyword}"的商业洞察分析 🧪\n\n`;
  text += `发现的洞察 (${problems.length}个):\n\n`;
  
  problems.forEach((problem: any, index: number) => {
    text += `${index + 1}. ${problem.title}\n`;
    text += `类别: ${problem.category.join(', ')}\n`;
    text += `${problem.description}\n\n`;
    
    if (problem.evidence && problem.evidence.length > 0) {
      text += `支持依据:\n`;
      problem.evidence.slice(0, 2).forEach((evidence: any) => {
        text += `- ${evidence.text}\n`;
      });
      text += '\n';
    }
    
    if (problem.value) {
      text += `价值评分: ${problem.value.overall}/100\n\n`;
    }
    
    text += '-------------------\n\n';
  });
  
  text += `\n生成时间: ${new Date().toISOString()} | 由KeywordAlchemist提供`;
  
  return text;
}

// 注册discover命令
program
  .command('discover <keyword>')
  .description('从关键词中提炼高价值商业洞察与未解决问题')
  .option('-m, --max-problems <number>', '最大返回洞察数量', '5')
  .option('-c, --min-confidence <number>', '最小置信度阈值 (0-1)', '0.6')
  .option('-f, --filter-threshold <number>', '洞察过滤阈值 (0-1)', '0.6')
  .option('--fast', '启用快速分析模式', false)
  .option('--disable-autocomplete', '禁用搜索自动补全', false)
  .option('--mock-mode', '使用模拟LLM服务', true)
  .option('-o, --output <path>', '保存结果到文件')
  .option('--format <format>', '输出格式 (json, markdown, text)', 'json')
  .action(async (keyword, options) => {
    // 转换选项值为正确的类型
    options.maxProblems = parseInt(options.maxProblems);
    options.minConfidence = parseFloat(options.minConfidence);
    options.filterThreshold = parseFloat(options.filterThreshold);
    
    await discoverProblems(keyword, options);
  });

// 注册批量处理命令
program
  .command('batch <file>')
  .description('批量分析多个关键词并提炼商业洞察')
  .option('-m, --max-problems <number>', '每个关键词的最大返回洞察数量', '3')
  .option('-o, --output-dir <path>', '结果保存目录', './results')
  .option('--format <format>', '输出格式 (json, markdown, text)', 'json')
  .action(async (file, options) => {
    const outputDir = options.outputDir;
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    try {
      // 读取关键词文件
      const content = fs.readFileSync(file, 'utf-8');
      const keywords = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      console.log(chalk.cyan(`\n🧪 批量分析 ${keywords.length} 个关键词\n`));
      
      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];
        console.log(chalk.bold(`\n处理关键词 ${i+1}/${keywords.length}: "${keyword}"`));
        
        const outputPath = path.join(
          outputDir, 
          `${keyword.replace(/\s+/g, '_').toLowerCase()}.${options.format}`
        );
        
        await discoverProblems(keyword, {
          ...options,
          output: outputPath,
          maxProblems: parseInt(options.maxProblems),
          minConfidence: 0.6,
          filterThreshold: 0.6
        });
      }
      
      console.log(chalk.green(`\n✅ 批量分析完成! 结果保存在 ${outputDir} 目录`));
      
    } catch (error) {
      console.error(chalk.red(`\n❌ 批量处理失败: ${error instanceof Error ? error.message : String(error)}`));
    }
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!program.args.length) {
  program.help();
} 