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
  private config: AnalyzerConfig = {
    model: 'gpt-4',
    temperature: 0.7,
    engine: 'baidu',
    verbose: false
  };

  constructor() {
    this.llm = new LLMServiceHub();
  }

  /**
   * Configure the analyzer
   */
  public configure(config: Partial<AnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    this.llm = new LLMServiceHub({
      model: this.config.model,
      verbose: this.config.verbose
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

    const [timingAnalysis, directionAnalysis] = await Promise.all([
      this.llm.analyze(timingPrompt, 'timing_analysis', { temperature: this.config.temperature }),
      this.llm.analyze(directionPrompt, 'trend_analysis', { temperature: this.config.temperature })
    ]);

    return {
      domain,
      timing: JSON.parse(timingAnalysis),
      direction: JSON.parse(directionAnalysis)
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

    return JSON.parse(await this.llm.analyze(prompt, 'strategy_analysis', { temperature: this.config.temperature }));
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

    return JSON.parse(await this.llm.analyze(prompt, 'risk_analysis', { temperature: this.config.temperature }));
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

    return JSON.parse(await this.llm.analyze(prompt, 'resource_planning', { temperature: this.config.temperature }));
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

    return JSON.parse(await this.llm.analyze(prompt, 'validation_planning', { temperature: this.config.temperature }));
  }
}