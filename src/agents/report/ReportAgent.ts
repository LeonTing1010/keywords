/**
 * ReportAgent.ts - 分析报告生成Agent
 * 负责收集其他Agent的结果并生成最终分析报告
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseAgent, BaseAgentConfig } from '../base/BaseAgent';
import { GraphStateType } from '../../types/schema';
import { logger } from '../../infra/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

// 报告生成Agent配置
export interface ReportAgentConfig extends BaseAgentConfig {
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
  outputDir?: string;
  includeDetails?: boolean;
}

/**
 * 报告生成Agent
 * 负责汇总分析结果并生成最终报告
 */
export class ReportAgent extends BaseAgent<GraphStateType, Partial<GraphStateType>> {
  private format: 'markdown' | 'json';
  private language: 'zh' | 'en';
  private outputDir: string;
  private includeDetails: boolean;
  
  constructor(config: ReportAgentConfig = {}) {
    super(config);
    
    this.format = config.format || 'markdown';
    this.language = config.language || 'zh';
    this.outputDir = config.outputDir || './output';
    this.includeDetails = config.includeDetails || false;
    
    logger.debug('ReportAgent initialized', { 
      format: this.format,
      language: this.language,
      outputDir: this.outputDir,
      includeDetails: this.includeDetails
    });
  }
  
  /**
   * 设置Agent所需的工具
   */
  protected setupTools(): void {
    // 报告生成不需要特殊工具
  }
  
