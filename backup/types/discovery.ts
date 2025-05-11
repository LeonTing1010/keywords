/**
 * Problem Discovery Framework Core Types
 * 
 * This file defines the core interfaces for the problem discovery framework,
 * including problem representation, evidence tracking, agent feedback,
 * and quality thresholds.
 */

/**
 * Problem Evolution Record - Tracks changes to a problem over time
 */
export interface ProblemEvolutionRecord {
  timestamp: string;
  stage: string;
  previousFormulation: string;
  currentFormulation: string;
  agent: string;
  reasoning: string;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
}

/**
 * Evidence supporting the existence and value of a problem
 */
export interface Evidence {
  type: 'search_result' | 'forum_post' | 'query_suggestion' | 'user_journey' | 'content_gap' | 'competitor_analysis' | 'expert_opinion';
  source: string;
  content: string;
  relevanceScore: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Problem Quality Score - quantifies different aspects of problem quality
 */
export interface ProblemQualityScore {
  authenticity: number; // How real and validated the problem is (1-10)
  urgency: number; // How urgent the problem is for users (1-10)
  scale: number; // How many people experience this problem (1-10)
  solutionGap: number; // How well existing solutions solve the problem (1-10, higher means bigger gap)
  feasibility: number; // How feasible it is to solve the problem (1-10)
  overall: number; // Overall quality score (1-10)
  confidence: number; // Confidence in this assessment (0-1)
}

/**
 * Problem Branch - Alternative formulation of a problem
 */
export interface ProblemBranch {
  branchId: string;
  formulation: string;
  creationReason: string;
  qualityScore: number;
  isExplored: boolean;
}

/**
 * Problem Relationship - Connection between related problems
 */
export interface ProblemRelationship {
  problemId: string;
  relationshipType: 'similar' | 'parent' | 'child' | 'prerequisite' | 'consequence';
  similarityScore?: number;
}

/**
 * Core Problem representation
 */
export interface Problem {
  id: string;
  originalFormulation: string;
  currentFormulation: string;
  domain: string[];
  targetAudience?: string[];
  qualityScore: ProblemQualityScore;
  evidence: Evidence[];
  evolutionPath: ProblemEvolutionRecord[];
  feedbackHistory: AgentFeedback[];
  relatedProblems: ProblemRelationship[];
  branches?: ProblemBranch[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    iterationCount: number;
    sourceKeyword: string;
    explorationStatus: 'initial' | 'validating' | 'refining' | 'finalized';
    mergeHistory?: {
      mergedProblemIds: string[];
      mergeReasoning: string;
      timestamp: string;
    }[];
  };
}

/**
 * Suggested Change - Specific change proposed by agent feedback
 */
export interface SuggestedChange {
  fieldName: string;
  suggestedValue: any;
  changeReasoning: string;
}

/**
 * Alternative Branch - Alternative formulation proposed by agent feedback
 */
export interface AlternativeBranch {
  alternativeFormulation: string;
  branchReasoning: string;
  estimatedQualityScore: number;
}

/**
 * Agent Feedback - Structured feedback from agents about problems
 */
export interface AgentFeedback {
  id: string;
  agentId: string;
  agentType: string;
  problemId: string;
  timestamp: string;
  feedbackType: 'validation' | 'refinement' | 'branch_suggestion' | 'rejection';
  confidenceScore: number;
  suggestedChanges?: SuggestedChange[];
  alternativeBranches?: AlternativeBranch[];
  validationResults?: {
    isValid: boolean;
    validationReasoning: string;
    suggestions: string[];
  };
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Quality Threshold Adjustment Factors
 */
export interface ThresholdAdjustmentFactors {
  lowConfidenceAdjustment: number;
  highEvidenceBoost: number;
  iterationBoost: number;
  feedbackConsistencyBoost: number;
}

/**
 * Quality Thresholds - used to filter low-quality problems
 */
export interface QualityThresholds {
  domain: string;
  minOverallScore: number;
  minAuthenticity: number;
  minUrgency: number;
  minScale: number;
  minSolutionGap: number;
  minFeasibility: number;
  thresholdAdjustmentFactors?: ThresholdAdjustmentFactors;
}

/**
 * Similarity Detection Settings
 */
export interface SimilarityDetectionSettings {
  algorithm: 'jaccard' | 'levenshtein' | 'embedding' | 'hybrid';
  threshold: number;
  considerEvidence: boolean;
  useWeightedFactors: boolean;
  weightFactors?: {
    formulationSimilarity: number;
    audienceSimilarity: number;
    domainSimilarity: number;
    evidenceSimilarity: number;
  };
}

/**
 * Agent Configuration
 */
export interface AgentConfig {
  explorer: boolean;
  simulator: boolean;
  evaluator: boolean;
  strategist: boolean;
}

/**
 * Problem Discovery Configuration
 */
export interface ProblemDiscoveryConfig {
  maxIterations: number;
  maxProblemsToTrack: number;
  initialQualityThreshold: number;
  adaptiveQualityThresholds: boolean;
  domainSpecificThresholds: QualityThresholds[];
  similarityDetection: SimilarityDetectionSettings;
  enableBranching: boolean;
  maxBranchesPerProblem: number;
  minFeedbackConfidence: number;
  feedbackIncorporationStrategy: 'accept_all' | 'majority_vote' | 'confidence_weighted';
  agents: AgentConfig;
}

/**
 * Iteration Metrics - tracks performance for a single iteration
 */
export interface IterationMetrics {
  iterationNumber: number;
  timestamp: string;
  problemCount: number;
  averageQualityScore: number;
  topProblemId: string;
  processingTimeMs: number;
}

/**
 * Processing Metrics - overall performance metrics
 */
export interface ProcessingMetrics {
  totalTimeMs: number;
  totalIterations: number;
  initialProblemCount: number;
  finalProblemCount: number;
  qualityImprovement: number;
  branchesExplored: number;
  feedbacksProcessed: number;
  mergesPerformed: number;
  feedbackLoopsProcessed?: number;
}

/**
 * Discovery Result - final output from the discovery process
 */
export interface DiscoveryResult {
  sourceKeyword: string;
  discoveredProblems: Problem[];
  iterations: IterationMetrics[];
  processingMetrics: ProcessingMetrics;
}

/**
 * Discovery Agent - interface for agents participating in the discovery process
 */
export interface DiscoveryAgent {
  id: string;
  name: string;
  type: 'explorer' | 'simulator' | 'evaluator' | 'strategist';
  process: (input: any) => Promise<any>;
  provideFeedback: (problem: Problem) => Promise<AgentFeedback>;
} 