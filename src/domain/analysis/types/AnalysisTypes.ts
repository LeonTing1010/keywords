/**
 * 用户旅程步骤
 */
export interface JourneyStep {
  query: string;
  intent: string;
  satisfaction: number;
  nextQueries: string[];
}

/**
 * 决策点
 */
export interface DecisionPoint {
  query: string;
  options: string[];
  chosenOption: string;
  reason: string;
}

/**
 * 用户旅程
 */
export interface UserJourney {
  startKeyword: string;
  steps: JourneyStep[];
  decisionPoints: DecisionPoint[];
  insights: JourneyInsight[];
}

/**
 * 用户旅程洞察
 */
export interface JourneyInsight {
  type: string;
  description: string;
  confidence: number;
}

/**
 * 市场洞察
 */
export interface MarketInsight {
  type: string;
  description: string;
  confidence: number;
  trend: string;
  impact: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  hypothesis: string;
  isValidated: boolean;
  confidence: number;
  method: string;
  result: string;
}

/**
 * 增强的工作流结果
 */
export interface EnhancedWorkflowResult {
  keyword: string;
  discoveredKeywords: string[];
  userJourneys: UserJourney[];
  marketInsights: MarketInsight[];
  validationResults: ValidationResult[];
  version: string;
  generatedAt: string;
}

export interface StartupAnalysis {
  opportunity: {
    domain: string;
    timing: {
      status?: string;
      windowSize?: string;
      urgencyLevel?: 'high' | 'medium' | 'low';
      rationale?: string;
      content?: any; // 用于存储无法解析为标准格式的响应
      error?: string; // 错误信息
    };
    direction: {
      trends?: string[];
      drivingFactors?: string[];
      evidence?: string[];
      confidenceLevel?: number;
      content?: any; // 用于存储无法解析为标准格式的响应
      error?: string; // 错误信息
    };
  };
  strategy: {
    entryPoint?: string;
    approach?: string;
    competitiveAdvantages?: string[];
    challenges?: string[];
    differentiators?: string[];
    timingRecommendations?: string[];
    content?: any; // 用于存储无法解析为标准格式的响应
    error?: string; // 错误信息
  };
  risks: {
    immediate?: {
      description: string;
      severity: 'high' | 'medium' | 'low';
      mitigation: string;
    }[];
    strategic?: {
      description: string;
      impact: string;
      timeframe: string;
      mitigation: string;
    }[];
    content?: any; // 用于存储无法解析为标准格式的响应
    error?: string; // 错误信息
  };
  resources: {
    immediate?: {
      type: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }[];
    scaling?: {
      trigger: string;
      requirements: string[];
      timeline: string;
    }[];
    alternatives?: string[];
    content?: any; // 用于存储无法解析为标准格式的响应
    error?: string; // 错误信息
  };
  validation: {
    hypotheses?: {
      statement: string;
      priority: 'high' | 'medium' | 'low';
    }[];
    methods?: {
      name: string;
      description: string;
      metrics: string[];
      thresholds: string[];
    }[];
    nextSteps?: string[];
    priorities?: string[];
    content?: any; // 用于存储无法解析为标准格式的响应
    error?: string; // 错误信息
  };
} 