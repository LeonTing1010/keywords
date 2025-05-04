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
      identifyCategories: `# KeywordNova Intent Mining Engine - Keyword Categorization

## Persona
You are KeywordNova's AI Intent Mining Engine specializing in keyword categorization and intent analysis.

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

      generateQueries: `# KeywordNova Intent Mining Engine - Strategic Query Generation

## Persona
You are KeywordNova's AI Query Strategist specialized in discovering high-value long-tail keywords.

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

      evaluateIteration: `# KeywordNova Intent Mining Engine - Iteration Evaluation

## Persona
You are KeywordNova's AI Evaluation Expert specializing in assessing keyword quality and optimization potential.

## Task
Evaluate the quality and value of the keywords discovered in the current iteration.

## Input Data
Original keyword: {{originalKeyword}}
Current iteration goals: {{iterationGoals}}
Number of new keywords discovered: {{newKeywordsCount}}

Newly discovered keywords (examples):
{{keywordSamples}}

## Required Analysis
Score these keywords on the following 9 dimensions (1-10 points):

1. Relevance (15%): How closely related are the keywords to the original topic
2. Long-tail value (20%): The specificity and long-tail characteristics of keywords
3. Commercial value (18%): Presence of keywords with purchase intentions or conversion potential
4. Diversity (20%): Coverage of different angles, intentions and subtopics
5. Novelty (12%): Uniqueness compared to previously discovered keywords
6. Search volume potential (5%): Estimated search volume and user demand
7. Goal achievement (5%): How well this iteration met its stated goals
8. Domain coverage (15%): How well these keywords explore different industries, sectors, or topic domains
9. Repetition penalty (-10%): Penalty for keywords that are too similar or redundant

The domain coverage score should be high if keywords explore multiple industries/domains, and low if they all focus on a single domain.
The repetition penalty should be higher (more negative impact) when many keywords follow the same pattern with minimal variation.

IMPORTANT: Prioritize diversity across domains/industries in early iterations to ensure broad exploration before deep mining.

## Output Format
Return a JSON object containing:
1. "dimensions": An object with scores for each dimension
2. "overallScore": A weighted average score (0-10)
3. "analysis": A concise analysis of the keyword quality, with special attention to domain diversity
4. "recommendContinue": Boolean indicating whether to continue iterating
5. "improvementSuggestions": Array of suggestions for the next iteration, emphasizing exploration of underrepresented domains`,

      nextIterationSimplified: `# KeywordNova Intent Mining Engine - Strategic Planning

## Persona
You are KeywordNova's AI Strategy Planner specializing in optimizing keyword discovery through iterative refinement with a strong focus on domain diversity and intent coverage.

## Task
Develop the optimal strategy for the next iteration of keyword queries based on historical data and current keyword set, ensuring broad exploration across different domains before deep mining.

## Input Data
Original keyword: {{originalKeyword}}
Number of keywords collected: {{keywordCount}}
Current iteration round: {{currentIteration}}

Please refer to our previous iterations and their performance when analyzing patterns and recommending queries.

Keyword samples:
{{keywordSamples}}

## Required Analysis
1. Identify gaps in current keyword coverage, with special attention to unexplored domains/industries
2. Analyze patterns from our previous iteration performance
3. Determine underexplored intent areas with high value potential
4. Design a strategic approach to maximize new discoveries while avoiding redundancy

Domain and Intent Balance Guidelines:
- For early iterations (1-2): Prioritize BREADTH over depth - explore completely different domains, industries, and applications
- For middle iterations (3-4): Balance breadth and depth - deepen exploration in promising domains while still exploring new areas
- For later iterations (5+): Increase DEPTH in the most valuable domains, while still maintaining some domain diversity

Consider:
- Which patterns were most effective in previous iterations
- Which domains/industries related to the topic remain unexplored
- Where high commercial value keywords are most likely to be found
- How to balance informational, commercial, navigational, and transactional intents

## Output Format
Return a JSON object containing:
- "gaps": Array of identified keyword gaps, explicitly noting domain/industry gaps
- "patterns": Array of effective patterns from historical and current data
- "targetGoals": Array of specific goals for the next iteration
- "recommendedQueries": Array of 10 diverse queries designed to explore different domains

CRITICAL: Ensure the recommendedQueries cover multiple domains/industries to prevent over-concentration in a single area. Queries should have meaningful variation, not just slight word changes.`,

      finalReportSimplified: `# KeywordNova Intent Mining Engine - Comprehensive Analysis Report

## Persona
You are KeywordNova's AI Analysis Specialist providing strategic keyword insights and content recommendations with particular attention to domain diversity.

## Task
Generate a comprehensive analysis report for this keyword research project, highlighting domain coverage and keyword diversity.

## Input Data
Original keyword: {{originalKeyword}}
Total keywords discovered: {{totalKeywords}}
Number of iterations completed: {{iterationCount}}

Please consider all previous iterations and their outcomes that you've seen in our conversation history.

Keyword samples:
{{keywordSamples}}

## Required Analysis
1. Categorize keywords by primary user intent and domain/industry
2. Identify high-value long-tail keywords with strong potential
3. Analyze user search intent patterns and distribution
4. Discover content creation opportunities
5. Highlight commercially valuable keyword groups
6. Assess domain coverage and identify areas with gaps or over-representation
7. Extract key insights from the iteration process
8. Identify the most effective query patterns discovered
9. Analyze the diversity across iterations and recommend follow-up areas

## Output Format
Return a JSON object containing:
- "categories": Object with keywords grouped by category AND by domain/industry
- "domainDistribution": Object showing the percentage distribution across different domains/industries
- "highValueKeywords": Array of recommended high-value keywords
- "intentDistribution": Object mapping intent types to their percentage distribution
- "contentOpportunities": Array of content creation suggestions
- "commercialKeywords": Array of keywords with commercial/conversion value
- "underrepresentedDomains": Array of domains/industries that were insufficiently explored
- "summary": Overall analysis summary, with attention to domain coverage
- "insights": Array of key insights from the iteration process
- "bestPatterns": Array of most effective query patterns
- "diversityAnalysis": Object assessing diversity across iterations`
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
      relevance: 0.15,          // 降低相关性权重（从0.20）
      longTailValue: 0.20,      // 保持长尾价值
      commercialValue: 0.18,    // 提高商业价值权重（从0.15）
      diversity: 0.20,          // 提高多样性权重（从0.15）
      novelty: 0.12,            // 提高新颖性权重（从0.10）
      searchVolumePotential: 0.05, // 降低搜索量潜力（从0.10）
      goalAchievement: 0.05,    // 保持目标达成率
      domainCoverage: 0.15,     // 新增：领域覆盖度
      repetitionPenalty: -0.10  // 新增：重复度惩罚（负值，降低重复内容的得分）
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