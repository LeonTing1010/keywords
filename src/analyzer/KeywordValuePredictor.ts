/**
 * KeywordValuePredictor - 关键词价值预测器
 * 评估关键词的商业价值和竞争程度
 */
import { LLMServiceHub, AnalysisOptions } from '../llm/LLMServiceHub';

// 关键词价值接口
export interface KeywordValue {
  keyword: string;
  scores: {
    commercial: number; // 0-1 商业价值
    informational: number; // 0-1 信息价值
    competition: number; // 0-1 竞争程度
    specificity: number; // 0-1 特异性
    conversion: number; // 0-1 转化潜力
    complexity: number; // 0-1 复杂度
  };
  intentType: string;
  commercialIntentSignals: string[];
  recommendedAction: string;
  overallValue: number; // 0-1 综合价值
}

// 价值分析结果接口
export interface ValueAnalysisResult {
  keywords: KeywordValue[];
  summary: {
    averageScores: {
      commercial: number;
      informational: number;
      competition: number;
      specificity: number;
      conversion: number;
      complexity: number;
      overallValue: number;
    };
    valueDistribution: {
      high: string[];
      medium: string[];
      low: string[];
    };
    intentDistribution: Record<string, number>;
    topCommercialKeywords: string[];
    topInformationalKeywords: string[];
    lowCompetitionOpportunities: string[];
  };
}

// 价值预测器配置接口
export interface KeywordValuePredictorConfig {
  llmService: LLMServiceHub;
  commercialThreshold?: number; // 0-1，认为具有商业价值的阈值
  competitionThreshold?: number; // 0-1，认为竞争较低的阈值
  verbose?: boolean;
}

/**
 * KeywordValuePredictor是一个用于评估关键词价值的组件
 * 它可以预测关键词的商业价值、竞争程度和转化潜力
 */
export class KeywordValuePredictor {
  private llmService: LLMServiceHub;
  private commercialThreshold: number;
  private competitionThreshold: number;
  private verbose: boolean;
  
