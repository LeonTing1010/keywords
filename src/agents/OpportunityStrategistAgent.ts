/**
 * 报告Agent (机会策略专家)
 * 
 * 核心职责:
 * 1. 整合和综合所有其他Agent的洞察
 * 2. 基于价值潜力和执行可行性对机会进行优先级排序
 * 3. 设计具有最小可行功能和明确成功指标的MVP解决方案
 * 4. 创建包含时间/资源估计的验证路线图
 * 5. 为每个机会生成有证据支持的商业案例
 * 6. 识别问题循环反馈和迭代改进机会
 * 7. 提出问题重新定义和重构建议
 * 
 * 主要功能:
 * - 汇总所有Agent的分析结果并提取核心洞察
 * - 对机会进行价值和可行性评估与排序
 * - 生成具体的MVP方案和验证策略
 * - 提供清晰的后续行动建议和路线图
 * - 以多种格式输出综合分析报告(Markdown/JSON)
 * - 识别循环反馈和问题重新定义机会
 * - 提供问题重定向和深化建议
 */
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BaseAgent, BaseAgentConfig } from './base/BaseAgent';
import { GraphStateType } from '../types/schema';
import { logger } from '../infra/logger';
import * as path from 'path';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableConfig } from '@langchain/core/runnables';

// 扩展GraphStateType以包含OpportunityStrategy
interface ExtendedGraphStateType extends GraphStateType {
  opportunityStrategy?: {
    keyword: string;
    prioritizedOpportunities: any[];
    mvpDesigns: any[];
    validationRoadmap: { phases: any[] };
    businessCases: any[];
    problemRefinements: any[];
    feedbackLoops: any[];
    reportContent: string;
    reportPath: string;
    format: 'markdown' | 'json';
    metrics: {
      opportunitiesCount: number;
      mvpDesignsCount: number;
      businessCasesCount: number;
      averagePriorityScore: number;
      topPriorityOpportunity: string;
      roadmapPhasesCount: number;
      generationTimeMs: number;
      problemRefinementsCount: number;
    };
  };
}

// 机会策略Agent配置
export interface OpportunityStrategistAgentConfig extends BaseAgentConfig {
  format?: 'markdown' | 'json';
  language?: 'zh' | 'en';
  outputDir?: string;
  includeDetails?: boolean;
  enableMVPDesign?: boolean; // 启用MVP设计
  enableRoadmapGeneration?: boolean; // 启用路线图生成
  enableBusinessCase?: boolean; // 启用商业案例生成
  enableProblemRefinement?: boolean; // 启用问题精炼和循环反馈
  maxOpportunities?: number; // 处理的最大机会数量
  maxFeedbackLoops?: number; // 最大反馈循环数量
}

/**
 * 机会策略Agent (机会策略专家)
 * 负责机会优先级排序、MVP设计、验证路线图和商业案例生成
 */
export class OpportunityStrategistAgent extends BaseAgent<ExtendedGraphStateType, Partial<ExtendedGraphStateType>> {
  private format: 'markdown' | 'json';
  private language: 'zh' | 'en';
  private outputDir: string;
  private includeDetails: boolean;
  private enableMVPDesign: boolean;
  private enableRoadmapGeneration: boolean;
  private enableBusinessCase: boolean = true;
  private enableProblemRefinement: boolean;
  private maxOpportunities: number;
  private maxFeedbackLoops: number;
  
  constructor(config?: OpportunityStrategistAgentConfig) {
    super(config || {});
    this.format = config?.format || 'markdown';
    this.language = config?.language || 'zh';
    this.outputDir = config?.outputDir || './output';
    this.includeDetails = config?.includeDetails || false;
    this.maxOpportunities = config?.maxOpportunities || 5;
    this.enableMVPDesign = config?.enableMVPDesign !== false; // 默认启用
    this.enableRoadmapGeneration = config?.enableRoadmapGeneration !== false; // 默认启用
    this.enableBusinessCase = config?.enableBusinessCase !== false; // 默认启用
    this.enableProblemRefinement = config?.enableProblemRefinement !== false; // 默认启用
    this.maxFeedbackLoops = config?.maxFeedbackLoops || 3; // 默认3个反馈循环
    
    logger.debug('OpportunityStrategistAgent initialized', {
      format: this.format,
      language: this.language,
      outputDir: this.outputDir,
      includeDetails: this.includeDetails,
      maxOpportunities: this.maxOpportunities,
      enableMVPDesign: this.enableMVPDesign,
      enableRoadmapGeneration: this.enableRoadmapGeneration,
      enableBusinessCase: this.enableBusinessCase,
      enableProblemRefinement: this.enableProblemRefinement,
      maxFeedbackLoops: this.maxFeedbackLoops
    });
  }
  
