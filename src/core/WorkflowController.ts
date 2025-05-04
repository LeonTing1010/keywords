/**
 * WorkflowController - 工作流控制器
 * 协调各模块的执行流程，控制整体分析过程
 * 
 * 核心流程:
 * 1. 关键词挖掘 - 发现相关长尾关键词
 * 2. 意图分析 - 识别用户真实搜索意图
 * 3. 领域专家分析 - 提供垂直行业专业视角
 * 4. 用户旅程模拟 - 模拟完整搜索路径和意图变化
 * 5. 综合分析 - 跨域关联和价值评估
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { IntentAnalyzer } from '../intent/IntentAnalyzer';
import { DomainExpertSystem } from '../domain/DomainExpertSystem';
import { UserJourneySim } from '../journey/UserJourneySim';
import { CrossDomainAnalyzer } from '../analyzer/CrossDomainAnalyzer';
import { KeywordValuePredictor } from '../analyzer/KeywordValuePredictor';
import { IterativeDiscoveryEngine, IterativeDiscoveryEngineConfig } from '../discovery/IterativeDiscoveryEngine';

// 工作流配置接口
export interface WorkflowConfig {
  searchEngine: SearchEngine;
  llmService: LLMServiceHub;
  maxIterations: number;
  satisfactionThreshold: number;
  analysisDepth: number;
  outputFormat: string;
  enableDomainExpert: boolean;
  enableJourneySim: boolean;
  enableCrossDomain: boolean;
  enableValuePredict: boolean;
  enableIntentAnalysis: boolean;
  verbose: boolean;
}

// 工作流结果接口
export interface WorkflowResult {
  keyword: string;
  iterations: any[];
  discoveredKeywords: string[];
  intentAnalysis?: any;
  domainAnalysis?: any;
  journeyAnalysis?: any;
  crossDomainAnalysis?: any;
  valueAnalysis?: any;
  recommendations?: any;
  summary: {
    keywordCounts: {
      total: number;
      byIteration: number[];
      byDomain?: Record<string, number>;
      byIntent?: Record<string, number>;
    };
    intentCounts: {
      total: number;
      byType?: Record<string, number>;
    };
    averageValueScore: number;
    dominantDomains?: string[];
    dominantIntents?: string[];
    topOpportunities?: string[];
  };
  generatedAt: string;
  version: string;
}

/**
 * WorkflowController是一个控制整体分析流程的组件
 * 
 * 该类负责:
 * - 协调多个分析模块的执行顺序和数据流转
 * - 管理分析过程的状态和结果整合
 * - 确保各组件正确初始化和资源释放
 * - 提供统一的分析入口和结果格式
 */
export class WorkflowController {
  private searchEngine: SearchEngine;
  private llmService: LLMServiceHub;
  private intentAnalyzer: IntentAnalyzer | null = null;
  private domainExpert: DomainExpertSystem | null = null;
  private journeySim: UserJourneySim | null = null;
  private crossDomainAnalyzer: CrossDomainAnalyzer | null = null;
  private valuePredictor: KeywordValuePredictor | null = null;
  private discoveryEngine: IterativeDiscoveryEngine;
  
  private maxIterations: number;
  private satisfactionThreshold: number;
  private analysisDepth: number;
  private outputFormat: string;
  private verbose: boolean;
  
  /**
   * 创建工作流控制器实例
   * 
   * @param config 工作流配置对象，包含以下内容：
   *   - searchEngine: 搜索引擎实例，用于关键词发现
   *   - llmService: LLM服务实例，用于AI分析
   *   - maxIterations: 最大迭代次数
   *   - satisfactionThreshold: 满意度阈值，决定迭代何时停止
   *   - analysisDepth: 分析深度，影响各分析模块的处理深度
   *   - outputFormat: 输出格式(json, markdown, csv)
   *   - enableXXX: 各功能模块的开关
   *   - verbose: 是否输出详细日志
   */
  constructor(config: WorkflowConfig) {
    this.searchEngine = config.searchEngine;
    this.llmService = config.llmService;
    this.maxIterations = config.maxIterations;
    this.satisfactionThreshold = config.satisfactionThreshold;
    this.analysisDepth = config.analysisDepth;
    this.outputFormat = config.outputFormat;
    this.verbose = config.verbose;
    
    // 初始化迭代发现引擎
    this.discoveryEngine = new IterativeDiscoveryEngine({
      searchEngine: this.searchEngine,
      llmService: this.llmService,
      maxIterations: this.maxIterations,
      satisfactionThreshold: this.satisfactionThreshold,
      verbose: this.verbose
    });
    
    // 根据配置初始化各组件
    if (config.enableIntentAnalysis) {
      this.intentAnalyzer = new IntentAnalyzer({
        llmService: this.llmService,
        verbose: this.verbose
      });
    }
    
    if (config.enableDomainExpert) {
      this.domainExpert = new DomainExpertSystem({
        llmService: this.llmService,
        verbose: this.verbose
      });
    }
    
    if (config.enableJourneySim) {
      this.journeySim = new UserJourneySim({
        llmService: this.llmService,
        searchEngine: this.searchEngine,
        verbose: this.verbose
      });
    }
    
    if (config.enableCrossDomain) {
      this.crossDomainAnalyzer = new CrossDomainAnalyzer({
        llmService: this.llmService,
        domainExpert: this.domainExpert || undefined,
        verbose: this.verbose
      });
    }
    
    if (config.enableValuePredict) {
      this.valuePredictor = new KeywordValuePredictor({
        llmService: this.llmService,
        verbose: this.verbose
      });
    }
    
    if (this.verbose) {
      console.info(`[WorkflowController] 初始化完成，启用的组件: ${[
        config.enableIntentAnalysis ? 'IntentAnalyzer' : '',
        config.enableDomainExpert ? 'DomainExpert' : '',
        config.enableJourneySim ? 'JourneySim' : '',
        config.enableCrossDomain ? 'CrossDomainAnalyzer' : '',
        config.enableValuePredict ? 'ValuePredictor' : ''
      ].filter(Boolean).join(', ')}`);
    }
  }
  