  /**
   * 生成Markdown格式的报告
   */
  private async generateMarkdownReport(state: GraphStateType): Promise<string> {
    try {
      logger.debug('Generating markdown report - start');
      
      // 获取关键数据
      const keyword = state.input.keyword;
      const keywordDiscovery = state.keywordDiscovery;
      const journeySimulation = state.journeySimulation;
      const contentAnalysis = state.contentAnalysis;
      
      // 记录状态数据用于调试
      logger.debug('Report input data summary', {
        keyword,
        hasKeywordDiscovery: !!keywordDiscovery,
        hasJourneySimulation: !!journeySimulation,
        hasContentAnalysis: !!contentAnalysis,
        discoveredKeywordsCount: keywordDiscovery?.discoveredKeywords?.length || 0,
        potentialUnmetNeedsCount: keywordDiscovery?.potentialUnmetNeeds?.length || 0,
        painPointsCount: journeySimulation?.painPoints?.length || 0,
        opportunitiesCount: journeySimulation?.opportunities?.length || 0,
        unmetNeedsCount: contentAnalysis?.unmetNeeds?.length || 0
      });
      
      // 创建提示模板字符串
      const promptTemplate = `
你是一个专业的市场研究分析师，需要为客户生成一份未满足需求分析报告。

报告语言: ${this.language === 'zh' ? '中文' : 'English'}

请根据以下分析数据，生成一份完整的Markdown格式分析报告:

关键词: {{keyword}}

关键词发现数据:
- 发现的相关关键词数量: ${keywordDiscovery?.discoveredKeywords?.length || 0}
- 潜在未满足需求: ${keywordDiscovery?.potentialUnmetNeeds?.length || 0}个
${keywordDiscovery?.potentialUnmetNeeds?.map(need => 
  `  - "${need.keyword}" (置信度: ${need.confidence}): ${need.reason}`
).join('\n') || ''}

用户旅程分析:
- 搜索满意度: ${journeySimulation?.metrics?.satisfactionScore?.toFixed(2) || 'N/A'}
- 痛点数量: ${journeySimulation?.painPoints?.length || 0}
${journeySimulation?.painPoints?.map(point => 
  `  - ${point.description} (严重度: ${point.severity})`
).join('\n') || ''}
- 机会数量: ${journeySimulation?.opportunities?.length || 0}
${journeySimulation?.opportunities?.map(opp => 
  `  - ${opp.description} (潜在价值: ${opp.potentialValue})`
).join('\n') || ''}

内容分析:
- 未满足需求数量: ${contentAnalysis?.statistics?.unmetNeedsCount || 0}
- 平均内容质量: ${contentAnalysis?.statistics?.averageContentQuality?.toFixed(2) || 'N/A'}
- 平均市场空白严重度: ${contentAnalysis?.statistics?.averageMarketGapSeverity?.toFixed(2) || 'N/A'}
${contentAnalysis?.concreteUnmetNeeds?.map(need => 
  `  - ${need.keyword}: ${need.description} (潜在价值: ${need.potentialValue})`
).join('\n') || ''}

市场洞察:
${contentAnalysis?.marketInsights?.map(insight => 
  `- ${insight.title}: ${insight.description}`
).join('\n') || ''}

请生成一份完整的Markdown格式分析报告，报告应包括:

1. 标题和简介
2. 主要发现摘要
3. 关键词分析
4. 用户旅程和痛点分析
5. 未满足需求详细分析
6. 市场机会评估
7. 建议行动方案
8. 附录: 数据细节 (如适用)

报告应当专业、详细且可操作，提供清晰的洞察和建议。
仅返回完整的Markdown格式内容，不要包含其他解释文字。
`;

      // 记录提示模板用于调试
      logger.debug('Markdown report prompt template created', { 
        promptLength: promptTemplate.length,
        promptFirstLines: promptTemplate.split('\n').slice(0, 5).join('\n') 
      });
      
      // 创建提示模板
      const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);
      
      // 生成报告
      logger.debug('Starting LLM markdown report generation', { keyword });
      const chain = prompt.pipe(this.model);
      
      try {
        // 记录LLM请求开始
        const requestStartTime = Date.now();
        const response = await chain.invoke({ keyword });
        const requestDuration = Date.now() - requestStartTime;
        
        // 记录LLM响应
        const content = response.content.toString();
        logger.debug('LLM markdown report generation completed', { 
          requestDuration,
          contentLength: content.length,
          contentPreview: content.substring(0, 200) + '...' // 只记录预览，避免日志过大
        });
        
        // 检查生成的报告是否过短或内容异常
        if (content.length < 100) {
          logger.warn('Generated markdown report is suspiciously short', { contentLength: content.length });
          // 如果报告过短，仍然返回，但会在内容前添加警告，便于排查
          return `# 分析报告\n\n> 警告：生成的报告内容异常简短，可能未能完全生成。原始内容为：\n\n${content}`;
        }
        
        return content;
      } catch (llmError) {
        // 捕获LLM调用中的错误
        logger.error('LLM markdown report generation failed', { 
          error: llmError instanceof Error ? llmError.message : String(llmError),
          errorStack: llmError instanceof Error ? llmError.stack : undefined,
          keyword
        });
        
        // 生成一个基本的失败报告，而不是直接抛出错误
        return `# 分析报告\n\n生成报告时出现错误：${llmError instanceof Error ? llmError.message : String(llmError)}\n\n## 调试信息\n\n- 关键词: ${keyword}\n- 时间: ${new Date().toISOString()}\n- 数据统计: 关键词发现(${keywordDiscovery?.discoveredKeywords?.length || 0}), 痛点(${journeySimulation?.painPoints?.length || 0}), 未满足需求(${contentAnalysis?.unmetNeeds?.length || 0})`;
      }
    } catch (error) {
      // 捕获一般错误
      logger.error('Failed to generate markdown report', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      
      // 返回简单错误报告，而不是抛出错误
      return `# 分析报告\n\n生成报告时出现错误：${error instanceof Error ? error.message : String(error)}\n\n请联系技术支持获取更多信息。`;
    }
  }
  
