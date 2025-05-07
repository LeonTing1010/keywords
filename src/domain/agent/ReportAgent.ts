/**
 * ReportAgent - 报告生成Agent
 * 负责整合分析结果，生成最终报告
 */
import { Agent, AgentConfig, AgentTask } from '../../infrastructure/agent/Agent';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { logger } from '../../infrastructure/core/logger';
import * as path from 'path';
import * as fs from 'fs';

interface ReportAgentConfig extends AgentConfig {
  llm?: LLMServiceHub;
  outputDir?: string;
  language?: 'zh' | 'en';
}

export interface ReportOptions {
  language?: 'zh' | 'en';
  format?: 'markdown' | 'json';
  includeDetails?: boolean;
  outputPath?: string;
}

export class ReportAgent extends Agent {
  private llm: LLMServiceHub;
  private outputDir: string;
  private language: 'zh' | 'en';
  
  constructor(config: ReportAgentConfig) {
    super({
      id: config.id,
      name: config.name || '报告生成Agent',
      description: config.description || '负责整合分析结果，生成最终报告',
      verbose: config.verbose,
      maxRetries: config.maxRetries
    });
    
    this.llm = config.llm || new LLMServiceHub();
    this.outputDir = config.outputDir || './output';
    this.language = config.language || 'zh';
    
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
  
  /**
   * 执行报告生成任务
   */
  public async execute(task: AgentTask): Promise<any> {
    logger.info(`ReportAgent 开始执行任务: ${task.task}`, { data: task.data });
    
    try {
      switch (task.task) {
        case 'generateReport':
          return await this.generateReport(
            task.data.keyword,
            task.data.keywordResult,
            task.data.journeyResult,
            task.data.contentResult,
            task.data.options
          );
          
        case 'generateSummary':
          return await this.generateSummary(task.data);
          
        default:
          throw new Error(`未知任务类型: ${task.task}`);
      }
    } catch (error) {
      logger.error(`ReportAgent 执行任务失败: ${task.task}`, { error });
      throw error;
    }
  }
  
  /**
   * 生成完整报告
   */
  private async generateReport(
    keyword: string,
    keywordResult: any,
    journeyResult: any,
    contentResult: any,
    options: ReportOptions = {}
  ): Promise<any> {
    logger.info('开始生成报告', { keyword });
    
    try {
      // 1. 合并选项
      const reportOptions: ReportOptions = {
        language: options.language || this.language,
        format: options.format || 'markdown',
        includeDetails: options.includeDetails || false,
        outputPath: options.outputPath
      };
      
      // 2. 生成报告内容
      const reportContent = await this.generateMarkdownReport(
        keyword,
        keywordResult,
        journeyResult,
        contentResult,
        reportOptions
      );
      
      // 3. 写入文件
      const reportPath = this.saveReport(keyword, reportContent, reportOptions);
      
      logger.info('报告生成完成', { reportPath });
      
      return {
        success: true,
        report: reportContent,
        reportPath
      };
      
    } catch (error) {
      logger.error('报告生成失败', { error, keyword });
      throw error;
    }
  }
  
  /**
   * 生成Markdown报告
   */
  private async generateMarkdownReport(
    keyword: string,
    keywordResult: any,
    journeyResult: any,
    contentResult: any,
    options: ReportOptions
  ): Promise<string> {
    // 使用LLM生成报告
    const reportPrompt = `以下是关于"${keyword}"的分析结果，请生成一份完整的Markdown格式报告:

## 关键词分析
发现关键词: ${keywordResult.discoveredKeywords?.length || 0}个
潜在未满足需求: ${keywordResult.potentialUnmetNeeds?.length || 0}个

## 用户旅程分析
步骤数: ${journeyResult?.steps?.length || 0}
痛点: ${journeyResult?.painPoints?.length || 0}个
机会: ${journeyResult?.opportunities?.length || 0}个
满意度分数: ${journeyResult?.satisfactionScore || 0}

## 内容分析
未满足需求: ${contentResult?.unmetNeeds?.length || 0}个
市场洞察: ${contentResult?.insights?.length || 0}个
具体未满足需求: ${contentResult?.concreteUnmetNeeds?.length || 0}个

请生成一份专业的Markdown格式报告，包括以下部分:
1. 执行摘要
2. 未满足需求分析
3. 用户旅程洞察
4. 市场机会
5. 推荐行动计划

语言要求: ${options.language === 'en' ? '英文' : '中文'}
${options.includeDetails ? '包括详细的分析过程和原始数据' : '只包括主要发现和结论'}
`;

    const report = await this.llm.analyze(reportPrompt, 'markdown_report', {
      temperature: 0.6,
      format: 'markdown'
    });
    
    // 格式化报告
    const title = `# ${keyword} 未满足需求分析报告\n\n`;
    const timestamp = `*报告生成时间: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}*\n\n`;
    
    return title + timestamp + report;
  }
  
  /**
   * 保存报告
   */
  private saveReport(
    keyword: string,
    reportContent: string,
    options: ReportOptions
  ): string {
    try {
      // 生成安全的文件名
      const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
      const uniqueId = Math.random().toString(36).substring(2, 6);
      
      // 文件名
      const fileName = `NM_${safeKeyword}_${timestamp}_${uniqueId}.md`;
      
      // 输出路径
      const outputPath = options.outputPath || path.join(this.outputDir, fileName);
      
      // 确保目录存在
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 写入文件
      fs.writeFileSync(outputPath, reportContent, 'utf8');
      
      return outputPath;
    } catch (error) {
      logger.error('保存报告失败', { error });
      throw error;
    }
  }
  
  /**
   * 生成摘要
   */
  private async generateSummary(data: any): Promise<any> {
    // 实现摘要生成逻辑
    return {
      summary: '未满足需求分析摘要'
    };
  }
} 