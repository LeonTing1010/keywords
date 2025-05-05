/**
 * JourneyEvaluator 测试
 */
import { JourneyEvaluator, RealJourneyData } from '../journey/JourneyEvaluator';
import { UserJourney, JourneyStep, DecisionPoint } from '../journey/UserJourneySim';

// 创建模拟的UserJourney数据用于测试
function createMockUserJourney(initialQuery: string): UserJourney {
  // 模拟步骤
  const steps: JourneyStep[] = [
    {
      query: initialQuery,
      intentType: 'information_seeking',
      expectedResults: ['一般信息'],
      userAction: 'initial_search',
      reasoning: '开始搜索'
    },
    {
      query: `${initialQuery} 推荐`,
      intentType: 'comparison_seeking',
      expectedResults: ['推荐列表', '比较信息'],
      userAction: 'refine_search',
      reasoning: '寻找推荐'
    },
    {
      query: `最好的${initialQuery}排行`,
      intentType: 'ranking_seeking',
      expectedResults: ['排行榜', '评价'],
      userAction: 'refine_search',
      reasoning: '查找排名'
    }
  ];
  
  // 模拟决策点
  const decisionPoints: DecisionPoint[] = [
    {
      step: 1,
      fromQuery: initialQuery,
      toQuery: `${initialQuery} 推荐`,
      reason: '需要推荐信息',
      intentShift: true,
      intentChange: {
        from: 'information_seeking',
        to: 'comparison_seeking'
      }
    },
    {
      step: 2,
      fromQuery: `${initialQuery} 推荐`,
      toQuery: `最好的${initialQuery}排行`,
      reason: '需要排名信息',
      intentShift: true,
      intentChange: {
        from: 'comparison_seeking',
        to: 'ranking_seeking'
      }
    }
  ];
  
  // 返回完整的UserJourney对象
  return {
    initialQuery,
    steps,
    decisionPoints,
    finalQuery: `最好的${initialQuery}排行`,
    summary: {
      totalSteps: steps.length,
      intentShifts: 2,
      refinementPatterns: ['addingSpecificity', 'rephrasing'],
      mainIntent: 'research'
    }
  };
}

// 创建测试用例
describe('JourneyEvaluator', () => {
  // 设置测试
  let evaluator: JourneyEvaluator;
  let mockJourney: UserJourney;
  let realJourneyData: RealJourneyData;
  
  beforeEach(() => {
    // 初始化评估器
    evaluator = new JourneyEvaluator({ verbose: false });
    
    // 创建模拟旅程
    mockJourney = createMockUserJourney('智能手机');
    
    // 创建真实旅程数据
    realJourneyData = {
      queries: [
        '智能手机',
        '智能手机 推荐',
        '最好的智能手机排行'
      ],
      refinementPatterns: ['addingSpecificity', 'rephrasing'],
      intentTransitions: [
        {
          fromQuery: '智能手机',
          toQuery: '智能手机 推荐',
          fromIntent: 'information_seeking',
          toIntent: 'comparison_seeking'
        },
        {
          fromQuery: '智能手机 推荐',
          toQuery: '最好的智能手机排行',
          fromIntent: 'comparison_seeking',
          toIntent: 'ranking_seeking'
        }
      ]
    };
  });
  
  // 测试评估相似旅程
  test('应该正确评估完全匹配的旅程', () => {
    const metrics = evaluator.evaluateJourney(mockJourney, realJourneyData);
    
    // 期望所有评分都很高
    expect(metrics.patternSimilarity).toBe(1.0);
    expect(metrics.intentTransitionAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(metrics.queryRelevance).toBeGreaterThanOrEqual(0.9);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0.9);
  });
  
  // 测试评估部分匹配旅程
  test('应该正确评估部分匹配的旅程', () => {
    // 修改模拟旅程的一部分
    mockJourney.steps[2].query = '2023最值得购买的智能手机';
    mockJourney.decisionPoints[1].toQuery = '2023最值得购买的智能手机';
    mockJourney.finalQuery = '2023最值得购买的智能手机';
    mockJourney.summary.refinementPatterns = ['addingSpecificity', 'addingCommercialIntent'];
    
    const metrics = evaluator.evaluateJourney(mockJourney, realJourneyData);
    
    // 期望模式相似度较低，但其他分数适中
    expect(metrics.patternSimilarity).toBeLessThan(1.0);
    expect(metrics.intentTransitionAccuracy).toBeGreaterThan(0.5);
    expect(metrics.queryRelevance).toBeGreaterThan(0.5);
    expect(metrics.overallScore).toBeGreaterThan(0.5);
  });
  
  // 测试完全不匹配的旅程
  test('应该正确评估完全不匹配的旅程', () => {
    // 创建一个完全不同的旅程
    const differentJourney = createMockUserJourney('学习编程');
    
    const metrics = evaluator.evaluateJourney(differentJourney, realJourneyData);
    
    // 期望所有分数都较低
    expect(metrics.patternSimilarity).toBeLessThan(0.5);
    expect(metrics.queryRelevance).toBeLessThan(0.3);
    expect(metrics.overallScore).toBeLessThan(0.5);
  });
  
  // 测试批量评估
  test('应该正确执行批量评估', () => {
    // 创建多个模拟旅程
    const journeys = [
      mockJourney,
      createMockUserJourney('笔记本电脑'),
      createMockUserJourney('健身器材')
    ];
    
    // 创建多个真实旅程数据
    const realData = [
      realJourneyData,
      {
        queries: ['笔记本电脑', '笔记本电脑 推荐', '最好的笔记本电脑排行'],
        refinementPatterns: ['addingSpecificity', 'rephrasing'],
        intentTransitions: []
      },
      {
        queries: ['健身器材', '家用健身器材', '最好的家用健身器材2023'],
        refinementPatterns: ['addingSpecificity'],
        intentTransitions: []
      }
    ];
    
    const batchResults = evaluator.evaluateBatch(journeys, realData);
    
    // 验证结果
    expect(batchResults.individualScores.length).toBe(3);
    expect(batchResults.averageScore.overallScore).toBeGreaterThan(0);
  });
}); 