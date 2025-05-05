/**
 * 自动补全增强的用户旅程模拟示例
 */
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { UserJourneySim } from '../journey/UserJourneySim';
import { AutocompleteService } from '../journey/AutocompleteService';
import { 
  AutocompleteParameters, 
  DEFAULT_AUTOCOMPLETE_PARAMETERS,
  AutocompleteBehaviorMetrics
} from '../journey/AutocompleteParameters';
import { AutocompleteEvaluator } from '../journey/AutocompleteEvaluator';

/**
 * 运行示例
 */
async function runExample() {
  console.log('启动自动补全增强的用户旅程模拟示例...');
  
  // 初始化服务
  const llmService = new LLMServiceHub({
    verbose: true
  });
  
  const autocompleteService = new AutocompleteService({
    defaultEngine: 'baidu',
    verbose: true
  });
  
  const autocompleteEvaluator = new AutocompleteEvaluator({
    verbose: true
  });
  
  // 自定义自动补全参数
  const autocompleteParams: AutocompleteParameters = {
    ...DEFAULT_AUTOCOMPLETE_PARAMETERS,
    overallAdoptionRate: 0.7,  // 提高采纳率
    positionWeights: [1.0, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0.05, 0.01, 0.001]  // 更偏向靠前的建议
  };
  
  // 初始化旅程模拟器
  const journeySim = new UserJourneySim({
    llmService,
    autocompleteService,
    autocompleteParams,
    autocompleteEvaluator,
    verbose: true
  });
  
  // 模拟用户旅程
  console.log('\n1. 模拟单个旅程:');
  const journey = await journeySim.simulateJourney('智能手机');
  
  // 打印旅程结果
  console.log(`\n初始查询: ${journey.initialQuery}`);
  console.log('查询路径:');
  journey.steps.forEach((step, index) => {
    const source = step.suggestedBy === 'autocomplete' 
      ? `[自动补全建议#${step.position}]` 
      : step.suggestedBy === 'enhanced_autocomplete'
        ? '[增强自动补全]'
        : '[LLM预测]';
    
    console.log(`${index + 1}. ${step.query} ${source}`);
    console.log(`   意图: ${step.intentType}`);
    console.log(`   原因: ${step.reasoning}`);
  });
  
  console.log('\n决策点:');
  journey.decisionPoints.forEach((dp, index) => {
    console.log(`${index + 1}. ${dp.fromQuery} -> ${dp.toQuery}`);
    console.log(`   原因: ${dp.reason}`);
    console.log(`   意图转换: ${dp.intentShift ? '是' : '否'}`);
  });
  
  console.log('\n查询修改模式:', journey.summary.refinementPatterns);
  console.log('自动补全影响度:', journey.summary.autocompleteInfluence);
  
  // 模拟多个旅程
  console.log('\n2. 批量模拟多个旅程:');
  const queries = ['智能手机', '笔记本电脑', '健身器材'];
  const journeys = await Promise.all(
    queries.map(query => journeySim.simulateJourney(query))
  );
  
  // 打印概要结果
  console.log('\n批量模拟结果:');
  journeys.forEach((j, index) => {
    console.log(`${index + 1}. ${j.initialQuery} -> ${j.finalQuery}`);
    console.log(`   步骤数: ${j.steps.length}`);
    console.log(`   自动补全影响度: ${j.summary.autocompleteInfluence}`);
  });
  
  // 评估自动补全采纳行为
  console.log('\n3. 评估自动补全采纳行为:');
  
  // 模拟真实指标数据(实际使用中应从真实数据中提取)
  const realMetrics: AutocompleteBehaviorMetrics = {
    adoptionRate: 0.65,
    positionPreference: [0.5, 0.3, 0.1, 0.05, 0.03, 0.01, 0.01, 0, 0, 0],
    semanticDeviationDistribution: {
      low: 0.6,
      medium: 0.3,
      high: 0.1
    },
    queryTypeInfluence: {
      informational: 0.5,
      navigational: 0.4,
      commercial: 0.8,
      transactional: 0.9,
      comparison: 0.7,
      research: 0.6
    }
  };
  
  const evaluationResult = journeySim.evaluateAutocompleteAdoption(journeys, realMetrics);
  
  console.log('评估结果:');
  console.log(`总体采纳率相似度: ${evaluationResult.overallAdoptionSimilarity.toFixed(4)}`);
  console.log(`位置偏好相似度: ${evaluationResult.positionPreferenceSimilarity.toFixed(4)}`);
  console.log(`语义偏离相似度: ${evaluationResult.semanticDeviationSimilarity.toFixed(4)}`);
  console.log(`查询类型影响相似度: ${evaluationResult.queryTypeInfluenceSimilarity.toFixed(4)}`);
  console.log(`综合相似度: ${evaluationResult.overallSimilarity.toFixed(4)}`);
  
  console.log('\n示例运行完成!');
}

// 运行示例
runExample().catch(error => {
  console.error('示例运行出错:', error);
});

/**
 * 导出示例函数，可以在其他地方导入并运行
 */
export { runExample }; 