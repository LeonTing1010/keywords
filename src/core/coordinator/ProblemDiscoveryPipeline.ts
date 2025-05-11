/**
 * Problem Discovery Pipeline
 * 
 * Orchestrates the recursive problem discovery and refinement process,
 * managing interaction between specialized agents to identify, validate,
 * refine, and prioritize valuable unsolved problems.
 */

import { logger } from '../../infra/logger';
import { 
  Problem, 
  DiscoveryAgent, 
  ProblemDiscoveryConfig, 
  DiscoveryResult,
  AgentFeedback,
  QualityThresholds,
  Evidence
} from '../../types/discovery';
import { v4 as uuidv4 } from 'uuid';
import { SimilarityDetector } from './SimilarityDetector';
import { QualityEvaluator } from './QualityEvaluator';
import { FeedbackProcessor } from './FeedbackProcessor';

export class ProblemDiscoveryPipeline {
  private config: ProblemDiscoveryConfig;
  private agents: Map<string, DiscoveryAgent> = new Map();
  private similarityDetector: SimilarityDetector;
  private qualityEvaluator: QualityEvaluator;
  private feedbackProcessor: FeedbackProcessor;
  private problems: Map<string, Problem> = new Map();
  private result: DiscoveryResult;
  private startTime: number = 0;
  private currentIteration: number = 0;
  private explorationStrategies: Map<string, (problems: Problem[]) => Problem[]> = new Map();
  private currentStrategy: string = 'feedback-driven';
  private strategyPerformance: Map<string, { successRate: number, samples: number }> = new Map();

  constructor(config: ProblemDiscoveryConfig) {
    this.config = this.validateAndNormalizeConfig(config);
    this.similarityDetector = new SimilarityDetector(this.config.similarityDetection);
    this.qualityEvaluator = new QualityEvaluator(this.config);
    this.feedbackProcessor = new FeedbackProcessor(this.config.feedbackIncorporationStrategy);
    this.result = this.initializeResult();
    
    this.registerExplorationStrategies();
  }

  /**
   * Register an agent with the pipeline
   */
  public registerAgent(agent: DiscoveryAgent): void {
    this.agents.set(agent.id, agent);
    logger.debug({ agent: agent.name, type: agent.type }, `Registered agent: ${agent.name} (${agent.type})`);
  }

  /**
   * Validate and normalize configuration
   */
  private validateAndNormalizeConfig(config: Partial<ProblemDiscoveryConfig>): ProblemDiscoveryConfig {
    // Apply defaults for any missing configuration
    return {
      maxIterations: config.maxIterations || 3,
      maxProblemsToTrack: config.maxProblemsToTrack || 20,
      initialQualityThreshold: config.initialQualityThreshold || 6,
      adaptiveQualityThresholds: config.adaptiveQualityThresholds !== false,
      domainSpecificThresholds: config.domainSpecificThresholds || [],
      similarityDetection: config.similarityDetection || {
        algorithm: 'hybrid',
        threshold: 0.7,
        considerEvidence: true,
        useWeightedFactors: true,
        weightFactors: {
          formulationSimilarity: 0.6,
          audienceSimilarity: 0.15,
          domainSimilarity: 0.15,
          evidenceSimilarity: 0.1
        }
      },
      enableBranching: config.enableBranching !== false,
      maxBranchesPerProblem: config.maxBranchesPerProblem || 3,
      minFeedbackConfidence: config.minFeedbackConfidence || 0.7,
      feedbackIncorporationStrategy: config.feedbackIncorporationStrategy || 'confidence_weighted',
      agents: config.agents || {
        explorer: true,
        simulator: true,
        evaluator: true,
        strategist: true
      }
    };
  }

  /**
   * Initialize result tracking object
   */
  private initializeResult(): DiscoveryResult {
    return {
      sourceKeyword: '',
      discoveredProblems: [],
      iterations: [],
      processingMetrics: {
        totalTimeMs: 0,
        totalIterations: 0,
        initialProblemCount: 0,
        finalProblemCount: 0,
        qualityImprovement: 0,
        branchesExplored: 0,
        feedbacksProcessed: 0,
        mergesPerformed: 0
      }
    };
  }

  /**
   * Execute the problem discovery pipeline
   */
  public async discover(keyword: string): Promise<DiscoveryResult> {
    this.startTime = Date.now();
    this.currentIteration = 0;
    this.problems.clear();
    this.result = this.initializeResult();
    this.result.sourceKeyword = keyword;

    logger.info({ keyword }, `Starting problem discovery for keyword: ${keyword}`);

    try {
      // Initialize with explorer agent
      await this.initializeProblems(keyword);
      
      // Track initial metrics
      this.result.processingMetrics.initialProblemCount = this.problems.size;
      
      // Iterative refinement process
      while (this.currentIteration < this.config.maxIterations) {
        this.currentIteration++;
        
        logger.info(`Starting iteration ${this.currentIteration}/${this.config.maxIterations}`);
        const iterationStartTime = Date.now();
        
        // Process with each agent in sequence
        await this.runIterationStages();
        
        // Check for convergence or stopping conditions
        if (this.shouldStopIteration()) {
          logger.info(`Stopping iterations early due to convergence criteria`);
          break;
        }
        
        // Record iteration metrics
        this.recordIterationMetrics(iterationStartTime);
      }
      
      // Finalize results
      this.finalizeResults();
      
      return this.result;
    } catch (error: any) {
      logger.error(`Error in problem discovery pipeline: ${error.message}`, { 
        error, 
        keyword 
      });
      throw error;
    }
  }

  /**
   * Initialize problems with explorer agent
   */
  private async initializeProblems(keyword: string): Promise<void> {
    const explorerAgent = Array.from(this.agents.values())
      .find(agent => agent.type === 'explorer');
    
    if (!explorerAgent) {
      throw new Error('Explorer agent is required but not registered');
    }
    
    logger.debug(`Initializing problems with explorer agent: ${explorerAgent.name}`);
    
    const initialResults = await explorerAgent.process({ keyword });
    const initialProblems = this.createProblemsFromExplorerResults(initialResults, keyword);
    
    for (const problem of initialProblems) {
      this.problems.set(problem.id, problem);
    }
    
    logger.info(`Initialized ${initialProblems.length} problems from explorer agent`);
  }

  /**
   * Convert explorer results to problem objects
   */
  private createProblemsFromExplorerResults(explorerResults: any, keyword: string): Problem[] {
    const problems: Problem[] = [];
    
    // Extract problems from explorer results (format depends on explorer agent implementation)
    const rawProblems = explorerResults.highValueProblems || [];
    
    for (const rawProblem of rawProblems) {
      const problem: Problem = {
        id: uuidv4(),
        originalFormulation: rawProblem.question || '',
        currentFormulation: rawProblem.question || '',
        domain: [keyword],
        qualityScore: {
          authenticity: rawProblem.overallScore || 5,
          urgency: 5, // Default values to be refined later
          scale: 5,
          solutionGap: 5,
          feasibility: 5,
          overall: rawProblem.overallScore || 5,
          confidence: 0.7
        },
        evidence: [],
        evolutionPath: [],
        feedbackHistory: [],
        relatedProblems: [],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'explorer',
          updatedBy: 'explorer',
          iterationCount: 0,
          sourceKeyword: keyword,
          explorationStatus: 'initial'
        }
      };
      
      // Add initial evidence if available
      if (rawProblem.originalQuery) {
        problem.evidence.push({
          type: 'query_suggestion',
          source: 'search_engine',
          content: rawProblem.originalQuery,
          relevanceScore: 1.0,
          timestamp: new Date().toISOString()
        });
      }
      
      problems.push(problem);
    }
    
