import {
  EnhancedWorkflowResult,
  StartupAnalysis
} from './types/AnalysisTypes';
import { LLMServiceHub } from '../../infrastructure/llm/LLMServiceHub';

interface AnalyzerConfig {
  model: string;
  temperature: number;
  engine: 'baidu' | 'google';
  verbose: boolean;
}

export class StartupAnalyzer {
  private llm: LLMServiceHub;
  private jsonLlm: LLMServiceHub; // JSON强制LLM服务
  private config: AnalyzerConfig = {
    model: 'gpt-4',
    temperature: 0.7,
    engine: 'baidu',
    verbose: false
  };

  constructor() {
    this.llm = new LLMServiceHub();
    // 创建一个专用于JSON响应的LLM服务
    this.jsonLlm = new LLMServiceHub();
  }

  /**
   * Configure the analyzer
   */
  public configure(config: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    this.llm = new LLMServiceHub({
      model: this.config.model,
    });
    this.jsonLlm = new LLMServiceHub({
      model: this.config.model,
    });
  }

  /**
   * Analyze startup opportunity with domain-specific insights
   */
  public async analyzeOpportunity(result: EnhancedWorkflowResult): Promise<StartupAnalysis> {
    const domain = await this.analyzeDomain(result);
    
    return {
      opportunity: await this.assessOpportunity(result, domain),
      strategy: await this.developStrategy(result, domain),
      risks: await this.analyzeRisks(result, domain),
      resources: await this.planResources(result, domain),
      validation: await this.createValidationPlan(result, domain)
    };
  }

  /**
   * Analyze the specific domain and market context
   */
  private async analyzeDomain(result: EnhancedWorkflowResult): Promise<string> {
    const prompt = `Analyze the following startup opportunity and identify its specific domain and market context:
    Keyword: ${result.keyword}
    Market Insights: ${JSON.stringify(result.marketInsights)}
    User Journeys: ${JSON.stringify(result.userJourneys)}
    Validation Results: ${JSON.stringify(result.validationResults)}`;

    return await this.llm.analyze(prompt, 'domain_analysis', { temperature: this.config.temperature });
  }

