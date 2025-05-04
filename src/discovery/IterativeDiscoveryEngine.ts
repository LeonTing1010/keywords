/**
 * KeywordNova 迭代发现引擎
 * 核心关键词挖掘组件
 */
import { SearchEngine } from '../providers/SearchEngine';
import { LLMService } from '../intent/LLMService';
import { IntentAnalyzer } from '../intent/IntentAnalyzer';
import { 
  SearchOptions, 
  DiscoveryResult,
  IterationHistory,
  IterationResult,
  AnalysisPlanResult,
  IntentAnalysisResult
} from '../types';
import { config } from '../config';
import { ErrorType, AppError, handleError } from '../core/errorHandler';
import { CheckpointService, DiscoveryCheckpoint } from '../core/checkpointService';

/**
 * 迭代发现引擎
 * 通过多轮迭代查询发现长尾关键词
 */
export class IterativeDiscoveryEngine {
  private searchEngine: SearchEngine;
  private llmService: LLMService | null = null;
  private intentAnalyzer: IntentAnalyzer | null = null;
  private discoveredKeywords: Set<string> = new Set();
  private iterationHistory: IterationHistory[] = [];
  private checkpointService: CheckpointService | null = null;

  /**
   * 创建迭代发现引擎实例
   * @param searchEngine 搜索引擎实例
   */
  constructor(searchEngine: SearchEngine) {
    this.searchEngine = searchEngine;
  }