  /**
   * 设置Agent所需的工具
   * 实现BaseAgent抽象方法
   */
  protected setupTools(): void {
    // 机会策略生成不需要特殊工具
    logger.debug('setupTools called in OpportunityStrategistAgent');
  }
  
  /**
   * 执行LLM链，统一处理LLM调用
   */
  private async llmChain(config: {
    prompt: ChatPromptTemplate;
    outputParser: StringOutputParser;
  }) {
    // 使用父类的llm实例
    return this.llm.pipe(config.prompt).pipe(config.outputParser);
  }
  
  /**
   * 生成Markdown格式报告
   */
  private async generateMarkdownReport(
    state: GraphStateType,
    opportunities: any[],
    mvpDesigns: any[],
    roadmap: any,
    businessCases: any[]
  ): Promise<string> {
    try {
      // 获取分析结果
      const keyword = state.input?.keyword || '';
      const keywordDiscovery = state.keywordDiscovery;
      const journeySimulation = state.journeySimulation;
      const contentAnalysis = state.contentAnalysis;
      
      // 获取统计指标
      const contentQualityScore = contentAnalysis?.statistics?.averageContentQuality || 'N/A';
      const marketGapScore = contentAnalysis?.statistics?.averageMarketGapSeverity || 'N/A';
      
      // 生成报告
      return `# "${keyword}" 市场机会分析报告

## 主要发现

- **需求满足度:** ${contentQualityScore}/10
- **市场缺口严重度:** ${marketGapScore}/10
- **已识别机会数量:** ${opportunities.length}
- **最高优先级机会:** ${opportunities.length > 0 ? opportunities[0].title : '无'}

## 优先级机会

${opportunities.map((opp, i) => `
### ${i+1}. ${opp.title}

**优先级得分:** ${opp.priorityScore}/10

**目标用户:** ${opp.targetUsers}

**核心价值主张:** ${opp.valueProposition}

**差异化因素:**
${opp.differentiators?.map((d: string) => `- ${d}`).join('\n') || '- 无差异化数据'}

**实施难度:** ${opp.implementationDifficulty}/10

**市场潜力:** ${opp.marketPotential}/10
`).join('\n')}

## 最小可行产品 (MVP) 方案

${mvpDesigns.map((mvp, i) => `
### MVP方案 ${i+1}: ${mvp.title}

**核心功能:**
${mvp.coreFeatures?.map((f: string) => `- ${f}`).join('\n') || '- 无功能数据'}

**成功指标:**
${mvp.successMetrics?.map((m: string) => `- ${m}`).join('\n') || '- 无指标数据'}

**资源需求:** ${mvp.resourceRequirements || '未指定'}

**预计开发时间:** ${mvp.estimatedTimeframe || '未指定'}
`).join('\n')}

## 验证路线图

${roadmap.phases?.map((phase: any, i: number) => `
### 阶段 ${i+1}: ${phase.name}

**目标:** ${phase.goal}

**关键活动:**
${phase.activities?.map((a: string) => `- ${a}`).join('\n') || '- 无活动数据'}

**时间估计:** ${phase.timeframe || '未指定'}

**成功标准:** ${phase.successCriteria || '未指定'}
`).join('\n') || '无路线图数据'}

## 结论与建议

${opportunities.length > 0 
  ? `建议优先关注 "${opportunities[0].title}" 机会，该机会具有最高的综合价值评分 (${opportunities[0].priorityScore}/10)。`
  : '无机会数据，无法提供建议。'}

报告生成时间: ${new Date().toISOString().split('T')[0]}
`;
    } catch (error) {
      logger.error('Error generating markdown report', { error });
      return `# "${state.input?.keyword || ''}" 分析报告\n\n生成报告时出错。请查看日志获取详细信息。`;
    }
  }
  
