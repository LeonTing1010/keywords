/**
 * 问题发现图
 * 
 * 使用问题发现流水线协调多个专业Agent，
 * 按照递归循环方式深入发现、验证、分析和优化高价值问题。
 */ 
import { MarketNeedExplorerAgent } from '../../agents/discovery/MarketNeedExplorerAgent';
import { UserJourneySimulatorAgent } from '../../agents/discovery/UserJourneySimulatorAgent';
import { SolutionEvaluatorAgent } from '../../agents/discovery/SolutionEvaluatorAgent';
import { OpportunityStrategistAgent } from '../../agents/discovery/OpportunityStrategistAgent';
import { logger } from '../../infra/logger';
import { DiscoveryResult, SimilarityDetectionSettings } from '../../types/discovery';
import { ProblemDiscoveryPipeline } from '../../core/coordinator/ProblemDiscoveryPipeline';
import { BaiduSearchEngine } from '../../infra/search/engines/BaiduSearchEngine';

/**
 * 问题发现图配置
 */
export interface ProblemDiscoveryGraphConfig {
  maxIterations?: number;
  maxProblems?: number;
  keyword?: string;
  outputDir?: string;
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
  trackAgents?: boolean;
  adaptiveMode?: boolean; // 是否启用自适应模式
  learningRate?: number; // 学习率
}

/**
 * 初始化问题发现图
 * 
 * 构建并配置问题发现流水线，返回可执行的发现流程
 */
export async function initializeProblemDiscoveryGraph(
  config: ProblemDiscoveryGraphConfig = {}
): Promise<{
  pipeline: ProblemDiscoveryPipeline;
  discoveryAgents: any[];
}> {
  // 配置默认值
  const maxIterations = config.maxIterations || 2;
  const maxProblems = config.maxProblems || 10;
  const outputDir = config.outputDir || './output';
  const format = config.format || 'markdown';
  const language = config.language || 'zh';
  const trackAgents = config.trackAgents !== false;
  const adaptiveMode = config.adaptiveMode !== false; // 默认启用自适应模式
  const learningRate = config.learningRate || 0.05; // 默认学习率
  
  logger.debug({}, 'Initializing Problem Discovery Graph');
  
  
  // 创建探索者Agent
  const marketNeedExplorerAgent = new MarketNeedExplorerAgent({
    agentName: '市场需求探索者',
    maxProblems,
    enableQuantification: true,
    enableCategorization: true,
    trackExecution: trackAgents,
    adaptiveMode, // 启用自适应模式
    learningRate
  });
  
  // 创建模拟者Agent
  const userJourneySimulatorAgent = new UserJourneySimulatorAgent({
    agentName: '用户旅程模拟者',
    maxSteps: 3,
    usePersonas: true,
    detailedAnalysis: true,
    trackExecution: trackAgents,
    adaptiveMode, // 启用自适应模式
    learningRate
  });
  
  // 创建评估者Agent
  const solutionEvaluatorAgent = new SolutionEvaluatorAgent({
    agentName: '解决方案评估者',
    includeCompetitorAnalysis: true,
    includeTrendAnalysis: true,
    trackExecution: trackAgents,
    adaptiveMode, // 启用自适应模式
    learningRate
  });
  
  // 创建策略者Agent
  const opportunityStrategistAgent = new OpportunityStrategistAgent({
    agentName: '机会策略者',
    maxOpportunities: maxProblems,
    includeMVPDesign: true,
    includeBusinessModel: true,
    includeRoadmap: true,
    format,
    language,
    outputDir,
    trackExecution: trackAgents,
    adaptiveMode, // 启用自适应模式
    learningRate
  });
  
  // 创建相似度检测设置
  const similaritySettings: SimilarityDetectionSettings = {
    algorithm: 'hybrid',
    threshold: 0.7,
    considerEvidence: true,
    useWeightedFactors: true
  };
  
  // 创建问题发现流水线
  const pipeline = new ProblemDiscoveryPipeline({
    maxIterations,
    maxProblemsToTrack: maxProblems * 2,
    initialQualityThreshold: 6,
    adaptiveQualityThresholds: adaptiveMode, // 与自适应模式一致
    similarityDetection: similaritySettings,
    enableBranching: true,
    maxBranchesPerProblem: 3,
    minFeedbackConfidence: 0.7,
    feedbackIncorporationStrategy: 'confidence_weighted',
    agents: {
      explorer: true,
      simulator: true,
      evaluator: true,
      strategist: true
    },
    domainSpecificThresholds: [
      {
        domain: 'tech',
        minOverallScore: 6,
        minAuthenticity: 6,
        minUrgency: 5,
        minScale: 5,
        minSolutionGap: 6,
        minFeasibility: 5,
        thresholdAdjustmentFactors: {
          lowConfidenceAdjustment: -0.5,
          highEvidenceBoost: 0.5,
          iterationBoost: 0.2,
          feedbackConsistencyBoost: 0.3
        }
      },
      {
        domain: 'general',
        minOverallScore: 6,
        minAuthenticity: 6,
        minUrgency: 5,
        minScale: 5,
        minSolutionGap: 6,
        minFeasibility: 5,
        thresholdAdjustmentFactors: {
          lowConfidenceAdjustment: -0.5,
          highEvidenceBoost: 0.5,
          iterationBoost: 0.2,
          feedbackConsistencyBoost: 0.3
        }
      }
    ]
  });
  
  // 注册 Agents
  pipeline.registerAgent(marketNeedExplorerAgent);
  pipeline.registerAgent(userJourneySimulatorAgent);
  pipeline.registerAgent(solutionEvaluatorAgent);
  pipeline.registerAgent(opportunityStrategistAgent);
  
  // 返回初始化的组件
  return {
    pipeline,
    discoveryAgents: [
      marketNeedExplorerAgent,
      userJourneySimulatorAgent,
      solutionEvaluatorAgent,
      opportunityStrategistAgent
    ]
  };
}

/**
 * 执行问题发现流程
 * 
 * 使用配置的流水线运行完整的问题发现过程
 */
export async function runProblemDiscovery(
  config: ProblemDiscoveryGraphConfig = {}
): Promise<DiscoveryResult> {
  try {
    logger.info({ config }, '启动问题发现流程');
    
    // 初始化问题发现图
    const { pipeline } = await initializeProblemDiscoveryGraph(config);
    
    // 运行问题发现流程
    const result = await pipeline.discover(config.keyword || '');
    
    logger.info({}, '问题发现流程完成');
    
    return result;
  } catch (error: any) {
    logger.error({ error }, `问题发现流程失败: ${error.message}`);
    throw error;
  }
} 