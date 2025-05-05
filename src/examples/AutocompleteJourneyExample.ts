/**
 * AutocompleteJourneyExample - 自动补全增强的用户旅程模拟示例
 * 演示如何使用自动补全功能增强用户搜索旅程模拟
 */
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { UserJourneySim } from '../journey/UserJourneySim';
import { AutocompleteService } from '../journey/AutocompleteService';
import { DEFAULT_AUTOCOMPLETE_PARAMETERS } from '../journey/AutocompleteParameters';
import { AutocompleteEvaluator } from '../journey/AutocompleteEvaluator';
import { JourneyEvaluator } from '../journey/JourneyEvaluator';

// 实际使用时需要替换为真实的LLM服务实现
class MockLLMService extends LLMServiceHub {
  async simulateUserJourney(initialQuery: string, options: any) {
    console.log(`[Mock] 模拟用户旅程: ${initialQuery}`);
    
    // 返回模拟的旅程数据
    return {
      steps: [
        {
          query: initialQuery,
          intentType: "informational",
          expectedResults: ["相关信息"],
          userAction: "搜索查询",
          reasoning: "初始查询"
        },
        {
          query: `${initialQuery} 教程`,
          intentType: "informational",
          expectedResults: ["教程信息"],
          userAction: "精炼查询",
          reasoning: "需要更具体的教程信息"
        },
        {
          query: `最佳 ${initialQuery} 教程 2023`,
          intentType: "informational",
          expectedResults: ["最新教程"],
          userAction: "精炼查询",
          reasoning: "需要最新的教程信息"
        },
        {
          query: `${initialQuery} 价格`,
          intentType: "commercial",
          expectedResults: ["价格信息"],
          userAction: "转换意图",
          reasoning: "从寻找教程转为了解价格"
        }
      ],
      mainIntent: "informational"
    };
  }
}

/**
 * 主示例函数
 */
async function runAutocompleteJourneyExample() {
  console.log("===== 自动补全增强的用户旅程模拟示例 =====");
  
  // 1. 初始化服务
  const llmService = new MockLLMService();
  
  // 2. 初始化自动补全服务
  const autocompleteService = new AutocompleteService({
    verbose: true,
    cacheExpiry: 60 * 60, // 1小时缓存过期
    defaultEngine: 'baidu' // 使用百度自动补全
  });
  
  // 3. 自定义自动补全参数（可选）
  const autocompleteParams = {
    ...DEFAULT_AUTOCOMPLETE_PARAMETERS,
    // 调整参数以适应特定需求
    overallAdoptionRate: 0.75, // 提高采纳率
    positionWeights: [1.0, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05, 0.02, 0.01]
  };
  
  // 4. 初始化评估器（可选）
  const journeyEvaluator = new JourneyEvaluator({
    verbose: true
  });
  
  const autocompleteEvaluator = new AutocompleteEvaluator({
    verbose: true
  });
  
  // 5. 初始化用户旅程模拟器
  const userJourneySim = new UserJourneySim({
    llmService,
    autocompleteService,
    autocompleteParams,
    autocompleteEvaluator,
    evaluator: journeyEvaluator,
    verbose: true,
    maxSteps: 6
  });
  
  // 6. 模拟用户旅程
  const initialQueries = [
    "Python",
    "数据分析",
    "机器学习"
  ];
  
  console.log("\n>> 开始模拟用户旅程...");
  
  for (const query of initialQueries) {
    console.log(`\n>> 为查询 "${query}" 模拟用户旅程:`);
    
    const journey = await userJourneySim.simulateJourney(query);
    
    // 7. 输出模拟结果
    console.log("\n---- 模拟旅程结果 ----");
    console.log(`初始查询: ${journey.initialQuery}`);
    console.log(`最终查询: ${journey.finalQuery}`);
    console.log(`总步骤数: ${journey.summary.totalSteps}`);
    console.log(`意图转换次数: ${journey.summary.intentShifts}`);
    console.log(`主要意图: ${journey.summary.mainIntent}`);
    console.log(`自动补全影响度: ${(journey.summary.autocompleteInfluence || 0) * 100}%`);
    
    console.log("\n查询进化路径:");
    journey.steps.forEach((step, index) => {
      const source = step.suggestedBy === 'autocomplete' ? 
        `[自动补全-位置${step.position}]` : 
        (step.suggestedBy === 'enhanced_autocomplete' ? '[增强自动补全]' : '[LLM]');
      
      console.log(`${index + 1}. ${step.query} - ${step.intentType} ${source}`);
    });
    
    console.log("\n决策点:");
    journey.decisionPoints.forEach((dp, index) => {
      console.log(`${index + 1}. 从 "${dp.fromQuery}" 到 "${dp.toQuery}"`);
      console.log(`   原因: ${dp.reason}`);
      if (dp.intentShift) {
        console.log(`   意图变化: ${dp.intentChange?.from} → ${dp.intentChange?.to}`);
      }
    });
  }
  
  // 8. 评估自动补全采纳行为（需要真实数据）
  console.log("\n>> 模拟评估自动补全采纳行为");
  
  // 这里使用模拟的真实行为数据
  const mockRealMetrics = {
    adoptionRate: 0.68,
    positionPreference: [0.45, 0.25, 0.15, 0.08, 0.04, 0.02, 0.01, 0, 0, 0],
    semanticDeviationDistribution: {
      low: 0.65,
      medium: 0.30,
      high: 0.05
    },
    queryTypeInfluence: {
      informational: 0.7,
      navigational: 0.6,
      commercial: 0.8,
      transactional: 0.9
    }
  };
  
  // 批量模拟并评估旅程
  const moreQueries = [
    "Python 入门", 
    "数据科学", 
    "神经网络", 
    "深度学习框架", 
    "自然语言处理"
  ];
  
  const evaluationResult = await userJourneySim.simulateAndEvaluateAutocompleteAdoption(
    moreQueries,
    mockRealMetrics
  );
  
  console.log("\n---- 自动补全评估结果 ----");
  console.log(`总体采纳率相似度: ${evaluationResult.evaluationResult.overallAdoptionSimilarity.toFixed(4)}`);
  console.log(`位置偏好相似度: ${evaluationResult.evaluationResult.positionPreferenceSimilarity.toFixed(4)}`);
  console.log(`语义偏离相似度: ${evaluationResult.evaluationResult.semanticDeviationSimilarity.toFixed(4)}`);
  console.log(`查询类型影响相似度: ${evaluationResult.evaluationResult.queryTypeInfluenceSimilarity.toFixed(4)}`);
  console.log(`综合相似度: ${evaluationResult.evaluationResult.overallSimilarity.toFixed(4)}`);
}

// 执行示例
runAutocompleteJourneyExample().catch(error => {
  console.error("示例运行出错:", error);
}); 