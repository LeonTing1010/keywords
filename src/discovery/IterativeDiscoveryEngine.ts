/**
 * IterativeDiscoveryEngine - 迭代式发现引擎
 * 通过多轮智能迭代，持续优化挖掘策略，发现高价值长尾关键词
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

// 迭代引擎配置接口
export interface IterativeDiscoveryEngineConfig {
  searchEngine: SearchEngine;
  llmService: LLMServiceHub;
  maxIterations?: number;
  satisfactionThreshold?: number;
  verbose?: boolean;
}

// 迭代结果接口
export interface IterationResult {
  iterationNumber: number;
  query: string;
  queryType: 'initial' | 'refined';
  discoveries: string[];
  newDiscoveriesCount: number;
  satisfactionScore: number;
  analysis?: string;
  recommendedQueries?: string[];
}

// 发现结果接口
export interface DiscoveryResult {
  keyword: string;
  iterations: IterationResult[];
  allKeywords: string[];
  summary: {
    totalKeywords: number;
    uniqueKeywords: number;
    keywordsPerIteration: number[];
    averageSatisfaction: number;
    completionReason: string;
  };
}

/**
 * IterativeDiscoveryEngine是一个用于迭代式关键词挖掘的组件
 * 通过多轮迭代，持续优化挖掘策略，发现高价值长尾关键词
 */
export class IterativeDiscoveryEngine {
  private searchEngine: SearchEngine;
  private llmService: LLMServiceHub;
  private maxIterations: number;
  private satisfactionThreshold: number;
  private verbose: boolean;
  private discoveredKeywords: Set<string> = new Set();
  private iterations: IterationResult[] = [];
  