  /**
   * 开始关键词发现过程
   * @param initialKeyword 初始关键词
   * @param options 搜索选项
   * @returns 发现结果
   */
  async startDiscovery(
    initialKeyword: string, 
    options: SearchOptions
  ): Promise<DiscoveryResult> {
    this.discoveredKeywords = new Set();
    this.iterationHistory = [];
    
    // 初始化检查点服务
    this.checkpointService = new CheckpointService(initialKeyword);
    
    // 检查是否存在检查点，如果有则恢复状态
    const checkpoint = this.checkpointService.hasCheckpoint() ? 
      this.checkpointService.restoreCheckpoint() : null;
    
    if (checkpoint) {
      console.log(`[发现] 从检查点恢复，已完成 ${checkpoint.lastCompletedIteration} 次迭代`);
      // 恢复状态
      this.discoveredKeywords = new Set(checkpoint.discoveredKeywords);
      this.iterationHistory = checkpoint.iterationHistory;
    }
    
    // 初始化LLM服务（如果启用）
    if (options.useLLM) {
      // 如果提供了模型名称，更新 config
      if (options.llmModel) {
        console.info(`[发现] LLM模型: ${options.llmModel}`);
      }
      
      // 直接使用 config 创建 LLMService，不传递额外参数
      this.llmService = new LLMService();
      this.intentAnalyzer = new IntentAnalyzer(this.llmService);
    }
    
    // 确定迭代参数
    const maxIterations = options.maxIterations || config.iterativeEngine.maxIterations;
    const baseThreshold = options.satisfactionThreshold || 
      config.iterativeEngine.defaultSatisfactionThreshold;
    const minForcedIterations = config.iterativeEngine.minForcedIterations || 3;
    
    // 使用动态阈值设置
    const useDynamicThreshold = config.iterativeEngine.dynamicThreshold?.enabled || false;
    const initialThreshold = config.iterativeEngine.dynamicThreshold?.initial || baseThreshold;
    const finalThreshold = config.iterativeEngine.dynamicThreshold?.final || baseThreshold;
    const thresholdDecayRate = config.iterativeEngine.dynamicThreshold?.decayRate || 0.05;
    
    // 如果没有检查点，执行初始查询
    if (!checkpoint) {
      console.log(`[发现] 执行初始查询: "${initialKeyword}"`);
      let currentKeywords: string[] = [];
      
      try {
        // 执行初始搜索
        const initialSuggestions = await this.searchEngine.getSuggestions(initialKeyword, options);
        currentKeywords = initialSuggestions.suggestions;
        
        // 添加到已发现关键词集合
        currentKeywords.forEach(keyword => this.discoveredKeywords.add(keyword));
        
        console.log(`[发现] 初始查询发现 ${currentKeywords.length} 个关键词`);
        
        // 记录初始迭代历史
        this.iterationHistory.push({
          iterationNumber: 0,
          query: initialKeyword,
          queryType: 'initial',
          keywords: [...currentKeywords],
          newKeywordsCount: currentKeywords.length,
          satisfactionScore: 1.0, // 初始查询默认满意度为1.0
          analysis: 'Initial query',
          recommendedQueries: []
        });
        
        // 保存初始检查点
        this.saveCheckpoint(initialKeyword, 0);
      } catch (error) {
        handleError(error);
        throw new AppError(
          `初始查询失败: ${(error as Error).message}`,
          ErrorType.UNKNOWN,
          error as Error
        );
      }
    }
    
    let queryType: 'initial' | 'iteration' = 'iteration';
    let currentQuery = initialKeyword;
    
    try {
      // 执行迭代查询
      let iterationCount = checkpoint ? checkpoint.lastCompletedIteration : 0;
      let continueFetching = true;
      
      while (iterationCount < maxIterations && continueFetching) {
        iterationCount++;
        console.log(`\n[发现] 执行迭代 #${iterationCount}`);
        
        // 确定下一轮查询
        if (this.intentAnalyzer && this.llmService) {
          try {
            // 使用LLM分析规划下一轮查询
            const planResult = await this.planNextIteration(
              initialKeyword,
              Array.from(this.discoveredKeywords),
              iterationCount
            );
            
            // 重新设计查询选择逻辑，确保多样性
            if (planResult.recommendedQueries.length > 0) {
              // 选择策略：考虑领域均衡和句式多样性
              // 通过domain rotation plan选择下一轮查询
              if (planResult.domainRotationPlan && planResult.domainRotationPlan.excessiveFocus) {
                // 如果检测到领域严重不平衡，选择与主导领域不同的查询
                const nonDominantQueries = planResult.recommendedQueries.filter(query => {
                  const dominantDomain = planResult.domainRotationPlan?.dominantDomain || '';
                  return !query.toLowerCase().includes(dominantDomain.toLowerCase());
                });
                
                if (nonDominantQueries.length > 0) {
                  // 使用非主导领域的查询
                  currentQuery = nonDominantQueries[0];
                  console.log(`[发现] 选择非主导领域查询: "${currentQuery}" (领域均衡策略)`);
                } else {
                  // 如果找不到非主导领域的查询，使用推荐的查询
                  currentQuery = planResult.recommendedQueries[0];
                  console.log(`[发现] 选择推荐查询: "${currentQuery}" (找不到非主导领域查询)`);
                }
              } else if (iterationCount <= 2) {
                // 早期迭代：选择最多样的查询，关注广度
                // 使用索引轮换，确保我们不会重复使用建议列表中的相同位置
                const index = (iterationCount - 1) % planResult.recommendedQueries.length;
                currentQuery = planResult.recommendedQueries[index];
                console.log(`[发现] 早期迭代选择查询 #${index+1}: "${currentQuery}" (优先广度)`);
              } else if (iterationCount < maxIterations - 1) {
                // 中期迭代：平衡广度和深度
                // 识别与前几轮查询不同领域的查询
                const previousQueries = this.iterationHistory
                  .filter(h => h.iterationNumber > 0)
                  .map(h => h.query.toLowerCase());
                
                // 查找领域差异最大的查询
                // 简单启发式：挑选关键词前缀不同的查询
                const diverseQuery = planResult.recommendedQueries.find(query => {
                  const queryPrefix = query.split(' ')[0].toLowerCase();
                  return !previousQueries.some(pq => pq.includes(queryPrefix));
                });
                
                if (diverseQuery) {
                  currentQuery = diverseQuery;
                  console.log(`[发现] 中期迭代选择多样化查询: "${currentQuery}" (平衡广深)`);
                } else {
                  // 如果找不到差异明显的查询，使用推荐列表的第二个查询（避免总是使用第一个）
                  const index = Math.min(1, planResult.recommendedQueries.length - 1);
                  currentQuery = planResult.recommendedQueries[index];
                  console.log(`[发现] 中期迭代选择查询 #${index+1}: "${currentQuery}"`);
                }
              } else {
                // 后期迭代：专注于高潜力查询，偏向深度
                // 使用LLM认为最有价值的查询（通常是第一个推荐）
                currentQuery = planResult.recommendedQueries[0];
                console.log(`[发现] 后期迭代选择最高价值查询: "${currentQuery}" (优先深度)`);
              }
            } else {
              // 使用初始关键词加变种
              currentQuery = `${initialKeyword} best`;
              console.log(`[发现] 使用默认查询: "${currentQuery}"`);
            }
          } catch (error) {
            console.error(`[发现] 规划下一轮查询失败: ${(error as Error).message}`);
            // 使用备选查询策略
            const variants = ['how', 'best', 'tutorial', 'problems', 'compare'];
            currentQuery = `${initialKeyword} ${variants[iterationCount % variants.length]}`;
            console.log(`[发现] 使用备用查询策略: "${currentQuery}"`);
          }
        } else {
          // 不使用LLM分析，使用简单变种
          const variants = ['how', 'best', 'tutorial', 'problems', 'compare'];
          currentQuery = `${initialKeyword} ${variants[iterationCount % variants.length]}`;
          console.log(`[发现] 使用默认变种查询: "${currentQuery}"`);
        }
        
        try {
          // 执行迭代查询
          const iterationResult = await this.executeIteration(currentQuery, options);
          const newKeywords = iterationResult.allSuggestions;
          
          // 计算新发现的关键词
          const newDiscoveredKeywords = newKeywords.filter(
            keyword => !this.discoveredKeywords.has(keyword)
          );
          
          // 添加新关键词到发现集合
          newDiscoveredKeywords.forEach(keyword => this.discoveredKeywords.add(keyword));
          
          // 分析关键词多样性，检测是否集中在单一领域
          const domainFocusCheck = this.analyzeDomainFocus(newDiscoveredKeywords, currentQuery);
          if (domainFocusCheck.excessiveFocus) {
            console.warn(`[发现] 警告：当前关键词集中在 "${domainFocusCheck.dominantDomain}" 领域 (${domainFocusCheck.focusPercentage.toFixed(1)}%)，下轮将强制选择不同领域`);
          }
          
          // 计算满意度分数
          let satisfactionScore = newDiscoveredKeywords.length / 
            Math.max(config.iterativeEngine.minNewKeywordsPerIteration, 1);
          satisfactionScore = Math.min(satisfactionScore, 1.0);
          
          // 创建当前迭代分析
          let iterationAnalysis = `发现 ${newDiscoveredKeywords.length} 个新关键词`;
          let recommendedQueries: string[] = [];
          
          // 如果启用了LLM分析，评估迭代结果
          if (this.intentAnalyzer && this.llmService) {
            try {
              const evaluationResult = await this.intentAnalyzer.evaluateIteration(
                initialKeyword,
                newDiscoveredKeywords,
                iterationCount,
                [`Discover long-tail keywords`, `Increase coverage for ${initialKeyword} related areas`]
              );
              
              // 使用评估结果更新满意度
              satisfactionScore = evaluationResult.overallScore / 10;
              iterationAnalysis = evaluationResult.analysis;
              
              // 获取下一轮推荐查询
              const planResult = await this.planNextIteration(
                initialKeyword,
                Array.from(this.discoveredKeywords),
                iterationCount + 1
              );
              recommendedQueries = planResult.recommendedQueries;
              
              // 计算当前迭代的动态阈值
              let currentThreshold = baseThreshold;
              if (useDynamicThreshold) {
                // 线性插值计算当前迭代的阈值
                const progress = Math.min(iterationCount / maxIterations, 1);
                currentThreshold = initialThreshold - (initialThreshold - finalThreshold) * progress;
                console.log(`[发现] 迭代 #${iterationCount} 使用动态阈值: ${currentThreshold.toFixed(2)}`);
              }
              
              // 调整是否继续迭代
              // 1. 未达到最小强制迭代次数时强制继续
              // 2. 满意度低于阈值且评估建议继续时继续
              continueFetching = 
                iterationCount < minForcedIterations || 
                (satisfactionScore < currentThreshold && evaluationResult.recommendContinue);
              
              // 如果强制继续，记录原因
              if (iterationCount < minForcedIterations && satisfactionScore >= currentThreshold) {
                console.log(`[发现] 满意度已达 ${(satisfactionScore * 100).toFixed(1)}%，但未达最小迭代次数(${minForcedIterations})，将继续迭代`);
              }
            } catch (error) {
              console.error(`[发现] LLM分析评估失败: ${(error as Error).message}`);
              // 评估失败时使用默认满意度计算
              // 仍然遵循最小强制迭代逻辑
              continueFetching = 
                iterationCount < minForcedIterations || 
                (satisfactionScore < baseThreshold && 
                 newDiscoveredKeywords.length >= config.iterativeEngine.minNewKeywordsPerIteration);
            }
          } else {
            // 没有LLM分析时基于新发现关键词数量决定是否继续
            continueFetching = 
              iterationCount < minForcedIterations || 
              (satisfactionScore < baseThreshold && 
               newDiscoveredKeywords.length >= config.iterativeEngine.minNewKeywordsPerIteration);
          }
          
          // 记录迭代历史
          this.iterationHistory.push({
            iterationNumber: iterationCount,
            query: currentQuery,
            queryType: 'iteration',
            queryResults: iterationResult.queryResults,
            keywords: newDiscoveredKeywords,
            newKeywordsCount: newDiscoveredKeywords.length,
            satisfactionScore,
            analysis: iterationAnalysis,
            recommendedQueries
          });
          
          console.log(`[发现] 迭代 #${iterationCount} 完成。新发现关键词: ${newDiscoveredKeywords.length}`);
          console.log(`[发现] 满意度评分: ${(satisfactionScore * 100).toFixed(1)}%`);
          
          // 保存当前迭代的检查点
          this.saveCheckpoint(initialKeyword, iterationCount, {
            satisfactionScore,
            lastQuery: currentQuery,
            recommendedQueries
          });
          
          // 如果已达到最大迭代次数或没有新关键词，停止迭代
          if (iterationCount >= maxIterations || newDiscoveredKeywords.length === 0) {
            if (iterationCount >= maxIterations) {
              console.log(`[发现] 已达到最大迭代次数(${maxIterations})，停止迭代`);
            } else if (newDiscoveredKeywords.length === 0) {
              console.log(`[发现] 未发现新关键词，停止迭代`);
            }
            continueFetching = false;
          }
        } catch (error) {
          console.error(`[发现] 迭代 #${iterationCount} 执行失败: ${(error as Error).message}`);
          console.log(`[发现] 已保存检查点，可以重新启动程序继续执行`);
          // 不会抛出异常，可以重新从检查点开始
          throw error;
        }
      }
      
      // 转换为结果对象
      const allKeywords = Array.from(this.discoveredKeywords);
      
      console.log(`[发现] 关键词发现完成，共 ${allKeywords.length} 个关键词，${this.iterationHistory.length - 1} 次迭代`);
      
      // 生成发现结果
      const discoveryResult: DiscoveryResult = {
        originalKeyword: initialKeyword,
        totalIterations: this.iterationHistory.length - 1, // 不计算初始查询
        totalKeywordsDiscovered: allKeywords.length,
        keywordsByIteration: {},
        satisfactionByIteration: {},
        keywords: allKeywords,
        highValueKeywords: [],
        intentAnalysis: null,
        iterationHistory: this.iterationHistory,
        summary: `执行了 ${this.iterationHistory.length - 1} 次迭代，发现了 ${allKeywords.length} 个关键词`
      };
      
      // 添加每次迭代的关键词
      this.iterationHistory.forEach(iteration => {
        discoveryResult.keywordsByIteration[iteration.iterationNumber] = iteration.keywords;
        discoveryResult.satisfactionByIteration[iteration.iterationNumber] = iteration.satisfactionScore;
      });
      
      // 如果启用了LLM分析，生成最终分析报告
      if (this.intentAnalyzer && this.llmService) {
        try {
          console.log(`[发现] 生成最终意图分析报告...`);
          const finalAnalysis = await this.intentAnalyzer.generateFinalReport(
            initialKeyword,
            allKeywords,
            this.iterationHistory
          );
          discoveryResult.intentAnalysis = finalAnalysis;
          discoveryResult.highValueKeywords = finalAnalysis.highValueKeywords;
          discoveryResult.summary = finalAnalysis.summary;
        } catch (error) {
          console.error(`[发现] 生成最终分析报告失败: ${(error as Error).message}`);
        }
      }
      
      // 清除检查点文件，因为已经成功完成
      if (this.checkpointService) {
        this.checkpointService.clearCheckpoint();
      }
      
      return discoveryResult;
    } catch (error) {
      handleError(error);
      
      // 如果有创建检查点，尝试从检查点生成部分结果
      if (this.checkpointService && this.checkpointService.hasCheckpoint()) {
        const checkpoint = this.checkpointService.restoreCheckpoint();
        
        if (checkpoint) {
          console.log(`[发现] 从检查点恢复部分结果数据`);
          return this.checkpointService.createResultFromCheckpoint(checkpoint);
        }
      }
      
      throw new AppError(
        `关键词发现过程失败: ${(error as Error).message}`,
        ErrorType.UNKNOWN,
        error as Error
      );
    }
  }
  
