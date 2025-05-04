/**
 * IntentAnalyzer - 意图分析器
 * 识别关键词背后的用户意图和价值
 */
import { LLMServiceHub, AnalysisOptions } from '../llm/LLMServiceHub';

// 关键词分类接口
export interface KeywordCategories {
  informational: string[];
  navigational: string[];
  transactional: string[];
  commercial: string[];
  local: string[];
  [key: string]: string[];
}

// 关键词意图分析结果接口
export interface IntentAnalysisResult {
  categories: KeywordCategories;
  intents: Record<string, number>;
  patterns: string[];
  highValueKeywords: string[];
  contentOpportunities: string[];
  intentDistribution: Record<string, number>;
  commercialKeywords: string[];
  bestPatterns: string[];
  insights: string[];
  summary: string;
}

// 意图分析器配置接口
export interface IntentAnalyzerConfig {
  llmService: LLMServiceHub;
  verbose?: boolean;
}

/**
 * IntentAnalyzer是一个用于分析关键词意图的组件
 * 它使用大模型识别用户搜索意图
 */
export class IntentAnalyzer {
  private llmService: LLMServiceHub;
  private verbose: boolean;
  
  constructor(config: IntentAnalyzerConfig) {
    this.llmService = config.llmService;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 初始化完成`);
    }
  }
  
  /**
   * 分析关键词意图
   */
  async analyzeKeywords(keywords: string[]): Promise<IntentAnalysisResult> {
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 开始分析 ${keywords.length} 个关键词的意图`);
    }
    
    // 使用LLM进行意图分析
    const intentAnalysis = await this.llmService.analyze('intent_analysis', {
      keywords,
      task: 'Analyze the search intent behind these keywords'
    }, {
      systemPrompt: 'You are a search intent expert who identifies user intent patterns in search terms.',
      format: 'json'
    });
    
    // 确保结果符合预期格式
    const result: IntentAnalysisResult = {
      categories: intentAnalysis.categories || {},
      intents: intentAnalysis.intents || {},
      patterns: intentAnalysis.patterns || [],
      highValueKeywords: intentAnalysis.highValueKeywords || [],
      contentOpportunities: intentAnalysis.contentOpportunities || [],
      intentDistribution: intentAnalysis.intentDistribution || {},
      commercialKeywords: intentAnalysis.commercialKeywords || [],
      bestPatterns: intentAnalysis.bestPatterns || [],
      insights: intentAnalysis.insights || [],
      summary: intentAnalysis.summary || 'No summary provided'
    };
    
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 意图分析完成，识别到 ${Object.keys(result.intents).length} 种意图类型`);
    }
    
    return result;
  }
  
  /**
   * 提取关键词中的意图指示词
   */
  async extractIntentIndicators(keywords: string[]): Promise<Record<string, string[]>> {
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 提取意图指示词`);
    }
    
    // 使用LLM提取意图指示词
    const indicators = await this.llmService.analyze('extract_intent_indicators', {
      keywords,
      task: 'Extract words that indicate specific user intents in these keywords'
    }, {
      systemPrompt: 'You are a linguistic analyst who identifies intent-signaling words in search queries.',
      format: 'json'
    });
    
    return indicators.intentIndicators || {};
  }
  
  /**
   * 按意图类型筛选关键词
   */
  async filterKeywordsByIntent(keywords: string[], intentType: string): Promise<string[]> {
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 筛选 "${intentType}" 意图的关键词`);
    }
    
    // 使用LLM按意图筛选关键词
    const filtered = await this.llmService.analyze('filter_by_intent', {
      keywords,
      intentType,
      task: `Filter keywords that express ${intentType} intent`
    }, {
      systemPrompt: `You are a search intent specialist focusing on identifying ${intentType} intent in search queries.`,
      format: 'json'
    });
    
    return filtered.keywords || [];
  }
  
  /**
   * 识别关键词的意图转换点
   */
  async identifyIntentShifts(keywordJourney: string[]): Promise<any[]> {
    if (this.verbose) {
      console.info(`[IntentAnalyzer] 识别意图转换点`);
    }
    
    // 使用LLM识别意图转换点
    const shifts = await this.llmService.analyze('identify_intent_shifts', {
      keywordJourney,
      task: 'Identify points where user intent shifts between these sequential keywords'
    }, {
      systemPrompt: 'You are an expert in search behavior who identifies when and why users change their search intent.',
      format: 'json'
    });
    
    return shifts.intentShifts || [];
  }
  
  /**
   * 获取最有价值的关键词
   */
  async getHighValueKeywords(analysisResult: IntentAnalysisResult, count: number = 10): Promise<string[]> {
    // 从已有的分析结果中提取高价值关键词
    if (analysisResult.highValueKeywords && analysisResult.highValueKeywords.length > 0) {
      return analysisResult.highValueKeywords.slice(0, count);
    }
    
    // 如果结果中没有，尝试筛选商业关键词
    if (analysisResult.commercialKeywords && analysisResult.commercialKeywords.length > 0) {
      return analysisResult.commercialKeywords.slice(0, count);
    }
    
    // 如果都没有，返回意图分布靠前的类型
    const intentTypes = Object.entries(analysisResult.intentDistribution)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([intent]) => intent);
    
    if (intentTypes.length > 0 && analysisResult.categories[intentTypes[0]]) {
      return analysisResult.categories[intentTypes[0]].slice(0, count);
    }
    
    return [];
  }
  
  /**
   * 提取关键词模式
   */
  extractPatterns(keywords: string[]): string[] {
    // 简单的模式提取实现
    const patterns: string[] = [];
    const prefixMap: Record<string, number> = {};
    const suffixMap: Record<string, number> = {};
    
    // 分析前缀和后缀
    keywords.forEach(keyword => {
      const words = keyword.split(' ');
      if (words.length > 1) {
        const prefix = words[0];
        const suffix = words[words.length - 1];
        
        prefixMap[prefix] = (prefixMap[prefix] || 0) + 1;
        suffixMap[suffix] = (suffixMap[suffix] || 0) + 1;
      }
    });
    
    // 提取常见前缀模式
    const commonPrefixes = Object.entries(prefixMap)
      .filter(([, count]) => count > 2)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([prefix]) => `${prefix} *`);
    
    // 提取常见后缀模式
    const commonSuffixes = Object.entries(suffixMap)
      .filter(([, count]) => count > 2)
      .sort(([, countA], [, countB]) => countB - countA)
      .map(([suffix]) => `* ${suffix}`);
    
    // 合并模式
    patterns.push(...commonPrefixes.slice(0, 5));
    patterns.push(...commonSuffixes.slice(0, 5));
    
    return patterns;
  }
} 