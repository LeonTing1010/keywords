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
      identifyCategories: `请将下列关键词按用户真实需求意图分组，突出内容缺口和市场机会。输出JSON。\n原始关键词: {{originalKeyword}}\n建议列表: {{suggestions}}`,
      generateQueries: `基于原始关键词和补全建议，生成3个能发现未满足需求和内容空白的高价值长尾查询。输出JSON数组。\n原始关键词: {{originalKeyword}}\n建议: {{suggestions}}`,
      evaluateIteration: `评估本轮新关键词的内容缺口、市场机会和未满足需求价值。输出JSON，包含各维度评分、主要内容缺口、改进建议。\n原始关键词: {{originalKeyword}}\n新关键词样例: {{keywordSamples}}`
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