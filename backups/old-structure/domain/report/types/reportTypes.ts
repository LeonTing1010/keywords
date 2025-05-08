export interface ValidationResult {
  score: number;            // 验证分数 0-1
  confidence: number;       // 置信度 0-1
  evidence: string[];       // 证据列表
  source?: string;         // 数据来源
  timestamp?: string;      // 验证时间
  method?: string;         // 验证方法
  marketSize?: number;     // 市场规模估算
  growthRate?: number;     // 增长率
  competitorCount?: number; // 竞争对手数量
  userDemand?: number;     // 用户需求强度
  competitorInfo?: {       // 竞争对手信息
    name: string;
    strengths: string[];
    weaknesses: string[];
    marketShare?: number;
  }[];
  trendData?: {           // 趋势数据
    period: string;
    value: number;
    growth: number;
  }[];
  riskFactors?: {         // 风险因素
    type: string;
    severity: number;     // 1-5
    probability: number;  // 0-1
    impact: string;
  }[];
  technicalRequirements?: string[];
  operationalRequirements?: string[];
}

export interface UserJourney {
  startPoint: string;
  endPoint: string;
  decisionPoints: string[];
  insights: string[];
  satisfactionScore: number;
  completionRate: number;
  conversionRate?: number;
  abandonmentPoints?: string[];
  timestamp?: string;        // 旅程记录时间
  searchVolume?: number;     // 搜索量
  bounceRate?: number;       // 跳出率
}

export interface MarketInsight {
  type: 'opportunity' | 'threat' | 'trend';
  description: string;
  score: number;
  evidence: string[];
  confidence: number;
  priority?: number;       // 1-5
  actionItems?: string[];
}

export interface EnhancedWorkflowResult {
  keyword: string;
  userJourneys?: UserJourney[];
  validationResults?: ValidationResult[];
  marketInsights?: MarketInsight[];
  iterations?: number;
  version?: string;
  generatedAt?: string;
  competitiveAnalysis?: {
    totalCompetitors: number;
    marketGaps: string[];
    entryBarriers: string[];
    competitiveAdvantages: string[];
  };
  implementationPlan?: {
    phases: {
      name: string;
      duration: string;
      tasks: string[];
      milestones: string[];
    }[];
    kpis: string[];
    estimatedCosts?: number;
  };
}

export interface RiskAssessment {
  marketRisks: {
    type: string;
    severity: number;  // 1-5
    probability: number;  // 0-1
    mitigation: string[];
  }[];
  technicalRisks: {
    type: string;
    severity: number;
    probability: number;
    mitigation: string[];
  }[];
  operationalRisks: {
    type: string;
    severity: number;
    probability: number;
    mitigation: string[];
  }[];
  overallRiskScore: number;  // 0-1
  criticalRisks: string[];
  riskMitigationPlan: string[];
}

export interface StartupAnalysis {
  // Core opportunity assessment
  opportunity: {
    domain: string;
    timing: {
      status: string;  // Current market timing assessment
      window: string;  // Opportunity window description
      urgency: 'high' | 'medium' | 'low';
      rationale: string[];
    };
    direction: {
      trend: string;  // Overall market direction
      confidence: number;
      keyDrivers: string[];  // Key factors driving the trend
      evidence: string[];
    };
  };
  
  // Strategic insights
  strategy: {
    entryPoint: string;  // Recommended entry strategy
    keyAdvantages: string[];
    criticalChallenges: string[];
    differentiators: string[];
    timing: string;  // Strategic timing recommendations
  };
  
  // Risk analysis
  risks: {
    critical: {  // Most pressing risks that need immediate attention
      description: string;
      impact: string;
      mitigation: string[];
      urgency: 'immediate' | 'short-term' | 'long-term';
    }[];
    strategic: {  // Longer-term strategic risks
      description: string;
      impact: string;
      mitigation: string[];
      timeframe: string;
    }[];
  };
  
  // Resource strategy
  resources: {
    immediate: {  // Resources needed to start
      type: string;
      description: string;
      alternatives: string[];
      priority: 'critical' | 'important' | 'optional';
    }[];
    scaling: {  // Resources needed for scaling
      trigger: string;  // When this resource becomes necessary
      description: string;
      preparation: string[];
    }[];
  };
  
  // Validation approach
  validation: {
    keyHypotheses: string[];  // Core assumptions to validate
    methods: {
      approach: string;
      metrics: string[];
      threshold: string;
      timeframe: string;
    }[];
    nextSteps: {
      action: string;
      purpose: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
}

export interface MVPSuggestion {
  coreFeatures: string[];
  techStack: string;
  timeline: string;
  costs: string;
}

export interface ResourceAssessment {
  essentialResources: string[];
  alternatives: string[];
  priorities: string[];
}

export interface DifferentiationStrategy {
  points: string[];
  competitionAvoidance: string[];
  valueProposition: string;
}

export interface ValidationPlan {
  steps: string[];
  metrics: string[];
  stopLoss: string[];
}

export interface StartupRecommendations {
  firstActions: string[];
  riskMitigation: string[];
  growthPath: string[];
}

export interface MarketTrend {
  direction: 'up' | 'down' | 'stable';
  strength: number;
  confidence: number;
  evidence: string[];
}

export interface RiskItem {
  type: string;
  severity: number; // 1-5
  probability: number; // 0-1
  mitigation: string[];
} 