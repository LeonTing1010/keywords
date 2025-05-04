/**
 * KeywordNova type definitions
 * Export all type definitions for easy reference by other modules
 */

// Search provider related types
export type SearchEngineType = 'google' | 'baidu' | string;

/**
 * Search engine configuration interface
 */
export interface SearchEngineConfig {
  /** Search engine name */
  name: string;
  /** Search engine default domain */
  defaultDomain: string;
  /** Whether proxy is supported */
  supportsProxy: boolean;
  /** Whether system browser is supported */
  supportsSystemBrowser: boolean;
  /** Search engine description */
  description: string;
  /** Retry attempts */
  retryAttempts?: number;
  /** Timeout (milliseconds) */
  timeout?: number;
  /** Wait time (milliseconds) */
  waitTime?: number;
}

/**
 * Search options interface
 */
export interface SearchOptions {
  /** Search domain */
  domain?: string;
  /** Proxy server address */
  proxyServer?: string;
  /** Whether to use system browser */
  useSystemBrowser?: boolean;
  /** Maximum result count */
  maxResults?: number;
  /** Maximum secondary query keyword count */
  maxSecondaryKeywords?: number;
  /** Delay between queries */
  delayBetweenQueries?: {
    min: number;
    max: number;
  };
  /** Custom filters */
  customFilters?: ((keyword: string) => boolean)[];
  /** Use LLM for analysis */
  useLLM?: boolean;
  /** LLM model */
  llmModel?: string;
  /** Maximum iteration count */
  maxIterations?: number;
  /** Satisfaction threshold */
  satisfactionThreshold?: number;
}

/**
 * Autocomplete suggestion result
 */
export interface AutocompleteSuggestion {
  /** Search keyword */
  keyword: string;
  /** Suggestion array */
  suggestions: string[];
}

// Intent analysis related types
/**
 * LLM analysis purpose
 */
export type AnalysisPurpose = 
  | 'identify_categories'   // Identify keyword categories
  | 'extract_patterns'      // Extract patterns
  | 'generate_queries'      // Generate queries
  | 'evaluate_iteration'    // Evaluate iteration
  | 'plan_next_iteration'   // Plan next iteration
  | 'final_analysis';       // Final analysis

/**
 * Keyword categories
 */
export interface KeywordCategories {
  informational?: string[];    // Informational query
  problemSolving?: string[];   // Problem solving
  commercial?: string[];       // Commercial transaction
  tutorial?: string[];         // Tutorial guide
  definitional?: string[];     // Definition explanation
  [key: string]: string[] | undefined; // Other custom categories
}

/**
 * Evaluation dimensions
 */
export interface EvaluationDimensions {
  relevance: number;            // Relevance
  longTailValue: number;        // Long-tail value
  commercialValue: number;      // Commercial value
  diversity: number;            // Diversity
  novelty: number;              // Novelty
  searchVolumePotential: number; // Search volume potential
  goalAchievement: number;      // Goal achievement rate
  domainCoverage: number;       // Domain coverage (breadth across industries/topic domains)
  repetitionPenalty: number;    // Repetition penalty (reduces value of repetitive keywords)
}

/**
 * Iteration evaluation result
 */
export interface IterationEvaluation {
  dimensions: EvaluationDimensions;
  overallScore: number;           // Overall score
  analysis: string;               // Analysis description
  recommendContinue: boolean;     // Whether to recommend continuing
  improvementSuggestions: string[]; // Improvement suggestions
  newKeywordsCount?: number;      // New keyword count
}

/**
 * Iteration planning analysis result
 */
export interface AnalysisPlanResult {
  gaps: string[];                 // Discovered keyword gaps
  patterns: string[];             // Identified patterns
  targetGoals: string[];          // Next round goals
  recommendedQueries: string[];   // Recommended queries
}

/**
 * Single iteration result
 */
export interface IterationResult {
  allSuggestions: string[];                // All suggestions
  queryResults: Record<string, string[]>;  // Results for each query
  mostEffectiveQuery: string;              // Most effective query
  newKeywordsCount: number;                // New keyword count
}

/**
 * Iteration history record
 */
export interface IterationHistory {
  iterationNumber: number;                // Iteration count
  query: string;                          // Query used
  queryType: 'initial' | 'iteration';     // Query type
  queryResults?: Record<string, string[]>; // Results for each query (optional)
  keywords: string[];                     // Discovered keywords
  newKeywordsCount: number;               // Newly discovered keyword count
  satisfactionScore: number;              // Satisfaction score
  analysis: string;                       // Analysis result
  evaluationDimensions?: EvaluationDimensions; // Evaluation dimensions (optional)
  recommendedQueries: string[];           // Recommended queries
}

/**
 * Intent analysis result
 */
export interface IntentAnalysisResult {
  categories: KeywordCategories;   // Keyword categories
  highValueKeywords: string[];     // High-value keywords
  intentDistribution: Record<string, number>; // Intent distribution percentage
  contentOpportunities: string[];  // Content opportunities
  commercialKeywords: string[];    // Commercial keywords
  summary: string;                 // Summary
  insights: string[];              // Key insights
  bestPatterns: string[];          // Best query patterns
  domainDistribution: Record<string, number>; // Domain distribution percentage
  underrepresentedDomains: string[]; // Underexplored domains
  diversityAnalysis: Record<string, any>; // Diversity analysis
}

/**
 * Discovery engine result
 */
export interface DiscoveryResult {
  originalKeyword: string;         // Original keyword
  totalIterations: number;         // Total iteration count
  totalKeywordsDiscovered: number; // Total keywords discovered
  keywordsByIteration: Record<number, string[]>; // Keywords by iteration
  satisfactionByIteration: Record<number, number>; // Satisfaction by iteration
  keywords: string[];              // All keywords
  highValueKeywords: string[];     // High-value keywords
  intentAnalysis: IntentAnalysisResult | null; // Intent analysis result
  iterationHistory: IterationHistory[]; // Iteration history
  summary: string;                 // Summary
}

/**
 * LLM configuration options
 */
export interface LLMServiceOptions {
  apiKey?: string;                 // API key
  model?: string;                  // Model
  timeout?: number;                // Timeout
  maxRetries?: number;             // Maximum retry count
  baseURL?: string;                // API base URL
}

// Re-export search engine related types
export * from './searchEngineTypes';
export * from './llmTypes';

// Other type definitions

/**
 * Google Trends result
 */
export interface TrendsResult {
  keyword: string;
  csvPath: string;
}

/**
 * SEMrush keyword data
 */
export interface SemrushData {
  keyword: string;
  volume: string;
}

/**
 * SimilarWeb traffic data
 */
export interface SimilarWebData {
  domain: string;
  monthlyTraffic: string;
}

/**
 * Credentials for services requiring authentication
 */
export interface Credentials {
  email: string;
  password: string;
} 