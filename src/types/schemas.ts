/**
 * schemas.ts - Zod validation schemas for all core types
 */

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Tool schemas
export const ToolParamsSchema = z.record(z.string(), z.unknown());
export type ToolParams = z.infer<typeof ToolParamsSchema>;

export const ToolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

// Evidence schema
export const EvidenceSchema = z.object({
  text: z.string(),
  source: z.string(),
  type: z.enum(['search', 'forum', 'social', 'expert', 'other']),
  confidence: z.number().min(0).max(1),
  url: z.string().url().optional()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// Value assessment schema
export const ValueAssessmentSchema = z.object({
  marketSize: z.number().min(1).max(10),
  urgency: z.number().min(1).max(10),
  solutionCost: z.number().min(1).max(10),
  competition: z.number().min(1).max(10),
  growthPotential: z.number().min(1).max(10),
  overallValue: z.number().min(0).max(100),
  reasoning: z.record(z.string(), z.string()).optional(),
  roi: z.object({
    score: z.number().min(1).max(10),
    analysis: z.string(),
    riskFactors: z.array(z.string()),
    timeToValue: z.string()
  }).optional()
});
export type ValueAssessment = z.infer<typeof ValueAssessmentSchema>;

// Existing solution schema
export const ExistingSolutionSchema = z.object({
  name: z.string(),
  description: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  satisfactionScore: z.number().min(1).max(10),
  marketPosition: z.string().optional(),
  targetAudience: z.string().optional(),
  userFeedback: z.string().optional()
});
export type ExistingSolution = z.infer<typeof ExistingSolutionSchema>;

// Solution gap schema
export const SolutionGapSchema = z.object({
  description: z.string(),
  unmetNeeds: z.array(z.string()),
  gapSize: z.number().min(1).max(10)
});
export type SolutionGap = z.infer<typeof SolutionGapSchema>;

// Critical analysis schema
export const CriticalAnalysisSchema = z.object({
  challenges: z.array(z.string()),
  alternativeViewpoints: z.array(z.string()),
  potentialBiases: z.array(z.string()),
  evidenceGaps: z.array(z.string()).optional(),
  riskFactors: z.array(z.string()).optional(),
  finalVerdict: z.string(),
  confidenceAdjustment: z.number()
});
export type CriticalAnalysis = z.infer<typeof CriticalAnalysisSchema>;

// Critique schema
export const CritiqueSchema = z.object({
  content: z.string(),
  source: z.string(),
  accepted: z.boolean(),
  response: z.string().optional()
});
export type Critique = z.infer<typeof CritiqueSchema>;

// ProblemInfo schema
export const ProblemInfoSchema = z.object({
  id: z.string().uuid().default(() => uuidv4()),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.array(z.string()),
  source: z.string(),
  evidence: z.array(EvidenceSchema).optional(),
  valueAssessment: ValueAssessmentSchema.optional(),
  existingSolutions: z.array(ExistingSolutionSchema).optional(),
  solutionGap: SolutionGapSchema.optional(),
  criticalAnalysis: CriticalAnalysisSchema.optional(),
  critiques: z.array(CritiqueSchema).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type ProblemInfo = z.infer<typeof ProblemInfoSchema>;

// WorkflowInput schema
export const WorkflowInputSchema = z.object({
  keyword: z.string(),
  options: z.object({
    fast: z.boolean().optional(),
    maxProblems: z.number().positive().optional(),
    format: z.enum(['json', 'markdown', 'html', 'text']).optional(),
    language: z.string().optional()
  }).optional().default({})
});
export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;

// WorkflowOutput schema
export const WorkflowOutputSchema = z.object({
  success: z.boolean(),
  keyword: z.string(),
  problems: z.array(ProblemInfoSchema).optional(),
  reportPath: z.string().optional(),
  metrics: z.object({
    executionTimeMs: z.number(),
    processedProblems: z.number(),
    valuableProblems: z.number()
  }).optional(),
  error: z.string().optional()
});
export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

// ExecutionMetadata schema
export const ExecutionMetadataSchema = z.object({
  startTime: z.number(),
  currentTime: z.number(),
  errors: z.array(z.object({
    nodeId: z.string(),
    error: z.string()
  }))
}).catchall(z.unknown());

// WorkflowState schema
export const WorkflowStateSchema = z.object({
  input: WorkflowInputSchema,
  currentNodeId: z.string(),
  completedNodeIds: z.array(z.string()),
  nodeOutputs: z.record(z.string(), z.any()), // We'll define AgentOutput later
  executionMetadata: ExecutionMetadataSchema
});
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// WorkflowContext schema
export const WorkflowContextSchema = z.object({
  workflowId: z.string().uuid(),
  state: WorkflowStateSchema,
  sharedMemory: z.record(z.string(), z.unknown()),
  availableTools: z.array(z.string())
});
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// AgentCritique schema
export const AgentCritiqueSchema = z.object({
  content: z.string(),
  reasons: z.array(z.string()),
  severity: z.number().min(1).max(5),
  suggestions: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type AgentCritique = z.infer<typeof AgentCritiqueSchema>;

// AgentOutput schema - now we can complete the circular reference
export const AgentOutputSchema = z.object({
  data: z.unknown(),
  status: z.enum(['success', 'partial', 'failed']),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// AgentInput schema
export const AgentInputSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  context: WorkflowContextSchema,
  options: z.record(z.string(), z.unknown()).optional()
});
export type AgentInput = z.infer<typeof AgentInputSchema>;

// AgentResponse schema
export const AgentResponseSchema = z.object({
  accepted: z.boolean(),
  content: z.string(),
  updatedOutput: AgentOutputSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Agent metadata schema
export const AgentMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  role: z.string(),
  version: z.string(),
  author: z.string(),
  capabilities: z.array(z.string())
});
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;

// EvaluationResult schema
export const EvaluationResultSchema = z.object({
  score: z.number().min(0).max(100),
  dimensions: z.record(z.string(), z.number()),
  comments: z.string(),
  suggestions: z.array(z.string()).optional()
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

// WorkflowAdjustment schema
export const WorkflowAdjustmentSchema = z.object({
  adjusted: z.boolean(),
  type: z.enum(['skip', 'repeat', 'redirect', 'parallel', 'terminate']).optional(),
  targetNodeId: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type WorkflowAdjustment = z.infer<typeof WorkflowAdjustmentSchema>;

// Chat message schema for LLM service
export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function']),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  name: z.string().optional()
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// LLM request options schema
export const LLMRequestOptionsSchema = z.object({
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  stop: z.array(z.string()).optional()
}).catchall(z.unknown());
export type LLMRequestOptions = z.infer<typeof LLMRequestOptionsSchema>;

// LLM service config schema
export const LLMServiceConfigSchema = z.object({
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiVersion: z.string().optional(),
  defaultOptions: LLMRequestOptionsSchema.optional()
}).catchall(z.unknown());
export type LLMServiceConfig = z.infer<typeof LLMServiceConfigSchema>;

// Enhanced agent options schema
export const EnhancedAgentOptionsSchema = z.object({
  enableCache: z.boolean().optional(),
  cacheTTL: z.number().positive().optional(),
  maxRetries: z.number().positive().optional(),
  retryDelay: z.number().positive().optional(),
  toolTimeout: z.number().positive().optional()
}).catchall(z.unknown());
export type EnhancedAgentOptions = z.infer<typeof EnhancedAgentOptionsSchema>; 