  /**
   * 执行完整的分析工作流
   * 
   * 该方法按顺序执行以下步骤:
   * 1. 关键词挖掘 - 发现相关长尾关键词
   * 2. 意图分析 - 识别用户真实搜索意图
   * 3. 领域专家分析 - 提供垂直行业专业视角
   * 4. 用户旅程模拟 - 模拟完整搜索路径和意图变化
   * 5. 综合分析 - 跨域关联和价值评估
   * 
   * @param keyword 初始关键词
   * @returns 完整的分析结果对象
   */
  async executeWorkflow(keyword: string): Promise<WorkflowResult> {
    if (this.verbose) {
      console.info(`[WorkflowController] 开始关键词分析工作流，关键词: "${keyword}"`);
    }
    
    const startTime = Date.now();
    
    // 步骤1: 关键词挖掘
    console.info(`[WorkflowController] 步骤1/5: 执行关键词挖掘`);
    const discoveryResult = await this.discoveryEngine.discover(keyword);
    
    // 提取所有发现的关键词
    const allKeywords = this.getAllDiscoveredKeywords(discoveryResult);
    
    if (this.verbose) {
      console.info(`[WorkflowController] 关键词挖掘完成，发现 ${allKeywords.length} 个关键词`);
    }
    
    // 初始化结果对象
    const result: WorkflowResult = {
      keyword,
      iterations: discoveryResult.iterations,
      discoveredKeywords: allKeywords,
      summary: {
        keywordCounts: {
          total: allKeywords.length,
          byIteration: discoveryResult.iterations.map(it => it.discoveries.length)
        },
        intentCounts: {
          total: 0
        },
        averageValueScore: 0
      },
      generatedAt: new Date().toISOString(),
      version: '3.0.0'
    };
    
    // 步骤2: 意图分析
    if (this.intentAnalyzer) {
      console.info(`[WorkflowController] 步骤2/5: 执行意图分析`);
      result.intentAnalysis = await this.intentAnalyzer.analyzeKeywords(allKeywords);
      result.summary.intentCounts = {
        total: Object.keys(result.intentAnalysis.intents).length,
        byType: this.countIntentsByType(result.intentAnalysis)
      };
      result.summary.dominantIntents = this.getDominantIntents(result.intentAnalysis);
      
      if (this.verbose) {
        console.info(`[WorkflowController] 意图分析完成，识别到 ${result.summary.intentCounts.total} 种意图类型`);
      }
    }
    
    // 步骤3: 领域分析
    if (this.domainExpert) {
      console.info(`[WorkflowController] 步骤3/5: 执行领域分析`);
      const domains = await this.domainExpert.identifyDomain(allKeywords);
      const domainKeywords = await this.domainExpert.classifyKeywordsByDomain(allKeywords);
      
      result.domainAnalysis = {
        domains,
        keywordsByDomain: domainKeywords
      };
      
      result.summary.keywordCounts.byDomain = this.countKeywordsByDomain(domainKeywords);
      result.summary.dominantDomains = this.getDominantDomains(domainKeywords);
      
      if (this.verbose) {
        console.info(`[WorkflowController] 领域分析完成，识别到 ${domains.length} 个领域`);
      }
    }
    
    // 步骤4: 进行用户旅程模拟 (仅对主关键词)
    if (this.journeySim) {
      console.info(`[WorkflowController] 步骤4/5: 执行用户旅程模拟`);
      result.journeyAnalysis = await this.journeySim.simulateJourney(keyword);
      
      if (this.verbose) {
        console.info(`[WorkflowController] 用户旅程模拟完成，共 ${result.journeyAnalysis.steps.length} 个步骤`);
      }
    }
    
    // 步骤5: 综合分析
    console.info(`[WorkflowController] 步骤5/5: 执行综合分析`);
    
    // 跨域分析
    if (this.crossDomainAnalyzer && result.domainAnalysis) {
      const domains = result.domainAnalysis.domains.map((d: any) => d.name);
      result.crossDomainAnalysis = await this.crossDomainAnalyzer.analyzeRelations(allKeywords, domains);
      
      if (this.verbose) {
        console.info(`[WorkflowController] 跨域分析完成，发现 ${result.crossDomainAnalysis.relations.length} 个领域关系`);
      }
    }
    
    // 价值预测
    if (this.valuePredictor) {
      result.valueAnalysis = await this.valuePredictor.predictValues(allKeywords);
      result.summary.averageValueScore = result.valueAnalysis.summary.averageScores.overallValue;
      result.summary.topOpportunities = result.valueAnalysis.summary.lowCompetitionOpportunities;
      
      if (this.verbose) {
        console.info(`[WorkflowController] 价值预测完成，平均价值: ${result.summary.averageValueScore.toFixed(2)}`);
      }
    }
    
    // 生成综合建议
    if (this.llmService) {
      result.recommendations = await this.generateRecommendations(result);
    }
    
    const duration = (Date.now() - startTime) / 1000;
    console.info(`[WorkflowController] 工作流完成，耗时: ${duration.toFixed(1)}秒`);
    
    return result;
  }
  
