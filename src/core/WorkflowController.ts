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
import { logger } from './logger';
import { MarkdownReporter } from '../tools/markdownReporter';
import * as path from 'path';
import * as fs from 'fs';

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
  outputDir?: string; // 输出目录
  language?: 'zh' | 'en'; // 报告语言
  generateMarkdownReport?: boolean; // 是否生成Markdown报告
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
  reportPath?: string; // Markdown报告路径
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
  private outputDir: string;
  private language: 'zh' | 'en';
  private config: WorkflowConfig;
  
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
   *   - outputDir: 输出目录
   *   - language: 报告语言
   *   - generateMarkdownReport: 是否生成Markdown报告
   */
  constructor(config: WorkflowConfig) {
    this.searchEngine = config.searchEngine;
    this.llmService = config.llmService;
    this.maxIterations = config.maxIterations;
    this.satisfactionThreshold = config.satisfactionThreshold;
    this.analysisDepth = config.analysisDepth;
    this.outputFormat = config.outputFormat;
    this.verbose = config.verbose;
    this.outputDir = config.outputDir || path.join(process.cwd(), 'output');
    this.language = config.language || 'zh'; // 默认使用中文
    this.config = {...config, generateMarkdownReport: true};
    
    // 确保输出目录存在
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // 初始化日志
    logger.info('初始化工作流控制器', {
      engine: this.searchEngine.getEngineType(),
      iterations: this.maxIterations,
      journeySim: config.enableJourneySim
    });
    
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
        logger.debug('初始化自动补全服务', { engine: engineType });
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
      
      logger.info('工作流控制器初始化完成', { enabledComponents });
    }
  }
  
  /**
   * 执行完整的分析工作流程
   * 
   * @param keyword 主关键词
   * @returns 完整的分析结果
   */
  async executeWorkflow(keyword: string): Promise<WorkflowResult> {
    logger.info('开始执行工作流', { keyword });
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 初始化工作流结果对象
    const result: WorkflowResult = {
      keyword,
      iterations: [],
      discoveredKeywords: [],
      summary: {
        keywordCounts: {
          total: 0,
          byIteration: []
        }
      },
      generatedAt: new Date().toISOString(),
      version: '3.0.0' // 使用简化版本
    };
    
    // 阶段1：执行关键词挖掘
    logger.info('开始关键词挖掘', { keyword });

    // 执行单次查询
    const discoveryResult = await this.discoveryEngine.discover(keyword);

    // 直接使用结果
    result.discoveredKeywords = discoveryResult.allKeywords;
    result.summary.keywordCounts.total = discoveryResult.allKeywords.length;

    // 添加一个虚拟迭代以保持结果格式兼容
    result.iterations.push({
      iterationNumber: 0,
      query: keyword,
      queryType: 'initial',
      discoveries: discoveryResult.allKeywords,
      newDiscoveriesCount: discoveryResult.allKeywords.length,
      satisfactionScore: 1.0
    });

    result.summary.keywordCounts.byIteration = [discoveryResult.allKeywords.length];
    
    // 阶段2：用户旅程模拟与意图分析
    if (this.journeySim) {
      logger.info('开始用户旅程模拟', { keyword });
      result.journeyAnalysis = await this.journeySim.simulateJourney(keyword);
    }
    
    // 阶段3：生成内容推荐
    result.recommendations = await this.generateRecommendations(result);
    
    // 处理报告输出
    const resultFilename = `${keyword.replace(/\s+/g, '_')}_analysis.json`;
    const resultPath = path.join(this.outputDir, resultFilename);
    
    // 保存JSON结果
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    logger.info('分析结果已保存', { path: resultPath });
    
    // 生成Markdown报告（如果配置中启用）
    if (this.config.generateMarkdownReport) {
      try {
        logger.info('开始生成Markdown报告');
        
        // 确保reports目录存在
        const reportsDir = path.join(this.outputDir, 'reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        // 设置报告文件名
        const formattedDate = new Date().toISOString().replace(/[-:T]/g, '_').substring(0, 16); // 20250506_1039
        const safeKeyword = keyword.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 30); // 保留中文并截取前30字符
        const uniqueId = Math.random().toString(36).substring(2, 6); // 随机标识符
        const reportFileName = `AIKR_${safeKeyword}_${formattedDate}_${uniqueId}.md`;
        const reportPath = path.join(reportsDir, reportFileName);
        
        // 实例化Markdown报告生成器
        const reporter = new MarkdownReporter({
          language: this.language,
          theme: 'light',
          outputHtml: true
        });
        
        // 生成报告
        const generatedReportPath = await reporter.generateReport(result, reportPath);
        
        // 更新结果对象，添加报告路径
        result.reportPath = generatedReportPath;
        
        logger.info('Markdown报告生成成功', { path: generatedReportPath });
      } catch (error) {
        logger.error('Markdown报告生成失败', { error });
      }
    }
    
    // 计算总耗时
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('工作流执行完成', { 
      keyword,
      keywordsFound: result.discoveredKeywords.length,
      elapsedTime: `${elapsedTime}s`
    });
    
    return result;
  }

  /**
   * 生成内容推荐
   * @param result 当前工作流结果
   * @returns 推荐对象
   */
  private async generateRecommendations(result: WorkflowResult): Promise<any> {
    logger.info('生成内容推荐');
    
    try {
      // 使用默认推荐器 - 简化实现，仅提供基础推荐
      const recommendations = await this.llmService.analyze('content_recommendations', {
        keyword: result.keyword,
        discoveredKeywords: result.discoveredKeywords.slice(0, 20),
        journey: result.journeyAnalysis
      }, 
      { temperature: 0.7,
        format: 'json'
       });
      
      return recommendations;
    } catch (error) {
      logger.error('生成推荐失败', { error });
      return {
        contentIdeas: [],
        keyFindings: ['无法生成推荐，请检查日志']
      };
    }
  }
}