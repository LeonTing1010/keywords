import { UnmetNeed } from './index';

/**
 * 工作流结果接口
 */
export interface WorkflowResult {
  /** 关键词 */
  keyword: string;
  /** 发现的关键词 */
  discoveredKeywords: string[];
  /** 未满足需求 */
  unmetNeeds: UnmetNeed[];
  /** 分析结果 */
  analysis: {
    /** 关键词分类 */
    categories: Record<string, string[]>;
    /** 发现的模式 */
    patterns: string[];
    /** 洞察 */
    insights: string[];
  };
}

/**
 * 增强的工作流结果
 */
export interface EnhancedWorkflowResult extends WorkflowResult {
  /** 用户旅程分析 */
  journeyAnalysis?: {
    /** 关键决策点 */
    decisionPoints: string[];
    /** 痛点 */
    painPoints: string[];
    /** 机会点 */
    opportunities: string[];
  };
  /** 内容分析 */
  contentAnalysis?: {
    /** 内容质量评分 */
    qualityScores: Record<string, number>;
    /** 内容缺口 */
    contentGaps: string[];
    /** 改进建议 */
    improvements: string[];
  };
}

/**
 * 创业机会分析接口
 */
export interface StartupAnalysis {
  /** 机会分析 */
  opportunity: {
    /** 市场规模 */
    marketSize: {
      /** 当前规模 */
      current: number;
      /** 预计增长率 */
      growthRate: number;
      /** 潜在规模 */
      potential: number;
    };
    /** 市场阶段 */
    marketStage: 'emerging' | 'growing' | 'mature' | 'declining';
    /** 竞争强度 */
    competitionIntensity: 'low' | 'medium' | 'high';
    /** 进入壁垒 */
    entryBarriers: string[];
    /** 关键成功因素 */
    keySuccessFactors: string[];
  };
  
  /** 策略建议 */
  strategy: {
    /** 切入点 */
    entryPoint: string;
    /** 差异化优势 */
    differentiators: string[];
    /** 增长策略 */
    growthStrategy: string;
    /** 关键里程碑 */
    milestones: Array<{
      /** 阶段名称 */
      stage: string;
      /** 目标 */
      goals: string[];
      /** 时间范围 */
      timeframe: string;
    }>;
  };
  
  /** 资源需求 */
  resources: {
    /** 初始投资 */
    initialInvestment: number;
    /** 团队需求 */
    teamRequirements: string[];
    /** 关键资源 */
    keyResources: string[];
    /** 合作伙伴 */
    partnerships: string[];
  };
  
  /** 风险分析 */
  risks: {
    /** 市场风险 */
    market: Array<{
      /** 风险描述 */
      description: string;
      /** 影响程度 */
      impact: 'low' | 'medium' | 'high';
      /** 可能性 */
      likelihood: 'low' | 'medium' | 'high';
      /** 缓解策略 */
      mitigation: string;
    }>;
    /** 技术风险 */
    technical: Array<{
      description: string;
      impact: 'low' | 'medium' | 'high';
      likelihood: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
    /** 运营风险 */
    operational: Array<{
      description: string;
      impact: 'low' | 'medium' | 'high';
      likelihood: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
  };
  
  /** 验证计划 */
  validation: {
    /** 关键假设 */
    keyAssumptions: string[];
    /** 验证实验 */
    experiments: Array<{
      /** 假设 */
      hypothesis: string;
      /** 验证方法 */
      method: string;
      /** 成功标准 */
      successCriteria: string;
      /** 所需时间 */
      timeRequired: string;
      /** 估计成本 */
      estimatedCost: number;
    }>;
    /** 最小可行产品 */
    mvp: {
      /** 核心特性 */
      features: string[];
      /** 开发时间 */
      developmentTime: string;
      /** 估计成本 */
      estimatedCost: number;
    };
  };
} 