  /**
   * 获取所有发现的关键词
   * 
   * 从所有迭代结果中提取并去重关键词
   * 
   * @param discoveryResult 发现引擎的结果
   * @returns 所有唯一的关键词数组
   */
  private getAllDiscoveredKeywords(discoveryResult: any): string[] {
    const allKeywords = new Set<string>();
    
    // 从各个迭代中收集关键词
    discoveryResult.iterations.forEach((iteration: any) => {
      iteration.discoveries.forEach((keyword: string) => {
        allKeywords.add(keyword);
      });
    });
    
    return Array.from(allKeywords);
  }
  
  /**
   * 统计意图类型分布
   * 
   * 计算各种意图类型的关键词数量
   * 
   * @param intentAnalysis 意图分析结果
   * @returns 意图类型及对应数量的映射
   */
  private countIntentsByType(intentAnalysis: any): Record<string, number> {
    const counts: Record<string, number> = {};
    
    Object.values(intentAnalysis.intents).forEach((intent: any) => {
      const intentType = intent.type;
      counts[intentType] = (counts[intentType] || 0) + 1;
    });
    
    return counts;
  }
  
  /**
   * 获取主导意图
   * 
   * 根据数量排序，取前几个最主要的意图类型
   * 
   * @param intentAnalysis 意图分析结果
   * @returns 主要意图类型数组
   */
  private getDominantIntents(intentAnalysis: any): string[] {
    const intentCounts = this.countIntentsByType(intentAnalysis);
    
    // 按数量排序并取前3个
    return Object.entries(intentCounts)
      .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
      .map(([intent]) => intent)
      .slice(0, 3);
  }
  
  /**
   * 统计各领域的关键词数量
   * 
   * @param domainKeywords 按领域分类的关键词
   * @returns 各领域及其关键词数量的映射
   */
  private countKeywordsByDomain(domainKeywords: Record<string, string[]>): Record<string, number> {
    const counts: Record<string, number> = {};
    
    Object.entries(domainKeywords).forEach(([domain, keywords]) => {
      counts[domain] = keywords.length;
    });
    
    return counts;
  }
  
  /**
   * 获取主导领域
   * 
   * 根据关键词数量排序，取前几个最主要的领域
   * 
   * @param domainKeywords 按领域分类的关键词
   * @returns 主要领域数组
   */
  private getDominantDomains(domainKeywords: Record<string, string[]>): string[] {
    // 按关键词数量排序并取前3个
    return Object.entries(domainKeywords)
      .sort(([, keywordsA], [, keywordsB]) => keywordsB.length - keywordsA.length)
      .map(([domain]) => domain)
      .slice(0, 3);
  }
  
  /**
   * 生成综合建议
   * 
   * 使用LLM生成基于所有分析结果的综合建议
   * 
   * @param result 完整的工作流结果
   * @returns 建议对象
   */
  private async generateRecommendations(result: WorkflowResult): Promise<any> {
    if (this.verbose) {
      console.info(`[WorkflowController] 生成综合建议`);
    }
    
    // 使用LLM生成综合建议
    const recommendations = await this.llmService.analyze('workflow_recommendations', {
      result,
      task: 'Generate comprehensive recommendations based on the complete analysis'
    }, {
      systemPrompt: 'You are a strategic advisor who provides actionable insights based on comprehensive keyword analysis.',
      format: 'json'
    });
    
    return recommendations;
  }
} 