  /**
   * Assess the core opportunity with timing and direction
   */
  private async assessOpportunity(result: EnhancedWorkflowResult, domain: string): Promise<StartupAnalysis['opportunity']> {
    const timingPrompt = `Given the following data for a ${domain} startup opportunity, analyze:
    1. Current market timing status
    2. Size of the opportunity window
    3. Urgency level (high/medium/low)
    4. Key rationale for timing assessment
    
    Data:
    ${JSON.stringify(result)}`;

    const directionPrompt = `Based on the following data for a ${domain} startup opportunity, analyze:
    1. Overall market direction and trends
    2. Key driving factors
    3. Supporting evidence
    4. Confidence level in the analysis
    
    Data:
    ${JSON.stringify(result)}`;

    let timing, direction;

    try {
      const timingAnalysis = await this.jsonLlm.analyze(timingPrompt, 'timing_analysis', { 
        temperature: this.config.temperature, 
        format: 'json',
        strictFormat: true
      });
      
      timing = typeof timingAnalysis === 'string' ? JSON.parse(timingAnalysis) : timingAnalysis;
    } catch (error) {
      console.log('获取timing分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      timing = {
        status: "Unknown",
        windowSize: "Unknown",
        urgencyLevel: "medium",
        rationale: "Unable to analyze market timing due to API error. Please try again later.",
        error: error instanceof Error ? error.message : String(error)
      };
    }
    
    try {
      const directionAnalysis = await this.jsonLlm.analyze(directionPrompt, 'trend_analysis', { 
        temperature: this.config.temperature, 
        format: 'json',
        strictFormat: true
      });
      
      direction = typeof directionAnalysis === 'string' ? JSON.parse(directionAnalysis) : directionAnalysis;
    } catch (error) {
      console.log('获取direction分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      direction = {
        trends: ["Unable to analyze market trends due to API error"],
        drivingFactors: ["Please try again later"],
        evidence: ["Error occurred during analysis"],
        confidenceLevel: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    return {
      domain,
      timing,
      direction
    };
  }

  /**
   * Develop domain-specific strategy
   */
  private async developStrategy(result: EnhancedWorkflowResult, domain: string): Promise<StartupAnalysis['strategy']> {
    const prompt = `As an expert in ${domain}, develop a strategic entry and growth plan:
    1. Recommend the best entry point and approach
    2. Identify key competitive advantages
    3. List critical challenges to address
    4. Suggest unique differentiators
    5. Provide timing recommendations
    
    Context:
    ${JSON.stringify(result)}`;

    try {
      const strategyAnalysis = await this.jsonLlm.analyze(prompt, 'strategy_analysis', { 
        temperature: this.config.temperature,
        format: 'json',
        strictFormat: true
      });
      
      return typeof strategyAnalysis === 'string' ? JSON.parse(strategyAnalysis) : strategyAnalysis;
    } catch (error) {
      console.log('获取strategy分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      return {
        entryPoint: "Unable to analyze due to API error",
        approach: "Please try again later",
        competitiveAdvantages: ["Analysis error occurred"],
        challenges: ["Unable to identify challenges due to API error"],
        differentiators: ["Error analyzing differentiators"],
        timingRecommendations: ["Please retry the analysis"],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze domain-specific risks
   */
  private async analyzeRisks(result: EnhancedWorkflowResult, domain: string): Promise<StartupAnalysis['risks']> {
    const prompt = `As a risk analyst specializing in ${domain}, analyze:
    1. Critical immediate risks that need urgent attention
    2. Strategic long-term risks
    3. Specific impact in this domain
    4. Domain-specific mitigation strategies
    
    Context:
    ${JSON.stringify(result)}`;

    try {
      const riskAnalysis = await this.jsonLlm.analyze(prompt, 'risk_analysis', { 
        temperature: this.config.temperature,
        format: 'json',
        strictFormat: true
      });
      
      return typeof riskAnalysis === 'string' ? JSON.parse(riskAnalysis) : riskAnalysis;
    } catch (error) {
      console.log('获取risks分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      return {
        immediate: [{
          description: "Unable to analyze immediate risks due to API error",
          severity: "medium" as 'high' | 'medium' | 'low',
          mitigation: "Please try again later"
        }],
        strategic: [{
          description: "Unable to analyze strategic risks due to API error",
          impact: "unknown",
          timeframe: "unknown",
          mitigation: "Please retry the analysis"
        }],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Plan resource needs based on domain requirements
   */
  private async planResources(result: EnhancedWorkflowResult, domain: string): Promise<StartupAnalysis['resources']> {
    const prompt = `As a startup advisor specializing in ${domain}, plan resource needs:
    1. Essential immediate resources to start
    2. Alternative resource strategies
    3. Scaling triggers and requirements
    4. Resource preparation timeline
    
    Context:
    ${JSON.stringify(result)}`;

    try {
      const resourcePlanning = await this.jsonLlm.analyze(prompt, 'resource_planning', { 
        temperature: this.config.temperature,
        format: 'json',
        strictFormat: true
      });
      
      return typeof resourcePlanning === 'string' ? JSON.parse(resourcePlanning) : resourcePlanning;
    } catch (error) {
      console.log('获取resources分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      return {
        immediate: [{
          type: "Error",
          description: "Unable to analyze resource needs due to API error",
          priority: "medium" as 'high' | 'medium' | 'low'
        }],
        scaling: [{
          trigger: "Unknown",
          requirements: ["Please try again later"],
          timeline: "Error in analysis"
        }],
        alternatives: ["Unable to provide alternatives due to analysis error"],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create domain-specific validation plan
   */
  private async createValidationPlan(result: EnhancedWorkflowResult, domain: string): Promise<StartupAnalysis['validation']> {
    const prompt = `As a ${domain} market validation expert, create a validation plan:
    1. Key hypotheses that need validation
    2. Domain-specific validation methods
    3. Appropriate success metrics and thresholds
    4. Immediate next steps and priorities
    
    Context:
    ${JSON.stringify(result)}`;

    try {
      const validationPlanning = await this.jsonLlm.analyze(prompt, 'validation_planning', { 
        temperature: this.config.temperature,
        format: 'json',
        strictFormat: true
      });
      
      return typeof validationPlanning === 'string' ? JSON.parse(validationPlanning) : validationPlanning;
    } catch (error) {
      console.log('获取validation分析失败，创建兜底内容', { error });
      
      // 创建兜底内容
      return {
        hypotheses: [{
          statement: "Unable to generate hypotheses due to API error",
          priority: "medium" as 'high' | 'medium' | 'low'
        }],
        methods: [{
          name: "Error in analysis",
          description: "Unable to propose validation methods due to API error",
          metrics: ["Please try again later"],
          thresholds: ["Error occurred during analysis"]
        }],
        nextSteps: ["Retry the analysis"],
        priorities: ["Unable to determine priorities due to API error"],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}