  /**
   * 执行单次迭代
   * @param query 查询关键词
   * @param options 搜索选项
   * @returns 迭代结果
   */
  private async executeIteration(
    query: string, 
    options: SearchOptions
  ): Promise<IterationResult> {
    try {
      // 获取主查询的建议
      const mainQueryResult = await this.searchEngine.getSuggestions(query, options);
      const queryResults: Record<string, string[]> = {
        [query]: mainQueryResult.suggestions
      };
      
      // 如果建议数量足够，从中挑选一些有潜力的进行二级查询
      let secondaryQueries: string[] = [];
      if (mainQueryResult.suggestions.length > 0) {
        // 选择一些最具潜力的建议进行二级查询
        secondaryQueries = this.selectSecondaryQueries(
          mainQueryResult.suggestions,
          options.maxSecondaryKeywords || config.searchDefaults.maxSecondaryKeywords || 10
        );
      }
      
      // 执行二级查询
      if (secondaryQueries.length > 0) {
        console.log(`[迭代] 执行 ${secondaryQueries.length} 个二级查询`);
      }
      
      for (const secondaryQuery of secondaryQueries) {
        try {
          // 添加随机延迟以避免被封锁
          await this.randomDelay(options);
          
          // 执行二级查询
          const secondaryResult = await this.searchEngine.getSuggestions(
            secondaryQuery, 
            options
          );
          
          // 存储二级查询结果
          queryResults[secondaryQuery] = secondaryResult.suggestions;
        } catch (error) {
          console.error(`[迭代] 二级查询 "${secondaryQuery}" 失败: ${(error as Error).message}`);
          // 继续下一个查询
        }
      }
      
      // 汇总所有建议
      const allSuggestions = [
        ...mainQueryResult.suggestions,
        ...Object.values(queryResults)
          .slice(1) // 跳过主查询结果（已经包含）
          .flat()
      ];
      
      // 去重
      const uniqueSuggestions = [...new Set(allSuggestions)];
      
      // 查找最有效的查询
      let mostEffectiveQuery = query;
      let maxResults = mainQueryResult.suggestions.length;
      
      for (const [queryKey, results] of Object.entries(queryResults)) {
        if (results.length > maxResults) {
          maxResults = results.length;
          mostEffectiveQuery = queryKey;
        }
      }
      
      console.log(`[迭代] 共获取 ${uniqueSuggestions.length} 个关键词建议`);
      
      return {
        allSuggestions: uniqueSuggestions,
        queryResults,
        mostEffectiveQuery,
        newKeywordsCount: uniqueSuggestions.length
      };
    } catch (error) {
      console.error(`[迭代] 迭代执行失败: ${(error as Error).message}`);
      throw new AppError(
        `Iteration execution failed: ${(error as Error).message}`,
        ErrorType.UNKNOWN,
        error as Error
      );
    }
  }
  
