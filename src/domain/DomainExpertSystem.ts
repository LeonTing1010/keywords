/**
 * DomainExpertSystem - 垂直领域专家系统
 * 自动适配不同行业知识体系，提供专业化分析
 */
import { LLMServiceHub, AnalysisOptions } from '../llm/LLMServiceHub';

// 领域配置文件接口
export interface DomainProfile {
  name: string;
  description: string;
  keyTerms: string[];
  subdomains: string[];
  relatedDomains: string[];
}

// 领域信息结果接口
export interface DomainInfo {
  name: string;
  confidence: number;
  description: string;
  keyTerms: Record<string, string>;
  subdomains: string[];
  relatedDomains: string[];
  dominantIntent: string;
}

// 领域关键词分析结果接口
export interface DomainKeywordAnalysis {
  keyword: string;
  domain: string;
  confidence: number;
  termExplanation?: Record<string, string>;
  subdomainClassification?: string;
  technicalLevel: 'basic' | 'intermediate' | 'advanced';
  intentInDomain: string;
}

// 领域专家系统配置接口
export interface DomainExpertSystemConfig {
  llmService: LLMServiceHub;
  verbose?: boolean;
}

/**
 * DomainExpertSystem是一个垂直领域专家系统
 * 可以自动适配不同行业的专业知识，提供深度分析
 */
export class DomainExpertSystem {
  private llmService: LLMServiceHub;
  private verbose: boolean;
  private domainProfiles: Record<string, DomainProfile> = {};
  
