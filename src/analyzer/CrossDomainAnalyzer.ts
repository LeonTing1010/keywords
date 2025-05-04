/**
 * CrossDomainAnalyzer - 跨领域关联分析器
 * 发现不同领域间的关键词关联和机会点
 */
import { LLMServiceHub, AnalysisOptions } from '../llm/LLMServiceHub';
import { DomainExpertSystem, DomainInfo } from '../domain/DomainExpertSystem';

// 领域关联接口
export interface DomainRelation {
  sourceDomain: string;
  targetDomain: string;
  strength: number; // 0-1
  keywords: string[];
  opportunities: string[];
  description: string;
}

// 跨域机会接口
export interface CrossDomainOpportunity {
  domains: string[];
  keywords: string[];
  description: string;
  opportunityType: 'content' | 'commercial' | 'research' | 'innovation';
  potentialValue: number; // 0-1
}

// 跨域关系结果接口
export interface CrossDomainAnalysisResult {
  domains: string[];
  keywordCount: number;
  relations: DomainRelation[];
  opportunities: CrossDomainOpportunity[];
  clusters: {
    name: string;
    domains: string[];
    keywords: string[];
  }[];
  summary: {
    strongestRelation: {
      domains: string[];
      strength: number;
    };
    mostValuableOpportunity: {
      domains: string[];
      value: number;
      description: string;
    };
    domainConnectivity: Record<string, number>;
  };
}

// 分析器配置接口
export interface CrossDomainAnalyzerConfig {
  llmService: LLMServiceHub;
  domainExpert?: DomainExpertSystem;
  verbose?: boolean;
}

/**
 * CrossDomainAnalyzer是一个用于分析不同领域间关键词关联的组件
 * 它能够发现跨领域机会并识别领域间的关系强度
 */
export class CrossDomainAnalyzer {
  private llmService: LLMServiceHub;
  private domainExpert?: DomainExpertSystem;
  private verbose: boolean;
  
  constructor(config: CrossDomainAnalyzerConfig) {
    this.llmService = config.llmService;
    this.domainExpert = config.domainExpert;
    this.verbose = config.verbose || false;
    
    if (this.verbose) {
      console.info(`[CrossDomainAnalyzer] 初始化完成`);
    }
  }
  
  /**
   * 分析跨领域关系
   */
  async analyzeRelations(keywords: string[], domains?: string[]): Promise<CrossDomainAnalysisResult> {
    if (this.verbose) {
      console.info(`[CrossDomainAnalyzer] 开始跨域分析，关键词数量: ${keywords.length}`);
    }
    
    // 如果没有提供领域，尝试使用DomainExpert识别或通过LLM识别
    let targetDomains: string[] = domains || [];
    
    if (targetDomains.length === 0) {
      if (this.domainExpert) {
        // 通过领域专家识别
        const domainInfo = await this.domainExpert.identifyDomain(keywords);
        targetDomains = domainInfo.map((d: { name: string }) => d.name);
        
        if (this.verbose) {
          console.info(`[CrossDomainAnalyzer] 领域专家识别到 ${targetDomains.length} 个领域: ${targetDomains.join(', ')}`);
        }
      } else {
        // 使用LLM识别领域
        const domainIdResult = await this.llmService.analyze('identify_domains', {
          keywords,
          task: 'Identify the main domains represented in these keywords'
        }, {
          systemPrompt: 'You are a domain classification expert who identifies distinct industries and fields from keywords.',
          format: 'json'
        });
        
        targetDomains = domainIdResult.domains.map((d: any) => d.name);
        
        if (this.verbose) {
          console.info(`[CrossDomainAnalyzer] LLM识别到 ${targetDomains.length} 个领域: ${targetDomains.join(', ')}`);
        }
      }
    }
    
    // 确保targetDomains不为undefined
    targetDomains = targetDomains || [];
    
    // 分析领域关系
    const relations = await this.analyzeDomainRelations(keywords, targetDomains);
    
    // 识别跨域机会
    const opportunities = await this.identifyCrossDomainOpportunities(keywords, targetDomains, relations);
    
    // 创建跨域聚类
    const clusters = await this.createCrossDomainClusters(keywords, targetDomains, relations);
    
    // 构建结果
    const result: CrossDomainAnalysisResult = {
      domains: targetDomains,
      keywordCount: keywords.length,
      relations,
      opportunities,
      clusters,
      summary: {
        strongestRelation: this.findStrongestRelation(relations),
        mostValuableOpportunity: this.findMostValuableOpportunity(opportunities),
        domainConnectivity: this.calculateDomainConnectivity(relations, targetDomains)
      }
    };
    
    if (this.verbose) {
      console.info(`[CrossDomainAnalyzer] 分析完成，发现 ${relations.length} 个领域关系, ${opportunities.length} 个机会点`);
    }
    
    return result;
  }
  
