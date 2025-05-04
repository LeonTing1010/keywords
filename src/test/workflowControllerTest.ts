/**
 * WorkflowController 测试脚本
 */
import { WorkflowController } from '../core/WorkflowController';
import { LLMServiceHub } from '../llm/LLMServiceHub';
import { GoogleSearchEngine } from '../providers/GoogleSearchEngine';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 加载环境变量
dotenv.config();

async function testWorkflowController() {
  try {
    console.log('开始测试 WorkflowController...');
    
    // 创建搜索引擎实例
    const searchEngine = new GoogleSearchEngine();
    console.log('✓ 搜索引擎已初始化');
    
    // 创建 LLM 服务
    const llmService = new LLMServiceHub({
      model: 'gpt-4',
      verbose: true
    });
    console.log('✓ LLM服务已初始化');
    
    // 创建工作流控制器
    const workflowController = new WorkflowController({
      searchEngine,
      llmService,
      maxIterations: 2, // 使用较小的迭代次数以快速测试
      satisfactionThreshold: 0.8,
      analysisDepth: 3,
      outputFormat: 'json',
      enableDomainExpert: true,
      enableJourneySim: true,
      enableCrossDomain: true,
      enableValuePredict: true,
      enableIntentAnalysis: true,
      verbose: true
    });
    console.log('✓ 工作流控制器已初始化');
    
    // 测试关键词
    const testKeyword = 'artificial intelligence';
    console.log(`开始分析关键词: "${testKeyword}"`);
    
    // 执行工作流
    const startTime = Date.now();
    const result = await workflowController.executeWorkflow(testKeyword);
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`✓ 分析完成！耗时: ${duration.toFixed(2)} 秒`);
    console.log(`✓ 发现关键词: ${result.discoveredKeywords.length} 个`);
    
    if (result.intentAnalysis) {
      console.log(`✓ 意图分析: ${result.summary.intentCounts.total} 种意图`);
    }
    
    if (result.domainAnalysis) {
      const domainCount = result.domainAnalysis.domains.length;
      console.log(`✓ 领域分析: ${domainCount} 个领域`);
    }
    
    if (result.journeyAnalysis) {
      const stepCount = result.journeyAnalysis.steps.length;
      console.log(`✓ 用户旅程: ${stepCount} 个步骤`);
    }
    
    // 保存结果到文件
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `test_result_${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`✓ 结果已保存到: ${outputFile}`);
    
    console.log('测试成功完成!');
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 执行测试
testWorkflowController(); 