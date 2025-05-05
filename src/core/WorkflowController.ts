/**
 * WorkflowController - 工作流控制器
 * 协调各模块的执行流程，控制整体分析过程
 * 
 * 核心流程:
 * 1. 关键词挖掘 - 发现相关长尾关键词（已简化）
 * 2. 用户旅程模拟 - 模拟完整搜索路径和意图变化（包含动态意图分析）
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { UserJourneySim } from '../journey/UserJourneySim';
import { SimpleKeywordDiscovery } from '../discovery/SimpleKeywordDiscovery';
import { AutocompleteService } from '../journey/AutocompleteService';
import { AutocompleteParameters, DEFAULT_AUTOCOMPLETE_PARAMETERS } from '../journey/AutocompleteParameters';
import { AutocompleteEvaluator } from '../journey/AutocompleteEvaluator';

// 工作流配置接口
export interface WorkflowConfig {
  searchEngine: SearchEngine;
  llmService: LLMServiceHub;
  maxIterations: number;
  satisfactionThreshold: number;
  analysisDepth: number;
  outputFormat: string;
  enableJourneySim: boolean;
  enableAutocomplete?: boolean; // 默认为true
  autocompleteEngine?: string; // 自动补全搜索引擎(默认与searchEngine相同)
  verbose: boolean;
}

// 工作流结果接口
export interface WorkflowResult {
  keyword: string;
  iterations: {
    iterationNumber: number;
    query: string;
    queryType: string;
    discoveries: string[];
    newDiscoveriesCount: number;
    satisfactionScore: number;
  }[];
  discoveredKeywords: string[];
  journeyAnalysis?: any; // 包含动态意图分析
  recommendations?: any;
  summary: {
    keywordCounts: {
      total: number;
      byIteration: number[];
    };
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
  private journeySim: UserJourneySim | null = null;
  private discoveryEngine: SimpleKeywordDiscovery; // 使用简化版挖掘器
  private autocompleteService: AutocompleteService | null = null; // 自动补全服务
  
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
   *   - enableJourneySim: 是否启用用户旅程模拟
   *   - enableAutocomplete: 是否启用自动补全功能
   *   - autocompleteEngine: 自动补全使用的搜索引擎
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
    
    // 初始化简单关键词挖掘器
    this.discoveryEngine = new SimpleKeywordDiscovery({
      searchEngine: this.searchEngine,
      verbose: this.verbose
    });
    
    // 根据配置初始化自动补全服务
    if (config.enableAutocomplete !== false) {
      const engineType = config.autocompleteEngine || this.searchEngine.getEngineType();
      this.autocompleteService = new AutocompleteService({
        defaultEngine: this.searchEngine,
        verbose: this.verbose
      });
      
      if (this.verbose) {
        console.info(`[WorkflowController] 初始化自动补全服务，使用引擎: ${engineType}`);
      }
    }
    
    // 根据配置初始化各组件
    if (config.enableJourneySim) {
      const journeySimConfig: any = {
        llmService: this.llmService,
        searchEngine: this.searchEngine,
        verbose: this.verbose
      };
      
      // 如果启用了自动补全，将自动补全服务添加到配置中
      if (this.autocompleteService) {
        journeySimConfig.autocompleteService = this.autocompleteService;
        journeySimConfig.autocompleteParams = DEFAULT_AUTOCOMPLETE_PARAMETERS;
      }
      
      this.journeySim = new UserJourneySim(journeySimConfig);
    }
    
    if (this.verbose) {
      const enabledComponents = [];
      if (config.enableJourneySim) {
        enabledComponents.push('JourneySim');
      }
      if (config.enableAutocomplete !== false) {
        enabledComponents.push('Autocomplete');
      }
      
      console.info(`[WorkflowController] 初始化完成，启用的组件: ${enabledComponents.join(', ') || '无'}`);
    }
  }
  
 
  
  /**
   * 执行完整的分析工作流
   * 
   * 该方法按顺序执行以下步骤:
   * 1. 关键词挖掘 - 使用简单挖掘器发现相关关键词
   * 2. 用户旅程模拟 - 模拟完整搜索路径和意图变化（包含动态意图分析）
   * 
   * @param keyword 初始关键词
   * @returns 完整的分析结果对象
   */
  async executeWorkflow(keyword: string): Promise<WorkflowResult> {
    if (this.verbose) {
      console.info(`[WorkflowController] 开始关键词分析工作流，关键词: "${keyword}"`);
    }
    
    const startTime = Date.now();
    
    // 步骤1: 关键词挖掘 (使用简化版挖掘器)
    console.info(`[WorkflowController] 步骤1/2: 执行关键词挖掘`);
    const discoveryResult = await this.discoveryEngine.discover(keyword);
    
    // 提取所有发现的关键词
    const allKeywords = discoveryResult.allKeywords;
    
    if (this.verbose) {
      console.info(`[WorkflowController] 关键词挖掘完成，发现 ${allKeywords.length} 个关键词`);
    }
    
    // 初始化结果对象
    const result: WorkflowResult = {
      keyword,
      iterations: discoveryResult.iterations.map(it => ({
        iterationNumber: discoveryResult.iterations.indexOf(it),
        query: it.query,
        queryType: it.query === keyword ? 'initial' : 'refined',
        discoveries: it.discoveries,
        newDiscoveriesCount: it.discoveries.length,
        satisfactionScore: 1.0
      })),
      discoveredKeywords: allKeywords,
      summary: {
        keywordCounts: {
          total: allKeywords.length,
          byIteration: discoveryResult.iterations.map(it => it.discoveries.length)
        }
      },
      generatedAt: new Date().toISOString(),
      version: '3.0.0'
    };
    
    // 步骤2: 进行用户旅程模拟 (仅对主关键词)
    if (this.journeySim) {
      console.info(`[WorkflowController] 步骤2/2: 执行用户旅程模拟（包含动态意图分析）`);
      result.journeyAnalysis = await this.journeySim.simulateJourney(keyword);
      
      if (this.verbose) {
        console.info(`[WorkflowController] 用户旅程模拟完成，共 ${result.journeyAnalysis.steps.length} 个步骤`);
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