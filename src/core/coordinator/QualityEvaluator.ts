/**
 * Quality Evaluator
 * 
 * Responsible for evaluating problem quality using adaptive thresholds
 * and domain-specific scoring criteria.
 */

import { logger } from '../../infra/logger';
import { 
  Problem, 
  ProblemQualityScore, 
  QualityThresholds, 
  ProblemDiscoveryConfig,
  ThresholdAdjustmentFactors
} from '../../types/discovery';
import { AgentLLMService } from '../llm/AgentLLMService';
import { AgentLLMServiceExtensions } from '../llm/extensions';
import { z } from 'zod';

// Define schemas for validation
const qualityScoreSchema = z.object({
  authenticity: z.number().min(1).max(10),
  urgency: z.number().min(1).max(10),
  scale: z.number().min(1).max(10),
  solutionGap: z.number().min(1).max(10),
  feasibility: z.number().min(1).max(10),
  overall: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

const thresholdDecisionSchema = z.object({
  meetsThreshold: z.boolean(),
  adjustedThreshold: z.number(),
  reasoning: z.string()
});

export class QualityEvaluator {
  private config: ProblemDiscoveryConfig;
  private globalThreshold: number;
  private domainThresholds: Map<string, QualityThresholds> = new Map();
  private llmService: AgentLLMService;
  private domainPerformance: Map<string, { averageQuality: number; successRate: number; samples: number }> = new Map();
  private adaptiveFactors: Map<string, ThresholdAdjustmentFactors> = new Map();
  private learningRate: number = 0.05;
  
  constructor(config: ProblemDiscoveryConfig, llmService?: AgentLLMService) {
    this.config = config;
    this.globalThreshold = config.initialQualityThreshold;
    
    // Initialize domain-specific thresholds
    if (config.domainSpecificThresholds) {
      for (const threshold of config.domainSpecificThresholds) {
        this.domainThresholds.set(threshold.domain, threshold);
        
        // 初始化领域性能指标
        this.domainPerformance.set(threshold.domain, {
          averageQuality: 0,
          successRate: 0,
          samples: 0
        });
        
        // 初始化自适应因子
        if (threshold.thresholdAdjustmentFactors) {
          this.adaptiveFactors.set(threshold.domain, { ...threshold.thresholdAdjustmentFactors });
        }
      }
    }
    
    // Initialize LLM service
    if (llmService) {
      this.llmService = llmService;
    } else {
      // Import dynamically to avoid circular dependencies
      const { getDefaultLLMService } = require('../../core/llm/providers/llmFactory');
      this.llmService = getDefaultLLMService();
    }
    
    logger.debug({}, 'QualityEvaluator initialized with LLM service');
  }
  
  /**
   * Evaluate if a problem meets quality thresholds using LLM
   */
  public async meetsQualityThreshold(problem: Problem): Promise<boolean> {
    try {
      logger.debug({}, `Evaluating if problem ${problem.id} meets quality threshold using LLM`);
      
      // Get appropriate threshold
      const threshold = this.getThresholdForProblem(problem);
      
      // Prepare problem data
      const problemData = {
        id: problem.id,
        formulation: problem.currentFormulation,
        domain: problem.domain.join(', '),
        audience: problem.targetAudience ? problem.targetAudience.join(', ') : 'Not specified',
        qualityScore: problem.qualityScore,
        evidenceCount: problem.evidence.length,
        feedbackCount: problem.feedbackHistory.length,
        iterationCount: problem.metadata.iterationCount
      };
      
      // Construct threshold evaluation prompt
      const prompt = `
        As an expert in problem quality evaluation, determine if the following problem meets the quality threshold.
        
        # Problem:
        ID: ${problemData.id}
        Formulation: "${problemData.formulation}"
        Domain: ${problemData.domain}
        Target Audience: ${problemData.audience}
        
        # Current Quality Scores:
        - Authenticity: ${problemData.qualityScore.authenticity}/10
        - Urgency: ${problemData.qualityScore.urgency}/10
        - Scale: ${problemData.qualityScore.scale}/10
        - Solution Gap: ${problemData.qualityScore.solutionGap}/10
        - Feasibility: ${problemData.qualityScore.feasibility}/10
        - Overall: ${problemData.qualityScore.overall}/10
        - Confidence: ${problemData.qualityScore.confidence}
        
        # Additional Metadata:
        - Evidence count: ${problemData.evidenceCount}
        - Feedback count: ${problemData.feedbackCount}
        - Iteration count: ${problemData.iterationCount}
        
        # Threshold Configuration:
        - Base threshold: ${threshold.minOverallScore}
        - Min authenticity: ${threshold.minAuthenticity}
        - Min urgency: ${threshold.minUrgency}
        - Min scale: ${threshold.minScale}
        - Min solution gap: ${threshold.minSolutionGap}
        - Min feasibility: ${threshold.minFeasibility}
        - Adaptive thresholds enabled: ${this.config.adaptiveQualityThresholds ? 'Yes' : 'No'}
        
        # Assessment Task:
        ${this.config.adaptiveQualityThresholds ? 
        `1. Calculate an adjusted threshold considering:
           - For low confidence scores (< 0.6): Lower threshold by up to 0.5
           - For high evidence count (> 3): Increase threshold by 0.1 per evidence (max 0.5)
           - For each iteration: Increase threshold by 0.2 (max 1.0)
           - For consistent feedback (> 70% positive): Increase threshold by 0.3` : 
        `Use the fixed threshold of ${threshold.minOverallScore}`}
        
        2. Determine if the problem meets the threshold
        3. Provide reasoning for your decision
        
        Return a JSON object with:
        {
          "meetsThreshold": true/false,
          "adjustedThreshold": 7.2,
          "reasoning": "Explanation of threshold calculation and decision"
        }
      `;
      
      // Default fallback calculation
      const baseAdjustedThreshold = this.calculateFallbackAdaptiveThreshold(problem, threshold);
      const defaultMeetsThreshold = problem.qualityScore.overall >= baseAdjustedThreshold;
      
      // Default value in case of failure
      const defaultValue = {
        meetsThreshold: defaultMeetsThreshold,
        adjustedThreshold: baseAdjustedThreshold,
        reasoning: `Calculated using base threshold of ${threshold.minOverallScore} with standard adjustments.`
      };
      
      // Use LLM to evaluate with schema validation
      const thresholdResult = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        'evaluate-quality-threshold',
        thresholdDecisionSchema,
        {
          temperature: 0.3,
          defaultValue
        }
      );
      
      logger.info({}, `LLM evaluated problem ${problem.id}: ${thresholdResult.meetsThreshold ? 'MEETS' : 'FAILS'} threshold (${problem.qualityScore.overall.toFixed(2)} vs ${thresholdResult.adjustedThreshold.toFixed(2)})`);
      
      return thresholdResult.meetsThreshold;
    } catch (error: any) {
      logger.error({ error }, `Error evaluating quality threshold with LLM: ${error.message}`);
      
      // Fallback to algorithmic method
      const threshold = this.getThresholdForProblem(problem);
      const adjustedThreshold = this.calculateFallbackAdaptiveThreshold(problem, threshold);
      const result = problem.qualityScore.overall >= adjustedThreshold;
      
      logger.debug({}, `Fallback quality evaluation for problem ${problem.id}: ${problem.qualityScore.overall.toFixed(2)} vs threshold ${adjustedThreshold.toFixed(2)} - ${result ? 'PASSED' : 'FAILED'}`);
      
      return result;
    }
  }
  
  /**
   * Get appropriate threshold for a specific problem
   */
  private getThresholdForProblem(problem: Problem): QualityThresholds {
    // Use domain-specific threshold if available
    for (const domain of problem.domain) {
      if (this.domainThresholds.has(domain)) {
        return this.domainThresholds.get(domain)!;
      }
    }
    
    // Use a default threshold if no domain match
    return {
      domain: 'global',
      minOverallScore: this.globalThreshold,
      minAuthenticity: 5,
      minUrgency: 5,
      minScale: 5,
      minSolutionGap: 5,
      minFeasibility: 5,
      thresholdAdjustmentFactors: {
        lowConfidenceAdjustment: -0.5,
        highEvidenceBoost: 0.5,
        iterationBoost: 0.2,
        feedbackConsistencyBoost: 0.3
      }
    };
  }
  
  /**
   * 增强版的自适应阈值计算
   * 考虑更多因素并动态调整权重
   */
  private calculateEnhancedAdaptiveThreshold(problem: Problem, baseThreshold: QualityThresholds): number {
    if (!this.config.adaptiveQualityThresholds) {
      return baseThreshold.minOverallScore;
    }
    
    let adjustedThreshold = baseThreshold.minOverallScore;
    let adjustmentFactors = this.getAdjustmentFactorsForDomain(baseThreshold.domain);
    
    // 根据问题质量置信度进行调整
    if (problem.qualityScore.confidence < 0.6) {
      adjustedThreshold += adjustmentFactors.lowConfidenceAdjustment;
    }
    
    // 根据证据数量和质量进行调整
    if (problem.evidence.length > 0) {
      // 计算证据关联性加权提升
      const evidenceRelevanceScores = problem.evidence.map(e => e.relevanceScore);
      const averageRelevance = evidenceRelevanceScores.length > 0 
        ? evidenceRelevanceScores.reduce((a, b) => a + b) / evidenceRelevanceScores.length 
        : 0;
      
      // 证据高质量时提升阈值, 低质量时降低阈值
      const relevanceAdjustment = (averageRelevance - 0.5) * 2; // -1 to 1 range
      const evidenceBoost = Math.min(
        adjustmentFactors.highEvidenceBoost,
        (problem.evidence.length * 0.1) * (0.5 + relevanceAdjustment)
      );
      
      adjustedThreshold += evidenceBoost;
    }
    
    // 根据迭代次数动态调整
    if (problem.metadata.iterationCount > 0) {
      // 使用对数曲线使得效果边际递减
      const iterationBoost = Math.min(
        adjustmentFactors.iterationBoost * Math.log(problem.metadata.iterationCount + 1),
        1.0
      );
      adjustedThreshold += iterationBoost;
    }
    
    // 根据反馈一致性进行调整
    if (problem.feedbackHistory.length > 0) {
      // 计算反馈一致性
      const feedbackTypes = new Map<string, number>();
      let totalConfidence = 0;
      
      // 统计各类反馈数量和总置信度
      for (const feedback of problem.feedbackHistory) {
        const type = feedback.feedbackType;
        feedbackTypes.set(type, (feedbackTypes.get(type) || 0) + 1);
        totalConfidence += feedback.confidenceScore;
      }
      
      // 找出最主要的反馈类型
      let maxType = '';
      let maxCount = 0;
      for (const [type, count] of feedbackTypes.entries()) {
        if (count > maxCount) {
          maxCount = count;
          maxType = type;
        }
      }
      
      // 计算一致性得分
      const consistencyScore = maxCount / problem.feedbackHistory.length;
      const avgConfidence = totalConfidence / problem.feedbackHistory.length;
      
      // 一致性高 + 验证型反馈 = 提升阈值
      if (consistencyScore > 0.7 && maxType === 'validation') {
        const consistencyBoost = adjustmentFactors.feedbackConsistencyBoost * avgConfidence;
        adjustedThreshold += consistencyBoost;
      }
      // 一致性高 + 拒绝型反馈 = 降低阈值
      else if (consistencyScore > 0.7 && maxType === 'rejection') {
        const consistencyPenalty = -adjustmentFactors.feedbackConsistencyBoost * avgConfidence;
        adjustedThreshold += consistencyPenalty;
      }
    }
    
    // 确保阈值在合理范围内 (1-10)
    return Math.max(1, Math.min(10, adjustedThreshold));
  }
  
  /**
   * 获取领域特定的调整因子
   */
  private getAdjustmentFactorsForDomain(domain: string): ThresholdAdjustmentFactors {
    // 先查找自适应因子
    if (this.adaptiveFactors.has(domain)) {
      return this.adaptiveFactors.get(domain)!;
    }
    
    // 再查找原始配置
    const threshold = this.domainThresholds.get(domain);
    if (threshold?.thresholdAdjustmentFactors) {
      return threshold.thresholdAdjustmentFactors;
    }
    
    // 返回默认因子
    return {
      lowConfidenceAdjustment: -0.5,
      highEvidenceBoost: 0.5,
      iterationBoost: 0.2,
      feedbackConsistencyBoost: 0.3
    };
  }
  
  /**
   * Fallback calculation for adaptive threshold
   */
  private calculateFallbackAdaptiveThreshold(problem: Problem, baseThreshold: QualityThresholds): number {
    // 使用增强版自适应阈值计算代替简单计算
    return this.calculateEnhancedAdaptiveThreshold(problem, baseThreshold);
  }
  
  /**
   * Recalculate quality score for a problem using LLM
   */
  public async recalculateQualityScore(problem: Problem): Promise<ProblemQualityScore> {
    try {
      logger.debug({}, `Recalculating quality score for problem ${problem.id} using LLM`);
      
      // Prepare evidence data
      let evidenceString = '';
      if (problem.evidence && Array.isArray(problem.evidence)) {
        evidenceString = problem.evidence
          .filter((e: any) => e && e.content)
          .map((e: any) => `- [${e.type || 'evidence'}] ${e.content}`)
          .join('\n');
      }
      
      // Create prompt for quality evaluation
      const prompt = `
        As an expert in problem evaluation, assess the quality of the following problem.
        
        ## Problem Information
        Problem ID: ${problem.id}
        Problem Formulation: ${problem.currentFormulation}
        Original Formulation: ${problem.originalFormulation}
        Domain: ${Array.isArray(problem.domain) ? problem.domain.join(', ') : problem.domain}
        Target Audience: ${Array.isArray(problem.targetAudience) ? problem.targetAudience.join(', ') : problem.targetAudience || 'Not specified'}
        
        ## Previous Quality Scores
        Authenticity: ${problem.qualityScore.authenticity}/10
        Urgency: ${problem.qualityScore.urgency}/10
        Scale: ${problem.qualityScore.scale}/10
        Solution Gap: ${problem.qualityScore.solutionGap}/10
        Feasibility: ${problem.qualityScore.feasibility}/10
        Overall: ${problem.qualityScore.overall}/10
        Confidence: ${problem.qualityScore.confidence}
        
        ## Evidence
        ${evidenceString || 'No evidence available'}
        
        ## Evolution Path
        ${problem.evolutionPath.length} iterations
        
        ## Evaluation Dimensions
        1. Authenticity (1-10) - Is this a real problem faced by users?
           - 10: Abundant evidence confirming this is a widespread, verified problem
           - 5: Some evidence suggests this is a real problem
           - 1: Little to no evidence that this is an actual problem
           
        2. Urgency (1-10) - How quickly does this problem need to be solved?
           - 10: Immediate solution required, critical impact on users
           - 5: Medium urgency, should be addressed in near future
           - 1: Low urgency, can be addressed at leisure
           
        3. Scale (1-10) - How many people are affected by this problem?
           - 10: Affects a vast number of users across multiple segments
           - 5: Affects a moderate number of users in specific segments
           - 1: Affects very few users in niche segments
           
        4. Solution Gap (1-10) - Are existing solutions inadequate?
           - 10: No effective solutions exist, major unmet need
           - 5: Partial solutions exist but with significant limitations
           - 1: Multiple adequate solutions already exist
           
        5. Feasibility (1-10) - Can this problem be solved effectively?
           - 10: Highly solvable with current technology and resources
           - 5: Moderately solvable with some innovation required
           - 1: Extremely difficult to solve with current technology
           
        ## Task
        Re-evaluate this problem and provide updated quality scores for each dimension.
        
        Return a JSON object with your scores and reasoning:
        {
          "authenticity": 8,
          "urgency": 7,
          "scale": 6,
          "solutionGap": 9, 
          "feasibility": 8,
          "overall": 7.6,
          "confidence": 0.85,
          "reasoning": "Brief explanation of your assessment"
        }
      `;
      
      // Create default value based on existing scores
      const defaultValue = {
        authenticity: problem.qualityScore.authenticity,
        urgency: problem.qualityScore.urgency,
        scale: problem.qualityScore.scale,
        solutionGap: problem.qualityScore.solutionGap,
        feasibility: problem.qualityScore.feasibility,
        overall: problem.qualityScore.overall,
        confidence: problem.qualityScore.confidence,
        reasoning: "Using existing scores due to evaluation failure"
      };
      
      // Use LLM to evaluate with schema validation
      const newScore = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        this.llmService,
        prompt,
        'recalculate-quality-score',
        qualityScoreSchema,
        {
          temperature: 0.4,
          defaultValue
        }
      );
      
      logger.info({}, `LLM recalculated quality score for problem ${problem.id}: ${newScore.overall.toFixed(2)}`);
      
      // Create final quality score object
      const qualityScore: ProblemQualityScore = {
        authenticity: newScore.authenticity,
        urgency: newScore.urgency,
        scale: newScore.scale,
        solutionGap: newScore.solutionGap,
        feasibility: newScore.feasibility,
        overall: newScore.overall,
        confidence: newScore.confidence
      };
      
      return qualityScore;
    } catch (error: any) {
      logger.error({ error }, `Error using LLM to recalculate quality score: ${error.message}`);
      
      // Fallback to simple adjustment of existing scores
      return this.fallbackScoreCalculation(problem);
    }
  }
  
  /**
   * Fallback calculation if LLM fails
   */
  private fallbackScoreCalculation(problem: Problem): ProblemQualityScore {
    // Start with existing scores
    const newScore: ProblemQualityScore = { ...problem.qualityScore };
    
    // Adjust for evidence
    if (problem.evidence.length > 0) {
      const relevantEvidenceCount = problem.evidence.filter(e => e.relevanceScore > 0.7).length;
      const evidenceFactor = Math.min(1, relevantEvidenceCount / 5);
      
      newScore.authenticity = Math.min(10, newScore.authenticity + evidenceFactor);
    }
    
    // Adjust for iterations
    if (problem.evolutionPath.length > 0) {
      newScore.overall = Math.min(
        10,
        newScore.overall + (problem.evolutionPath.length * 0.1)
      );
    }
    
    // Adjust for formulation clarity
    if (problem.currentFormulation.length > problem.originalFormulation.length * 1.2) {
      // Assume a longer, refined formulation is clearer
      newScore.overall = Math.min(10, newScore.overall + 0.2);
    }
    
    // Recalculate overall score as weighted average
    newScore.overall = this.calculateWeightedScore(newScore);
    
    // Adjust confidence based on evidence and feedback
    newScore.confidence = Math.min(1.0, Math.max(0.1, 
      problem.qualityScore.confidence + (problem.evidence.length > 2 ? 0.1 : -0.1)
    ));
    
    return newScore;
  }
  
  /**
   * Calculate weighted quality score
   */
  private calculateWeightedScore(score: ProblemQualityScore): number {
    // Define weights for each component
    const weights = {
      authenticity: 0.25,
      urgency: 0.2,
      scale: 0.2,
      solutionGap: 0.25,
      feasibility: 0.1
    };
    
    // Calculate weighted average
    const weightedScore =
      score.authenticity * weights.authenticity +
      score.urgency * weights.urgency +
      score.scale * weights.scale +
      score.solutionGap * weights.solutionGap +
      score.feasibility * weights.feasibility;
    
    // Round to one decimal place
    return Math.round(weightedScore * 10) / 10;
  }
  
  /**
   * 从问题集合中学习以优化阈值调整
   */
  public learnFromProblems(problems: Problem[]): void {
    if (!this.config.adaptiveQualityThresholds || problems.length < 5) {
      return; // 样本太少，不调整
    }
    
    logger.debug({}, `Learning from ${problems.length} problems to optimize thresholds`);
    
    // 按领域分组
    const domainGroups = new Map<string, Problem[]>();
    
    for (const problem of problems) {
      // 跳过没有反馈的问题
      if (problem.feedbackHistory.length === 0) continue;
      
      for (const domain of problem.domain) {
        if (!domainGroups.has(domain)) {
          domainGroups.set(domain, []);
        }
        
        domainGroups.get(domain)!.push(problem);
      }
    }
    
    // 更新每个领域的调整因子
    for (const [domain, domainProblems] of domainGroups.entries()) {
      // 样本太少，不调整
      if (domainProblems.length < 3) continue;
      
      // 获取当前因子或默认值
      const currentFactors = this.getAdjustmentFactorsForDomain(domain);
      
      // 分析成功与失败的问题（通过验证的）
      const validatedProblems = domainProblems.filter(p => 
        p.feedbackHistory.some(f => f.feedbackType === 'validation')
      );
      
      if (validatedProblems.length < 2) continue;
      
      // 评估问题成功率
      const successfulProblems = validatedProblems.filter(p => {
        // 计算正面验证反馈的比例
        const validations = p.feedbackHistory.filter(f => f.feedbackType === 'validation');
        const positiveValidations = validations.filter(f => f.validationResults?.isValid);
        return positiveValidations.length / Math.max(1, validations.length) > 0.5;
      });
      
      const successRate = successfulProblems.length / validatedProblems.length;
      
      // 根据样本大小调整学习率
      const adjustedLearningRate = this.learningRate * Math.min(1, validatedProblems.length / 10);
      
      // 分析各因素对成功率的影响
      
      // 分析高证据数量的影响
      const highEvidenceProblems = validatedProblems.filter(p => p.evidence.length > 3);
      const highEvidenceSuccessRate = highEvidenceProblems.length > 0 
        ? highEvidenceProblems.filter(p => p.qualityScore.overall >= 7).length / highEvidenceProblems.length 
        : 0;
      
      // 分析高迭代次数的影响
      const highIterationProblems = validatedProblems.filter(p => p.metadata.iterationCount > 2);
      const highIterationSuccessRate = highIterationProblems.length > 0 
        ? highIterationProblems.filter(p => p.qualityScore.overall >= 7).length / highIterationProblems.length 
        : 0;
      
      // 分析反馈一致性的影响
      const highConsistencyProblems = validatedProblems.filter(p => {
        const feedbackTypes = new Map<string, number>();
        for (const f of p.feedbackHistory) {
          feedbackTypes.set(f.feedbackType, (feedbackTypes.get(f.feedbackType) || 0) + 1);
        }
        
        let maxCount = 0;
        for (const count of feedbackTypes.values()) {
          maxCount = Math.max(maxCount, count);
        }
        
        return maxCount / p.feedbackHistory.length > 0.7;
      });
      
      const highConsistencySuccessRate = highConsistencyProblems.length > 0 
        ? highConsistencyProblems.filter(p => p.qualityScore.overall >= 7).length / highConsistencyProblems.length 
        : 0;
      
      // 分析低置信度的影响
      const lowConfidenceProblems = validatedProblems.filter(p => p.qualityScore.confidence < 0.6);
      const lowConfidenceSuccessRate = lowConfidenceProblems.length > 0 
        ? lowConfidenceProblems.filter(p => p.qualityScore.overall >= 7).length / lowConfidenceProblems.length 
        : 0;
      
      // 根据分析结果调整因子
      const newFactors = { ...currentFactors };
      
      // 调整证据提升因子
      if (highEvidenceSuccessRate > successRate + 0.1) {
        // 证据与成功强相关，增加其重要性
        newFactors.highEvidenceBoost = Math.min(1.0, currentFactors.highEvidenceBoost + adjustedLearningRate);
      } else if (highEvidenceSuccessRate < successRate - 0.1) {
        // 证据与成功不强相关，降低其重要性
        newFactors.highEvidenceBoost = Math.max(0.1, currentFactors.highEvidenceBoost - adjustedLearningRate);
      }
      
      // 调整迭代提升因子
      if (highIterationSuccessRate > successRate + 0.1) {
        newFactors.iterationBoost = Math.min(0.5, currentFactors.iterationBoost + adjustedLearningRate);
      } else if (highIterationSuccessRate < successRate - 0.1) {
        newFactors.iterationBoost = Math.max(0.05, currentFactors.iterationBoost - adjustedLearningRate);
      }
      
      // 调整反馈一致性提升因子
      if (highConsistencySuccessRate > successRate + 0.1) {
        newFactors.feedbackConsistencyBoost = Math.min(0.8, currentFactors.feedbackConsistencyBoost + adjustedLearningRate);
      } else if (highConsistencySuccessRate < successRate - 0.1) {
        newFactors.feedbackConsistencyBoost = Math.max(0.1, currentFactors.feedbackConsistencyBoost - adjustedLearningRate);
      }
      
      // 调整低置信度调整因子
      if (lowConfidenceSuccessRate > successRate - 0.05) {
        // 低置信度对成功率影响不大，减少惩罚
        newFactors.lowConfidenceAdjustment = Math.min(-0.1, currentFactors.lowConfidenceAdjustment + adjustedLearningRate);
      } else if (lowConfidenceSuccessRate < successRate - 0.2) {
        // 低置信度与失败强相关，增加惩罚
        newFactors.lowConfidenceAdjustment = Math.max(-1.0, currentFactors.lowConfidenceAdjustment - adjustedLearningRate);
      }
      
      // 更新调整因子
      this.adaptiveFactors.set(domain, newFactors);
      
      // 更新领域性能
      const performance = this.domainPerformance.get(domain) || {
        averageQuality: 0,
        successRate: 0,
        samples: 0
      };
      
      // 计算平均质量分数
      const avgQuality = domainProblems.reduce((sum, p) => sum + p.qualityScore.overall, 0) / domainProblems.length;
      
      // 使用移动平均来保留历史数据
      const newSamples = performance.samples + domainProblems.length;
      const weightOld = performance.samples / Math.max(1, newSamples);
      const weightNew = domainProblems.length / Math.max(1, newSamples);
      
      performance.averageQuality = (performance.averageQuality * weightOld) + (avgQuality * weightNew);
      performance.successRate = (performance.successRate * weightOld) + (successRate * weightNew);
      performance.samples = newSamples;
      
      this.domainPerformance.set(domain, performance);
      
      logger.info(
        {}, 
        `Updated threshold adjustment factors for domain '${domain}' based on ${validatedProblems.length} problems`
      );
    }
  }
  
  /**
   * Update global quality threshold based on problem distribution
   */
  public updateGlobalThreshold(problems: Problem[]): void {
    if (!this.config.adaptiveQualityThresholds || problems.length < 5) {
      return; // Don't adjust with too few problems
    }
    
    // Calculate average quality
    const averageQuality = problems.reduce(
      (sum, p) => sum + p.qualityScore.overall, 0
    ) / problems.length;
    
    // 动态学习优化阈值
    this.learnFromProblems(problems);
    
    // 更细致的阈值调整逻辑
    // 如果平均质量很高或很低，更积极地调整
    let adjustmentFactor = 0.9;  // 默认调整因子
    
    if (averageQuality > 8) {
      // 如果问题普遍高质量，提高标准
      adjustmentFactor = 1.05;
    } else if (averageQuality < 4) {
      // 如果问题普遍低质量，适当降低标准
      adjustmentFactor = 0.8;
    }
    
    // 确保阈值在5-9之间
    this.globalThreshold = Math.min(9, Math.max(5, averageQuality * adjustmentFactor));
    
    logger.debug({}, `Updated global quality threshold to ${this.globalThreshold.toFixed(2)} based on ${problems.length} problems with avg quality ${averageQuality.toFixed(2)}`);
  }
} 