  constructor(config: DomainExpertSystemConfig) {
    this.llmService = config.llmService;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 初始化完成`);
    }
  }
  
  /**
   * 识别关键词所属的领域
   */
  async identifyDomain(keywords: string[]): Promise<DomainInfo[]> {
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 开始领域识别，关键词数量: ${keywords.length}`);
    }
    
    // 使用LLM识别领域
    const domainData = await this.llmService.identifyDomain(keywords, {
      format: 'json'
    });
    
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 领域识别完成，识别到 ${domainData.domains.length} 个领域`);
    }
    
    // 丰富领域信息
    const enhancedDomains = await this.enhanceDomainsWithExpertise(domainData.domains);
    
    return enhancedDomains;
  }
  
  /**
   * 丰富领域信息
   */
  private async enhanceDomainsWithExpertise(domains: any[]): Promise<DomainInfo[]> {
    // 对每个识别到的领域添加专业知识
    const enhancedDomains: DomainInfo[] = [];
    
    for (const domain of domains) {
      // 查找本地缓存的领域资料
      const cachedProfile = this.domainProfiles[domain.name];
      
      if (cachedProfile) {
        enhancedDomains.push({
          ...domain,
          description: cachedProfile.description,
          keyTerms: domain.keyTerms || {},
          subdomains: cachedProfile.subdomains,
          relatedDomains: cachedProfile.relatedDomains,
          dominantIntent: domain.dominantIntent || 'informational'
        });
      } else {
        // 请求LLM生成领域详情
        const domainDetails = await this.llmService.analyze('domain_details', {
          domain: domain.name,
          task: 'Generate detailed domain expertise information'
        }, {
          systemPrompt: 'You are a domain expert who provides comprehensive information about specific industries and fields.',
          format: 'json'
        });
        
        // 缓存领域资料
        this.domainProfiles[domain.name] = {
          name: domain.name,
          description: domainDetails.description,
          keyTerms: domainDetails.keyTerms || [],
          subdomains: domainDetails.subdomains || [],
          relatedDomains: domainDetails.relatedDomains || []
        };
        
        enhancedDomains.push({
          ...domain,
          description: domainDetails.description,
          keyTerms: domainDetails.termExplanations || {},
          subdomains: domainDetails.subdomains || [],
          relatedDomains: domainDetails.relatedDomains || [],
          dominantIntent: domain.dominantIntent || 'informational'
        });
      }
    }
    
    return enhancedDomains;
  }
  
  /**
   * 获取领域专家分析
   */
  async getExpertAnalysis(keywords: string[], domainName: string): Promise<DomainKeywordAnalysis[]> {
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 开始领域专家分析，领域: ${domainName}, 关键词数量: ${keywords.length}`);
    }
    
    // 查找领域资料
    let domainProfile = this.domainProfiles[domainName];
    
    // 如果没有领域资料，生成一个
    if (!domainProfile) {
      const domainDetails = await this.llmService.analyze('domain_details', {
        domain: domainName,
        task: 'Generate detailed domain expertise information'
      }, {
        systemPrompt: 'You are a domain expert who provides comprehensive information about specific industries and fields.',
        format: 'json'
      });
      
      domainProfile = {
        name: domainName,
        description: domainDetails.description,
        keyTerms: domainDetails.keyTerms || [],
        subdomains: domainDetails.subdomains || [],
        relatedDomains: domainDetails.relatedDomains || []
      };
      
      // 缓存领域资料
      this.domainProfiles[domainName] = domainProfile;
    }
    
    // 获取专家分析
    const expertAnalysis = await this.llmService.analyze('expert_analysis', {
      keywords,
      domain: domainName,
      domainProfile,
      task: 'Analyze keywords from domain expert perspective'
    }, {
      systemPrompt: `You are an expert in the field of ${domainName} with deep knowledge of the terminology, concepts, and trends in this domain.`,
      format: 'json'
    });
    
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 领域专家分析完成，已分析 ${expertAnalysis.analyses.length} 个关键词`);
    }
    
    return expertAnalysis.analyses;
  }
  
  /**
   * 根据领域进行关键词分类
   */
  async classifyKeywordsByDomain(keywords: string[]): Promise<Record<string, string[]>> {
    // 识别领域
    const domains = await this.identifyDomain(keywords);
    
    // 按领域分组关键词
    const domainKeywords: Record<string, string[]> = {};
    
    // 使用LLM对每个关键词进行领域分类
    const classification = await this.llmService.analyze('domain_classification', {
      keywords,
      identifiedDomains: domains.map(d => d.name),
      task: 'Classify each keyword into the most relevant domain'
    }, {
      systemPrompt: 'You are a domain classification expert who categorizes keywords by their relevant industry or field.',
      format: 'json'
    });
    
    // 处理分类结果
    classification.results.forEach((result: any) => {
      if (!domainKeywords[result.domain]) {
        domainKeywords[result.domain] = [];
      }
      domainKeywords[result.domain].push(result.keyword);
    });
    
    return domainKeywords;
  }
  
  /**
   * 领域适配分析
   */
  async adaptToDomain(keywords: string[], targetDomain: string): Promise<any> {
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 开始领域适配分析，目标领域: ${targetDomain}`);
    }
    
    // 获取领域专家分析
    const expertAnalyses = await this.getExpertAnalysis(keywords, targetDomain);
    
    // 获取领域术语解释
    const termExplanations = await this.getTermExplanations(
      keywords, 
      targetDomain
    );
    
    // 获取领域意图解释
    const intentExplanations = await this.getDomainIntentAnalysis(
      keywords,
      targetDomain
    );
    
    return {
      domain: targetDomain,
      analyses: expertAnalyses,
      termExplanations,
      intentExplanations,
      summary: {
        totalKeywords: keywords.length,
        domainRelevance: expertAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / expertAnalyses.length,
        technicalDistribution: this.calculateTechnicalDistribution(expertAnalyses)
      }
    };
  }
  
  /**
   * 获取术语解释
   */
  private async getTermExplanations(keywords: string[], domain: string): Promise<Record<string, string>> {
    // 使用LLM生成术语解释
    const explanations = await this.llmService.analyze('term_explanations', {
      keywords,
      domain,
      task: 'Explain domain-specific terminology in these keywords'
    }, {
      systemPrompt: `You are a terminology expert in the field of ${domain} who explains complex terms in clear language.`,
      format: 'json'
    });
    
    return explanations.explanations || {};
  }
  
  /**
   * 获取领域意图分析
   */
  private async getDomainIntentAnalysis(keywords: string[], domain: string): Promise<any> {
    // 使用LLM进行领域特定意图分析
    const intentAnalysis = await this.llmService.analyze('domain_intent', {
      keywords,
      domain,
      task: 'Analyze search intent from domain-specific perspective'
    }, {
      systemPrompt: `You are an intent analyst specializing in the ${domain} industry who understands the unique search behavior in this field.`,
      format: 'json'
    });
    
    return intentAnalysis;
  }
  
  /**
   * 计算技术水平分布
   */
  private calculateTechnicalDistribution(analyses: DomainKeywordAnalysis[]): Record<string, number> {
    const distribution: Record<string, number> = {
      basic: 0,
      intermediate: 0,
      advanced: 0
    };
    
    analyses.forEach(analysis => {
      distribution[analysis.technicalLevel] += 1;
    });
    
    // 转换为百分比
    const total = analyses.length;
    Object.keys(distribution).forEach(level => {
      distribution[level] = Math.round((distribution[level] / total) * 100);
    });
    
    return distribution;
  }
  
  /**
   * 生成领域特定建议
   */
  async generateDomainSpecificSuggestions(keywords: string[], domain: string): Promise<string[]> {
    if (this.verbose) {
      console.info(`[DomainExpertSystem] 生成领域特定建议，领域: ${domain}`);
    }
    
    // 使用LLM生成建议
    const suggestions = await this.llmService.analyze('domain_suggestions', {
      keywords,
      domain,
      task: 'Generate domain-specific keyword suggestions'
    }, {
      systemPrompt: `You are a keyword strategist specializing in the ${domain} industry who can generate highly relevant search terms.`,
      format: 'json',
      temperature: 0.7
    });
    
    return suggestions.suggestions || [];
  }
} 