  /**
   * 选择二级查询关键词
   * @param suggestions 候选建议列表
   * @param maxCount 最大选择数量
   * @returns 选择的二级查询关键词
   */
  private selectSecondaryQueries(suggestions: string[], maxCount: number): string[] {
    if (suggestions.length <= maxCount) {
      return suggestions;
    }
    
    // 优先选择较长且包含特定意图词的关键词
    const scoredSuggestions = suggestions.map(suggestion => {
      // 计算基础分数（长度）
      let score = suggestion.length;
      
      // 意图指示词加分
      const intentWords = [
        'how', 'best', 'recommended', 'problems', 'compare', 
        'tutorial', 'guide', 'method', 'steps', 'tips'
      ];
      
      for (const word of intentWords) {
        if (suggestion.includes(word)) {
          score += 5;
        }
      }
      
      return { suggestion, score };
    });
    
    // 按分数排序
    scoredSuggestions.sort((a, b) => b.score - a.score);
    
    // 返回分数最高的 maxCount 个建议
    return scoredSuggestions
      .slice(0, maxCount)
      .map(item => item.suggestion);
  }
  
  /**
   * 规划下一轮迭代
   * @param originalKeyword 原始关键词
   * @param currentKeywords 当前已发现的关键词
   * @param nextIterationNumber 下一迭代序号
   * @returns 分析和规划结果
   */
  private async planNextIteration(
    originalKeyword: string,
    currentKeywords: string[],
    nextIterationNumber: number
  ): Promise<AnalysisPlanResult> {
    if (!this.intentAnalyzer) {
      throw new AppError(
        'Cannot plan iteration: Intent analyzer not initialized',
        ErrorType.VALIDATION
      );
    }
    
    try {
      console.info(`[ENGINE_INFO] Starting next iteration planning for iteration #${nextIterationNumber}`);
      console.info(`[ENGINE_INFO] Original keyword: "${originalKeyword}"`);
      console.info(`[ENGINE_INFO] Total keywords so far: ${currentKeywords.length}`);
      
      // 首先分析当前关键词的领域分布情况
      const domainAnalysis = this.analyzeDomainFocus(
        currentKeywords, 
        originalKeyword
      );
      
      // 如果检测到领域严重不平衡，记录日志
      if (domainAnalysis.excessiveFocus) {
        console.warn(`[ENGINE_WARN] Detected excessive focus on domain: ${domainAnalysis.dominantDomain} (${domainAnalysis.focusPercentage.toFixed(2)}%)`);
        console.warn(`[ENGINE_WARN] Will enforce domain rotation to improve diversity`);
      }
      
      // 获取LLM生成的规划结果
      const result = await this.intentAnalyzer.planNextIteration(
        originalKeyword,
        currentKeywords,
        nextIterationNumber,
        this.iterationHistory
      );
      
      // 应用领域均衡和句式多样性增强
      if (result.recommendedQueries.length > 0) {
        // 1. 如果检测到领域严重不平衡，过滤掉属于主导领域的查询
        if (domainAnalysis.excessiveFocus && domainAnalysis.forbiddenDomains.length > 0) {
          const originalCount = result.recommendedQueries.length;
          result.recommendedQueries = result.recommendedQueries.filter(query => {
            // 过滤掉包含主导领域关键词的查询
            return !domainAnalysis.forbiddenDomains.some(domain => 
              query.toLowerCase().includes(domain.toLowerCase())
            );
          });
          
          console.info(`[ENGINE_INFO] Filtered out ${originalCount - result.recommendedQueries.length} queries containing dominant domain`);
          
          // 如果过滤后查询太少，添加一些探索未充分代表的领域的查询
          if (result.recommendedQueries.length < 3 && domainAnalysis.underrepresentedDomains.length > 0) {
            const neededQueries = 5 - result.recommendedQueries.length;
            const underrepresentedQueries = domainAnalysis.underrepresentedDomains
              .slice(0, neededQueries)
              .map(domain => `${originalKeyword} applications in ${domain} domain`);
            
            result.recommendedQueries = [...result.recommendedQueries, ...underrepresentedQueries];
            console.info(`[ENGINE_INFO] Added ${underrepresentedQueries.length} queries for underrepresented domains`);
          }
        }
        
        // 2. 应用句式多样性增强
        result.recommendedQueries = this.enforcePatternDiversity(
          result.recommendedQueries,
          nextIterationNumber
        );
        
        // 3. 添加领域轮换计划
        result.domainRotationPlan = {
          dominantDomain: domainAnalysis.dominantDomain,
          focusPercentage: domainAnalysis.focusPercentage,
          forbiddenDomains: domainAnalysis.forbiddenDomains,
          underrepresentedDomains: domainAnalysis.underrepresentedDomains,
          rotationStrategy: domainAnalysis.excessiveFocus 
            ? "Force exploration of underrepresented domains, prohibit dominant domain"
            : "Balance domain distribution, ensure diversity",
          excessiveFocus: domainAnalysis.excessiveFocus
        };
      }
      
      console.info(`[ENGINE_INFO] Next iteration planning completed successfully`);
      console.info(`[ENGINE_INFO] Got ${result.recommendedQueries.length} recommended queries`);
      
      return result;
    } catch (error) {
      console.error(`[ENGINE_ERROR] Failed to plan next iteration: ${(error as Error).message}`);
      
      // 检查是否为网络错误
      if (error instanceof Error) {
        const errorObj = error as any;
        if (errorObj.code) {
          console.error(`[ENGINE_ERROR] Network error detected. Error code: ${errorObj.code}`);
          if (errorObj.code === 'ENOTFOUND') {
            console.error(`[ENGINE_ERROR] DNS resolution failed. Check internet connection and DNS settings.`);
            console.error(`[ENGINE_ERROR] Unable to connect to LLM API server.`);
          } else if (errorObj.code === 'ECONNREFUSED') {
            console.error(`[ENGINE_ERROR] Connection refused. The server may be down or firewall is blocking.`);
          } else if (errorObj.code.startsWith('ETIMEOUT')) {
            console.error(`[ENGINE_ERROR] Connection timed out. Check network connectivity or proxy settings.`);
          }
          
          console.error(`[ENGINE_ERROR] Consider using a proxy with the --proxy parameter if you're behind a firewall.`);
        }
      }
      
      // 分析现有关键词的领域分布，即使LLM调用失败也能提供领域均衡
      const domainAnalysis = this.analyzeDomainFocus(currentKeywords, originalKeyword);
      
      // 返回默认规划结果，但应用领域均衡逻辑
      console.info(`[ENGINE_INFO] Using fallback query strategy due to LLM error`);
      
      // 创建基础查询列表
      let fallbackQueries = [
        `${originalKeyword} how`,
        `${originalKeyword} best`,
        `${originalKeyword} tutorial`,
        `${originalKeyword} problems`,
        `${originalKeyword} compare`
      ];
      
      // 添加来自未充分探索领域的查询
      if (domainAnalysis.excessiveFocus && domainAnalysis.underrepresentedDomains.length > 0) {
        domainAnalysis.underrepresentedDomains.slice(0, 5).forEach(domain => {
          fallbackQueries.push(`${originalKeyword} applications in ${domain} domain`);
        });
      }
      
      // 应用句式多样性增强
      fallbackQueries = this.enforcePatternDiversity(fallbackQueries, nextIterationNumber);
      
      return {
        gaps: ['Gaps could not be identified through LLM analysis'],
        patterns: [],
        targetGoals: [`Discover more long-tail keywords for "${originalKeyword}"`],
        recommendedQueries: fallbackQueries,
        domainRotationPlan: {
          dominantDomain: domainAnalysis.dominantDomain,
          focusPercentage: domainAnalysis.focusPercentage,
          forbiddenDomains: domainAnalysis.forbiddenDomains,
          underrepresentedDomains: domainAnalysis.underrepresentedDomains,
          rotationStrategy: domainAnalysis.excessiveFocus 
            ? "Force exploration of underrepresented domains, prohibit dominant domain"
            : "Balance domain distribution, ensure diversity",
          excessiveFocus: domainAnalysis.excessiveFocus
        }
      };
    }
  }
  