  /**
   * 根据综合价值和可行性对机会进行优先级排序
   */
  private async prioritizeOpportunities(state: GraphStateType): Promise<any[]> {
    try {
      logger.debug('Prioritizing opportunities');
      
      // 收集所有可能的机会
      const marketInsights = state.contentAnalysis?.marketInsights || [];
      const journeyInsights = state.journeySimulation?.insights || [];
      const potentialUnmetNeeds = state.keywordDiscovery?.potentialUnmetNeeds || [];
      // 从keywordDiscovery中获取insights数据
      const keywordInsights = state.keywordDiscovery?.insights || [];
      // 从不同数据源获取机会数据
      // @ts-ignore - 为了兼容新版数据结构
      const solutionOpportunities = state.contentAnalysis?.solutionOpportunities || 
                                   // @ts-ignore - 通过其他字段适配
                                   state.contentAnalysis?.opportunities || [];
      
      // 如果没有机会数据，返回空数组
      if (marketInsights.length === 0 && journeyInsights.length === 0 && 
          potentialUnmetNeeds.length === 0 && keywordInsights.length === 0 && 
          solutionOpportunities.length === 0) {
        logger.warn('No opportunities found to prioritize');
        return [];
      }
      
      // 准备所有机会相关数据文本
      let allOpportunitiesDataText = '';
      
      const formattedMarketInsights = marketInsights.length > 0
        ? `市场洞察 (Market Insights):\n${marketInsights.map((o: any, i: number) =>
            `  - 洞察 ${i+1}: ${o.title || 'Unnamed market insight'}\n` +
            `    价值: ${o.potentialValue || 'N/A'}/10\n` +
            `    说明: ${o.description || 'N/A'}`
          ).join('\n')}`
        : '';

      const formattedSolutionOpportunities = solutionOpportunities.length > 0
        ? `已有解决方案机会 (Solution Opportunities):\n${solutionOpportunities.map((opp: any, i: number) =>
            `  - 机会 ${i+1}: ${opp.title || 'Unnamed solution opportunity'}\n` +
            `    目标用户: ${opp.targetUsers || opp.targetAudience || 'N/A'}\n` +
            `    价值主张: ${opp.valueProposition || opp.description || 'N/A'}\n` +
            `    现有评分/潜力: ${opp.priorityScore || opp.marketPotential || opp.potentialValue || 'N/A'}`
          ).join('\n')}`
        : '';

      const opportunityParts = [];
      if (formattedMarketInsights) opportunityParts.push(formattedMarketInsights);
      if (formattedSolutionOpportunities) opportunityParts.push(formattedSolutionOpportunities);
      allOpportunitiesDataText = opportunityParts.join('\n\n');
      
      if (!allOpportunitiesDataText.trim()) {
        allOpportunitiesDataText = '没有明确定义的市场机会或解决方案机会数据。';
      }

      const journeyText = journeyInsights.length > 0
        ? `用户旅程洞察 (User Journey Insights):\n${journeyInsights.map((insight: string, i: number) => `  - ${i+1}. ${insight}`).join('\n')}`
        : '没有用户旅程洞察数据。';

      const needsText = potentialUnmetNeeds.length > 0
        ? `潜在未满足需求 (Potential Unmet Needs):\n${potentialUnmetNeeds.map((need: any, i: number) =>
            `  - 需求 ${i+1}: ${need.keyword}\n` +
            `    置信度: ${need.confidence}\n` +
            `    原因: ${need.reason}`
          ).join('\n')}`
        : '没有潜在未满足需求数据。';
        
      const insightsText = keywordInsights.length > 0
        ? `关键词洞察 (Keyword Insights):\n${keywordInsights.map((insight: any, i: number) =>
            `  - 洞察 ${i+1}: ${insight.title || 'Unnamed keyword insight'}\n` +
            `    说明: ${insight.description || 'N/A'}`
          ).join('\n')}`
        : '没有关键词洞察数据';
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的市场战略专家，擅长评估机会价值和可行性并排序。
        
        请综合分析以下所有信息，并对潜在的市场机会进行优先级排序:
        
        ${allOpportunitiesDataText}
        
        ${journeyText}
        
        ${needsText}
        
        ${insightsText}
        
        请使用以下综合评分标准:
        
        1. 市场潜力 (40%) - 市场规模和增长预期
        2. 执行可行性 (30%) - 资源要求和技术挑战
        3. 差异化程度 (20%) - 与竞争对手相比的独特价值
        4. 战略一致性 (10%) - 与核心业务的契合度
        
        为每个机会计算优先级分数(1-10)，并按分数从高到低排序。
        
        对于每个机会，请提供:
        1. 标题
        2. 目标用户群体
        3. 核心价值主张
        4. 优先级得分 (1-10)
        5. 实施难度 (1-10)
        6. 市场潜力 (1-10)
        7. 差异化因素 (3-5点)
        8. 建议初步行动
        
        以JSON数组返回结果:
        [
          {{
            "title": "机会标题",
            "targetUsers": "目标用户",
            "valueProposition": "核心价值主张",
            "priorityScore": 8.5,
            "implementationDifficulty": 6,
            "marketPotential": 9,
            "differentiators": ["差异点1", "差异点2", "差异点3"],
            "recommendedActions": ["初步行动1", "初步行动2"]
          }}
        ]
        
        最多返回${this.maxOpportunities}个机会，优先返回最高价值的机会。确保JSON格式正确，只返回JSON，不要其他解释。
      `);
      
      // 使用LLM执行优先级排序
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for prioritized opportunities', { content });
          return [];
        }
        
        const opportunities = JSON.parse(jsonMatch[0]);
        logger.debug('Prioritized opportunities', { count: opportunities.length });
        
        return opportunities;
      } catch (parseError) {
        logger.error('Failed to parse prioritized opportunities JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to prioritize opportunities', { error });
      return [];
    }
  }
  
  /**
   * 设计最小可行产品(MVP)解决方案
   * 为优先级最高的机会创建MVP设计方案
   */
  private async designMVPSolutions(opportunities: any[]): Promise<any[]> {
    if (!this.enableMVPDesign || opportunities.length === 0) {
      return [];
    }
    
    try {
      logger.debug('Designing MVP solutions');
      
      // 只为前N个高优先级机会设计MVP
      const topOpportunities = opportunities.slice(0, Math.min(3, opportunities.length));
      
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的产品设计师，精通将机会转化为最小可行产品(MVP)方案。
        
        请为以下优先级机会设计MVP方案:
        
        ${topOpportunities.map((opp, i) => `
        机会 ${i+1}: ${opp.title}
        价值主张: ${opp.valueProposition || 'N/A'}
        目标用户: ${opp.targetUsers || 'N/A'}
        优先级: ${opp.priorityScore}/10
        `).join('\n')}
        
        对于每个机会，请设计一个MVP方案，确保:
        
        1. 聚焦于验证核心价值主张的最小功能集
        2. 明确定义成功指标和验证标准
        3. 估计实施时间和资源需求
        4. 考虑技术可行性和用户体验
        
        以JSON数组格式返回结果:
        
        [
          {{
            "title": "MVP标题",
            "opportunityId": 0, // 关联的机会索引
            "valueProposition": "核心价值主张",
            "targetUsers": "目标用户群体",
            "coreFeatures": ["核心功能1", "核心功能2", "核心功能3"],
            "successMetrics": ["成功指标1", "成功指标2"],
            "resourceRequirements": "资源需求描述",
            "estimatedTimeframe": "时间估计"
          }}
        ]
        
        只返回JSON，不要其他解释。确保方案简洁实用，专注于验证关键假设的最小可行功能。
      `);
      
      // 使用LLM执行MVP设计
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for MVP designs', { content });
          return [];
        }
        
