/**
 * MockToolFactory.ts - 模拟工具工厂
 * 用于创建各种模拟工具
 */

import { Tool, BaseTool } from '../../tools/Tool';
import { ToolParams, ToolResult } from '../../types/schemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * 模拟工具工厂类
 * 创建各种测试用的模拟工具
 */
export class MockToolFactory {
  /**
   * 创建搜索自动补全工具
   * @returns 搜索自动补全工具
   */
  createSearchCompletionTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'searchCompletion',
          '搜索自动补全工具，提供基于关键词的自动补全建议',
          '使用方法: searchCompletion({ query: "关键词" })',
          { query: '搜索查询关键词' }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { query } = args;
        return this.createSuccessResult([
          `${query} 问题`,
          `${query} 解决方案`,
          `${query} 优化`,
          `${query} 教程`,
          `${query} 挑战`
        ]);
      }
    };
  }

  /**
   * 创建社区洞察工具
   * @returns 社区洞察工具
   */
  createCommunityInsightTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'communityInsight',
          '社区洞察工具，分析社区讨论中的热门问题',
          '使用方法: communityInsight({ keyword: "关键词" })',
          { keyword: '要分析的关键词' }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { keyword } = args;
        return this.createSuccessResult([
          {
            title: `${keyword}的性能问题`,
            frequency: 42,
            sentiment: 'negative',
            sources: ['reddit', 'stackoverflow']
          },
          {
            title: `${keyword}的集成挑战`,
            frequency: 37,
            sentiment: 'neutral',
            sources: ['github', 'quora']
          },
          {
            title: `${keyword}的学习曲线`,
            frequency: 31,
            sentiment: 'negative',
            sources: ['reddit', 'twitter']
          }
        ]);
      }
    };
  }

  /**
   * 创建搜索证据工具
   * @returns 搜索证据工具
   */
  createSearchEvidenceTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'searchEvidence',
          '搜索证据工具，从网络搜索结果中收集证据',
          '使用方法: searchEvidence({ query: "搜索查询", depth: 2, maxResults: 5 })',
          { 
            query: '搜索查询',
            depth: '搜索深度，默认为1',
            maxResults: '最大结果数量，默认为10'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { query } = args;
        return this.createSuccessResult([
          {
            text: `关于"${query}"的证据1`,
            source: '搜索引擎',
            url: 'https://example.com/1',
            timestamp: new Date().toISOString()
          },
          {
            text: `关于"${query}"的证据2`,
            source: '专业网站',
            url: 'https://example.com/2',
            timestamp: new Date().toISOString()
          },
          {
            text: `关于"${query}"的证据3`,
            source: '学术网站',
            url: 'https://example.com/3',
            timestamp: new Date().toISOString()
          }
        ]);
      }
    };
  }

  /**
   * 创建社区搜索工具
   * @returns 社区搜索工具
   */
  createSearchCommunityTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'searchCommunity',
          '社区搜索工具，从社区平台搜索相关讨论',
          '使用方法: searchCommunity({ keyword: "关键词", sources: ["reddit", "stackoverflow"], limit: 10 })',
          { 
            keyword: '搜索关键词',
            sources: '要搜索的平台，默认全部',
            limit: '结果数量限制，默认为10'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { keyword } = args;
        return this.createSuccessResult([
          {
            text: `社区用户讨论了"${keyword}"的问题1`,
            source: 'reddit',
            postId: uuidv4(),
            upvotes: 42,
            commentCount: 23
          },
          {
            text: `社区用户讨论了"${keyword}"的问题2`,
            source: 'stackoverflow',
            postId: uuidv4(),
            upvotes: 17,
            commentCount: 8
          },
          {
            text: `社区用户讨论了"${keyword}"的问题3`,
            source: 'quora',
            postId: uuidv4(),
            upvotes: 31,
            commentCount: 14
          }
        ]);
      }
    };
  }

  /**
   * 创建趋势分析工具
   * @returns 趋势分析工具
   */
  createAnalyzeTrendsTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'analyzeTrends',
          '趋势分析工具，分析关键词的搜索趋势',
          '使用方法: analyzeTrends({ keyword: "关键词", timeRange: "last_5_years" })',
          { 
            keyword: '要分析的关键词',
            timeRange: '时间范围，如"last_5_years"，默认为5年'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { keyword, timeRange } = args;
        return this.createSuccessResult({
          keyword,
          timeRange: timeRange || 'last_5_years',
          trend: 'increasing',
          growthRate: 23.5,
          seasonality: 'moderate',
          relatedRisingTerms: [
            `${keyword} 最佳实践`,
            `${keyword} 教程`,
            `${keyword} 案例`
          ]
        });
      }
    };
  }

  /**
   * 创建解决方案搜索工具
   * @returns 解决方案搜索工具
   */
  createSearchSolutionsTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'searchSolutions',
          '解决方案搜索工具，寻找现有的解决方案',
          '使用方法: searchSolutions({ query: "查询", maxResults: 5 })',
          { 
            query: '搜索查询',
            maxResults: '最大结果数量，默认为5'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { query } = args;
        return this.createSuccessResult([
          {
            name: `${query}解决方案A`,
            url: 'https://example.com/solutionA',
            description: `针对${query}的综合解决方案`,
            type: 'commercial',
            features: ['特性1', '特性2', '特性3']
          },
          {
            name: `${query}工具B`,
            url: 'https://example.com/toolB',
            description: `专注于解决${query}某方面问题的工具`,
            type: 'open-source',
            features: ['特性1', '特性2']
          },
          {
            name: `${query}平台C`,
            url: 'https://example.com/platformC',
            description: `处理${query}的平台`,
            type: 'freemium',
            features: ['特性1', '特性2', '特性3', '特性4']
          }
        ]);
      }
    };
  }

  /**
   * 创建评论分析工具
   * @returns 评论分析工具
   */
  createAnalyzeReviewsTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'analyzeReviews',
          '评论分析工具，分析产品评论',
          '使用方法: analyzeReviews({ productName: "产品名称", maxReviews: 20 })',
          { 
            productName: '产品名称',
            maxReviews: '最大评论数量，默认为20'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { productName } = args;
        return this.createSuccessResult([
          {
            text: `${productName}的正面评论1`,
            rating: 5,
            sentiment: 'positive',
            source: 'app_store'
          },
          {
            text: `${productName}的负面评论1`,
            rating: 2,
            sentiment: 'negative',
            source: 'google_play'
          },
          {
            text: `${productName}的中性评论1`,
            rating: 3,
            sentiment: 'neutral',
            source: 'amazon'
          }
        ]);
      }
    };
  }

  /**
   * 创建市场规模估算工具
   * @returns 市场规模估算工具
   */
  createEstimateMarketSizeTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'estimateMarketSize',
          '市场规模估算工具，估算特定问题的市场规模',
          '使用方法: estimateMarketSize({ keyword: "关键词", problem: "问题描述" })',
          { 
            keyword: '关键词',
            problem: '问题描述'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { keyword, problem } = args;
        return this.createSuccessResult({
          estimatedSize: '$500M-$1B',
          cagr: '12.5%',
          targetAudience: '企业用户',
          geographicDistribution: {
            northAmerica: 45,
            europe: 30,
            asiaPacific: 20,
            restOfWorld: 5
          },
          confidenceLevel: 'medium'
        });
      }
    };
  }

  /**
   * 创建趋势数据获取工具
   * @returns 趋势数据获取工具
   */
  createGetTrendDataTool(): Tool {
    return new class extends BaseTool {
      constructor() {
        super(
          'getTrendData',
          '趋势数据获取工具，获取特定查询的趋势数据',
          '使用方法: getTrendData({ query: "查询", period: "5y" })',
          { 
            query: '查询关键词',
            period: '时间段，如"5y"表示5年'
          }
        );
      }

      protected async executeInternal(args: ToolParams): Promise<ToolResult> {
        const { query, period } = args;
        return this.createSuccessResult({
          query,
          period: period || '5y',
          trendData: [
            { date: '2019-01', value: 35 },
            { date: '2020-01', value: 42 },
            { date: '2021-01', value: 58 },
            { date: '2022-01', value: 67 },
            { date: '2023-01', value: 82 }
          ],
          overallTrend: 'up',
          volatility: 'low',
          seasonalPatterns: true
        });
      }
    };
  }
}