  /**
   * 添加随机延迟
   * @param options 搜索选项
   */
  private async randomDelay(options: SearchOptions): Promise<void> {
    // 获取延迟范围
    const delayRange = options.delayBetweenQueries || 
      config.searchDefaults.delayBetweenQueries || 
      { min: 1000, max: 3000 };
    
    // 生成随机延迟时间
    const delay = Math.floor(
      Math.random() * (delayRange.max - delayRange.min + 1) + delayRange.min
    );
    
    // 等待
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * 保存当前状态到检查点
   * @param originalKeyword 原始关键词
   * @param lastCompletedIteration 最后完成的迭代编号
   * @param engineState 引擎状态
   */
  private saveCheckpoint(
    originalKeyword: string,
    lastCompletedIteration: number,
    engineState: {
      satisfactionScore?: number;
      lastQuery?: string;
      recommendedQueries?: string[];
    } = {}
  ): void {
    if (this.checkpointService) {
      this.checkpointService.saveCheckpoint(
        originalKeyword,
        this.discoveredKeywords,
        this.iterationHistory,
        lastCompletedIteration,
        engineState
      );
    }
  }

  /**
   * 分析关键词多样性，检测是否集中在单一领域
   * @param keywords 关键词列表
   * @param query 查询关键词
   * @returns 分析结果
   */
  private analyzeDomainFocus(keywords: string[], query: string): {
    dominantDomain: string;
    focusPercentage: number;
    excessiveFocus: boolean;
    forbiddenDomains: string[];
    underrepresentedDomains: string[];
  } {
    // 主要领域检测逻辑
    const domains = new Map<string, number>();
    // 使用英文领域名称列表，与提示词库保持一致
    const importantDomains = [
      'medical', 'education', 'finance', 'agriculture', 'manufacturing', 'environment',
      'retail', 'entertainment', 'sports', 'legal', 'travel', 'culture'
    ];
    
    // 识别关键词中的领域分布
    for (const keyword of keywords) {
      // 简单启发式：使用关键词前两个词作为领域指示
      const words = keyword.split(' ');
      if (words.length > 0) {
        // 尝试将关键词映射到已知领域
        let domain = '';
        for (const impDomain of importantDomains) {
          if (keyword.includes(impDomain)) {
            domain = impDomain;
            break;
          }
        }
        
        // 如果没有匹配已知领域，使用第一个词作为领域
        if (!domain && words[0]) {
          domain = words[0];
        }
        
        if (domain) {
          domains.set(domain, (domains.get(domain) || 0) + 1);
        }
      }
    }
    
    // 找出主导领域
    let dominantDomain = '';
    let maxCount = 0;
    let totalCount = 0;
    
    domains.forEach((count, domain) => {
      totalCount += count;
      if (count > maxCount) {
        maxCount = count;
        dominantDomain = domain;
      }
    });
    
    // 计算主导领域占比
    const focusPercentage = totalCount > 0 ? (maxCount / totalCount) * 100 : 0;
    
    // 确定是否过度集中
    const excessiveFocus = focusPercentage > 60;
    
    // 识别未被充分探索的领域
    const underrepresentedDomains = importantDomains.filter(domain => {
      const count = domains.get(domain) || 0;
      return count < totalCount * 0.05; // 少于5%的领域被视为未充分探索
    });
    
    // 确定应该禁止的领域（主导领域如果超过阈值）
    const forbiddenDomains = excessiveFocus ? [dominantDomain] : [];
    
    return {
      dominantDomain,
      focusPercentage,
      excessiveFocus,
      forbiddenDomains,
      underrepresentedDomains
    };
  }

  /**
   * 强制关键词句式多样性
   * @param recommendedQueries 推荐的查询列表
   * @param iterationNumber 当前迭代次数
   * @returns 增强多样性后的查询列表
   */
  private enforcePatternDiversity(recommendedQueries: string[], iterationNumber: number): string[] {
    // 句式模式类型
    const patternTypes = ["question", "scenario", "comparison", "need", "case-study"];
    const patterns = [
      (kw: string) => `what is ${kw}`, // 问题型
      (kw: string) => `${kw} in practical scenarios`, // 场景型
      (kw: string) => `${kw} compared to traditional methods`, // 比较型
      (kw: string) => `how to choose the most suitable ${kw}`, // 需求型
      (kw: string) => `successful case studies of ${kw}` // 案例型
    ];
    
    // 如果推荐查询不足，填充到5个
    if (recommendedQueries.length < 5) {
      const baseKeyword = recommendedQueries[0] || "artificial intelligence";
      const baseWords = baseKeyword.split(' ');
      const rootKeyword = baseWords[0] || "artificial intelligence";
      
      // 补充查询
      while (recommendedQueries.length < 5) {
        const patternIndex = recommendedQueries.length % patterns.length;
        recommendedQueries.push(patterns[patternIndex](rootKeyword));
      }
    }
    
    // 根据迭代次数确定是增强商业意图还是多样性
    if (iterationNumber > 2) {
      // 后期迭代：确保有足够的商业意图
      const hasCommercialIntent = (query: string) => {
        const commercialTerms = ["buy", "price", "compare", "choose", "best", "recommend", "cost", "value"];
        return commercialTerms.some(term => query.includes(term));
      };
      
      let commercialCount = recommendedQueries.filter(hasCommercialIntent).length;
      const targetCommercial = Math.ceil(recommendedQueries.length * 0.3); // 目标30%商业意图
      
      if (commercialCount < targetCommercial) {
        // 不够，转换一些查询为商业意图
        for (let i = 0; i < recommendedQueries.length && commercialCount < targetCommercial; i++) {
          if (!hasCommercialIntent(recommendedQueries[i])) {
            // 转换这个查询为商业意图
            const baseWords = recommendedQueries[i].split(' ');
            const rootKeyword = baseWords[0] || "artificial intelligence";
            const commercialPatterns = [
              `${rootKeyword} product price comparison`,
              `best options to buy ${rootKeyword}`,
              `most cost-effective ${rootKeyword} recommendations`,
              `enterprise ${rootKeyword} solution costs`
            ];
            recommendedQueries[i] = commercialPatterns[i % commercialPatterns.length];
            commercialCount++;
          }
        }
      }
    } else {
      // 早期迭代：强调领域多样性
      // 确保前5个查询使用不同的句式模式
      for (let i = 0; i < Math.min(5, recommendedQueries.length); i++) {
        // 如果查询明显遵循某种模式，保留原样
        // 否则，应用特定模式转换
        const baseWords = recommendedQueries[i].split(' ');
        const rootKeyword = baseWords[0] || "artificial intelligence";
        
        // 检查是否已经具有鲜明的句式特征
        const hasDistinctPattern = patternTypes.some(pt => {
          return recommendedQueries[i].includes(`what is`) || 
                 recommendedQueries[i].includes(`how to`) ||
                 recommendedQueries[i].includes(`compared`) ||
                 recommendedQueries[i].includes(`case`);
        });
        
        if (!hasDistinctPattern) {
          // 应用对应的句式模式
          recommendedQueries[i] = patterns[i % patterns.length](rootKeyword);
        }
      }
    }
    
    return recommendedQueries;
  }
} 