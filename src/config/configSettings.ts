import { SearchOptions } from '../types';
import * as path from 'path';
import * as os from 'os';

import { envConfig, validateEnvConfig } from './env';

// Validate environment configuration
validateEnvConfig();

// Export global configuration object
export const config = {
  // LLM related configuration
  llm: {
    apiKey: envConfig.llm.apiKey,
    defaultModel: envConfig.llm.model,
    baseURL: envConfig.llm.baseURL,
    timeout: 60000, // milliseconds
    maxRetries: 3,
    promptTemplates: {
      identifyCategories: `# KeywordIntent Intent Mining Engine - Keyword Categorization

## Persona
You are KeywordIntent's AI Intent Mining Engine specializing in keyword categorization and intent analysis.

## Task
Analyze the following keyword list and classify them into intent-based categories.

## Input Data
Original keyword: {{originalKeyword}}
Suggestion list:
{{suggestions}}

## Required Analysis
1. Categorize these keywords into the following intent-based groups:
   - Informational: Users seeking information, facts, explanations
   - Problem-Solving: Users trying to solve specific issues or challenges
   - Commercial/Transactional: Users with purchase or comparison intent
   - Tutorial/Guide: Users wanting to learn how to do something
   - Definition/Explanation: Users wanting to understand concept meanings

2. For each category, provide the most representative examples from the keyword list.
3. Identify any additional patterns or intent types specific to this topic.

## Output Format
Return the categorized keywords in a valid JSON format with each category containing an array of keywords.`,

      generateQueries: `# KeywordIntent Intent Mining Engine - Strategic Query Generation

## Persona
You are KeywordIntent's AI Query Strategist specialized in discovering high-value long-tail keywords.

## Task
Based on the initial keyword and search suggestions, generate strategic queries to discover valuable long-tail keywords.

## Input Data
Original keyword: {{originalKeyword}}
Search suggestions:
{{suggestions}}

## Required Analysis
1. Identify patterns and gaps in the current keyword list
2. Design 10 strategic queries that will uncover new high-value long-tail keywords
3. Focus on diverse user intent perspectives:
   - Different user intent angles (informational, problem-solving, commercial)
   - Problem and solution patterns
   - Specific subtopic deep mining
   - Commercial and conversion intent

## Output Format
Return a JSON object containing an array of recommended queries, with each query designed to discover new keyword opportunities.`,

      evaluateIteration: `# KeywordIntent Intent Mining Engine - Iteration Quality Evaluation

## Analysis Goal
Evaluate the quality of keywords discovered in the current iteration, with special focus on domain coverage and diversity.

## Input Data
Original keyword: {{originalKeyword}}
Current iteration number: {{iterationNumber}}
Iteration goals: {{iterationGoals}}
Number of newly discovered keywords: {{newKeywordsCount}}

Newly discovered keywords (examples):
{{keywordSamples}}

## Enhanced Evaluation Guidelines

1. Domain Analysis
   - First classify each keyword by domain (medical, education, agriculture, finance, entertainment, etc.)
   - Calculate the percentage distribution of each domain, identify dominant domains and missing domains
   - **STRICT REQUIREMENT**: If any single domain exceeds 50% of keywords, this is considered a severe imbalance, and domainCoverage score should not exceed 4 points

2. Repetition Pattern Detection
   - Identify repeated sentence patterns in keywords (e.g., "X application in Y" appearing too frequently)
   - When more than 40% of keywords follow the same structural pattern, repetitionPenalty should be at least 7 points
   - Similarity analysis should consider semantic similarity, not just literal repetition

3. Iteration-Aware Scoring
   - Early iterations (rounds 1-2): Double the weight of domain diversity, treat single domain concentration as a serious issue
   - Middle iterations (rounds 3-4): Balance domain breadth and depth, increase weight of commercial intent keywords
   - Later iterations (rounds 5+): Allow deeper exploration of high-value domains

4. Intent Balance Detection
   - Analyze distribution across informational, commercial, problem-solving, and navigational intents
   - Any intent type below 15% is considered unbalanced and should reduce the diversity score
   - Commercial intent should comprise at least 20% of keywords, otherwise reduce the commercialValue score

## Scoring Dimensions and Weights
Score the following 9 dimensions (1-10 points):

1. Relevance (10%): How closely related keywords are to the original topic
2. Long-tail value (18%): Specificity and long-tail characteristics of keywords
3. Commercial value (18%): Presence of keywords with purchase intent or conversion potential
4. Diversity (20%): Coverage of different angles, intents and subtopics
5. Novelty (12%): Uniqueness compared to previously discovered keywords
6. Search volume potential (5%): Estimated search volume and user demand
7. Goal achievement (5%): How well this iteration met its stated goals
8. Domain coverage (22%): Breadth across different industries and sectors (most important metric)
9. Repetition penalty (-15%): Penalty for keywords that are too similar or redundant

## Domain Saturation Scoring Standards
Apply different domain saturation thresholds based on iteration stage:
- Iterations 1-2: Single domain >40%, domain coverage score -5 points
- Iterations 3-4: Single domain >60%, domain coverage score -3 points
- Iterations 5+: Single domain >75%, domain coverage score -2 points

## Output Format
Return a JSON object containing:
1. "dimensions": Object with scores for each dimension
2. "overallScore": Weighted average score (0-10)
3. "analysis": Analysis of keyword quality, with special attention to domain diversity
4. "recommendContinue": Boolean indicating whether to continue iterating
5. "improvementSuggestions": Array of suggestions for the next iteration, emphasizing underrepresented domains
6. "domainAnalysis": Detailed analysis of keyword domain distribution
   - Dominant domains and percentages
   - List of missing domains
   - Domain saturation risk assessment`,

      nextIterationSimplified: `# KeywordIntent Intent Mining Engine - Query Strategy Optimization

## Analysis Goal
Develop optimal queries for the next iteration based on current keyword distribution, ensuring comprehensive domain coverage.

## Input Data
Original keyword: {{originalKeyword}}
Current keyword count: {{keywordCount}}
Current iteration round: {{currentIteration}}

Keyword samples:
{{keywordSamples}}

## Enhanced Strategy Guidelines

1. Domain Balance Mechanism
   - Identify currently oversaturated domains (domains with >30% representation)
   - Identify completely missing important domains (agriculture, education, environment, finance, manufacturing, etc.)
   - **MANDATORY REQUIREMENT**: Next iteration queries MUST prioritize unexplored or underexplored domains

2. Query Pattern Diversification
   - Identify sentence patterns used in previous queries
   - Avoid repeating the same query patterns
   - Ensure diversity in query types (question-based, scenario-based, comparison-based, etc.)

3. Iteration-Aware Strategy
   - Early iterations (rounds 1-2): Provide completely different domain-based basic queries
   - Middle iterations (rounds 3-4): Provide cross-domain specific application scenario queries
   - Later iterations (rounds 5+): Focus on high commercial value and insufficiently explored domain queries

4. Intent Balance Strategy
   - Ensure generated queries cover multiple search intents
   - Include at least 30% commercial intent queries
   - Include at least 20% problem-solving queries

## Special Processing Rules

If severe domain imbalance is detected (e.g., medical domain >60%), then:
1. Completely prohibit generating queries related to oversaturated domains
2. Force generation of at least 5 queries related to completely different domains
3. Prioritize unexplored domains with high commercial value

## Output Format
Return a JSON object containing:
1. "gaps": Array of identified domain coverage gaps
2. "patterns": Array of effective query patterns
3. "targetGoals": Array of specific goals for the next iteration
4. "recommendedQueries": 10 diverse query designs ensuring domain balance coverage
5. "domainRotationPlan": Detailed explanation of how to rotate different domains in future iterations`,

      finalReportSimplified: `# KeywordIntent Intent Mining Engine - Comprehensive Analysis Report

## Analysis Goal
Conduct a comprehensive evaluation of keyword mining results, providing in-depth domain coverage analysis and improvement recommendations.

## Input Data
Original keyword: {{originalKeyword}}
Total keywords discovered: {{totalKeywords}}
Number of iterations completed: {{iterationCount}}

Keyword samples:
{{keywordSamples}}

## Enhanced Analysis Guidelines

1. Domain Coverage Assessment
   - Analyze the percentage distribution of keywords across different domains
   - Identify severely imbalanced domains (e.g., medical >60%)
   - Calculate a domain diversity score, consider below 0.6 as unbalanced
   - Compare with industry standard domain distributions

2. Intent Distribution Analysis
   - Categorize keywords into informational, commercial, problem-solving, and navigational types
   - Evaluate whether the intent distribution is balanced
   - Pay special attention to the quality of commercial value keywords

3. Iteration Efficiency Analysis
   - Evaluate the efficiency of new keyword discovery in each iteration
   - Identify the most effective and least effective query patterns
   - Analyze strengths and weaknesses of the iteration strategy

4. Content Opportunity Identification
   - Based on domain distribution and intent analysis, provide specific content creation recommendations
   - Focus particularly on opportunities in neglected domains
   - Highlight content directions with high commercial value

## Special Quality Assessment Criteria
When a single domain significantly dominates (>50%):
1. Reduce the overall diversity score
2. Specifically note improvement recommendations
3. Suggest targeted domain expansion strategies

## Output Format
Return a JSON object containing:
1. "categories": Object with keywords grouped by category and domain
2. "highValueKeywords": Array of recommended high-value keywords
3. "intentDistribution": Mapping of intent types to percentage distribution
4. "contentOpportunities": Array of content creation suggestions
5. "commercialKeywords": Array of keywords with commercial/conversion value
6. "domainDistribution": Percentage distribution across different domains
7. "underrepresentedDomains": Array of underrepresented domains
8. "summary": Overall analysis summary, with special focus on domain coverage
9. "insights": Array of key insights from the iteration process
10. "bestPatterns": Array of most effective query patterns
11. "diversityAnalysis": Object assessing diversity across iterations
12. "qualityScore": Final quality score, with emphasis on domain balance`
    }
  },
  
  // Iterative engine configuration
  iterativeEngine: {
    maxIterations: 5,
    defaultSatisfactionThreshold: 0.85,
    minNewKeywordsPerIteration: 10,
    minForcedIterations: 3,  // 最小强制迭代次数，即使满意度达标也会执行的迭代数
    dynamicThreshold: {      // 动态满意度阈值设置
      enabled: true,         // 是否启用动态阈值
      initial: 0.95,         // 初始轮次的高阈值（促进广度探索）
      final: 0.75,           // 最终轮次的低阈值（允许深度挖掘）
      decayRate: 0.05        // 每轮降低的阈值比例
    },
    evaluationWeights: {
      relevance: 0.10,          // 保持相关性权重
      longTailValue: 0.15,      // 降低长尾价值权重(从0.18到0.15)
      commercialValue: 0.25,    // 提高商业价值权重(从0.18到0.25)
      diversity: 0.18,          // 略微降低多样性权重(从0.20到0.18)
      novelty: 0.10,            // 降低新颖性权重(从0.12到0.10)
      searchVolumePotential: 0.05, // 保持搜索量潜力权重
      goalAchievement: 0.05,    // 保持目标达成率权重
      domainCoverage: 0.22,     // 保持领域覆盖度权重
      repetitionPenalty: -0.15  // 保持重复度惩罚
    }
  },
  
  // Search options defaults
  searchDefaults: {
    batchSize: 26,
    retryCount: 2,
    maxSecondaryKeywords: 10,
    maxResults: 300,
    delayBetweenQueries: { min: 1000, max: 3000 }
  } as Partial<SearchOptions>,
  
  // Output directory configuration
  output: {
    dir: process.env.OUTPUT_DIR || path.join(process.cwd(), 'output'),
    formats: ['json', 'csv', 'md']
  },
  
  // Debug configuration
  debug: {
    enabled: process.env.DEBUG === 'true',
    verbose: process.env.VERBOSE === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};

// Export default configuration
export default config; 