        const mvpDesigns = JSON.parse(jsonMatch[0]);
        logger.debug('Generated MVP designs', { count: mvpDesigns.length });
        
        return mvpDesigns;
      } catch (parseError) {
        logger.error('Failed to parse MVP designs JSON', { parseError, response });
        return [];
      }
    } catch (error) {
      logger.error('Failed to design MVP solutions', { error });
      return [];
    }
  }
  
  /**
   * 生成验证路线图
   * 为优先级机会创建实验和验证阶段
   */
  private async generateValidationRoadmap(opportunities: any[], mvpDesigns: any[]): Promise<any> {
    if (!this.enableRoadmapGeneration || opportunities.length === 0) {
      return { phases: [] };
    }
    
    try {
      logger.debug('Generating validation roadmap');
      
      // 创建提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个精通产品验证和实验设计的专家。
        
        请为以下机会和MVP设计创建详细的验证路线图:
        
        ${opportunities.map((opp, i) => `
        机会 ${i+1}: ${opp.title}
        优先级: ${opp.priorityScore}/10
        价值主张: ${opp.valueProposition || 'N/A'}
        目标用户: ${opp.targetUsers || 'N/A'}
        `).join('\n')}
        
        ${mvpDesigns.length > 0 ? `
        MVP设计:
        ${mvpDesigns.map((mvp, i) => `
        MVP ${i+1}: ${mvp.title || mvp.mvpName || 'Unnamed MVP'}
        核心价值: ${mvp.valueProposition || 'N/A'}
        主要功能: ${mvp.coreFeatures?.join(', ') || mvp.coreFunctionality?.map((f: any) => f.name).join(', ') || 'N/A'}
        `).join('\n')}
        ` : ''}
        
        请创建一个3-4阶段的验证路线图，确保:
        
        1. 每个阶段有明确的目标和成功标准
        2. 从低成本验证逐步过渡到更完整的解决方案
        3. 包含具体的实验和验证方法
        4. 为每个阶段提供时间和资源估计
        
        以JSON格式返回:
        {{
          "phases": [
            {{
              "name": "阶段名称",
              "goal": "阶段目标",
              "timeframe": "时间估计",
              "activities": ["关键活动1", "关键活动2"],
              "successCriteria": "成功标准描述"
            }}
          ]
        }}
        
        只返回JSON，不要其他解释。确保路线图实用、高效，聚焦于用最少资源验证关键假设。
      `);
      
      // 使用LLM执行路线图生成
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      const response = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const content = response.toString();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          logger.warn('Failed to parse LLM response for validation roadmap', { content });
          return { phases: [] };
        }
        
        const roadmap = JSON.parse(jsonMatch[0]);
        logger.debug('Generated validation roadmap', { 
          phasesCount: roadmap.phases?.length || 0
        });
        
        return roadmap;
      } catch (parseError) {
        logger.error('Failed to parse validation roadmap JSON', { parseError, response });
        return { phases: [] };
      }
    } catch (error) {
      logger.error('Failed to generate validation roadmap', { error });
      return { phases: [] };
    }
  }
  
  /**
   * 从评估的问题中整合和优先排序机会
   */
  private async prioritizeOpportunitiesFromProblems(
    problems: any[],
    keyword: string
  ): Promise<any[]> {
    try {
      if (!problems || problems.length === 0) {
        logger.debug('No problems to prioritize');
        return [];
      }
      
      logger.debug('Prioritizing opportunities from problems', { 
        problemsCount: problems.length,
        keyword
      });
      
      // 按价值分数排序
      const sortedProblems = problems.sort((a, b) => {
        // 如果有valueScore，优先使用
        const scoreA = a.valueScore || a.gapSeverity || a.validityScore || 0;
        const scoreB = b.valueScore || b.gapSeverity || b.validityScore || 0;
        return scoreB - scoreA; // 降序排序
      });
      
      // 限制机会数量
      const topProblems = sortedProblems.slice(0, this.maxOpportunities);
      
      // 将问题转换为机会
      const opportunities = topProblems.map((problem, index) => {
        // 提取问题基本信息
        const question = problem.refinedQuestion || problem.originalQuestion || '';
        const validityScore = problem.validityScore || 0;
        const gapSeverity = problem.gapSeverity || 0;
        const valueScore = problem.valueScore || Math.max(validityScore, gapSeverity);
        
        // 提取目标受众
        const targetAudience = problem.targetAudience || 
                             problem.validation?.targetAudience || 
                             '待定目标用户';
        
        // 提取市场潜力
        const marketPotential = problem.marketPotential || 
                              problem.validation?.marketPotential || 
                              problem.solutionGapAnalysis?.marketGapAnalysis?.opportunitySize || 
                              '中等';
        
        // 提取未满足需求
        const unmetNeeds = problem.unmetNeeds || 
                         problem.solutionGapAnalysis?.marketGapAnalysis?.unmetNeeds || 
                         [];
        
        // 创建机会对象
        return {
          id: index + 1,
          title: `解决"${question}"的机会`,
          problem: question,
          originalProblem: problem,
          priorityScore: valueScore,
          targetUsers: targetAudience,
          valueProposition: `为${targetAudience}提供解决"${question}"的优质解决方案`,
          marketPotential: valueScore > 8 ? 9 : valueScore > 6 ? 7 : 5,
          implementationDifficulty: 5, // 默认中等难度，将在后续分析中细化
          differentiators: unmetNeeds.length > 0 ? unmetNeeds : ['待确定'],
          keyInsights: [
            `用户真实性评分: ${validityScore}/10`,
            `解决方案缺口严重度: ${gapSeverity}/10`,
            `总体价值评分: ${valueScore}/10`
          ]
        };
      });
      
      logger.debug('Opportunities prioritized', { count: opportunities.length });
      return opportunities;
    } catch (error) {
      logger.error('Failed to prioritize opportunities', { error });
      return [];
    }
  }
  
  /**
   * 生成问题精炼建议和反馈循环
   */
  private async generateProblemRefinements(
    opportunities: any[],
    keyword: string
  ): Promise<any> {
    try {
      if (!opportunities || opportunities.length === 0) {
        logger.debug('No opportunities to refine');
        return {
          problemRefinements: [],
          feedbackLoops: []
        };
      }
      
      logger.debug('Generating problem refinements', { 
        opportunitiesCount: opportunities.length,
        keyword
      });
      
      // 准备提示
      const prompt = ChatPromptTemplate.fromTemplate(`
        你是一个专业的问题定义和精炼专家，擅长重新构建和深化问题，以发现更有价值的机会。
        
        初始关键词: "${keyword}"
        
        已识别的高价值问题:
        ${opportunities.map((opp, i) => `
        ${i+1}. ${opp.problem}
        - 优先级得分: ${opp.priorityScore}/10
        - 目标用户: ${opp.targetUsers}
        - 市场潜力: ${opp.marketPotential}/10
        `).join('\n')}
        
        请对每个问题进行深入思考，帮助我们:
        1. 提供更精确、更深入的问题重新定义
        2. 分解复杂问题为更具体的子问题
        3. 识别能作为新关键词使用的相关问题
        4. 设计反馈循环，将一个问题的解决方案作为下一个问题的输入
        
        对于每个问题，请提供:
        1. 问题精炼: 更精确、更有洞察力的问题表述
        2. 子问题分解: 将复杂问题分解为2-3个更具体的子问题
        3. 新关键词建议: 基于此问题可以探索的新关键词(类似的但更深入的问题)
        4. 原始问题与新问题的关系说明
        
        另外，请设计${this.maxFeedbackLoops}个反馈循环路径，将这些问题连接起来，形成持续精炼的过程。
        
        以JSON格式返回:
        {
          "problemRefinements": [
            {
              "originalProblem": "原始问题",
              "refinedProblem": "精炼后的问题",
              "subProblems": ["子问题1", "子问题2"],
              "suggestedKeywords": ["建议关键词1", "建议关键词2"],
              "relationshipExplanation": "新旧问题之间的关系说明",
              "refinementValue": 8
            }
          ],
          "feedbackLoops": [
            {
              "name": "循环名称",
              "description": "循环描述",
              "steps": [
                {
                  "stepNumber": 1,
                  "problemToSolve": "要解决的问题",
                  "outputToNextStep": "输出到下一步的内容"
                },
                {
                  "stepNumber": 2,
                  "problemToSolve": "要解决的问题",
                  "outputToNextStep": "输出到下一步的内容"
                }
              ],
              "expectedOutcome": "预期成果",
              "iterationValue": 9
            }
          ]
        }
      `);
      
      // 执行LLM生成
      const chain = this.llmChain({
        prompt,
        outputParser: new StringOutputParser(),
      });
      
      const refinementResult = await chain.invoke({});
      
      try {
        // 解析LLM返回的JSON
        const parsedRefinements = JSON.parse(refinementResult);
        
        logger.debug('Problem refinements generated', {
          refinementsCount: parsedRefinements.problemRefinements?.length || 0,
          feedbackLoopsCount: parsedRefinements.feedbackLoops?.length || 0
        });
        
        return parsedRefinements;
      } catch (error) {
        logger.error('Failed to parse problem refinements', { error });
        return {
          problemRefinements: [],
          feedbackLoops: []
        };
      }
    } catch (error) {
      logger.error('Failed to generate problem refinements', { error });
      return {
        problemRefinements: [],
        feedbackLoops: []
      };
    }
  }
  
  /**
   * Agent执行入口
   */
  protected async executeImpl(state: any, config?: RunnableConfig): Promise<Partial<ExtendedGraphStateType>> {
    try {
      const startTime = Date.now();
      
      // 从状态中获取关键词和分析结果
      const keyword = state.input?.keyword;
      if (!keyword) {
        throw new Error('No keyword provided in state');
      }
      
      logger.info(`Starting OpportunityStrategistAgent for keyword: ${keyword}`);
      
      // 获取前一阶段SolutionEvaluatorAgent评估的问题
      const evaluatedProblems = state.contentAnalysis?.problemGapAnalyses || [];
      
      // 如果没有找到评估后的问题，尝试从其他状态中获取
      let problems = evaluatedProblems;
      if (problems.length === 0) {
        // 尝试从UserJourneySimulatorAgent获取验证的问题
        const validatedProblems = state.journeySimulation?.problemValidations || [];
        if (validatedProblems.length > 0) {
          problems = validatedProblems;
        } else {
          // 最后尝试从MarketNeedExplorerAgent获取发现的问题
          const discoveredProblems = state.keywordDiscovery?.highValueProblems || [];
          problems = discoveredProblems;
        }
      }
      
      // 汇总来自所有Agent的各种洞察
      const keywordDiscovery = state.keywordDiscovery || {};
      const journeySimulation = state.journeySimulation || {};
      const contentAnalysis = state.contentAnalysis || {};
      
      // 1. 对机会进行优先级排序
      const prioritizedOpportunities = await this.prioritizeOpportunitiesFromProblems(
        problems,
        keyword
      );
      
      // 2. 设计MVP解决方案(如果启用)
      let mvpDesigns = [];
      if (this.enableMVPDesign) {
        mvpDesigns = await this.designMVPSolutions(prioritizedOpportunities);
      }
      
      // 3. 生成验证路线图(如果启用)
      let validationRoadmap = { phases: [] };
      if (this.enableRoadmapGeneration) {
        validationRoadmap = await this.generateValidationRoadmap(
          prioritizedOpportunities,
          mvpDesigns
        );
      }
      
      // 4. 生成商业案例(如果启用)
      let businessCases = [];
      if (this.enableBusinessCase) {
        businessCases = await this.generateBusinessCases(
          prioritizedOpportunities,
          mvpDesigns,
          validationRoadmap
        );
      }
      
      // 5. 生成问题精炼和反馈循环(如果启用)
      let problemRefinements = [];
      let feedbackLoops = [];
      if (this.enableProblemRefinement) {
        const refinementResults = await this.generateProblemRefinements(
          prioritizedOpportunities,
          keyword
        );
        problemRefinements = refinementResults.problemRefinements || [];
        feedbackLoops = refinementResults.feedbackLoops || [];
      }
      
      // 6. 生成报告
      let reportContent = '';
      let reportPath = '';
      
      if (this.format === 'markdown') {
        reportContent = await this.generateMarkdownReport(
          state,
          prioritizedOpportunities,
          mvpDesigns,
          validationRoadmap,
          businessCases,
          problemRefinements,
          feedbackLoops
        );
        
        // 保存报告到文件
        reportPath = path.join(this.outputDir, `${keyword.replace(/[^\w\s]/g, '')}_report.md`);
        
        // 保存报告使用工具 - 如果有的话
        const markdownTool = this.tools.find(t => t.name === 'generate_markdown');
        if (markdownTool) {
          try {
            await markdownTool.invoke({
              content: reportContent,
              outputPath: reportPath,
              title: `${keyword} 市场机会分析报告`
            });
          } catch (error) {
            logger.error('Failed to save markdown report', { error });
            // 继续执行，不让报告保存失败影响整体流程
          }
        } else {
          logger.warn('generate_markdown tool not found, report not saved to file');
        }
      }
      
      // 计算指标
      const metrics = {
        opportunitiesCount: prioritizedOpportunities.length,
        mvpDesignsCount: mvpDesigns.length,
        businessCasesCount: businessCases.length,
        averagePriorityScore: prioritizedOpportunities.length > 0 
          ? prioritizedOpportunities.reduce((sum, opp) => sum + opp.priorityScore, 0) / prioritizedOpportunities.length 
          : 0,
        topPriorityOpportunity: prioritizedOpportunities.length > 0 
          ? prioritizedOpportunities[0].title 
          : '',
        roadmapPhasesCount: validationRoadmap.phases.length,
        generationTimeMs: Date.now() - startTime,
        problemRefinementsCount: problemRefinements.length
      };
      
      logger.info(`OpportunityStrategistAgent completed for ${keyword}`, {
        opportunitiesCount: prioritizedOpportunities.length,
        mvpDesignsCount: mvpDesigns.length,
        businessCasesCount: businessCases.length,
        problemRefinementsCount: problemRefinements.length
      });
      
      // 返回状态更新
      return {
        opportunityStrategy: {
          keyword,
          prioritizedOpportunities,
          mvpDesigns,
          validationRoadmap,
          businessCases,
          problemRefinements,
          feedbackLoops,
          reportContent,
          reportPath,
          format: this.format,
          metrics
        }
      };
    } catch (error: any) {
      logger.error('Error in OpportunityStrategistAgent', { 
        error: error.message, 
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * 生成Markdown格式报告 - 增强版
   */
  private async generateMarkdownReport(
    state: GraphStateType,
    opportunities: any[],
    mvpDesigns: any[],
    roadmap: any,
    businessCases: any[],
    problemRefinements: any[],
    feedbackLoops: any[]
  ): Promise<string> {
    try {
      // 获取分析结果
      const keyword = state.input?.keyword || '';
      const keywordDiscovery = state.keywordDiscovery;
      const journeySimulation = state.journeySimulation;
      const contentAnalysis = state.contentAnalysis;
      
      // 获取统计指标
      const contentQualityScore = contentAnalysis?.statistics?.averageContentQuality || 'N/A';
      const marketGapScore = contentAnalysis?.statistics?.averageGapSeverity || 'N/A';
      
      // 增强报告 - 添加问题精炼和反馈循环部分
      let problemRefinementsSection = '';
      if (problemRefinements && problemRefinements.length > 0) {
        problemRefinementsSection = `
## 问题精炼与深化

${problemRefinements.map((refinement, i) => `
### ${i+1}. 从"${refinement.originalProblem}"到"${refinement.refinedProblem}"

**精炼价值:** ${refinement.refinementValue}/10

**问题关系:** ${refinement.relationshipExplanation}

**子问题分解:**
${refinement.subProblems?.map((sub: string) => `- ${sub}`).join('\n') || '- 无子问题数据'}

**建议关键词探索:**
${refinement.suggestedKeywords?.map((key: string) => `- ${key}`).join('\n') || '- 无关键词建议'}
`).join('\n')}
`;
      }
      
      let feedbackLoopsSection = '';
      if (feedbackLoops && feedbackLoops.length > 0) {
        feedbackLoopsSection = `
## 问题循环反馈机制

${feedbackLoops.map((loop, i) => `
### 循环 ${i+1}: ${loop.name}

**描述:** ${loop.description}

**迭代价值:** ${loop.iterationValue}/10

**循环步骤:**
${loop.steps?.map((step: any) => `
#### 步骤 ${step.stepNumber}: ${step.problemToSolve}
输出到下一步: ${step.outputToNextStep}
`).join('\n') || '- 无步骤数据'}

**预期成果:** ${loop.expectedOutcome}
`).join('\n')}
`;
      }
      
      // 生成基础报告
      let report = `# "${keyword}" 市场机会分析报告

## 主要发现

- **需求满足度:** ${contentQualityScore}/10
- **市场缺口严重度:** ${marketGapScore}/10
- **已识别机会数量:** ${opportunities.length}
- **最高优先级机会:** ${opportunities.length > 0 ? opportunities[0].title : '无'}

## 优先级机会

${opportunities.map((opp, i) => `
### ${i+1}. ${opp.title}

**优先级得分:** ${opp.priorityScore}/10

**目标用户:** ${opp.targetUsers}

**核心价值主张:** ${opp.valueProposition}

**差异化因素:**
${opp.differentiators?.map((d: string) => `- ${d}`).join('\n') || '- 无差异化数据'}

**实施难度:** ${opp.implementationDifficulty}/10

**市场潜力:** ${opp.marketPotential}/10

**关键洞察:**
${opp.keyInsights?.map((insight: string) => `- ${insight}`).join('\n') || '- 无洞察数据'}
`).join('\n')}

## 最小可行产品 (MVP) 方案

${mvpDesigns.map((mvp, i) => `
### MVP方案 ${i+1}: ${mvp.title}

**核心功能:**
${mvp.coreFeatures?.map((f: string) => `- ${f}`).join('\n') || '- 无功能数据'}

**成功指标:**
${mvp.successMetrics?.map((m: string) => `- ${m}`).join('\n') || '- 无指标数据'}

**资源需求:** ${mvp.resourceRequirements || '未指定'}

**预计开发时间:** ${mvp.estimatedTimeframe || '未指定'}
`).join('\n')}

## 验证路线图

${roadmap.phases?.map((phase: any, i: number) => `
### 阶段 ${i+1}: ${phase.name}

**目标:** ${phase.goal}

**关键活动:**
${phase.activities?.map((a: string) => `- ${a}`).join('\n') || '- 无活动数据'}

**时间估计:** ${phase.timeframe || '未指定'}

**成功标准:** ${phase.successCriteria || '未指定'}
`).join('\n') || '无路线图数据'}

${problemRefinementsSection}

${feedbackLoopsSection}

## 结论与建议

${opportunities.length > 0 
  ? `建议优先关注 "${opportunities[0].title}" 机会，该机会具有最高的综合价值评分 (${opportunities[0].priorityScore}/10)。${problemRefinements.length > 0 ? '同时，考虑使用问题精炼和循环反馈机制进一步深化分析。' : ''}`
  : '无机会数据，无法提供建议。'}

报告生成时间: ${new Date().toISOString().split('T')[0]}
`;

      return report;
    } catch (error) {
      logger.error('Failed to generate markdown report', { error });
      return `# "${state.input?.keyword || '未知关键词'}" 市场机会分析报告\n\n*报告生成失败*\n\n错误: ${error}`;
    }
  }
}