    return problems;
  }

  /**
   * 注册各种探索策略
   */
  private registerExplorationStrategies(): void {
    // 深度优先策略 - 优先探索高质量问题
    this.explorationStrategies.set('depth-first', (problems: Problem[]) => {
      return [...problems].sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);
    });
    
    // 广度优先策略 - 优先探索较少迭代的问题
    this.explorationStrategies.set('breadth-first', (problems: Problem[]) => {
      return [...problems].sort((a, b) => a.metadata.iterationCount - b.metadata.iterationCount);
    });
    
    // 证据驱动策略 - 优先探索证据较少的问题
    this.explorationStrategies.set('evidence-driven', (problems: Problem[]) => {
      return [...problems].sort((a, b) => a.evidence.length - b.evidence.length);
    });
    
    // 反馈驱动策略 - 优先探索有更多反馈的问题
    this.explorationStrategies.set('feedback-driven', (problems: Problem[]) => {
      return [...problems].sort((a, b) => b.feedbackHistory.length - a.feedbackHistory.length);
    });
    
    // 初始化策略性能
    for (const strategy of this.explorationStrategies.keys()) {
      this.strategyPerformance.set(strategy, { successRate: 0, samples: 0 });
    }
  }

  /**
   * Run all stages of a single iteration
   */
  private async runIterationStages(): Promise<void> {
    // 如果启用了自适应阈值，先优化当前策略
    if (this.config.adaptiveQualityThresholds && this.currentIteration > 0) {
      this.updateExplorationStrategy();
    }
    
    // 1. Simulate user journeys to validate problems
    await this.runSimulationStage();
    
    // 2. Evaluate solution gaps
    await this.runEvaluationStage();
    
    // 3. Generate opportunities and refine problems
    await this.runStrategyStage();
    
    // 4. 处理反馈和精炼
    await this.processFeedbackAndRefinements();
    
    // 5. 探测和合并相似问题
    await this.detectAndMergeSimilarProblems();
    
    // 6. 探索分支
    if (this.config.enableBranching) {
      await this.exploreBranches();
    }
    
    // 7. 删减问题
    this.pruneProblems();
    
    // 8. 更新当前策略的绩效
    this.updateStrategyPerformance();
  }
  
  /**
   * 更新探索策略
   */
  private updateExplorationStrategy(): void {
    if (!this.config.adaptiveQualityThresholds) {
      return;
    }
    
    // 获取所有策略的性能数据
    const performances = Array.from(this.strategyPerformance.entries())
      .filter(([_, perf]) => perf.samples > 0)
      .map(([strategy, perf]) => ({
        strategy,
        successRate: perf.successRate,
        samples: perf.samples
      }));
    
    // 如果没有足够的性能数据，使用默认策略
    if (performances.length === 0) {
      this.currentStrategy = 'feedback-driven';
      return;
    }
    
    // 基于样本数量加权的探索-利用平衡
    // 使用UCB (Upper Confidence Bound) 算法进行多臂老虎机优化
    const totalSamples = performances.reduce((sum, p) => sum + p.samples, 0);
    const logTotalSamples = Math.log(Math.max(totalSamples, 1));
    
    let bestStrategy = '';
    let bestScore = -Infinity;
    
    for (const perf of performances) {
      // UCB公式: 成功率 + sqrt(2 * log(总样本) / 策略样本)
      const explorationBonus = Math.sqrt(2 * logTotalSamples / perf.samples);
      const ucbScore = perf.successRate + explorationBonus;
      
      if (ucbScore > bestScore) {
        bestScore = ucbScore;
        bestStrategy = perf.strategy;
      }
    }
    
    // 如果找到最佳策略则使用
    if (bestStrategy) {
      if (bestStrategy !== this.currentStrategy) {
        logger.info(
          {}, 
          `Changed exploration strategy from '${this.currentStrategy}' to '${bestStrategy}' based on performance data`
        );
      }
      
      this.currentStrategy = bestStrategy;
    }
  }
  
  /**
   * 更新当前策略的绩效
   */
  private updateStrategyPerformance(): void {
    if (!this.config.adaptiveQualityThresholds) {
      return;
    }
    
    // 获取当前迭代的问题
    const problems = Array.from(this.problems.values());
    
    // 计算成功率 (质量评分 >= 7 的问题比例)
    const successfulProblems = problems.filter(p => p.qualityScore.overall >= 7);
    const successRate = problems.length > 0 ? successfulProblems.length / problems.length : 0;
    
    // 获取当前策略性能
    const performance = this.strategyPerformance.get(this.currentStrategy) || { successRate: 0, samples: 0 };
    
    // 使用指数移动平均更新
    const newSamples = performance.samples + problems.length;
    const alpha = Math.min(0.3, problems.length / Math.max(1, newSamples)); // 动态学习率
    
    performance.successRate = (1 - alpha) * performance.successRate + alpha * successRate;
    performance.samples = newSamples;
    
    this.strategyPerformance.set(this.currentStrategy, performance);
    
    logger.debug(
      {}, 
      `Updated performance for strategy '${this.currentStrategy}': success rate ${performance.successRate.toFixed(2)} (${newSamples} samples total)`
    );
  }
  
  /**
   * 对问题集合应用当前探索策略
   */
  private applyExplorationStrategy(problems: Problem[]): Problem[] {
    const strategyFn = this.explorationStrategies.get(this.currentStrategy);
    
    if (!strategyFn) {
      // 策略不存在，使用默认排序（按质量分数）
      return [...problems].sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);
    }
    
    return strategyFn(problems);
  }
  
  /**
   * 转换问题为Agent可处理的格式
   * 提取必要信息并简化输入
   */
  private convertProblemToAgentFormat(problem: Problem): any {
    return {
      id: problem.id,
      formulation: problem.currentFormulation,
      originalFormulation: problem.originalFormulation,
      domain: problem.domain,
      targetAudience: problem.targetAudience,
      evidence: problem.evidence,
      qualityScore: problem.qualityScore,
      iterationCount: problem.metadata.iterationCount,
      explorationStatus: problem.metadata.explorationStatus,
      feedbackCount: problem.feedbackHistory.length
    };
  }
  
  /**
   * Override to run simulation with adaptive prioritization
   */
  private async runSimulationStage(): Promise<void> {
    const simulatorAgent = Array.from(this.agents.values())
      .find(agent => agent.type === 'simulator');
    
    if (!simulatorAgent) {
      logger.debug({}, 'Skipping simulation stage: No simulator agent registered');
      return;
    }
    
    logger.info({}, 'Running simulation stage to validate problems');
    
    // 获取当前问题列表
    const problems = Array.from(this.problems.values());
    
    // 应用自适应优先级排序
    const prioritizedProblems = this.config.adaptiveQualityThresholds 
      ? this.applyExplorationStrategy(problems)
      : problems;
      
    if (this.config.adaptiveQualityThresholds) {
      logger.debug(
        {}, 
        `Applied '${this.currentStrategy}' exploration strategy for ${prioritizedProblems.length} problems`
      );
    }
    
    for (const problem of prioritizedProblems) {
      // Skip problems already in final status
      if (problem.metadata.explorationStatus === 'finalized') {
        continue;
      }
      
      // Track current exploration status
      problem.metadata.explorationStatus = 'validating';
      problem.metadata.updatedAt = new Date().toISOString();
      
      try {
        logger.debug(
          {}, 
          `Simulating user journey for problem: ${problem.id} - "${problem.currentFormulation.substring(0, 50)}..."`
        );
        
        const simulationResult = await simulatorAgent.process({
          problem: this.convertProblemToAgentFormat(problem),
          iteration: this.currentIteration
        });
        
        this.updateProblemFromSimulation(problem, simulationResult);
      } catch (error: any) {
        logger.error(
          { error, problemId: problem.id }, 
          `Error in simulation for problem ${problem.id}: ${error.message}`
        );
      }
    }
  }

  /**
   * Update problem with simulation insights
   */
  private updateProblemFromSimulation(problem: Problem, simulationResult: any): void {
    // Update quality scores based on validation
    if (simulationResult.validityScore) {
      problem.qualityScore.authenticity = simulationResult.validityScore;
      
      // If detailed scores available, use them
      if (simulationResult.validation?.userValidations) {
        const validations = simulationResult.validation.userValidations;
        const avgUrgency = validations.reduce((sum: number, v: any) => sum + (v.urgencyScore || 0), 0) / validations.length;
        const avgPain = validations.reduce((sum: number, v: any) => sum + (v.painPointScore || 0), 0) / validations.length;
        const avgFrequency = validations.reduce((sum: number, v: any) => sum + (v.frequencyScore || 0), 0) / validations.length;
        
        problem.qualityScore.urgency = Math.round(avgUrgency * 10) / 10;
        problem.qualityScore.scale = Math.round(avgFrequency * 10) / 10;
        
        // Update confidence
        problem.qualityScore.confidence = 0.8; // Higher confidence with user validation
      }
      
      // Update target audience if available
      if (simulationResult.targetAudience) {
        problem.targetAudience = Array.isArray(simulationResult.targetAudience) 
          ? simulationResult.targetAudience 
          : [simulationResult.targetAudience];
      }
      
      // Recalculate overall score
      problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
      
      // Update metadata
      problem.metadata.updatedAt = new Date().toISOString();
      problem.metadata.updatedBy = 'simulator';
      problem.metadata.explorationStatus = 'validating';
    }
  }
  
  /**
   * Add user journey evidence to a problem
   */
  private addUserJourneyEvidence(problem: Problem, userJourney: any): void {
    // Add evidence from user journey simulation if available
    if (userJourney.searchSteps && userJourney.searchSteps.length > 0) {
      // Add each significant step as evidence
      for (const step of userJourney.searchSteps) {
        // Only include steps with pain points or low satisfaction
        if (step.painPoints?.length > 0 || (step.satisfaction && step.satisfaction < 0.5)) {
          const evidence: Evidence = {
            type: 'user_journey',
            source: 'journey_simulator',
            content: `Query: "${step.query}" - Satisfaction: ${step.satisfaction} - Pain Points: ${step.painPoints?.join(', ') || 'none'}`,
            relevanceScore: 0.9, // High relevance for direct user simulation
            timestamp: new Date().toISOString(),
            metadata: {
              satisfaction: step.satisfaction,
              painPoints: step.painPoints,
              query: step.query,
              nextAction: step.nextAction
            }
          };
          
          problem.evidence.push(evidence);
        }
      }
    }
    
    // Add overall journey evidence
    if (userJourney.satisfactionReached !== undefined) {
      const evidence: Evidence = {
        type: 'user_journey',
        source: 'journey_simulator',
        content: `User journey simulation ${userJourney.satisfactionReached ? 'found' : 'did not find'} a satisfactory solution. ${userJourney.painPoints?.length || 0} pain points identified.`,
        relevanceScore: 0.95,
        timestamp: new Date().toISOString(),
        metadata: {
          satisfactionReached: userJourney.satisfactionReached,
          averageSatisfaction: userJourney.averageSatisfactionScore,
          stepsCount: userJourney.searchSteps?.length || 0,
          painPointsCount: userJourney.painPoints?.length || 0
        }
      };
      
      problem.evidence.push(evidence);
    }
  }
  
  /**
   * Calculate weighted quality score
   */
  private calculateWeightedScore(score: any): number {
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
      (score.authenticity || 5) * weights.authenticity +
      (score.urgency || 5) * weights.urgency +
      (score.scale || 5) * weights.scale +
      (score.solutionGap || 5) * weights.solutionGap +
      (score.feasibility || 5) * weights.feasibility;
    
    // Round to one decimal place
    return Math.round(weightedScore * 10) / 10;
  }

  /**
   * Record metrics for the current iteration
   */
  private recordIterationMetrics(iterationStartTime: number): void {
    const iterationTimeMs = Date.now() - iterationStartTime;
    const problems = Array.from(this.problems.values());
    const avgQuality = problems.reduce((sum, p) => sum + p.qualityScore.overall, 0) / (problems.length || 1);
    const topProblem = problems.sort((a, b) => b.qualityScore.overall - a.qualityScore.overall)[0];
    
    this.result.iterations.push({
      iterationNumber: this.currentIteration,
      timestamp: new Date().toISOString(),
      problemCount: problems.length,
      averageQualityScore: avgQuality,
      topProblemId: topProblem?.id || '',
      processingTimeMs: iterationTimeMs
    });
    
    logger.info(`Completed iteration ${this.currentIteration} in ${iterationTimeMs}ms. Average quality: ${avgQuality.toFixed(2)}`);
  }

  /**
   * Check whether to stop iteration based on convergence criteria
   */
  private shouldStopIteration(): boolean {
    // If we don't have any iterations yet, don't stop
    if (this.result.iterations.length === 0) {
      return false;
    }
    
    const latestIteration = this.result.iterations[this.result.iterations.length - 1];
    
    // If we have no problems, continue for at least one more iteration
    if (this.problems.size === 0) {
      return false;
    }

    // If we have only one iteration, continue
    if (this.result.iterations.length < 2) {
      return false;
    }
    
    // Get previous iteration metrics
    const previousIteration = this.result.iterations[this.result.iterations.length - 2];
    
    // Check for quality improvement
    const qualityDifference = latestIteration.averageQualityScore - previousIteration.averageQualityScore;
    
    // If quality is not improving significantly and we have decent problems, we can stop
    if (qualityDifference < 0.1 && latestIteration.averageQualityScore > 7.5) {
      logger.info(`Quality converged: ${previousIteration.averageQualityScore} → ${latestIteration.averageQualityScore}`);
      return true;
    }
    
    return false;
  }

  /**
   * Finalize results before returning
   */
  private finalizeResults(): void {
    const endTime = Date.now();
    this.result.processingMetrics.totalTimeMs = endTime - this.startTime;
    this.result.processingMetrics.totalIterations = this.currentIteration;
    this.result.processingMetrics.finalProblemCount = this.problems.size;
    
    // Sort problems by quality score for the final result
    const sortedProblems = Array.from(this.problems.values())
      .sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);
    
    this.result.discoveredProblems = sortedProblems;
    
    // Calculate quality improvement
    if (sortedProblems.length > 0 && this.result.iterations.length > 0) {
      const initialAvgQuality = this.result.iterations[0].averageQualityScore;
      const finalAvgQuality = sortedProblems.reduce(
        (sum, p) => sum + p.qualityScore.overall, 0) / sortedProblems.length;
      
      this.result.processingMetrics.qualityImprovement = finalAvgQuality - initialAvgQuality;
    }
    
    logger.info(`Problem discovery completed. Found ${sortedProblems.length} problems with average quality ${sortedProblems.reduce((sum, p) => sum + p.qualityScore.overall, 0) / (sortedProblems.length || 1)}`);
  }

  /**
   * Run the solution evaluation stage
   * This stage analyzes existing solutions for problems and identifies gaps
   */
  private async runEvaluationStage(): Promise<void> {
    const evaluatorAgent = Array.from(this.agents.values())
      .find(agent => agent.type === 'evaluator');
    
    if (!evaluatorAgent) {
      logger.warn('Evaluator agent not found, skipping evaluation stage');
      return;
    }
    
    logger.info(`Running evaluation stage with ${this.problems.size} problems`);
    
    try {
      // Prepare problems for evaluation
      const problemsArray = Array.from(this.problems.values());
      
      // Prioritize problems by quality score to evaluate the most promising ones first
      const prioritizedProblems = problemsArray
        .sort((a, b) => b.qualityScore.overall - a.qualityScore.overall)
        .slice(0, Math.min(problemsArray.length, 10)); // Limit to top 10 problems
      
      logger.debug(`Selected ${prioritizedProblems.length} problems for detailed solution gap analysis`);
      
      // Process problems in batches if there are many
      const batchSize = 3; // Smaller batch size due to more intensive analysis
      const batches = [];
      
      for (let i = 0; i < prioritizedProblems.length; i += batchSize) {
        batches.push(prioritizedProblems.slice(i, i + batchSize));
      }
      
      // Process each batch
      let feedbackCollected = 0;
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing evaluation batch ${i+1}/${batches.length} with ${batch.length} problems`);
        
        // Prepare input for evaluator agent
        const evaluationInput = {
          problems: batch,
          sourceKeyword: this.result.sourceKeyword,
          iteration: this.currentIteration
        };
        
        // Run evaluation
        const evaluationResults = await evaluatorAgent.process(evaluationInput);
        
        // Process evaluation results
        for (const result of evaluationResults.problemGapAnalyses || []) {
          const problemId = result.id;
          const problem = this.problems.get(problemId);
          
          if (!problem) {
            logger.warn(`Evaluation returned result for unknown problem ID: ${problemId}`);
            continue;
          }
          
          // Update problem with evaluation insights
          this.updateProblemFromEvaluation(problem, result);
          
          // Get feedback from evaluator agent
          const feedback = await evaluatorAgent.provideFeedback(problem);
          feedbackCollected++;
          
          // Add feedback to problem if not already present
          if (!problem.feedbackHistory.some(f => f.agentId === feedback.agentId && f.timestamp === feedback.timestamp)) {
            problem.feedbackHistory.push(feedback);
          }
          
          // Add solution gap evidence
          if (result.solutionGapAnalysis) {
            this.addSolutionGapEvidence(problem, result.solutionGapAnalysis);
          }
        }
        
        // Also analyze general content for the keyword if there are content analysis results
        if (evaluationResults?.contentAnalysis?.qualityAnalysis) {
          this.processContentAnalysis(evaluationResults.contentAnalysis);
        }
      }
      
      logger.info(`Evaluation stage completed. Processed ${prioritizedProblems.length} problems, collected ${feedbackCollected} feedback items`);
    } catch (error: any) {
      logger.error(`Error in evaluation stage: ${error.message}`, { error });
      // Continue with next stage despite errors
    }
  }
  
  /**
   * Update problem with evaluation insights
   */
  private updateProblemFromEvaluation(problem: Problem, evaluationResult: any): void {
    // Update solution gap score based on evaluation
    if (evaluationResult.gapSeverity !== undefined) {
      problem.qualityScore.solutionGap = evaluationResult.gapSeverity;
      
      // Update feasibility if available
      if (evaluationResult.solutionGapAnalysis?.marketGapAnalysis?.opportunitySize) {
        // Set feasibility based on opportunity size (inverting the relationship)
        const opportunitySize = evaluationResult.solutionGapAnalysis.marketGapAnalysis.opportunitySize;
        if (opportunitySize.toLowerCase().includes('大')) {
          problem.qualityScore.feasibility = 8; // Large opportunity often means feasible solution
        } else if (opportunitySize.toLowerCase().includes('中')) {
          problem.qualityScore.feasibility = 6;
        } else if (opportunitySize.toLowerCase().includes('小')) {
          problem.qualityScore.feasibility = 4; // Small opportunity might be harder to address
        }
      }
      
      // Recalculate overall score
      problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
      
      // Update confidence based on evaluation
      if (evaluationResult.solutionGapAnalysis?.marketGapAnalysis) {
        // Higher confidence with detailed market analysis
        problem.qualityScore.confidence = Math.min(1.0, problem.qualityScore.confidence + 0.1);
      }
      
      // Update metadata
      problem.metadata.updatedAt = new Date().toISOString();
      problem.metadata.updatedBy = 'evaluator';
      problem.metadata.explorationStatus = 'validating';
    }
    
    // If there's a value score, use it to influence overall score
    if (evaluationResult.valueScore !== undefined) {
      // Blend existing overall score with value score (70/30 split)
      problem.qualityScore.overall = Math.round(
        (problem.qualityScore.overall * 0.7 + evaluationResult.valueScore * 0.3) * 10
      ) / 10;
    }
  }
  
  /**
   * Add solution gap evidence to a problem
   */
  private addSolutionGapEvidence(problem: Problem, gapAnalysis: any): void {
    // Add evidence from solution gap analysis
    
    // Add evidence for each evaluated solution
    if (gapAnalysis.solutionEvaluations && gapAnalysis.solutionEvaluations.length > 0) {
      for (const solution of gapAnalysis.solutionEvaluations) {
        // Only include solutions with notable weaknesses
        const weaknesses = solution.weaknesses || [];
        if (weaknesses.length > 0 || solution.overallScore < 6) {
          const evidence: Evidence = {
            type: 'content_gap',
            source: solution.url || 'solution_analysis',
            content: `Solution "${solution.title}" has weaknesses: ${weaknesses.join(', ')}. Overall score: ${solution.overallScore}/10`,
            relevanceScore: 0.85,
            timestamp: new Date().toISOString(),
            metadata: {
              solutionTitle: solution.title,
              url: solution.url,
              overallScore: solution.overallScore,
              weaknesses,
              strengths: solution.strengths,
              coverageScore: solution.coverageScore,
              qualityScore: solution.qualityScore
            }
          };
          
          problem.evidence.push(evidence);
        }
      }
    }
    
    // Add overall market gap evidence
    if (gapAnalysis.marketGapAnalysis) {
      const marketGap = gapAnalysis.marketGapAnalysis;
      const evidence: Evidence = {
        type: 'competitor_analysis',
        source: 'gap_analyzer',
        content: `Market gap severity: ${marketGap.gapSeverity}/10. Unmet needs: ${(marketGap.unmetNeeds || []).join(', ')}. Opportunity size: ${marketGap.opportunitySize || 'Unknown'}`,
        relevanceScore: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          gapSeverity: marketGap.gapSeverity,
          unmetNeeds: marketGap.unmetNeeds,
          opportunitySize: marketGap.opportunitySize,
          competitiveLandscape: marketGap.competitiveLandscape,
          mainDeficiencies: marketGap.mainDeficiencies
        }
      };
      
      problem.evidence.push(evidence);
    }
  }
  
  /**
   * Process general content analysis for the keyword
   */
  private processContentAnalysis(contentAnalysis: any): void {
    // This would process general content analysis for the keyword
    // For example, finding common gaps across all content
    
    if (!contentAnalysis.qualityAnalysis) {
      return;
    }
    
    // Extract general content gaps to potentially create new problems
    const contentGaps = contentAnalysis.qualityAnalysis.contentGaps || [];
    const significantGaps = contentGaps.filter((gap: any) => gap.severity >= 7);
    
    if (significantGaps.length === 0) {
      return;
    }
    
    logger.debug(`Found ${significantGaps.length} significant content gaps from general analysis`);
    
    // For each significant gap, either create a new problem or enhance existing problems
    for (const gap of significantGaps) {
      // Check if this gap matches any existing problem
      let matchedProblem = false;
      
      for (const problem of this.problems.values()) {
        // Simple check - see if gap description appears in problem formulation
        const normalizedGap = gap.description.toLowerCase();
        const normalizedProblem = problem.currentFormulation.toLowerCase();
        
        if (normalizedProblem.includes(normalizedGap) || normalizedGap.includes(normalizedProblem)) {
          // Add content gap evidence to the existing problem
          this.addContentGapEvidence(problem, gap);
          matchedProblem = true;
          break;
        }
      }
      
      // If no match, consider creating a new problem from this gap
      if (!matchedProblem && this.problems.size < this.config.maxProblemsToTrack) {
        this.createProblemFromContentGap(gap);
      }
    }
  }
  
  /**
   * Add content gap evidence to a problem
   */
  private addContentGapEvidence(problem: Problem, gap: any): void {
    const evidence: Evidence = {
      type: 'content_gap',
      source: 'content_analysis',
      content: `Content gap: ${gap.description}. Severity: ${gap.severity}/10`,
      relevanceScore: 0.85,
      timestamp: new Date().toISOString(),
      metadata: {
        description: gap.description,
        severity: gap.severity,
        importance: gap.importance,
        affectedUserNeeds: gap.affectedUserNeeds
      }
    };
    
    problem.evidence.push(evidence);
    
    // Potentially update solution gap score if this is more severe
    if (gap.severity > problem.qualityScore.solutionGap) {
      problem.qualityScore.solutionGap = gap.severity;
      // Recalculate overall score
      problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
    }
  }
  
  /**
   * Create a new problem from a significant content gap
   */
  private createProblemFromContentGap(gap: any): void {
    const problemId = uuidv4();
    
    const problem: Problem = {
      id: problemId,
      originalFormulation: gap.description,
      currentFormulation: gap.description,
      domain: [this.result.sourceKeyword],
      qualityScore: {
        authenticity: 7, // Relatively high authenticity since it came from content analysis
        urgency: 6,
        scale: 6,
        solutionGap: gap.severity || 7,
        feasibility: 5,
        overall: 0, // Will be calculated
        confidence: 0.7
      },
      evidence: [{
        type: 'content_gap',
        source: 'content_analysis',
        content: `Content gap: ${gap.description}. Severity: ${gap.severity}/10`,
        relevanceScore: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          description: gap.description,
          severity: gap.severity,
          importance: gap.importance,
          affectedUserNeeds: gap.affectedUserNeeds
        }
      }],
      evolutionPath: [],
      feedbackHistory: [],
      relatedProblems: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'evaluator',
        updatedBy: 'evaluator',
        iterationCount: 0,
        sourceKeyword: this.result.sourceKeyword,
        explorationStatus: 'initial'
      }
    };
    
    // Calculate overall score
    problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
    
    // Add to problems collection
    this.problems.set(problemId, problem);
    
    logger.info(`Created new problem from content gap: "${gap.description}"`);
  }

  /**
   * Run the strategy stage
   * This stage analyzes problems, designs solution approaches, and generates refinements
   */
  private async runStrategyStage(): Promise<void> {
    const strategistAgent = Array.from(this.agents.values())
      .find(agent => agent.type === 'strategist');
    
    if (!strategistAgent) {
      logger.warn('Strategist agent not found, skipping strategy stage');
      return;
    }
    
    logger.info(`Running strategy stage with ${this.problems.size} problems`);
    
    try {
      // Prepare problems for strategy development
      const problemsArray = Array.from(this.problems.values());
      
      // Prioritize problems by quality score
      const prioritizedProblems = problemsArray
        .sort((a, b) => b.qualityScore.overall - a.qualityScore.overall)
        .slice(0, Math.min(problemsArray.length, 10)); // Focus on top 10 problems
      
      logger.debug(`Selected ${prioritizedProblems.length} problems for strategy development`);
      
      // Prepare input for strategist agent
      const strategyInput = {
        problems: prioritizedProblems,
        sourceKeyword: this.result.sourceKeyword,
        iteration: this.currentIteration,
        previousIterationResults: this.currentIteration > 1 ? 
          this.result.iterations[this.currentIteration - 2] : null
      };
      
      // Run strategy development
      const strategyResults = await strategistAgent.process(strategyInput);
      
      // Process prioritized opportunities
      const opportunities = strategyResults.prioritizedOpportunities || [];
      if (opportunities.length > 0) {
        logger.debug(`Received ${opportunities.length} prioritized opportunities from strategist`);
        this.processPrioritizedOpportunities(opportunities, prioritizedProblems);
      }
      
      // Process MVP designs if available
      const mvpDesigns = strategyResults.mvpDesigns || [];
      if (mvpDesigns.length > 0) {
        logger.debug(`Received ${mvpDesigns.length} MVP designs from strategist`);
        this.processMVPDesigns(mvpDesigns, prioritizedProblems);
      }
      
      // Process problem refinements if available
      const problemRefinements = strategyResults.problemRefinements || [];
      if (problemRefinements.length > 0) {
        logger.debug(`Received ${problemRefinements.length} problem refinements from strategist`);
        this.processProblemRefinements(problemRefinements);
      }
      
      // Process feedback loops if available (for generating new keywords)
      const feedbackLoops = strategyResults.feedbackLoops || [];
      if (feedbackLoops.length > 0) {
        logger.debug(`Received ${feedbackLoops.length} feedback loops from strategist`);
        this.processFeedbackLoops(feedbackLoops);
      }
      
      // Collect feedback from strategist for each problem
      let feedbackCollected = 0;
      for (const problem of prioritizedProblems) {
        const feedback = await strategistAgent.provideFeedback(problem);
        feedbackCollected++;
        
        // Add feedback to problem if not already present
        if (!problem.feedbackHistory.some(f => f.agentId === feedback.agentId && f.timestamp === feedback.timestamp)) {
          problem.feedbackHistory.push(feedback);
        }
      }
      
      logger.info(`Strategy stage completed. Processed ${prioritizedProblems.length} problems, collected ${feedbackCollected} feedback items`);
    } catch (error: any) {
      logger.error(`Error in strategy stage: ${error.message}`, { error });
      // Continue despite errors
    }
  }
  
  /**
   * Process prioritized opportunities from strategist
   */
  private processPrioritizedOpportunities(opportunities: any[], problems: Problem[]): void {
    // Map opportunities to their corresponding problems
    for (const opportunity of opportunities) {
      // Attempt to find the problem this opportunity relates to
      const relatedProblem = problems.find(p => {
        // Match by problem content/formulation
        const keyProblem = opportunity.keyProblemSolved;
        if (!keyProblem) return false;
        
        return p.currentFormulation.toLowerCase().includes(keyProblem.toLowerCase()) ||
          keyProblem.toLowerCase().includes(p.currentFormulation.toLowerCase());
      });
      
      if (relatedProblem) {
        // Update problem with strategic insights
        this.updateProblemFromOpportunity(relatedProblem, opportunity);
      }
    }
  }
  
  /**
   * Update problem with strategic opportunity insights
   */
  private updateProblemFromOpportunity(problem: Problem, opportunity: any): void {
    // Add evidence from the opportunity
    const evidence: Evidence = {
      type: 'expert_opinion',
      source: 'strategist',
      content: `Strategic opportunity: ${opportunity.title}. Market potential: ${opportunity.marketPotential}/10. Priority: ${opportunity.priority}/10`,
      relevanceScore: 0.9,
      timestamp: new Date().toISOString(),
      metadata: {
        title: opportunity.title,
        valueProposition: opportunity.valueProposition,
        keyProblemSolved: opportunity.keyProblemSolved,
        marketPotential: opportunity.marketPotential,
        implementationDifficulty: opportunity.implementationDifficulty,
        priority: opportunity.priority,
        differentiators: opportunity.differentiators,
        keyComponents: opportunity.keyComponents
      }
    };
    
    problem.evidence.push(evidence);
    
    // Potentially update quality scores based on strategic assessment
    if (opportunity.marketPotential) {
      // Market potential influences scale and urgency
      const marketScore = opportunity.marketPotential;
      problem.qualityScore.scale = Math.max(problem.qualityScore.scale, marketScore);
      problem.qualityScore.urgency = Math.max(problem.qualityScore.urgency, marketScore * 0.8);
    }
    
    if (opportunity.implementationDifficulty) {
      // Implementation difficulty influences feasibility (inverse relationship)
      const feasibilityScore = 11 - opportunity.implementationDifficulty;
      problem.qualityScore.feasibility = feasibilityScore;
    }
    
    // Update domain information if available
    if (opportunity.targetUsers) {
      if (!problem.targetAudience) {
        problem.targetAudience = [];
      }
      
      // Add target users as audience if not already present
      const targetUsers = Array.isArray(opportunity.targetUsers) 
        ? opportunity.targetUsers 
        : [opportunity.targetUsers];
        
      for (const user of targetUsers) {
        if (!problem.targetAudience.includes(user)) {
          problem.targetAudience.push(user);
        }
      }
    }
    
    // Recalculate overall score
    problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
    
    // Update metadata
    problem.metadata.updatedAt = new Date().toISOString();
    problem.metadata.updatedBy = 'strategist';
    problem.metadata.explorationStatus = 'finalized';
  }
  
  /**
   * Process MVP designs from strategist
   */
  private processMVPDesigns(mvpDesigns: any[], problems: Problem[]): void {
    // Similar to opportunities, associate MVP designs with problems
    for (const design of mvpDesigns) {
      // Find related problem
      const relatedProblem = problems.find(p => {
        const problemToSolve = design.problemToSolve;
        if (!problemToSolve) return false;
        
        return p.currentFormulation.toLowerCase().includes(problemToSolve.toLowerCase()) ||
          problemToSolve.toLowerCase().includes(p.currentFormulation.toLowerCase());
      });
      
      if (relatedProblem) {
        // Add evidence from the MVP design
        const evidence: Evidence = {
          type: 'expert_opinion',
          source: 'strategist',
          content: `MVP design: "${design.name}". Core features: ${(design.coreFeatures || []).join(', ')}`,
          relevanceScore: 0.85,
          timestamp: new Date().toISOString(),
          metadata: {
            name: design.name,
            description: design.description,
            coreFeatures: design.coreFeatures,
            successMetrics: design.successMetrics,
            timeToMvp: design.timeToMvp,
            resourceEstimate: design.resourceEstimate,
            riskFactors: design.riskFactors
          }
        };
        
        relatedProblem.evidence.push(evidence);
        
        // MVP time and resource estimates can influence feasibility
        if (design.timeToMvp && design.resourceEstimate) {
          // If quick to build with low resources, increase feasibility
          const isQuickBuild = design.timeToMvp.toLowerCase().includes('快速') || 
                              design.timeToMvp.toLowerCase().includes('短期');
          const isLowResource = design.resourceEstimate.toLowerCase().includes('低') ||
                               design.resourceEstimate.toLowerCase().includes('小型');
          
          if (isQuickBuild && isLowResource) {
            relatedProblem.qualityScore.feasibility = Math.min(10, relatedProblem.qualityScore.feasibility + 1);
            // Recalculate overall score
            relatedProblem.qualityScore.overall = this.calculateWeightedScore(relatedProblem.qualityScore);
          }
        }
      }
    }
  }
  
  /**
   * Process problem refinements from strategist
   */
  private processProblemRefinements(refinements: any[]): void {
    // Update problems with refinements
    for (const refinement of refinements) {
      // Find the problem to refine
      const problemId = refinement.problemId;
      const problem = this.problems.get(problemId);
      
      if (!problem) {
        logger.warn(`Refinement received for unknown problem ID: ${problemId}`);
        continue;
      }
      
      // Apply refinements
      if (refinement.refinedFormulation) {
        // Record the original formulation
        const previousFormulation = problem.currentFormulation;
        
        // Update the formulation
        problem.currentFormulation = refinement.refinedFormulation;
        
        // Add to evolution path
        problem.evolutionPath.push({
          timestamp: new Date().toISOString(),
          stage: 'strategy',
          previousFormulation,
          currentFormulation: refinement.refinedFormulation,
          agent: 'strategist',
          reasoning: refinement.refinementReasoning || 'Strategic refinement of problem formulation',
          qualityScoreBefore: problem.qualityScore.overall,
          qualityScoreAfter: problem.qualityScore.overall // Same for now, will be recalculated
        });
      }
      
      // Update domain if provided
      if (refinement.domains && refinement.domains.length > 0) {
        problem.domain = refinement.domains;
      }
      
      // Update target audience if provided
      if (refinement.targetAudience && refinement.targetAudience.length > 0) {
        problem.targetAudience = refinement.targetAudience;
      }
      
      // Update quality scores if provided
      if (refinement.qualityScores) {
        if (refinement.qualityScores.authenticity) {
          problem.qualityScore.authenticity = refinement.qualityScores.authenticity;
        }
        if (refinement.qualityScores.urgency) {
          problem.qualityScore.urgency = refinement.qualityScores.urgency;
        }
        if (refinement.qualityScores.scale) {
          problem.qualityScore.scale = refinement.qualityScores.scale;
        }
        if (refinement.qualityScores.solutionGap) {
          problem.qualityScore.solutionGap = refinement.qualityScores.solutionGap;
        }
        if (refinement.qualityScores.feasibility) {
          problem.qualityScore.feasibility = refinement.qualityScores.feasibility;
        }
        
        // Recalculate overall score
        problem.qualityScore.overall = this.calculateWeightedScore(problem.qualityScore);
      }
      
      // Update metadata
      problem.metadata.updatedAt = new Date().toISOString();
      problem.metadata.updatedBy = 'strategist';
      problem.metadata.iterationCount += 1;
    }
  }
  
  /**
   * Process feedback loops for generating new keywords
   */
  private processFeedbackLoops(feedbackLoops: any[]): void {
    // In a complete implementation, these would be used to trigger new discovery cycles
    // with the generated keywords
    
    for (const loop of feedbackLoops) {
      const newKeywords = loop.newKeywords || [];
      
      if (newKeywords.length > 0) {
        logger.info(`Feedback loop suggests exploring new keywords: ${newKeywords.join(', ')}`);
        
        // In a real implementation, we might:
        // 1. Store these suggestions for later exploration
        // 2. Trigger new discovery cycles with these keywords
        // 3. Connect problems discovered from related keywords
        
        // For now, we'll just log them
        this.result.processingMetrics.feedbackLoopsProcessed = 
          (this.result.processingMetrics.feedbackLoopsProcessed || 0) + 1;
      }
    }
  }

  /**
   * Process feedback and refine problems
   */
  private async processFeedbackAndRefinements(): Promise<void> {
    logger.info(`Processing feedback for ${this.problems.size} problems`);
    
    try {
      // Collect feedback from all problems
      const feedbackMap = new Map<string, AgentFeedback[]>();
      
      for (const [problemId, problem] of this.problems.entries()) {
        // Only process feedback from the current iteration
        const feedback = problem.feedbackHistory.filter(f => {
          // Get feedback from the current iteration
          const feedbackDate = new Date(f.timestamp);
          const iterationStartDate = new Date(
            this.result.iterations[this.currentIteration - 1]?.timestamp || this.startTime
          );
          
          return feedbackDate >= iterationStartDate;
        });
        
        if (feedback.length > 0) {
          feedbackMap.set(problemId, feedback);
        }
      }
      
      // Process all problems with feedback
      const problemsToProcess = Array.from(this.problems.values())
        .filter(p => feedbackMap.has(p.id));
      
      if (problemsToProcess.length === 0) {
        logger.info('No feedback to process in this iteration');
        return;
      }
      
      logger.info(`Processing feedback for ${problemsToProcess.length} problems`);
      
      // Use FeedbackProcessor to refine problems
      const refinedProblems = await this.feedbackProcessor.processAllProblems(
        problemsToProcess,
        feedbackMap
      );
      
      // Update problems with refined versions
      for (const refinedProblem of await refinedProblems) {
        this.problems.set(refinedProblem.id, refinedProblem);
      }
      
      logger.info('Feedback processing completed');
    } catch (error: any) {
      logger.error(`Error in feedback processing: ${error.message}`, { error });
      // Continue with other stages despite errors
    }
  }
  
  /**
   * Detect and merge similar problems
   */
  private async detectAndMergeSimilarProblems(): Promise<void> {
    logger.info(`Checking for similar problems among ${this.problems.size} problems`);
    
    try {
      // Get all problems
      const problems = Array.from(this.problems.values());
      
      // Skip if we have too few problems
      if (problems.length < 2) {
        logger.debug('Too few problems to check for similarities');
        return;
      }
      
      // Use SimilarityDetector to find similar problems
      const similarityGroups = await this.similarityDetector.detectSimilarProblems(problems);
      
      if (similarityGroups.size === 0) {
        logger.debug('No similar problems detected');
        return;
      }
      
      logger.debug(`Found ${similarityGroups.size} groups of similar problems`);
      
      // Process each group and merge problems
      let mergesPerformed = 0;
      
      for (const [primaryId, similarIds] of similarityGroups.entries()) {
        const primaryProblem = this.problems.get(primaryId);
        
        if (!primaryProblem || similarIds.length === 0) {
          continue;
        }
        
        // Get the secondary problems
        const secondaryProblems = similarIds
          .map(id => this.problems.get(id))
          .filter(p => p !== undefined) as Problem[];
        
        if (secondaryProblems.length === 0) {
          continue;
        }
        
        // Merge the problems
        const mergedProblem = await this.similarityDetector.mergeProblems(primaryProblem, secondaryProblems);
        
        // Update the primary problem with the merged version
        this.problems.set(primaryId, mergedProblem);
        
        // Remove the secondary problems (now merged into the primary)
        for (const id of similarIds) {
          this.problems.delete(id);
        }
        
        mergesPerformed++;
        logger.debug(`Merged ${secondaryProblems.length} problems into primary problem ${primaryId}`);
      }
      
      // Update metrics
      this.result.processingMetrics.mergesPerformed = 
        (this.result.processingMetrics.mergesPerformed || 0) + mergesPerformed;
      
      logger.info(`Similarity detection completed. Performed ${mergesPerformed} merges`);
    } catch (error: any) {
      logger.error(`Error detecting similar problems: ${error.message}`, { error });
      // Continue with other stages despite errors
    }
  }
  
  /**
   * Explore promising problem branches
   */
  private async exploreBranches(): Promise<void> {
    if (!this.config.enableBranching) {
      return;
    }
    
    logger.info('Exploring promising problem branches');
    
    try {
      // Find problems with unexplored branches
      const problemsWithBranches = Array.from(this.problems.values())
        .filter(p => p.branches && p.branches.some(b => !b.isExplored));
      
      if (problemsWithBranches.length === 0) {
        logger.debug('No problems with unexplored branches found');
        return;
      }
      
      // Limit the number of branches to explore in one iteration
      const maxBranchesToExplore = 5;
      let branchesExplored = 0;
      
      // Process each problem with branches
      for (const problem of problemsWithBranches) {
        if (!problem.branches) continue;
        
        // Get unexplored branches, sorted by quality score
        const unexploredBranches = problem.branches
          .filter(b => !b.isExplored)
          .sort((a, b) => b.qualityScore - a.qualityScore);
        
        if (unexploredBranches.length === 0) continue;
        
        // Limit branches per problem
        const branchesToExplore = unexploredBranches.slice(0, 
          Math.min(this.config.maxBranchesPerProblem, unexploredBranches.length));
        
        for (const branch of branchesToExplore) {
          if (branchesExplored >= maxBranchesToExplore) break;
          
          // Create a new problem from the branch
          const branchProblem = this.createProblemFromBranch(problem, branch);
          
          // Add the new problem to the collection
          this.problems.set(branchProblem.id, branchProblem);
          
          // Mark branch as explored
          branch.isExplored = true;
          
          branchesExplored++;
          logger.debug(`Explored branch ${branch.branchId} from problem ${problem.id}`);
          
          // Limit the number of problems if we've reached the maximum
          if (this.problems.size > this.config.maxProblemsToTrack) {
            this.pruneProblems();
          }
        }
        
        // Update the original problem with updated branch status
        this.problems.set(problem.id, problem);
      }
      
      // Update metrics
      this.result.processingMetrics.branchesExplored = 
        (this.result.processingMetrics.branchesExplored || 0) + branchesExplored;
      
      logger.info(`Branch exploration completed. Explored ${branchesExplored} branches`);
    } catch (error: any) {
      logger.error(`Error exploring branches: ${error.message}`, { error });
    }
  }
  
  /**
   * Create a new problem from a branch
   */
  private createProblemFromBranch(parentProblem: Problem, branch: any): Problem {
    const problemId = uuidv4();
    
    // Create a new problem based on the branch
    const branchProblem: Problem = {
      id: problemId,
      originalFormulation: branch.formulation,
      currentFormulation: branch.formulation,
      domain: [...parentProblem.domain], // Copy domain from parent
      targetAudience: parentProblem.targetAudience ? [...parentProblem.targetAudience] : undefined,
      qualityScore: {
        authenticity: parentProblem.qualityScore.authenticity,
        urgency: parentProblem.qualityScore.urgency,
        scale: parentProblem.qualityScore.scale,
        solutionGap: parentProblem.qualityScore.solutionGap,
        feasibility: parentProblem.qualityScore.feasibility,
        overall: branch.qualityScore || parentProblem.qualityScore.overall,
        confidence: 0.6 // Lower confidence for branch problems initially
      },
      evidence: [], // Start with empty evidence
      evolutionPath: [], // Start with empty evolution path
      feedbackHistory: [], // Start with empty feedback
      relatedProblems: [{
        problemId: parentProblem.id,
        relationshipType: 'parent'
      }],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'branching',
        updatedBy: 'branching',
        iterationCount: 0,
        sourceKeyword: parentProblem.metadata.sourceKeyword,
        explorationStatus: 'initial'
      }
    };
    
    // Add relationship to parent problem too
    if (!parentProblem.relatedProblems.some(r => r.problemId === problemId)) {
      parentProblem.relatedProblems.push({
        problemId,
        relationshipType: 'child'
      });
    }
    
    // Add evolution record about branching
    branchProblem.evolutionPath.push({
      timestamp: new Date().toISOString(),
      stage: 'branching',
      previousFormulation: parentProblem.currentFormulation,
      currentFormulation: branch.formulation,
      agent: 'branching',
      reasoning: branch.creationReason || 'Alternative problem formulation',
      qualityScoreBefore: parentProblem.qualityScore.overall,
      qualityScoreAfter: branchProblem.qualityScore.overall
    });
    
    return branchProblem;
  }
  
  /**
   * Override existing pruneProblems to use adaptive strategy
   */
  private pruneProblems(): void {
    // Skip if we're under the limit
    if (this.problems.size <= this.config.maxProblemsToTrack) {
      return;
    }
    
    logger.info(`Pruning problems from ${this.problems.size} to maximum ${this.config.maxProblemsToTrack}`);
    
    try {
      // Evaluate all problems against quality thresholds
      const problems = Array.from(this.problems.values());
      
      // Update global threshold based on problem distribution
      this.qualityEvaluator.updateGlobalThreshold(problems);
      
      // First approach: remove problems that don't meet quality thresholds
      const belowThresholdProblems = problems.filter(
        p => !this.qualityEvaluator.meetsQualityThreshold(p)
      );
      
      if (belowThresholdProblems.length > 0) {
        logger.debug(`Found ${belowThresholdProblems.length} problems below quality threshold`);
        
        // Remove problems below threshold
        for (const problem of belowThresholdProblems) {
          this.problems.delete(problem.id);
          
          // Stop once we're under the limit
          if (this.problems.size <= this.config.maxProblemsToTrack) {
            break;
          }
        }
      }
      
      // If we're still over the limit, use adaptive strategy to prioritize
      if (this.problems.size > this.config.maxProblemsToTrack) {
        const remainingProblems = Array.from(this.problems.values());
        let problemsToKeep: Problem[];
        
        if (this.config.adaptiveQualityThresholds) {
          // 使用当前最佳探索策略对问题排序
          const prioritizedProblems = this.applyExplorationStrategy(remainingProblems);
          problemsToKeep = prioritizedProblems.slice(0, this.config.maxProblemsToTrack);
          
          logger.debug(
            {}, 
            `Prioritized problems using '${this.currentStrategy}' strategy for pruning`
          );
        } else {
          // 传统方式: 按质量分数排序
          const sortedProblems = remainingProblems
            .sort((a, b) => b.qualityScore.overall - a.qualityScore.overall);
          problemsToKeep = sortedProblems.slice(0, this.config.maxProblemsToTrack);
        }
        
        // 清除原问题集并添加保留的问题
        this.problems.clear();
        for (const problem of problemsToKeep) {
          this.problems.set(problem.id, problem);
        }
        
        logger.debug(`Kept ${problemsToKeep.length} highest priority problems`);
      }
    } catch (error: any) {
      logger.error({ error }, `Error during problem pruning: ${error.message}`);
    }
  }
} 