  /**
   * 分析领域间关系
   */
  private async analyzeDomainRelations(keywords: string[], domains: string[]): Promise<DomainRelation[]> {
    // 使用LLM分析领域关系
    const relationAnalysis = await this.llmService.analyzeCrossDomain(keywords, domains, {
      format: 'json'
    });
    
    return relationAnalysis.relations || [];
  }
  
  /**
   * 识别跨域机会
   */
  private async identifyCrossDomainOpportunities(
    keywords: string[], 
    domains: string[], 
    relations: DomainRelation[]
  ): Promise<CrossDomainOpportunity[]> {
    // 使用LLM识别跨域机会
    const opportunityAnalysis = await this.llmService.analyze('cross_domain_opportunities', {
      keywords,
      domains,
      relations,
      task: 'Identify cross-domain opportunities from these keywords and domain relations'
    }, {
      systemPrompt: 'You are an innovation strategist who identifies opportunities at the intersection of different domains.',
      format: 'json'
    });
    
    return opportunityAnalysis.opportunities || [];
  }
  
  /**
   * 创建跨域聚类
   */
  private async createCrossDomainClusters(
    keywords: string[], 
    domains: string[], 
    relations: DomainRelation[]
  ): Promise<any[]> {
    // 使用LLM创建跨域聚类
    const clusterAnalysis = await this.llmService.analyze('cross_domain_clusters', {
      keywords,
      domains,
      relations,
      task: 'Create cross-domain clusters from these keywords and domain relations'
    }, {
      systemPrompt: 'You are a clustering expert who identifies patterns across different domains.',
      format: 'json'
    });
    
    return clusterAnalysis.clusters || [];
  }
  
  /**
   * 找出最强的领域关系
   */
  private findStrongestRelation(relations: DomainRelation[]): { domains: string[], strength: number } {
    if (relations.length === 0) {
      return { domains: [], strength: 0 };
    }
    
    // 按关系强度排序
    const sorted = [...relations].sort((a, b) => b.strength - a.strength);
    const strongest = sorted[0];
    
    return {
      domains: [strongest.sourceDomain, strongest.targetDomain],
      strength: strongest.strength
    };
  }
  
  /**
   * 找出最有价值的机会
   */
  private findMostValuableOpportunity(opportunities: CrossDomainOpportunity[]): { domains: string[], value: number, description: string } {
    if (opportunities.length === 0) {
      return { domains: [], value: 0, description: '' };
    }
    
    // 按价值排序
    const sorted = [...opportunities].sort((a, b) => b.potentialValue - a.potentialValue);
    const mostValuable = sorted[0];
    
    return {
      domains: mostValuable.domains,
      value: mostValuable.potentialValue,
      description: mostValuable.description
    };
  }
  
  /**
   * 计算领域连接度
   */
  private calculateDomainConnectivity(relations: DomainRelation[], domains: string[]): Record<string, number> {
    const connectivity: Record<string, number> = {};
    
    // 初始化所有领域的连接度为0
    domains.forEach(domain => {
      connectivity[domain] = 0;
    });
    
    // 计算每个领域的连接度
    relations.forEach(relation => {
      connectivity[relation.sourceDomain] += relation.strength;
      connectivity[relation.targetDomain] += relation.strength;
    });
    
    // 标准化连接度 (0-1)
    const maxConnectivity = Math.max(...Object.values(connectivity));
    if (maxConnectivity > 0) {
      Object.keys(connectivity).forEach(domain => {
        connectivity[domain] = parseFloat((connectivity[domain] / maxConnectivity).toFixed(2));
      });
    }
    
    return connectivity;
  }
  
  /**
   * 获取特定领域对之间的关系
   */
  getDomainRelation(result: CrossDomainAnalysisResult, domainA: string, domainB: string): DomainRelation | null {
    // 查找两个领域之间的关系
    const relation = result.relations.find(r => 
      (r.sourceDomain === domainA && r.targetDomain === domainB) || 
      (r.sourceDomain === domainB && r.targetDomain === domainA)
    );
    
    return relation || null;
  }
  
  /**
   * 查找涉及指定领域的所有机会
   */
  getDomainOpportunities(result: CrossDomainAnalysisResult, domain: string): CrossDomainOpportunity[] {
    // 查找包含特定领域的所有机会
    return result.opportunities.filter(opp => opp.domains.includes(domain));
  }
  
  /**
   * 比较两个领域的相似度
   */
  async compareDomains(domainA: string, domainB: string, keywords: string[]): Promise<any> {
    if (this.verbose) {
      console.info(`[CrossDomainAnalyzer] 比较领域: ${domainA} vs ${domainB}`);
    }
    
    // 使用LLM比较两个领域
    const comparison = await this.llmService.analyze('domain_comparison', {
      domainA,
      domainB,
      keywords,
      task: 'Compare two domains and analyze their relationship'
    }, {
      systemPrompt: 'You are a domain comparison expert who analyzes similarities and differences between different fields.',
      format: 'json'
    });
    
    return comparison;
  }
} 