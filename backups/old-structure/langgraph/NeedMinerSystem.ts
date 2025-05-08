/**
 * NeedMinerSystem.ts - LangGraph多Agent系统主接口
 * 整合所有组件，提供给CLI和其他外部调用
 */
import { GraphStateType } from './state/schema';
import { createKeywordAnalysisGraph, createFastKeywordAnalysisGraph, KeywordAnalysisGraphConfig } from './graph/KeywordAnalysisGraph';
import { logger } from '../infrastructure/core/logger';
import { BaiduSearchEngine } from '../infrastructure/search/engines/BaiduSearchEngine';
import { LLMServiceHub } from '../infrastructure/llm/LLMServiceHub';

/**
 * NeedMiner系统配置
 */
export interface NeedMinerSystemConfig {
  outputDir?: string;
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
  verbose?: boolean;
  modelName?: string;
  enableJourneySim?: boolean;
  enableDetailsInReport?: boolean;
  searchEngine?: any;
  llmService?: any;
}

/**
 * 关键词分析选项
 */
export interface AnalyzeKeywordOptions {
  fast?: boolean;
  includeDetails?: boolean;
  maxRetries?: number;
  maxKeywords?: number;
}

/**
 * 批量分析选项
 */
export interface BatchAnalyzeOptions extends AnalyzeKeywordOptions {
  concurrentLimit?: number;
}

/**
 * NeedMiner系统 - 基于LangGraph的多Agent实现
 * 提供统一的对外接口
 */
export class NeedMinerSystem {
  private config: NeedMinerSystemConfig;
  private searchEngine: any;
  private llmService: any;
  
  constructor(config: NeedMinerSystemConfig = {}) {
    this.config = {
      outputDir: './output',
      format: 'markdown',
      language: 'zh',
      verbose: false,
      modelName: process.env.LLM_MODEL || 'gpt-4',
      enableJourneySim: true,
      enableDetailsInReport: false,
      ...config
    };
    
    // 初始化搜索引擎
    this.searchEngine = config.searchEngine || new BaiduSearchEngine();
    
    // 初始化LLM服务
    this.llmService = config.llmService || new LLMServiceHub({
      model: this.config.modelName
    });
    
    logger.info('NeedMinerSystem initialized', {
      format: this.config.format,
      language: this.config.language,
      modelName: this.llmService.getModelName()
    });
  }
  
  /**
   * 分析单个关键词
   */
  public async analyzeKeyword(
    keyword: string, 
    options: AnalyzeKeywordOptions = {}
  ): Promise<any> {
    try {
      logger.info('Starting keyword analysis', { keyword, options });
      
      // 图配置
      const graphConfig: KeywordAnalysisGraphConfig = {
        outputDir: this.config.outputDir,
        format: this.config.format,
        language: this.config.language,
        enableJourneySim: options.fast ? false : this.config.enableJourneySim,
        enableDetailsInReport: options.includeDetails || this.config.enableDetailsInReport,
        fastMode: options.fast || false
      };
      
      // 创建工作流图
      const graph = options.fast 
        ? createFastKeywordAnalysisGraph(graphConfig)
        : createKeywordAnalysisGraph(graphConfig);
      
      // 准备初始状态
      const initialState = {
        input: {
          keyword,
          options: {
            includeDetails: options.includeDetails || false,
            fast: options.fast || false,
            maxKeywords: options.maxKeywords,
            maxRetries: options.maxRetries
          }
        },
        executionMetadata: {
          startTime: Date.now(),
          currentNode: 'start',
          errors: [],
          completedNodes: [],
          nodeDecisions: {}
        }
      };
      
      // 执行工作流
      logger.debug('Executing workflow graph', { initialState });
      
      // 使用修改后的调用方式
      const result = await graph.invoke(initialState.input);
      
      // 处理结果
      if (result.output) {
        logger.info('Keyword analysis completed', { 
          keyword, 
          reportPath: result.reportGeneration?.reportPath,
          elapsedTimeMs: result.executionMetadata?.elapsedTimeMs
        });
        
        // 返回处理后的结果
        return {
          keyword,
          reportPath: result.reportGeneration?.reportPath,
          format: result.reportGeneration?.format,
          metrics: result.output.metrics,
          success: result.output.success
        };
      } else {
        throw new Error('Workflow execution failed to produce output');
      }
    } catch (error: unknown) {
      logger.error('Failed to analyze keyword', { 
        keyword, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }
  
  /**
   * 批量分析多个关键词
   */
  public async batchAnalyzeKeywords(
    keywords: string[],
    options: BatchAnalyzeOptions = {}
  ): Promise<any[]> {
    const concurrentLimit = options.concurrentLimit || 1;
    const results: any[] = [];
    
    logger.info('Starting batch keyword analysis', { 
      keywordCount: keywords.length,
      concurrentLimit,
      options
    });
    
    if (concurrentLimit === 1) {
      // 串行执行
      for (const keyword of keywords) {
        try {
          const result = await this.analyzeKeyword(keyword, options);
          results.push(result);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error in batch processing keyword', { keyword, error: errorMessage });
          results.push({
            keyword,
            success: false,
            error: errorMessage
          });
        }
      }
    } else {
      // 并行执行，但控制并发数
      for (let i = 0; i < keywords.length; i += concurrentLimit) {
        const batch = keywords.slice(i, i + concurrentLimit);
        const batchPromises = batch.map(keyword => 
          this.analyzeKeyword(keyword, options)
            .catch((error: unknown) => {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error('Error in parallel batch processing', { keyword, error: errorMessage });
              return {
                keyword,
                success: false,
                error: errorMessage
              };
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
    }
    
    logger.info('Batch analysis completed', { 
      totalKeywords: keywords.length,
      successCount: results.filter(r => r.success).length
    });
    
    return results;
  }
  
  /**
   * 获取系统配置
   */
  public getConfig(): NeedMinerSystemConfig {
    return { ...this.config };
  }
  
  /**
   * 更新系统配置
   */
  public updateConfig(newConfig: Partial<NeedMinerSystemConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    logger.info('NeedMinerSystem config updated', { 
      newConfig,
      currentConfig: this.config
    });
  }
  
  /**
   * 获取LLM服务实例
   */
  public getLLMService(): any {
    return this.llmService;
  }
  
  /**
   * 获取搜索引擎实例
   */
  public getSearchEngine(): any {
    return this.searchEngine;
  }
}

/**
 * 快速创建一个NeedMiner系统实例
 */
export function createNeedMinerSystem(config: NeedMinerSystemConfig = {}): NeedMinerSystem {
  return new NeedMinerSystem(config);
} 