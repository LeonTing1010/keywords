import { LLMService } from './llmService';
import { Logger } from './logger';
import { KeywordCategories, AnalysisPlanResult, IterationHistory } from '../types';
import { config } from '../config';

/**
 * 关键词分析器类
 * 实现关键词分类、评分和策略生成
 */
export class KeywordAnalyzer {
  private llmService: LLMService;
  private logger: Logger;
  
  constructor(llmService?: LLMService) {
    this.llmService = llmService || new LLMService();
    this.logger = new Logger('KeywordAnalyzer');
  }
  
  /**
   * 识别关键词类别
   */
  async identifyKeywordCategories(
    originalKeyword: string, 
    suggestions: string[]
  ): Promise<KeywordCategories> {
    try {
      this.logger.info(`分析 ${suggestions.length} 条关键词以识别类别`);
      
      // 使用LLM进行分类
      const result = await this.llmService.analyzeKeywords(
        originalKeyword,
        suggestions,
        'identify_categories'
      );
      
      this.logger.info(`关键词分类完成，识别到 ${Object.keys(result).length} 个类别`);
      return result;
    } catch (error) {
      this.logger.error(`关键词分类失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // 如果LLM分析失败，尝试使用基本规则进行分类
      return this.fallbackCategorization(suggestions, originalKeyword);
    }
  }
  
  /**
   * 后备分类方法
   */
  private fallbackCategorization(
    suggestions: string[], 
    originalKeyword: string
  ): KeywordCategories {
    this.logger.info('使用基本规则进行关键词分类');
    
    const categories: KeywordCategories = {
      informational: [],
      problemSolving: [],
      commercial: [],
      tutorial: [],
      definitional: []
    };
    
    // 基本分类规则
    for (const suggestion of suggestions) {
      const lower = suggestion.toLowerCase();
      
      // 商业交易类
      if (
        /购买|价格|多少钱|便宜|贵|性价比|哪里买|哪家好|对比|比较|推荐|排名|哪个好|值得买|值不值|cost|price|buy|cheap|best/.test(lower)
      ) {
        categories.commercial?.push(suggestion);
        continue;
      }
      
      // 问题解决类
      if (
        /问题|故障|解决|修复|如何解决|怎么办|不能|失败|错误|不工作|坏了|失效|修理|不了|bug|issue|problem|fix|solve|error|won't|doesn't|fail/.test(lower)
      ) {
        categories.problemSolving?.push(suggestion);
        continue;
      }
      
      // 教程指南类
      if (
        /如何|怎么|教程|指南|步骤|方法|使用|操作|入门|技巧|how to|guide|tutorial|step|method|way to/.test(lower)
      ) {
        categories.tutorial?.push(suggestion);
        continue;
      }
      
      // 定义解释类
      if (
        /是什么|含义|定义|意思|概念|区别|difference|what is|definition|vs|versus/.test(lower)
      ) {
        categories.definitional?.push(suggestion);
        continue;
      }
      
      // 默认为信息查询类
      categories.informational?.push(suggestion);
    }
    
    this.logger.info(`基本分类完成: 信息查询(${categories.informational?.length})，问题解决(${categories.problemSolving?.length})，商业交易(${categories.commercial?.length})，教程指南(${categories.tutorial?.length})，定义解释(${categories.definitional?.length})`);
    
    return categories;
  }
  
  /**
   * 提取查询模式
   */
  async extractQueryPatterns(
    originalKeyword: string, 
    suggestions: string[]
  ): Promise<string[]> {
    try {
      this.logger.info(`从 ${suggestions.length} 条建议中提取查询模式`);
      
      // 使用LLM提取模式
      const result = await this.llmService.analyzeKeywords(
        originalKeyword,
        suggestions,
        'extract_patterns'
      );
      
      if (result.patterns && Array.isArray(result.patterns)) {
        this.logger.info(`成功提取 ${result.patterns.length} 个查询模式`);
        return result.patterns;
      }
      
      return this.extractBasicPatterns(suggestions);
    } catch (error) {
      this.logger.error(`提取查询模式失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.extractBasicPatterns(suggestions);
    }
  }
  
  /**
   * 基本模式提取
   */
  private extractBasicPatterns(suggestions: string[]): string[] {
    const patterns = new Set<string>();
    
    // 提取常见前缀和后缀
    const prefixes = new Set<string>();
    const suffixes = new Set<string>();
    
    for (const suggestion of suggestions) {
      const words = suggestion.split(/\s+/);
      if (words.length >= 2) {
        prefixes.add(words[0].toLowerCase());
        suffixes.add(words[words.length - 1].toLowerCase());
      }
    }
    
    // 识别问题模式
    const questionPatterns = suggestions
      .filter(s => /如何|怎么|为什么|是否|可以|能否/.test(s))
      .map(s => {
        const match = s.match(/(如何|怎么|为什么|是否|可以|能否)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    
    questionPatterns.forEach(p => patterns.add(`问题词: ${p}`));
    
    // 识别商业模式
    const commercialPatterns = suggestions
      .filter(s => /购买|价格|多少钱|对比|推荐|哪个好/.test(s))
      .map(s => {
        const match = s.match(/(购买|价格|多少钱|对比|推荐|哪个好)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    
    commercialPatterns.forEach(p => patterns.add(`商业词: ${p}`));
    
    // 添加前缀和后缀模式
    if (prefixes.size > 0) {
      patterns.add(`常见前缀: ${Array.from(prefixes).slice(0, 5).join(', ')}`);
    }
    
    if (suffixes.size > 0) {
      patterns.add(`常见后缀: ${Array.from(suffixes).slice(0, 5).join(', ')}`);
    }
    
    return Array.from(patterns);
  }
  
  /**
   * 生成战略查询
   */
  async generateStrategicQueries(
    originalKeyword: string, 
    suggestions: string[]
  ): Promise<string[]> {
    try {
      this.logger.info(`为 "${originalKeyword}" 生成战略查询`);
      
      // 使用LLM生成查询
      const result = await this.llmService.analyzeKeywords(
        originalKeyword,
        suggestions,
        'generate_queries'
      );
      
      if (result.queries && Array.isArray(result.queries)) {
        this.logger.info(`成功生成 ${result.queries.length} 个战略查询`);
        return result.queries;
      }
      
      if (result.recommendedQueries && Array.isArray(result.recommendedQueries)) {
        this.logger.info(`成功生成 ${result.recommendedQueries.length} 个战略查询`);
        return result.recommendedQueries;
      }
      
      return this.generateBasicStrategicQueries(originalKeyword, suggestions);
    } catch (error) {
      this.logger.error(`生成战略查询失败: ${error instanceof Error ? error.message : String(error)}`);
      return this.generateBasicStrategicQueries(originalKeyword, suggestions);
    }
  }
  
  /**
   * 基本战略查询生成
   */
  private generateBasicStrategicQueries(
    originalKeyword: string, 
    suggestions: string[]
  ): string[] {
    const queries = new Set<string>();
    
    // 1. 添加基本组合
    const basicModifiers = [
      '如何', '教程', '问题', '指南', 
      '购买', '价格', '推荐', '对比',
      '是什么', '定义', '原理'
    ];
    
    basicModifiers.forEach(modifier => {
      queries.add(`${originalKeyword} ${modifier}`);
    });
    
    // 2. 分析建议提取高频词
    const words = new Map<string, number>();
    
    suggestions.forEach(suggestion => {
      suggestion.split(/\s+/).forEach(word => {
        const lower = word.toLowerCase();
        if (lower.length > 1 && !originalKeyword.toLowerCase().includes(lower)) {
          words.set(lower, (words.get(lower) || 0) + 1);
        }
      });
    });
    
    // 排序并获取前5个高频词
    const topWords = Array.from(words.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    // 添加高频词组合
    topWords.forEach(word => {
      queries.add(`${originalKeyword} ${word}`);
    });
    
    // 随机组合两个高频词添加到查询
    if (topWords.length >= 2) {
      for (let i = 0; i < topWords.length - 1; i++) {
        for (let j = i + 1; j < topWords.length; j++) {
          queries.add(`${originalKeyword} ${topWords[i]} ${topWords[j]}`);
        }
      }
    }
    
    this.logger.info(`生成了 ${queries.size} 个基本战略查询`);
    return Array.from(queries);
  }
  
  /**
   * 评分关键词价值
   * 返回0-10的分数，10为最高价值
   */
  scoreKeywordValue(keyword: string, originalKeyword: string): number {
    let score = 0;
    const lowerKeyword = keyword.toLowerCase();
    const lowerOriginal = originalKeyword.toLowerCase();
    
    // 1. 词长评分 - 更长的关键词可能包含更多信息
    const wordCount = keyword.split(/\s+/).length;
    score += Math.min(wordCount * 1.5, 4); // 最多4分
    
    // 2. 商业意图评分 - 包含购买相关词汇
    if (/购买|价格|对比|推荐|最佳|哪个好/.test(lowerKeyword)) {
      score += 2.5;
    }
    
    // 3. 问题评分 - 问题型关键词通常产生更有价值的长尾结果
    if (/如何|怎么|为什么|是否|可以|能否/.test(lowerKeyword)) {
      score += 2;
    }
    
    // 4. 具体性评分 - 包含具体描述或修饰词
    if (/最[好佳新快慢贵便]/i.test(lowerKeyword) || /详细|高级|专业|入门|进阶/.test(lowerKeyword)) {
      score += 1.5;
    }
    
    // 5. 差异性评分 - 与原始关键词的不同程度
    if (!lowerKeyword.includes(lowerOriginal) && !lowerOriginal.includes(lowerKeyword)) {
      score += 1;
    }
    
    // 6. 特定专业词汇分数 - 包含领域专业术语
    if (/api|sdk|框架|技术|原理|机制|算法/.test(lowerKeyword)) {
      score += 1;
    }
    
    // 确保分数在0-10范围内
    return Math.min(Math.max(score, 0), 10);
  }
  
  /**
   * 选择高价值关键词
   */
  selectHighValueKeywords(
    categories: KeywordCategories, 
    originalKeyword: string, 
    count: number = 10
  ): string[] {
    this.logger.info(`从分类结果中选择 ${count} 个高价值关键词`);
    
    // 合并所有类别的关键词
    const allKeywords: Array<{keyword: string; category: string; score: number}> = [];
    
    Object.entries(categories).forEach(([category, keywords]) => {
      if (keywords && Array.isArray(keywords)) {
        keywords.forEach(keyword => {
          const score = this.scoreKeywordValue(keyword, originalKeyword);
          allKeywords.push({ keyword, category, score });
        });
      }
    });
    
    // 根据得分排序
    allKeywords.sort((a, b) => b.score - a.score);
    
    // 选择前N个
    const selected = allKeywords.slice(0, count).map(item => item.keyword);
    
    this.logger.info(`已选择 ${selected.length} 个高价值关键词`);
    return selected;
  }
  
  /**
   * 规划下一次迭代
   * 分析当前关键词，识别模式和空缺，生成下一轮查询策略
   */
  async planNextIteration(
    originalKeyword: string, 
    currentKeywords: string[],
    iterationHistory: IterationHistory[] = []
  ): Promise<AnalysisPlanResult> {
    try {
      this.logger.info(`规划下一次迭代查询，当前已有 ${currentKeywords.length} 个关键词，历史迭代 ${iterationHistory.length} 轮`);
      
      // 如果启用了LLM，则使用它生成下一轮查询策略
      return await this.llmService.generateNextIterationStrategy(
        originalKeyword,
        currentKeywords,
        iterationHistory
      );
    } catch (error) {
      this.logger.error(`规划下一次迭代失败: ${error instanceof Error ? error.message : String(error)}`);
      // 如果LLM失败，使用基本的迭代规划
      return this.createBasicIterationPlan(originalKeyword, currentKeywords);
    }
  }
  
  /**
   * 创建基本迭代计划
   */
  private createBasicIterationPlan(
    originalKeyword: string, 
    currentKeywords: string[]
  ): AnalysisPlanResult {
    // 分析当前关键词，识别可能的模式和空缺
    const categories = this.fallbackCategorization(currentKeywords, originalKeyword);
    
    // 识别缺失类别
    const gaps = [];
    
    if (!categories.commercial || categories.commercial.length < 5) {
      gaps.push('商业意图关键词不足');
    }
    
    if (!categories.problemSolving || categories.problemSolving.length < 5) {
      gaps.push('问题解决类关键词不足');
    }
    
    if (!categories.tutorial || categories.tutorial.length < 5) {
      gaps.push('教程指南类关键词不足');
    }
    
    // 创建查询推荐
    const recommendedQueries = [];
    
    // 根据空缺添加查询
    if (gaps.includes('商业意图关键词不足')) {
      recommendedQueries.push(`${originalKeyword} 价格`);
      recommendedQueries.push(`${originalKeyword} 购买`);
      recommendedQueries.push(`${originalKeyword} 推荐`);
    }
    
    if (gaps.includes('问题解决类关键词不足')) {
      recommendedQueries.push(`${originalKeyword} 问题`);
      recommendedQueries.push(`${originalKeyword} 解决`);
    }
    
    if (gaps.includes('教程指南类关键词不足')) {
      recommendedQueries.push(`${originalKeyword} 如何`);
      recommendedQueries.push(`${originalKeyword} 教程`);
    }
    
    // 确保有足够的查询
    while (recommendedQueries.length < 5) {
      const randomModifiers = ['优点', '缺点', '区别', '对比', '排名', '用途', '原理', '步骤', '实例'];
      const randomModifier = randomModifiers[Math.floor(Math.random() * randomModifiers.length)];
      
      const query = `${originalKeyword} ${randomModifier}`;
      if (!recommendedQueries.includes(query)) {
        recommendedQueries.push(query);
      }
    }
    
    return {
      gaps,
      patterns: [`用户在搜索${originalKeyword}时倾向于查询${gaps.length > 0 ? gaps[0].replace('不足', '') : '信息'}`],
      targetGoals: gaps.map(gap => `增加${gap.replace('不足', '')}的覆盖`),
      recommendedQueries
    };
  }
} 