  /**
   * 生成JSON格式的报告
   */
  private generateJsonReport(state: GraphStateType): string {
    try {
      logger.debug('Generating JSON report - start');
      
      // 记录状态数据用于调试
      logger.debug('JSON report input data', {
        keyword: state.input.keyword,
        hasKeywordDiscovery: !!state.keywordDiscovery,
        hasJourneySimulation: !!state.journeySimulation,
        hasContentAnalysis: !!state.contentAnalysis
      });
      
      // 创建输出结构
      const report = {
        keyword: state.input.keyword,
        timestamp: new Date().toISOString(),
        summary: {
          discoveredKeywordsCount: state.keywordDiscovery?.discoveredKeywords?.length || 0,
          potentialUnmetNeedsCount: state.keywordDiscovery?.potentialUnmetNeeds?.length || 0,
          painPointsCount: state.journeySimulation?.painPoints?.length || 0,
          unmetNeedsCount: state.contentAnalysis?.unmetNeeds?.filter(n => n.isUnmetNeed).length || 0,
          concreteOpportunitiesCount: state.contentAnalysis?.concreteUnmetNeeds?.length || 0,
          overallMarketGapSeverity: state.contentAnalysis?.statistics?.averageMarketGapSeverity || 0
        },
        keywordDiscovery: this.includeDetails ? state.keywordDiscovery : {
          insights: state.keywordDiscovery?.insights || [],
          potentialUnmetNeeds: state.keywordDiscovery?.potentialUnmetNeeds || [],
          statistics: state.keywordDiscovery?.statistics || {}
        },
        journeySimulation: this.includeDetails ? state.journeySimulation : {
          painPoints: state.journeySimulation?.painPoints || [],
          opportunities: state.journeySimulation?.opportunities || [],
          insights: state.journeySimulation?.insights || [],
          metrics: state.journeySimulation?.metrics || {}
        },
        contentAnalysis: this.includeDetails ? state.contentAnalysis : {
          unmetNeeds: state.contentAnalysis?.unmetNeeds?.filter(n => n.isUnmetNeed) || [],
          concreteUnmetNeeds: state.contentAnalysis?.concreteUnmetNeeds || [],
          marketInsights: state.contentAnalysis?.marketInsights || [],
          statistics: state.contentAnalysis?.statistics || {}
        },
        metadata: {
          executionTime: Date.now() - (state.executionMetadata?.startTime || Date.now()),
          format: this.format,
          language: this.language,
          includesDetails: this.includeDetails
        }
      };
      
      const jsonString = JSON.stringify(report, null, 2);
      logger.debug('JSON report generation completed', { 
        jsonLength: jsonString.length,
        reportStructure: Object.keys(report)
      });
      
      return jsonString;
    } catch (error) {
      logger.error('Failed to generate JSON report', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      
      // 返回简单错误JSON，而不是抛出错误
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        keyword: state.input?.keyword || 'unknown'
      }, null, 2);
    }
  }
  
  /**
   * 保存报告到文件
   */
  private async saveReport(content: string, keyword: string): Promise<string> {
    try {
      logger.debug('Saving report to file - start', { keyword, contentLength: content.length });
      
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
      const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const uniqueId = Math.random().toString(36).substring(2, 6);
      const extension = this.format === 'markdown' ? 'md' : 'json';
      const fileName = `AIKR_${safeKeyword}_${timestamp}_${uniqueId}.${extension}`;
      
      // 完整文件路径
      const filePath = path.join(this.outputDir, fileName);
      
      logger.debug('Report file path prepared', { fileName, filePath });
      
      // 写入文件
      await fs.writeFile(filePath, content, 'utf8');
      
      // 额外保存一份固定名称的最新报告，方便查看
      const testFilePath = path.join(this.outputDir, `test_${timestamp.substring(0, 10)}.${extension}`);
      await fs.writeFile(testFilePath, content, 'utf8');
      
      logger.info('Report saved successfully', { 
        filePath, 
        testFilePath,
        contentLength: content.length,
        format: this.format
      });
      
      return filePath;
    } catch (error) {
      logger.error('Failed to save report', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        keyword,
        outputDir: this.outputDir
      });
      
      // 尝试保存到临时目录作为备份
      try {
        const backupDir = path.join(this.outputDir, 'backup');
        await fs.mkdir(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `failed_report_${Date.now()}.txt`);
        await fs.writeFile(backupFile, content, 'utf8');
        logger.info('Backup report saved', { backupFile });
        return backupFile;
      } catch (backupError) {
        logger.error('Failed to save backup report', { error: backupError });
      }
      
      throw error;
    }
  }
  
  /**
   * 执行报告生成Agent的主要逻辑
   * @param state - 当前GraphStateType
   * @returns Partial<GraphStateType>，其中reportGeneration字段严格对齐ReportGenerationResult类型
   */
  public async execute(state: any): Promise<Partial<GraphStateType>> {
    try {
      logger.info('ReportAgent execution started');
      const startTime = Date.now();
      
      // 获取关键词
      const keyword = state.input?.keyword;
      if (!keyword) {
        logger.error('Missing keyword in input state');
        throw new Error('Missing keyword in input state');
      }
      
      // 检查是否有足够数据生成报告
      if (!state.keywordDiscovery && !state.contentAnalysis) {
        logger.warn('Not enough data to generate a meaningful report', { 
          hasKeywordDiscovery: !!state.keywordDiscovery,
          hasContentAnalysis: !!state.contentAnalysis,
          keyword
        });
      }
      
      // 记录State数据结构
      logger.debug('Report state structure', {
        stateKeys: Object.keys(state),
        inputKeys: state.input ? Object.keys(state.input) : [],
        keywordDiscoveryKeys: state.keywordDiscovery ? Object.keys(state.keywordDiscovery) : [],
        contentAnalysisKeys: state.contentAnalysis ? Object.keys(state.contentAnalysis) : []
      });
      
      // 根据格式生成报告内容
      let reportContent: string;
      try {
        if (this.format === 'markdown') {
          reportContent = await this.generateMarkdownReport(state);
        } else {
          reportContent = this.generateJsonReport(state);
        }
      } catch (generationError) {
        logger.error('Report generation error', { 
          error: generationError instanceof Error ? generationError.message : String(generationError) 
        });
        // 防止整个流程因报告生成失败而中断
        reportContent = this.format === 'markdown' 
          ? `# 分析报告\n\n生成报告时出现错误: ${generationError instanceof Error ? generationError.message : String(generationError)}`
          : JSON.stringify({ error: `Generation error: ${generationError instanceof Error ? generationError.message : String(generationError)}` });
      }
      
      // 保存报告
      let reportPath: string;
      try {
        reportPath = await this.saveReport(reportContent, keyword);
      } catch (saveError) {
        logger.error('Report save error', { 
          error: saveError instanceof Error ? saveError.message : String(saveError) 
        });
        // 使用临时路径
        reportPath = `${this.outputDir}/error_report_${Date.now()}.${this.format === 'markdown' ? 'md' : 'json'}`;
      }
      
      // 计算统计信息
      const generationTimeMs = Date.now() - startTime;
      const wordCount = this.format === 'markdown' 
        ? reportContent.split(/\s+/).length 
        : 0;
      
      const insightsCount = (state.keywordDiscovery?.insights?.length || 0) + 
                          (state.contentAnalysis?.marketInsights?.length || 0);
      
      const recommendationsCount = state.contentAnalysis?.concreteUnmetNeeds?.length || 0;
      
      // 记录性能和统计数据
      logger.info('Report generation completed', {
        format: this.format,
        generationTimeMs,
        wordCount,
        insightsCount,
        recommendationsCount,
        reportPathLength: reportPath.length
      });
      
      // 更新状态
      return {
        reportGeneration: {
          keyword,
          reportContent,
          reportPath,
          format: this.format,
          metrics: {
            wordCount,
            insightsCount,
            recommendationsCount,
            generationTimeMs
          }
        }
      };
    } catch (error) {
      logger.error('ReportAgent execution failed', { 
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined 
      });
      
      // 返回错误状态，而不是抛出错误，避免整个流程中断
      return {
        reportGeneration: {
          keyword: state.input?.keyword || 'unknown',
          reportContent: this.format === 'markdown' 
            ? `# 分析报告\n\n执行过程中出现错误: ${error instanceof Error ? error.message : String(error)}` 
            : JSON.stringify({ error: `Execution error: ${error instanceof Error ? error.message : String(error)}` }),
          reportPath: `${this.outputDir}/execution_error_${Date.now()}.${this.format === 'markdown' ? 'md' : 'json'}`,
          format: this.format,
          metrics: {
            wordCount: 0,
            insightsCount: 0,
            recommendationsCount: 0,
            generationTimeMs: Date.now() - (state.executionMetadata?.startTime || Date.now())
          }
        }
      };
    }
  }
} 