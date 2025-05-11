/**
 * 基础类型定义
 */

// Agent输入类型
export interface AgentInput {
  // 输入数据
  data: any;
  // 当前执行上下文
  context: WorkflowContext;
  // 可选的配置参数
  options?: Record<string, any>;
}

// Agent输出类型
export interface AgentOutput {
  // 输出数据
  data: any;
  // 处理状态
  status: 'success' | 'partial' | 'failed';
  // 可选的错误信息
  error?: string;
  // 可选的元数据
  metadata?: Record<string, any>;
}

// Agent元数据类型
export interface AgentMetadata {
  // Agent名称
  name: string;
  // Agent描述
  description: string;
  // Agent角色
  role: string;
  // Agent版本
  version: string;
  // Agent作者
  author: string;
  // Agent能力/职责
  capabilities: string[];
}

// Agent批评/质疑类型
export interface AgentCritique {
  // 批评的内容
  content: string;
  // 批评的理由
  reasons: string[];
  // 批评的严重程度 (1-5)
  severity: number;
  // 改进建议
  suggestions?: string[];
  // 可选的元数据
  metadata?: Record<string, any>;
}

// Agent响应类型
export interface AgentResponse {
  // 是否接受批评
  accepted: boolean;
  // 响应内容
  content: string;
  // 更新后的输出(如果接受了批评)
  updatedOutput?: AgentOutput;
  // 可选的元数据
  metadata?: Record<string, any>;
}

// 自我评估结果类型
export interface EvaluationResult {
  // 评分 (0-100)
  score: number;
  // 评估维度及分数
  dimensions: {
    [key: string]: number;
  };
  // 评估说明
  comments: string;
  // 改进建议
  suggestions?: string[];
}

// 工具参数类型
export interface ToolParams {
  // 参数对象
  [key: string]: any;
}

// 工具结果类型
export interface ToolResult {
  // 工具执行是否成功
  success: boolean;
  // 工具输出数据
  data?: any;
  // 可选的错误信息
  error?: string;
  // 可选的元数据
  metadata?: Record<string, any>;
}

// 工作流输入类型
export interface WorkflowInput {
  // 初始关键词
  keyword: string;
  // 可选的配置项
  options?: {
    // 是否快速模式
    fast?: boolean;
    // 最大问题数量
    maxProblems?: number;
    // 输出格式
    format?: 'json' | 'markdown' | 'html' | 'text';
    // 输出语言
    language?: string;
    // 其他选项
    [key: string]: any;
  };
}

// 工作流输出类型
export interface WorkflowOutput {
  // 是否成功
  success: boolean;
  // 处理的关键词
  keyword: string;
  // 发现的问题列表
  problems?: ProblemInfo[];
  // 处理报告路径
  reportPath?: string;
  // 处理指标
  metrics?: {
    // 执行时间(毫秒)
    executionTimeMs: number;
    // 处理的问题数量
    processedProblems: number;
    // 有价值的问题数量
    valuableProblems: number;
    // 其他指标
    [key: string]: any;
  };
  // 可选的错误信息
  error?: string;
}

// 工作流状态类型
export interface WorkflowState {
  // 输入信息
  input: WorkflowInput;
  // 当前执行的节点ID
  currentNodeId: string;
  // 已完成的节点ID列表
  completedNodeIds: string[];
  // 节点输出结果映射
  nodeOutputs: {
    [nodeId: string]: AgentOutput;
  };
  // 执行元数据
  executionMetadata: {
    // 开始时间
    startTime: number;
    // 当前时间
    currentTime: number;
    // 错误信息
    errors: {
      nodeId: string;
      error: string;
    }[];
    // 其他元数据
    [key: string]: any;
  };
}

// 工作流调整类型
export interface WorkflowAdjustment {
  // 是否调整工作流
  adjusted: boolean;
  // 调整类型
  type?: 'skip' | 'repeat' | 'redirect' | 'parallel' | 'terminate';
  // 目标节点(如果是redirect)
  targetNodeId?: string;
  // 调整原因
  reason?: string;
  // 其他元数据
  metadata?: Record<string, any>;
}

// 工作流上下文类型
export interface WorkflowContext {
  // 工作流ID
  workflowId: string;
  // 工作流状态
  state: WorkflowState;
  // 共享内存(Agent间共享数据)
  sharedMemory: Record<string, any>;
  // 可用工具列表
  availableTools: string[];
}

// 问题信息类型
export interface ProblemInfo {
  // 问题ID
  id: string;
  // 问题标题
  title: string;
  // 问题描述
  description: string;
  // 问题领域/分类
  category: string[];
  // 问题发现来源
  source: string;
  // 问题支持证据
  evidence?: {
    // 证据文本
    text: string;
    // 证据来源
    source: string;
    // 证据类型
    type: 'search' | 'forum' | 'social' | 'expert' | 'other';
    // 证据置信度(0-1)
    confidence: number;
  }[];
  // 问题价值评估
  valueAssessment?: {
    // 市场规模评分(1-10)
    marketSize: number;
    // 问题紧迫性评分(1-10)
    urgency: number;
    // 解决成本评分(1-10, 越低成本越高)
    solutionCost: number;
    // 竞争强度评分(1-10, 越低竞争越弱)
    competition: number;
    // 增长潜力评分(1-10)
    growthPotential: number;
    // 综合价值评分(1-100)
    overallValue: number;
  };
  // 现有解决方案分析
  existingSolutions?: {
    // 解决方案名称
    name: string;
    // 解决方案描述
    description: string;
    // 解决方案优势
    strengths: string[];
    // 解决方案劣势
    weaknesses: string[];
    // 解决方案满足度评分(1-10)
    satisfactionScore: number;
  }[];
  // 解决方案缺口分析
  solutionGap?: {
    // 缺口描述
    description: string;
    // 未满足需求
    unmetNeeds: string[];
    // 缺口大小评分(1-10, 越高缺口越大)
    gapSize: number;
  };
  // 批判性思考分析
  criticalAnalysis?: {
    // 挑战点
    challenges: string[];
    // 替代视角
    alternativeViewpoints: string[];
    // 潜在偏见
    potentialBiases: string[];
    // 证据缺口
    evidenceGaps?: string[];
    // 风险因素
    riskFactors?: string[];
    // 最终判断
    finalVerdict: string;
    // 信心调整(百分比)
    confidenceAdjustment: number;
  };
  // 质疑与反思记录
  critiques?: {
    // 质疑内容
    content: string;
    // 质疑来源Agent
    source: string;
    // 是否被接受
    accepted: boolean;
    // 响应内容
    response?: string;
  }[];
  // 其他元数据
  metadata?: Record<string, any>;
} 