  constructor(config: KeywordValuePredictorConfig) {
    this.llmService = config.llmService;
    this.commercialThreshold = config.commercialThreshold || 0.6;
    this.competitionThreshold = config.competitionThreshold || 0.4;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[KeywordValuePredictor] 初始化完成，商业阈值: ${this.commercialThreshold}, 竞争阈值: ${this.competitionThreshold}`);
    }
  }
  
  /**
   * 预测关键词价值
   */
  async predictValues(keywords: string[]): Promise<ValueAnalysisResult> {
    if (this.verbose) {
      console.info(`[KeywordValuePredictor] 开始预测关键词价值，关键词数量: ${keywords.length}`);
    }
    
    // 使用LLM预测价值
    const valueData = await this.llmService.predictKeywordValue(keywords, {
      format: 'json'
    });
    
    // 计算摘要数据
    const summary = this.generateValueSummary(valueData.keywords);
    
    const result: ValueAnalysisResult = {
      keywords: valueData.keywords,
      summary
    };
    
    if (this.verbose) {
      console.info(`[KeywordValuePredictor] 价值预测完成，平均综合价值: ${summary.averageScores.overallValue.toFixed(2)}`);
    }
    
    return result;
  }
  
  /**
   * 生成价值摘要
   */
  private generateValueSummary(keywordValues: KeywordValue[]): ValueAnalysisResult['summary'] {
    // 计算平均分数
    const averageScores = {
      commercial: this.calculateAverage(keywordValues, 'commercial'),
      informational: this.calculateAverage(keywordValues, 'informational'),
      competition: this.calculateAverage(keywordValues, 'competition'),
      specificity: this.calculateAverage(keywordValues, 'specificity'),
      conversion: this.calculateAverage(keywordValues, 'conversion'),
      complexity: this.calculateAverage(keywordValues, 'complexity'),
      overallValue: keywordValues.reduce((sum, kw) => sum + kw.overallValue, 0) / keywordValues.length
    };
    
    // 按价值分布
    const valueDistribution = {
      high: keywordValues.filter(kw => kw.overallValue >= 0.7).map(kw => kw.keyword),
      medium: keywordValues.filter(kw => kw.overallValue >= 0.4 && kw.overallValue < 0.7).map(kw => kw.keyword),
      low: keywordValues.filter(kw => kw.overallValue < 0.4).map(kw => kw.keyword)
    };
    
    // 计算意图分布
    const intentDistribution: Record<string, number> = {};
    keywordValues.forEach(kw => {
      intentDistribution[kw.intentType] = (intentDistribution[kw.intentType] || 0) + 1;
    });
    
    // 找出高商业价值关键词
    const topCommercialKeywords = keywordValues
      .filter(kw => kw.scores.commercial >= this.commercialThreshold)
      .sort((a, b) => b.scores.commercial - a.scores.commercial)
      .slice(0, 10)
      .map(kw => kw.keyword);
    
    // 找出高信息价值关键词
    const topInformationalKeywords = keywordValues
      .filter(kw => kw.scores.informational >= 0.7)
      .sort((a, b) => b.scores.informational - a.scores.informational)
      .slice(0, 10)
      .map(kw => kw.keyword);
    
    // 找出低竞争机会
    const lowCompetitionOpportunities = keywordValues
      .filter(kw => kw.scores.competition <= this.competitionThreshold && kw.scores.commercial >= this.commercialThreshold)
      .sort((a, b) => (b.scores.commercial - b.scores.competition) - (a.scores.commercial - a.scores.competition))
      .slice(0, 10)
      .map(kw => kw.keyword);
    
    return {
      averageScores,
      valueDistribution,
      intentDistribution,
      topCommercialKeywords,
      topInformationalKeywords,
      lowCompetitionOpportunities
    };
  }
  
  /**
   * 计算平均分数
   */
  private calculateAverage(keywordValues: KeywordValue[], scoreType: keyof KeywordValue['scores']): number {
    return keywordValues.reduce((sum, kw) => sum + kw.scores[scoreType], 0) / keywordValues.length;
  }
  
  /**
   * 按分数类型获取排序关键词
   */
  getKeywordsByScore(result: ValueAnalysisResult, scoreType: keyof KeywordValue['scores'], ascending: boolean = false): string[] {
    // 按指定分数类型排序关键词
    return [...result.keywords]
      .sort((a, b) => {
        const diff = a.scores[scoreType] - b.scores[scoreType];
        return ascending ? diff : -diff;
      })
      .map(kw => kw.keyword);
  }
  
  /**
   * 获取商业机会
   */
  getCommercialOpportunities(result: ValueAnalysisResult): KeywordValue[] {
    // 查找高商业价值、低竞争的关键词
    return result.keywords.filter(kw => 
      kw.scores.commercial >= this.commercialThreshold && 
      kw.scores.competition <= this.competitionThreshold
    );
  }
  
  /**
   * 获取内容机会
   */
  getContentOpportunities(result: ValueAnalysisResult): KeywordValue[] {
    // 查找高信息价值的关键词
    return result.keywords.filter(kw => 
      kw.scores.informational >= 0.7 && 
      kw.scores.specificity >= 0.6
    );
  }
  
  /**
   * 按意图类型分类关键词
   */
  groupKeywordsByIntent(result: ValueAnalysisResult): Record<string, KeywordValue[]> {
    // 按意图分组关键词
    const grouped: Record<string, KeywordValue[]> = {};
    
    result.keywords.forEach(kw => {
      if (!grouped[kw.intentType]) {
        grouped[kw.intentType] = [];
      }
      grouped[kw.intentType].push(kw);
    });
    
    return grouped;
  }
  
  /**
   * 按自定义规则过滤关键词
   */
  filterKeywords(result: ValueAnalysisResult, filterFn: (kw: KeywordValue) => boolean): KeywordValue[] {
    // 使用自定义函数过滤关键词
    return result.keywords.filter(filterFn);
  }
  
  /**
   * 生成价值分析建议
   */
  async generateRecommendations(result: ValueAnalysisResult): Promise<any> {
    if (this.verbose) {
      console.info(`[KeywordValuePredictor] 生成价值分析建议`);
    }
    
    // 使用LLM生成建议
    const recommendations = await this.llmService.analyze('value_recommendations', {
      valueAnalysis: result,
      task: 'Generate strategic recommendations based on keyword value analysis'
    }, {
      systemPrompt: 'You are a keyword strategy advisor who provides actionable recommendations based on value analysis.',
      format: 'json'
    });
    
    return recommendations;
  }
} 