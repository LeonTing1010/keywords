/**
 * 机会策略Agent (策略者)
 * 
 * 问题发现框架中的"策略者"角色
 * 将验证和评估过的问题转化为具体机会，制定解决策略
 */
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryAgentBase, DiscoveryAgentBaseConfig } from '../base/DiscoveryAgentBase';
import { 
  Problem, 
  AgentFeedback
} from '../../types/discovery';
import { logger } from '../../infra/logger';
import { RunnableConfig } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { AgentLLMService } from '../../core/llm/AgentLLMService';
import { z } from 'zod';
import { AgentLLMServiceExtensions } from '../../core/llm/extensions';

// 机会策略Agent配置
export interface OpportunityStrategistAgentConfig extends DiscoveryAgentBaseConfig {
  maxOpportunities?: number;
  language?: 'zh' | 'en';
  outputDir?: string;
  includeMVPDesign?: boolean;
  includeBusinessModel?: boolean;
  includeRoadmap?: boolean;
  format?: 'markdown' | 'json';
}

// 定义机会模式
const opportunitySchema = z.object({
  id: z.string(),
  problemId: z.string(),
  title: z.string(),
  description: z.string(),
  solutionConcept: z.string(),
  differentiators: z.array(z.string()),
  valueProposition: z.string(),
  targetAudience: z.array(z.string()),
  stakeholders: z.array(z.string()),
  feasibilityScore: z.number().min(1).max(10),
  marketPotentialScore: z.number().min(1).max(10),
  innovationScore: z.number().min(1).max(10),
  overallScore: z.number().min(1).max(10),
  keySuccessMetrics: z.array(z.string()),
  potentialChallenges: z.array(z.string()),
  nextSteps: z.array(z.string())
});

// 定义新问题建议模式
const suggestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string(),
  relevance: z.string(),
  targetAudience: z.array(z.string()),
  potentialValue: z.number().min(1).max(10),
  keywords: z.array(z.string())
});

// 定义反馈schema
const feedbackSchema = z.object({
  criticalAnalysis: z.object({
    assumptions: z.array(z.string()),
    limitations: z.array(z.string()),
    blindSpots: z.array(z.string())
  }),
  feasibilityCritique: z.object({
    technicalChallenges: z.array(z.string()),
    marketChallenges: z.array(z.string()),
    implementationRisks: z.array(z.string()),
    viabilityScore: z.number().min(1).max(10)
  }),
  reframing: z.object({
    newPerspectives: z.array(z.string()),
    improvedFormulation: z.string()
  }),
  alternativeApproaches: z.array(z.object({
    approach: z.string(),
    advantages: z.array(z.string()),
    disadvantages: z.array(z.string())
  })),
  newProblems: z.array(z.object({
    question: z.string(),
    description: z.string(),
    relevance: z.string(),
    value: z.string()
  })),
  suggestedChanges: z.array(z.object({
    fieldName: z.string(),
    suggestedValue: z.union([z.string(), z.array(z.string())]),
    changeReasoning: z.string()
  })),
  confidenceScore: z.number().min(0).max(1),
  feedbackType: z.enum(['validation', 'refinement', 'branch_suggestion', 'rejection'])
});

/**
 * 机会策略Agent
 * 在问题发现框架中担任"策略者"角色，将问题转化为机会并设计解决方案
 */
export class OpportunityStrategistAgent extends DiscoveryAgentBase {
  // 实现DiscoveryAgent接口
  public readonly type: 'strategist' = 'strategist';
  
  // 特定于此Agent的属性  
  private maxOpportunities: number;
  private language: 'zh' | 'en';
  private outputDir: string;
  
  /**
   * 构造函数
   */
  constructor(config: OpportunityStrategistAgentConfig = {}) {
    super(config);
    
    this.maxOpportunities = config.maxOpportunities || 5;
    this.language = config.language || 'zh';
    this.outputDir = config.outputDir || './output';
    
    logger.debug({}, 'OpportunityStrategistAgent initialized');
  }
  
  /**
   * 设置Agent所需的工具
   * 实现DiscoveryAgentBase的抽象方法
   */
  protected setupTools(): void {
    logger.debug({}, 'OpportunityStrategistAgent.setupTools called - no tools needed');
    // 简化版本不需要特定工具
  }
  
