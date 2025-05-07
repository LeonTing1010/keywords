import { TrendKeywordDiscovery } from '../../domain/discovery/TrendKeywordDiscovery';
import { UserJourneySim, EnhancedUserJourney } from '../../domain/journey/UserJourneySim';
import { ContentAnalyzer } from '../../domain/analysis/content/ContentAnalyzer';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';
import { SearchEngine } from '../../infrastructure/search/engines/SearchEngine';
import { EnhancedWorkflowResult, MarketInsight, UserJourney, ValidationResult, JourneyInsight } from '../../domain/analysis/types/AnalysisTypes';
import { logger } from '../../infrastructure/core/logger';
import { MarkdownReporter, StartupAnalysis } from '../../infrastructure/reporting/MarkdownReporter';
import * as path from 'path';
import * as fs from 'fs';

// 添加未满足需求接口
interface UnmetNeed {
  keyword: string;
  isUnmetNeed: boolean;
  contentQuality: number;
  reason: string;
}

export interface WorkflowControllerConfig {
  searchEngine: SearchEngine;
  llmService: LLMServiceHub;
  maxIterations: number;
  satisfactionThreshold: number;
  analysisDepth: number;
  outputFormat: 'json' | 'markdown';
  enableJourneySim: boolean;
  enableAutocomplete: boolean;
  autocompleteEngine?: string;
  verbose: boolean;
  outputDir: string;
  language: 'zh' | 'en';
  refinementCycles?: number; // 添加迭代循环次数
}

/**
 * 工作流控制器
 * 协调分析流程并管理资源的组件
 */
export class WorkflowController {
  private discovery: TrendKeywordDiscovery;
  private journeySim: UserJourneySim;
  private contentAnalyzer: ContentAnalyzer;
  private config: WorkflowControllerConfig;

  constructor(config: WorkflowControllerConfig) {
    this.config = {
      ...config,
      refinementCycles: config.refinementCycles || 1, // 默认执行一个循环
    };
    this.discovery = new TrendKeywordDiscovery({
      llmService: config.llmService,
      searchEngine: config.searchEngine
    });
    this.journeySim = new UserJourneySim({
      llmService: config.llmService,
      searchEngine: config.searchEngine,
      maxSteps: config.maxIterations,
      verbose: config.verbose
    });
    this.contentAnalyzer = new ContentAnalyzer(
      config.llmService,
      config.searchEngine
    );

    if (config.verbose) {
      logger.info('工作流控制器初始化完成', { config });
    }
  }

  /**
   * 执行完整的分析工作流
   * @param keyword 要分析的关键词
   * @returns 增强的工作流分析结果
   */
  public async executeWorkflow(keyword: string): Promise<EnhancedWorkflowResult> {
    try {
      logger.info('开始执行工作流', { keyword });

      // 初始化结果容器
      let marketInsights: MarketInsight[] = [];
      let userJourneys: (UserJourney | EnhancedUserJourney)[] = [];
      let unmetNeeds: UnmetNeed[] = [];
      let validationResults: ValidationResult[] = [];
      let discoveredKeywords: string[] = [];
      // 新增：存储趋势关键词和市场大方向
      let trendKeywords: string[] = [];
      let directionSummary: string = '';

      // 迭代优化循环
      for (let cycle = 0; cycle < (this.config.refinementCycles || 1); cycle++) {
        logger.info(`开始第 ${cycle + 1} 次优化循环`);
        
        // 1. 关键词发现 - 由SimpleKeywordDiscovery负责
        //    核心职责：挖掘趋势关键词，发现市场大方向
        const discoveryResult = await this.discovery.discoverKeywords(
          keyword,
          cycle > 0 ? { 
            // 后续循环将市场洞察转换为主题，用于精细化关键词
            themes: marketInsights.slice(0, 3).map(i => i.description),
            excludeExisting: discoveredKeywords
          } : undefined
        );
        
        // 更新已发现的关键词
        discoveredKeywords = [...discoveryResult.keywords];
        
        // 获取初始市场洞察（仅在第一次循环）
        if (cycle === 0) {
          marketInsights = discoveryResult.initialInsights || [];
          // 新增：获取趋势关键词和市场大方向
          trendKeywords = discoveryResult.trendKeywords || [];
          directionSummary = discoveryResult.directionSummary || '';
        }
        
        logger.info('关键词发现完成', { 
          count: discoveredKeywords.length,
          initialInsightsCount: discoveryResult.initialInsights?.length || 0,
          trendKeywordsCount: discoveryResult.trendKeywords?.length || 0
        });
        
        // 2. 用户旅程模拟 - 由UserJourneySim负责
        //    核心职责：基于关键词和市场洞察，模拟用户行为，找到痛点和机会
        if (this.config.enableJourneySim) {
          // 传递关键词、相关关键词和市场洞察，增强模拟效果
          // 优先使用趋势关键词进行旅程模拟
          const journeyKeywords = trendKeywords.length > 0 
            ? trendKeywords 
            : discoveredKeywords;
            
          const journeyResult = await this.journeySim.simulateJourney(
            keyword, 
            journeyKeywords,
            marketInsights
          );
          
          userJourneys.push(journeyResult);
          
          logger.info('用户旅程模拟完成', { 
            journeyCount: userJourneys.length,
            insightsCount: journeyResult.insights?.length || 0,
            painPointsCount: journeyResult.painPoints?.length || 0,
            opportunitiesCount: journeyResult.opportunities?.length || 0
          });
        }
        
        // 3. 内容分析 - 由ContentAnalyzer负责
        //    核心职责：整合前面的发现，找到未被满足的具体需求
        const enhancedJourneys = userJourneys as EnhancedUserJourney[];
        
        // 提取用户旅程中的痛点和机会
        const painPoints = enhancedJourneys.flatMap(journey => journey.painPoints || []);
        const opportunities = enhancedJourneys.flatMap(journey => journey.opportunities || []);
        
        // 将前面的分析结果传递给内容分析器，实现整合
        const contentAnalysis = await this.contentAnalyzer.analyzeContent(
          keyword, 
          // 优先分析趋势关键词
          trendKeywords.length > 0 ? trendKeywords : discoveredKeywords,
          painPoints,
          opportunities,
          marketInsights
        );
        
        // 更新市场洞察、未满足需求和验证结果
        marketInsights = contentAnalysis.insights;
        unmetNeeds = contentAnalysis.unmetNeeds;
        validationResults = contentAnalysis.validationResults;
        
        logger.info('内容分析完成', { 
          unmetNeedsCount: unmetNeeds.length,
          insightsCount: marketInsights.length,
          validationResultsCount: validationResults.length
        });
        
        logger.info(`第 ${cycle + 1} 次优化循环完成`);
      }

      // 4. 构建最终的工作流结果
      const result: EnhancedWorkflowResult = {
        keyword,
        discoveredKeywords,
        userJourneys,
        marketInsights,
        validationResults,
        version: '1.0.0',
        generatedAt: new Date().toISOString()
      };

      // 添加未被满足的需求到结果中
      (result as any).unmetNeeds = unmetNeeds;
      
      // 新增：添加趋势关键词和市场大方向到结果中
      (result as any).trendKeywords = trendKeywords;
      (result as any).directionSummary = directionSummary;

      logger.info('工作流执行完成', { 
        keywordsCount: discoveredKeywords.length,
        journeysCount: userJourneys.length,
        insightsCount: marketInsights.length,
        unmetNeedsCount: unmetNeeds.length,
        trendKeywordsCount: trendKeywords.length
      });
      return result;

    } catch (error) {
      logger.error('工作流执行失败', { error });
      throw error;
    }
  }
} 