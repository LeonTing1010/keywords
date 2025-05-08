/**
 * ReportAgent.ts - 分析报告生成Agent
 * 负责收集其他Agent的结果并生成最终分析报告
 */
import { BaseAgent, BaseAgentConfig } from './BaseAgent';
import { GraphStateType } from '../state/schema';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { logger } from '../../infrastructure/core/logger';
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
      logger.debug('Generating markdown report');
      
      // 获取关键数据
      const keyword = state.input.keyword;
      const keywordDiscovery = state.keywordDiscovery;
      const journeySimulation = state.journeySimulation;
      const contentAnalysis = state.contentAnalysis;
      
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
      
      // 创建提示模板
      const prompt = ChatPromptTemplate.fromTemplate(promptTemplate);
      
      // 生成报告
      const chain = prompt.pipe(this.model);
      const response = await chain.invoke({ keyword });
      
      return response.content.toString();
    } catch (error) {
      logger.error('Failed to generate markdown report', { error });
      throw error;
    }
  }
  
  /**
   * 生成JSON格式的报告
   */
  private generateJsonReport(state: GraphStateType): string {
    try {
      logger.debug('Generating JSON report');
      
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
      
      return JSON.stringify(report, null, 2);
    } catch (error) {
      logger.error('Failed to generate JSON report', { error });
      throw error;
    }
  }
  
  /**
   * 保存报告到文件
   */
  private async saveReport(content: string, keyword: string): Promise<string> {
    try {
      // 确保输出目录存在
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16);
      const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30);
      const uniqueId = Math.random().toString(36).substring(2, 6);
      const fileName = `AIKR_${safeKeyword}_${timestamp}_${uniqueId}.${this.format === 'markdown' ? 'md' : 'json'}`;
      
      // 完整文件路径
      const filePath = path.join(this.outputDir, fileName);
      
      // 写入文件
      await fs.writeFile(filePath, content, 'utf8');
      logger.info('Report saved', { filePath });
      
      return filePath;
    } catch (error) {
      logger.error('Failed to save report', { error });
      throw error;
    }
  }
  
  /**
   * 执行报告生成Agent的主要逻辑
   * @param state - 当前GraphStateType
   * @returns Partial<GraphStateType>，其中reportGeneration字段严格对齐ReportGenerationResult类型
   */
  public async execute(state: GraphStateType): Promise<Partial<GraphStateType>> {
    try {
      logger.info('ReportAgent execution started');
      const startTime = Date.now();
      
      // 获取关键词
      const keyword = state.input.keyword;
      if (!keyword) {
        throw new Error('Missing keyword in input state');
      }
      
      // 检查是否有足够数据生成报告
      if (!state.keywordDiscovery && !state.contentAnalysis) {
        logger.warn('Not enough data to generate a meaningful report');
      }
      
      // 根据格式生成报告内容
      let reportContent: string;
      if (this.format === 'markdown') {
        reportContent = await this.generateMarkdownReport(state);
      } else {
        reportContent = this.generateJsonReport(state);
      }
      
      // 保存报告
      const reportPath = await this.saveReport(reportContent, keyword);
      
      // 计算统计信息
      const generationTimeMs = Date.now() - startTime;
      const wordCount = this.format === 'markdown' 
        ? reportContent.split(/\s+/).length 
        : 0;
      
      const insightsCount = 
        (state.keywordDiscovery?.insights?.length || 0) + 
        (state.contentAnalysis?.marketInsights?.length || 0);
      
      const recommendationsCount = state.contentAnalysis?.concreteUnmetNeeds?.length || 0;
      
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
        },
        executionMetadata: {
          ...state.executionMetadata,
          endTime: Date.now(),
          elapsedTimeMs: Date.now() - (state.executionMetadata?.startTime || startTime),
          completedNodes: [
            ...(state.executionMetadata?.completedNodes || []),
            'reportGeneration'
          ]
        },
        output: {
          success: true,
          timestamp: Date.now(),
          keyword,
          metrics: {
            totalProcessingTimeMs: Date.now() - (state.executionMetadata?.startTime || startTime),
            totalKeywordsDiscovered: state.keywordDiscovery?.discoveredKeywords?.length || 0,
            totalUnmetNeeds: state.contentAnalysis?.unmetNeeds?.filter(n => n.isUnmetNeed).length || 0,
            totalInsights: insightsCount,
            totalOpportunities: 
              (state.contentAnalysis?.concreteUnmetNeeds?.length || 0) + 
              (state.journeySimulation?.opportunities?.length || 0)
          }
        }
      };
    } catch (error) {
      logger.error('ReportAgent execution failed', { error });
      throw error;
    }
  }
} 