  /**
   * 实现DiscoveryAgent.process方法
   * 处理输入并创建机会策略
   */
  public async process(input: any): Promise<any> {
    logger.info({}, 'OpportunityStrategistAgent processing input');
    
    if (!input.problems || !Array.isArray(input.problems) || input.problems.length === 0) {
      throw new Error('Valid problems array is required for OpportunityStrategistAgent');
    }
    
    try {
      // 选择和优先级排序问题
      const prioritizedProblems = this.prioritizeProblems(input.problems);
      
      // 获取优先级最高的问题
      const topPriorityProblem = prioritizedProblems[0];
      logger.info({ problemId: topPriorityProblem.id }, `Processing highest priority problem: ${topPriorityProblem.id}`);
      
      // 为最高优先级问题创建机会
      const opportunity = await this.createOpportunityForTopProblem(topPriorityProblem);
      
      logger.info({ opportunityId: opportunity.id }, `OpportunityStrategistAgent created opportunity for top priority problem`);
      
      return {
        opportunities: [opportunity],
        sourceKeyword: input.sourceKeyword || '',
        metadata: {
          opportunitiesCount: 1,
          timestamp: new Date().toISOString(),
          strategy: 'top_priority_focus'
        }
      };
    } catch (error: any) {
      logger.error({ error }, `Error in OpportunityStrategistAgent.process: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 对问题进行优先级排序
   */
  private prioritizeProblems(problems: any[]): any[] {
    logger.debug({ count: problems.length }, `Prioritizing ${problems.length} problems`);
    
    try {
      // 计算优先级分数
      const problemsWithPriority = problems.map(problem => {
        // 基本优先级等于缺口分数
        let priorityScore = problem.gapScore || 0;
        
        // 市场成熟度权重
        if (problem.marketMaturity === '早期') {
          priorityScore += 2;
        } else if (problem.marketMaturity === '成长期') {
          priorityScore += 1;
        }
        
        // 未满足需求和改进机会数量
        const unmetNeedsCount = (problem.unmetNeeds || []).length;
        const improvementCount = (problem.improvementOpportunities || []).length;
        priorityScore += Math.min(3, (unmetNeedsCount + improvementCount) / 2);
        
        return {
          ...problem,
          priorityScore
        };
      });
      
      // 按优先级分数排序并限制数量
      return problemsWithPriority
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, this.maxOpportunities);
    } catch (error: any) {
      logger.error({ error }, `Error prioritizing problems: ${error.message}`);
      // 如果出错，简单地取前N个问题
      return problems.slice(0, this.maxOpportunities);
    }
  }
  
  /**
   * 为最高优先级问题创建机会
   */
  private async createOpportunityForTopProblem(problem: any): Promise<any> {
    const problemId = problem.id || uuidv4();
    
    try {
      logger.debug({ problemId }, `创建最高优先级问题的机会: ${problemId}`);
      
      // 系统提示
      const systemPrompt = `你是一个创新策略专家，擅长将市场问题转化为业务机会和解决方案策略。`;
      
      // 用户提示
      const userPrompt = `
        分析以下最高优先级问题，将其转化为详尽的商业机会:
        
        问题ID: ${problemId}
        问题描述: ${problem.currentFormulation || problem.question}
        问题领域: ${problem.domain ? problem.domain.join(', ') : '未指定'}
        目标受众: ${problem.targetAudience ? problem.targetAudience.join(', ') : '未指定'}
        问题质量评分: ${problem.qualityScore ? problem.qualityScore.overall : '未评分'}/10
        
        请将此问题重新构想为市场机会，确保包含以下所有要素:
        1. 引人注目的机会标题
        2. 详细的机会描述
        3. 具体的解决方案概念
        4. 清晰的差异化优势
        5. 有说服力的价值主张
        6. 明确的目标受众和利益相关者
        7. 可靠的可行性、市场潜力和创新评分
        8. 明确的成功指标
        9. 潜在挑战
        10. 下一步行动建议
        
        你的回答必须严格遵循schema格式要求，包含所有必要字段。
      `;
      
      // 默认值，解析失败时使用
      const defaultValue = {
        id: uuidv4(),
        problemId: problemId,
        title: `解决方案：${problem.currentFormulation || problem.question}`,
        description: "无法生成机会描述",
        solutionConcept: "未能生成解决方案概念",
        differentiators: ["未能识别差异化因素"],
        valueProposition: "未能确定价值主张",
        targetAudience: problem.targetAudience || ["未确定的目标受众"],
        stakeholders: ["未确定的利益相关者"],
        feasibilityScore: 5,
        marketPotentialScore: 5,
        innovationScore: 5,
        overallScore: 5,
        keySuccessMetrics: ["未能确定成功指标"],
        potentialChallenges: ["未能识别潜在挑战"],
        nextSteps: ["需要进一步分析"]
      };
      
      // 使用SchemaValidator分析并确保返回满足schema要求
      const agentLLM = this.model as AgentLLMService;
      const finalPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      // 使用analyzeWithObjectSchema确保返回结果符合schema要求
      const opportunity = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        agentLLM,
        finalPrompt,
        '4-transform-problem-to-opportunity',
        opportunitySchema,
        {
          temperature: 0.7,
          defaultValue: defaultValue
        }
      );
      
      // 计算总体分数（如果没有）
      if (!opportunity.overallScore) {
        const scores = [
          opportunity.feasibilityScore || 0,
          opportunity.marketPotentialScore || 0,
          opportunity.innovationScore || 0
        ];
        const validScores = scores.filter(score => score > 0);
        opportunity.overallScore = validScores.length > 0 
          ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length) 
          : 5;
      }
      
      logger.debug({ opportunityId: opportunity.id }, `成功将最高优先级问题 ${problemId} 转换为机会 ${opportunity.id}`);
      
      return opportunity;
    } catch (error) {
      logger.error({ problemId, error }, `转换最高优先级问题为机会时出错: ${error}`);
      
      // 出错时返回基本对象
      return {
        id: uuidv4(),
        problemId: problemId,
        title: `解决方案：${problem.currentFormulation || problem.question}`,
        description: "生成机会时出错",
        solutionConcept: "未能生成解决方案概念",
        differentiators: ["未能识别差异化因素"],
        valueProposition: "生成价值主张时出错",
        targetAudience: problem.targetAudience || ["未确定的目标受众"],
        stakeholders: ["未确定的利益相关者"],
        feasibilityScore: 5,
        marketPotentialScore: 5,
        innovationScore: 5,
        overallScore: 5,
        keySuccessMetrics: ["未能确定成功指标"],
        potentialChallenges: ["错误发生"],
        nextSteps: ["重新尝试分析"]
      };
    }
  }
  
  /**
   * 为问题生成反馈
   * 实现DiscoveryAgentBase的抽象方法
   */
  protected async generateFeedback(problem: Problem): Promise<AgentFeedback> {
    try {
      logger.debug({}, `Generating feedback for problem: ${problem.id}`);
      
      // 准备问题数据
      const problemFormulation = problem.currentFormulation || problem.originalFormulation || "Unknown problem";
      const problemDomain = Array.isArray(problem.domain) ? problem.domain.join(', ') : (problem.domain || 'general');
      
      // 创建提示
      const prompt = `
        你是一位深度分析专家，擅长质疑商业机会的可行性并提出新问题。
        请针对以下问题进行批判性分析，质疑其可行性，并提出新的探索方向。
        
        ## 问题信息
        问题ID: ${problem.id}
        问题描述: ${problemFormulation}
        问题领域: ${problemDomain}
        目标受众: ${Array.isArray(problem.targetAudience) ? problem.targetAudience.join(', ') : '未指定'}
        
        ## 分析要求
        请执行以下批判性分析过程:
        
        1. 批判性分析：质疑问题的假设、限制和潜在盲点
        2. 可行性质疑：明确指出潜在的技术挑战、市场挑战和实施风险
        3. 重新框架：从不同角度重新定义问题
        4. 替代方案：提出至少3个不同的解决思路，并说明每种方案的优势和劣势
        5. 新问题生成：基于发现的挑战和盲点，提出3个全新但相关的待探索问题
        6. 建议修改：提出至少3个具体的修改建议，改进当前问题的表述
        
        请深入思考并严格质疑这个问题转化为机会的可行性。找出其中隐藏的困难和风险，避免过度乐观。
        
        请确保你的回答严格遵循指定的格式，包含所有必要字段：
        - criticalAnalysis：包含assumptions、limitations和blindSpots三个字段，每个字段都是字符串数组
        - feasibilityCritique：包含technicalChallenges、marketChallenges、implementationRisks和viabilityScore，前三个是字符串数组，viabilityScore是1-10的数字
        - reframing：包含newPerspectives(字符串数组)和improvedFormulation(字符串)
        - alternativeApproaches：是一个对象数组，每个对象包含approach(字符串)、advantages(字符串数组)和disadvantages(字符串数组)
        - newProblems：是一个对象数组，每个对象包含question、description、relevance和value，都是字符串
        - suggestedChanges：是一个对象数组，每个对象包含fieldName、suggestedValue和changeReasoning，suggestedValue可以是字符串或字符串数组
        - confidenceScore：0到1之间的数字
        - feedbackType：枚举值，只能是'validation'、'refinement'、'branch_suggestion'或'rejection'之一
      `;
      
      // 默认反馈值 - 确保符合schema定义
      const defaultFeedback = {
        criticalAnalysis: {
          assumptions: ["未能识别假设", "问题可能基于过度理想化的环境"],
          limitations: ["未能识别限制", "可能缺乏实际应用场景"],
          blindSpots: ["未能识别盲点", "可能忽略了技术实现难度"]
        },
        feasibilityCritique: {
          technicalChallenges: ["未能识别技术挑战", "可能需要考虑系统集成问题"],
          marketChallenges: ["未能识别市场挑战", "用户接受度可能低于预期"],
          implementationRisks: ["未能识别实施风险", "成本可能超出预算"],
          viabilityScore: 5
        },
        reframing: {
          newPerspectives: ["从用户体验角度重新考虑", "从成本效益角度评估", "从长期维护角度思考"],
          improvedFormulation: "未能改进问题表述"
        },
        alternativeApproaches: [
          {
            approach: "替代方法1",
            advantages: ["更低成本", "容易实施"],
            disadvantages: ["功能有限", "扩展性差"]
          },
          {
            approach: "替代方法2",
            advantages: ["功能全面", "用户友好"],
            disadvantages: ["成本较高", "实施复杂"]
          },
          {
            approach: "替代方法3",
            advantages: ["创新性强", "差异化明显"],
            disadvantages: ["风险较高", "需要更多验证"]
          }
        ],
        newProblems: [
          {
            question: "如何确保解决方案的可扩展性？",
            description: "考虑系统在用户量增长情况下的性能表现",
            relevance: "与原问题的技术实现直接相关",
            value: "有助于构建更稳健的解决方案"
          },
          {
            question: "用户采纳新解决方案的主要障碍是什么？",
            description: "分析用户接受新系统可能面临的阻力",
            relevance: "影响解决方案的市场成功",
            value: "有助于设计更好的推广策略"
          },
          {
            question: "长期维护成本如何优化？",
            description: "评估系统运行后的维护需求和成本控制",
            relevance: "关系到解决方案的可持续性",
            value: "影响总体拥有成本和投资回报"
          }
        ],
        suggestedChanges: [
          {
            fieldName: "currentFormulation",
            suggestedValue: "更具体的问题表述",
            changeReasoning: "增加问题的具体性和可操作性"
          },
          {
            fieldName: "domain",
            suggestedValue: ["更精确的领域分类"],
            changeReasoning: "更好地定位问题所属领域"
          },
          {
            fieldName: "targetAudience",
            suggestedValue: ["更细分的目标用户群体"],
            changeReasoning: "提高针对性"
          }
        ],
        confidenceScore: 0.7,
        feedbackType: "refinement"
      };
      
      // 使用analyzeWithObjectSchema确保返回满足schema要求
      const agentLLM = this.model as AgentLLMService;
      const feedbackResult = await AgentLLMServiceExtensions.analyzeWithObjectSchema(
        agentLLM,
        prompt,
        '4-generate-critical-feedback',
        feedbackSchema,
        {
          temperature: 0.8,
          defaultValue: defaultFeedback
        }
      );
      
      // 确保confidenceScore在有效范围内 (0-1)
      if (feedbackResult.confidenceScore > 1) {
        feedbackResult.confidenceScore = 1;
      } else if (feedbackResult.confidenceScore < 0) {
        feedbackResult.confidenceScore = 0.7;
      }
      
      // 构建反馈对象
      return {
        id: uuidv4(),
        agentId: this.id,
        agentType: this.type,
        problemId: problem.id,
        timestamp: new Date().toISOString(),
        feedbackType: feedbackResult.feedbackType,
        confidenceScore: feedbackResult.confidenceScore,
        validationResults: {
          isValid: feedbackResult.feasibilityCritique.viabilityScore > 5,
          validationReasoning: `基于可行性分析（评分：${feedbackResult.feasibilityCritique.viabilityScore}/10）`,
          suggestions: feedbackResult.reframing.newPerspectives
        },
        suggestedChanges: feedbackResult.suggestedChanges,
        metadata: {
          criticalAnalysis: feedbackResult.criticalAnalysis,
          feasibilityCritique: feedbackResult.feasibilityCritique,
          reframing: feedbackResult.reframing,
          alternativeApproaches: feedbackResult.alternativeApproaches,
          newProblems: feedbackResult.newProblems
        }
      };
    } catch (error: any) {
      logger.error({}, `Error generating feedback: ${error.message}`);
      return this.createDefaultFeedback(problem, error);
    }
  }
  
  // 添加创建默认反馈的私有方法
  protected createDefaultFeedback(problem: Problem, error: any): AgentFeedback {
    return {
      id: uuidv4(),
      agentId: this.id,
      agentType: this.type,
      problemId: problem.id,
      timestamp: new Date().toISOString(),
      feedbackType: 'refinement',
      confidenceScore: 0.5,
      validationResults: {
        isValid: true,
        validationReasoning: `生成详细反馈时发生错误: ${error?.message || 'Unknown error'}`,
        suggestions: ["重新评估问题"]
      },
      suggestedChanges: [
        {
          fieldName: "currentFormulation",
          suggestedValue: problem.currentFormulation || problem.originalFormulation || "问题表述需要更新",
          changeReasoning: "确保问题表述清晰明确"
        }
      ],
      metadata: {
        error: error?.message || 'Unknown error',
        generatingFeedbackFailed: true
      }
    };
  }
}