  constructor(config: IterativeDiscoveryEngineConfig) {
    this.searchEngine = config.searchEngine;
    this.llmService = config.llmService;
    this.maxIterations = config.maxIterations || 5;
    this.satisfactionThreshold = config.satisfactionThreshold || 0.85;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 初始化完成，最大迭代: ${this.maxIterations}, 满意度阈值: ${this.satisfactionThreshold}`);
    }
  }
  
  /**
   * 发现关键词
   */
  async discover(keyword: string): Promise<DiscoveryResult> {
    // 重置状态
    this.discoveredKeywords = new Set();
    this.iterations = [];
    
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 开始发现过程，初始关键词: "${keyword}"`);
    }
    
    // 检查缓存
    const cacheResult = this.checkCache(keyword);
    if (cacheResult) {
      if (this.verbose) {
        console.info(`[IterativeDiscoveryEngine] 使用缓存结果，共 ${cacheResult.allKeywords.length} 个关键词`);
      }
      return cacheResult;
    }
    
    // 执行初始查询
    await this.performInitialDiscovery(keyword);
    
    // 执行迭代查询
    let iterationCount = 0;
    let completionReason = '达到最大迭代次数';
    
    while (iterationCount < this.maxIterations) {
      iterationCount++;
      
      if (this.verbose) {
        console.info(`[IterativeDiscoveryEngine] 执行第 ${iterationCount} 次迭代`);
      }
      
      // 计划下一轮迭代查询
      const nextQuery = await this.planNextIteration(keyword, iterationCount);
      
      // 执行迭代查询
      const iterationResult = await this.executeIteration(nextQuery, iterationCount);
      
      // 保存迭代结果
      this.iterations.push(iterationResult);
      
      // 检查是否达到满意度阈值
      if (iterationResult.satisfactionScore >= this.satisfactionThreshold && iterationCount >= 3) {
        completionReason = '达到满意度阈值';
        break;
      }
      
      // 检查是否有新发现
      if (iterationResult.newDiscoveriesCount === 0 && iterationCount >= 3) {
        completionReason = '无新发现';
        break;
      }
    }
    
    // 构建结果
    const result: DiscoveryResult = {
      keyword,
      iterations: this.iterations,
      allKeywords: Array.from(this.discoveredKeywords),
      summary: {
        totalKeywords: this.discoveredKeywords.size,
        uniqueKeywords: this.discoveredKeywords.size,
        keywordsPerIteration: this.iterations.map(it => it.discoveries.length),
        averageSatisfaction: this.calculateAverageSatisfaction(),
        completionReason
      }
    };
    
    // 缓存结果
    this.cacheResult(keyword, result);
    
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 发现过程完成，共 ${result.allKeywords.length} 个关键词，原因: ${completionReason}`);
    }
    
    return result;
  }
  
  /**
   * 执行初始发现
   */
  private async performInitialDiscovery(keyword: string): Promise<void> {
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 执行初始查询: "${keyword}"`);
    }
    
    try {
      // 获取搜索建议
      const suggestionsResponse = await this.searchEngine.getSuggestions(keyword);
      
      // 将响应转换为字符串数组
      const suggestions = this.extractSuggestionsAsStrings(suggestionsResponse);
      
      // 添加到已发现关键词集合
      suggestions.forEach(kw => this.discoveredKeywords.add(kw));
      
      // 记录初始迭代结果
      this.iterations.push({
        iterationNumber: 0,
        query: keyword,
        queryType: 'initial',
        discoveries: suggestions,
        newDiscoveriesCount: suggestions.length,
        satisfactionScore: 1.0, // 初始查询默认满意度为1.0
        analysis: '初始查询'
      });
      
      if (this.verbose) {
        console.info(`[IterativeDiscoveryEngine] 初始查询发现 ${suggestions.length} 个关键词`);
      }
    } catch (error) {
      console.error(`[IterativeDiscoveryEngine] 初始查询失败: ${error}`);
      throw error;
    }
  }
  
  /**
   * 计划下一轮迭代
   */
  private async planNextIteration(keyword: string, iterationNumber: number): Promise<string> {
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 规划第 ${iterationNumber} 次迭代查询`);
    }
    
    try {
      // 准备关键词样本
      const keywordSample = this.getKeywordSample();
      
      // 使用LLM规划下一轮迭代
      const planResult = await this.llmService.analyze('plan_next_iteration', {
        originalKeyword: keyword,
        iterationNumber,
        keywordSample,
        currentTotalKeywords: this.discoveredKeywords.size,
        task: 'Plan the next iteration query to maximize keyword diversity and value'
      }, {
        systemPrompt: 'You are a keyword discovery strategist who plans optimal queries to find valuable and diverse keywords.',
        format: 'json'
      });
      
      // 提取推荐查询
      if (planResult.recommendedQueries && planResult.recommendedQueries.length > 0) {
        const nextQuery = planResult.recommendedQueries[0];
        
        if (this.verbose) {
          console.info(`[IterativeDiscoveryEngine] 选择查询: "${nextQuery}"`);
        }
        
        return nextQuery;
      }
    } catch (error) {
      console.error(`[IterativeDiscoveryEngine] 规划查询失败: ${error}`);
    }
    
    // 默认策略：使用预定义的变种
    const variants = ['how', 'best', 'tutorial', 'problems', 'compare'];
    const nextQuery = `${keyword} ${variants[iterationNumber % variants.length]}`;
    
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 使用默认查询: "${nextQuery}"`);
    }
    
    return nextQuery;
  }
  
  /**
   * 执行迭代
   */
  private async executeIteration(query: string, iterationNumber: number): Promise<IterationResult> {
    if (this.verbose) {
      console.info(`[IterativeDiscoveryEngine] 执行查询: "${query}"`);
    }
    
    try {
      // 获取搜索建议
      const suggestionsResponse = await this.searchEngine.getSuggestions(query);
      
      // 将响应转换为字符串数组
      const suggestions = this.extractSuggestionsAsStrings(suggestionsResponse);
      
      // 计算新发现的关键词
      const newDiscoveries = suggestions.filter(kw => !this.discoveredKeywords.has(kw));
      
      // 添加到已发现关键词集合
      newDiscoveries.forEach(kw => this.discoveredKeywords.add(kw));
      
      // 计算满意度分数
      const satisfactionScore = Math.min(
        newDiscoveries.length / Math.max(config.iterativeEngine?.minNewKeywordsPerIteration || 10, 1),
        1.0
      );
      
      if (this.verbose) {
        console.info(`[IterativeDiscoveryEngine] 发现 ${suggestions.length} 个关键词，其中 ${newDiscoveries.length} 个新关键词，满意度: ${satisfactionScore.toFixed(2)}`);
      }
      
      // 分析迭代结果
      let analysis = `第 ${iterationNumber} 次迭代发现 ${newDiscoveries.length} 个新关键词`;
      let recommendedQueries: string[] | undefined = undefined;
      
      // 对于较大的新发现，使用LLM进行分析
      if (newDiscoveries.length >= 5) {
        try {
          const analysisResult = await this.llmService.analyze('evaluate_iteration', {
            originalKeyword: query,
            newKeywords: newDiscoveries,
            iterationNumber,
            task: 'Evaluate the quality and diversity of these new keywords'
          }, {
            systemPrompt: 'You are a keyword analyst who evaluates keyword quality, diversity, and commercial value.',
            format: 'json'
          });
          
          analysis = analysisResult.analysis || analysis;
          recommendedQueries = analysisResult.recommendedQueries;
        } catch (error) {
          console.error(`[IterativeDiscoveryEngine] 分析迭代结果失败: ${error}`);
        }
      }
      
      // 返回迭代结果
      return {
        iterationNumber,
        query,
        queryType: 'refined',
        discoveries: suggestions,
        newDiscoveriesCount: newDiscoveries.length,
        satisfactionScore,
        analysis,
        recommendedQueries
      };
    } catch (error) {
      console.error(`[IterativeDiscoveryEngine] 执行查询失败: ${error}`);
      
      // 返回空结果
      return {
        iterationNumber,
        query,
        queryType: 'refined',
        discoveries: [],
        newDiscoveriesCount: 0,
        satisfactionScore: 0,
        analysis: `查询失败: ${error}`
      };
    }
  }
  
  /**
   * 从搜索引擎响应中提取字符串格式的建议
   */
  private extractSuggestionsAsStrings(suggestionsResponse: any): string[] {
    // 如果响应已经是字符串数组，直接返回
    if (Array.isArray(suggestionsResponse) && typeof suggestionsResponse[0] === 'string') {
      return suggestionsResponse;
    }
    
    // 如果响应是特定对象格式，例如包含 suggestions 属性
    if (suggestionsResponse && suggestionsResponse.suggestions) {
      return suggestionsResponse.suggestions;
    }
    
    // 如果响应包含完整性或其他类型，尝试提取文本
    if (Array.isArray(suggestionsResponse)) {
      return suggestionsResponse.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        if (item && typeof item.suggestion === 'string') return item.suggestion;
        // 使用JSON字符串化作为备用方案
        return typeof item === 'object' ? JSON.stringify(item) : String(item);
      });
    }
    
    // 如果无法解析，返回空数组
    console.warn('[IterativeDiscoveryEngine] 无法从响应中提取建议，返回空数组');
    return [];
  }
  
  /**
   * 获取关键词样本
   */
  private getKeywordSample(): string[] {
    const allKeywords = Array.from(this.discoveredKeywords);
    const sampleSize = Math.min(20, allKeywords.length);
    
    if (sampleSize === 0) {
      return [];
    }
    
    // 创建多样性样本
    const sample: string[] = [];
    
    // 25% 最长关键词
    const longKeywords = [...allKeywords].sort((a, b) => b.length - a.length);
    const longKeywordCount = Math.floor(sampleSize * 0.25);
    sample.push(...longKeywords.slice(0, longKeywordCount));
    
    // 25% 含商业词的关键词
    const commercialIndicators = ['buy', 'price', 'cost', 'review', 'best', 'vs', 'compare'];
    const commercialKeywords = allKeywords.filter(kw => 
      commercialIndicators.some(indicator => kw.toLowerCase().includes(indicator))
    );
    const commercialKeywordCount = Math.floor(sampleSize * 0.25);
    sample.push(...commercialKeywords.slice(0, commercialKeywordCount));
    
    // 剩余随机选择
    const remaining = allKeywords.filter(kw => !sample.includes(kw));
    const shuffled = remaining.sort(() => 0.5 - Math.random());
    const remainingCount = sampleSize - sample.length;
    sample.push(...shuffled.slice(0, remainingCount));
    
    return sample;
  }
  
  /**
   * 计算平均满意度
   */
  private calculateAverageSatisfaction(): number {
    if (this.iterations.length <= 1) {
      return 1.0;
    }
    
    // 排除初始迭代
    const refinedIterations = this.iterations.filter(it => it.queryType === 'refined');
    
    if (refinedIterations.length === 0) {
      return 1.0;
    }
    
    const sum = refinedIterations.reduce((total, it) => total + it.satisfactionScore, 0);
    return sum / refinedIterations.length;
  }
  
  /**
   * 检查缓存
   */
  private checkCache(keyword: string): DiscoveryResult | null {
    const cacheDir = path.join(process.cwd(), 'output', 'cache');
    const cacheFile = path.join(cacheDir, `discovery_${encodeURIComponent(keyword)}.json`);
    
    if (fs.existsSync(cacheFile)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        const cacheAge = Date.now() - cacheData.timestamp;
        
        // 缓存有效期为24小时
        if (cacheAge <= 24 * 60 * 60 * 1000) {
          return cacheData.result;
        }
      } catch (error) {
        console.error(`[IterativeDiscoveryEngine] 读取缓存失败: ${error}`);
      }
    }
    
    return null;
  }
  
  /**
   * 缓存结果
   */
  private cacheResult(keyword: string, result: DiscoveryResult): void {
    const cacheDir = path.join(process.cwd(), 'output', 'cache');
    
    // 确保缓存目录存在
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheFile = path.join(cacheDir, `discovery_${encodeURIComponent(keyword)}.json`);
    
    try {
      fs.writeFileSync(cacheFile, JSON.stringify({
        timestamp: Date.now(),
        result
      }));
    } catch (error) {
      console.error(`[IterativeDiscoveryEngine] 写入缓存失败: ${error}`);
    }
  }
} 