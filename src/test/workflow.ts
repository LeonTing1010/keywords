/**
 * 工作流测试脚本
 * 演示如何将所有Agent组合成一个完整的工作流
 */

import { 
  ProblemMiner,
  EvidenceCollector,
  SolutionAnalyzer,
  ValueEvaluator,
  CriticalThinker,
  Summarizer
} from '../agents/roles';
import { MockLLMService } from './mocks/MockLLMService';
import { MockToolFactory } from './mocks/MockToolFactory';
import { WorkflowContext } from '../types/schemas';
import { v4 as uuidv4 } from 'uuid';

// 创建模拟LLM服务
const llmService = new MockLLMService();

// 创建模拟工具工厂
const toolFactory = new MockToolFactory();

/**
 * 执行测试工作流
 * @param keyword 关键词
 */
async function runTestWorkflow(keyword: string) {
  console.log(`============= 开始关键词"${keyword}"的问题探索工作流 =============`);
  
  // 1. 创建所有Agent
  console.log("创建Agent...");
  const problemMiner = new ProblemMiner(llmService, {
    maxProblemsToReturn: 5,
    minConfidenceScore: 0.6
  });
  
  const evidenceCollector = new EvidenceCollector(llmService, {
    maxEvidencePerProblem: 5,
    confidenceThreshold: 0.7
  });
  
  const solutionAnalyzer = new SolutionAnalyzer(llmService, {
    maxSolutionsPerProblem: 3,
    confidenceThreshold: 0.7
  });
  
  const valueEvaluator = new ValueEvaluator(llmService, {
    valueThreshold: 60,
    analyzeMarketTrends: true
  });
  
  const criticalThinker = new CriticalThinker(llmService, {
    criticalIntensity: 7,
    maxChallengedProblems: 3
  });
  
  const summarizer = new Summarizer(llmService, {
    maxProblemsInReport: 3,
    includeActionableInsights: true
  });
  
  // 2. 注册工具
  console.log("注册工具...");
  
  // 为ProblemMiner注册工具
  problemMiner.registerTool(toolFactory.createSearchCompletionTool());
  problemMiner.registerTool(toolFactory.createCommunityInsightTool());
  
  // 为EvidenceCollector注册工具
  evidenceCollector.registerTool(toolFactory.createSearchEvidenceTool());
  evidenceCollector.registerTool(toolFactory.createSearchCommunityTool());
  evidenceCollector.registerTool(toolFactory.createAnalyzeTrendsTool());
  
  // 为SolutionAnalyzer注册工具
  solutionAnalyzer.registerTool(toolFactory.createSearchSolutionsTool());
  solutionAnalyzer.registerTool(toolFactory.createAnalyzeReviewsTool());
  
  // 为ValueEvaluator注册工具
  valueEvaluator.registerTool(toolFactory.createEstimateMarketSizeTool());
  valueEvaluator.registerTool(toolFactory.createGetTrendDataTool());
  
  // 收集所有注册的工具名称
  const allTools = [
    ...problemMiner.getRegisteredTools(),
    ...evidenceCollector.getRegisteredTools(),
    ...solutionAnalyzer.getRegisteredTools(),
    ...valueEvaluator.getRegisteredTools()
  ];
  
  // 3. 创建执行上下文
  const executionContext: WorkflowContext = {
    workflowId: uuidv4(),
    state: {
      input: {
        keyword,
        options: {
          fast: true,
          maxProblems: 10
        }
      },
      currentNodeId: 'ProblemMiner',
      completedNodeIds: [],
      nodeOutputs: {},
      executionMetadata: {
        startTime: Date.now(),
        currentTime: Date.now(),
        errors: []
      }
    },
    sharedMemory: {},
    availableTools: allTools
  };
  
  // 4. 执行工作流
  try {
    console.log("执行工作流...");
    
    // 4.1 问题挖掘阶段
    console.log("\n>>> 问题挖掘阶段...");
    const problemMinerOutput = await problemMiner.execute({
      data: {
        keyword
      },
      context: executionContext
    });
    
    if (problemMinerOutput.status !== 'success') {
      throw new Error(`问题挖掘失败: ${problemMinerOutput.error}`);
    }
    
    const problemMinerData = problemMinerOutput.data as any;
    console.log(`发现潜在问题: ${problemMinerData.problems.length}个`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('ProblemMiner');
    executionContext.state.currentNodeId = 'EvidenceCollector';
    executionContext.state.nodeOutputs.ProblemMiner = problemMinerOutput;
    
    // 4.2 证据收集阶段
    console.log("\n>>> 证据收集阶段...");
    const evidenceCollectorOutput = await evidenceCollector.execute({
      data: {
        keyword,
        previousOutputs: {
          ProblemMiner: problemMinerData
        }
      },
      context: executionContext
    });
    
    if (evidenceCollectorOutput.status !== 'success') {
      throw new Error(`证据收集失败: ${evidenceCollectorOutput.error}`);
    }
    
    const evidenceCollectorData = evidenceCollectorOutput.data as any;
    console.log(`验证问题: ${evidenceCollectorData.problems.length}个`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('EvidenceCollector');
    executionContext.state.currentNodeId = 'SolutionAnalyzer';
    executionContext.state.nodeOutputs.EvidenceCollector = evidenceCollectorOutput;
    
    // 4.3 解决方案分析阶段
    console.log("\n>>> 解决方案分析阶段...");
    const solutionAnalyzerOutput = await solutionAnalyzer.execute({
      data: {
        keyword,
        previousOutputs: {
          ProblemMiner: problemMinerData,
          EvidenceCollector: evidenceCollectorData
        }
      },
      context: executionContext
    });
    
    if (solutionAnalyzerOutput.status !== 'success') {
      throw new Error(`解决方案分析失败: ${solutionAnalyzerOutput.error}`);
    }
    
    const solutionAnalyzerData = solutionAnalyzerOutput.data as any;
    console.log(`分析解决方案: ${solutionAnalyzerData.problems.length}个问题`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('SolutionAnalyzer');
    executionContext.state.currentNodeId = 'ValueEvaluator';
    executionContext.state.nodeOutputs.SolutionAnalyzer = solutionAnalyzerOutput;
    
    // 4.4 价值评估阶段
    console.log("\n>>> 价值评估阶段...");
    const valueEvaluatorOutput = await valueEvaluator.execute({
      data: {
        keyword,
        previousOutputs: {
          ProblemMiner: problemMinerData,
          EvidenceCollector: evidenceCollectorData,
          SolutionAnalyzer: solutionAnalyzerData
        }
      },
      context: executionContext
    });
    
    if (valueEvaluatorOutput.status !== 'success') {
      throw new Error(`价值评估失败: ${valueEvaluatorOutput.error}`);
    }
    
    const valueEvaluatorData = valueEvaluatorOutput.data as any;
    const highValueProblems = valueEvaluatorData.problems.filter(
      (p: any) => p.valueAssessment && p.valueAssessment.overallValue >= valueEvaluator['options'].valueThreshold!
    );
    
    console.log(`高价值问题: ${highValueProblems.length}个`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('ValueEvaluator');
    executionContext.state.currentNodeId = 'CriticalThinker';
    executionContext.state.nodeOutputs.ValueEvaluator = valueEvaluatorOutput;
    
    // 4.5 批判性思考阶段
    console.log("\n>>> 批判性思考阶段...");
    const criticalThinkerOutput = await criticalThinker.execute({
      data: {
        keyword,
        previousOutputs: {
          ProblemMiner: problemMinerData,
          EvidenceCollector: evidenceCollectorData,
          SolutionAnalyzer: solutionAnalyzerData,
          ValueEvaluator: valueEvaluatorData
        }
      },
      context: executionContext
    });
    
    if (criticalThinkerOutput.status !== 'success') {
      throw new Error(`批判性思考失败: ${criticalThinkerOutput.error}`);
    }
    
    const challengedProblemCount = criticalThinkerOutput.metadata?.challengedProblemCount || 0;
    console.log(`质疑问题: ${challengedProblemCount}个`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('CriticalThinker');
    executionContext.state.currentNodeId = 'Summarizer';
    executionContext.state.nodeOutputs.CriticalThinker = criticalThinkerOutput;
    
    // 4.6 总结阶段
    console.log("\n>>> 总结阶段...");
    const summarizerOutput = await summarizer.execute({
      data: {
        keyword,
        previousOutputs: {
          ProblemMiner: problemMinerData,
          EvidenceCollector: evidenceCollectorData,
          SolutionAnalyzer: solutionAnalyzerData,
          ValueEvaluator: valueEvaluatorData,
          CriticalThinker: criticalThinkerOutput.data as any
        }
      },
      context: executionContext
    });
    
    if (summarizerOutput.status !== 'success') {
      throw new Error(`总结失败: ${summarizerOutput.error}`);
    }
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('Summarizer');
    executionContext.state.currentNodeId = 'Complete';
    executionContext.state.nodeOutputs.Summarizer = summarizerOutput;
    
    // 5. 输出最终报告
    const summarizerData = summarizerOutput.data as any;
    console.log("\n============= 最终报告 =============");
    console.log(`\n标题: ${summarizerData.detailedReport.title}`);
    console.log(`\n执行摘要: ${summarizerData.executiveSummary.summary}`);
    
    console.log("\n主要发现:");
    summarizerData.executiveSummary.keyFindings.forEach((finding: string, index: number) => {
      console.log(`${index + 1}. ${finding}`);
    });
    
    console.log(`\n市场机会: ${summarizerData.executiveSummary.marketOpportunity}`);
    
    if (summarizerData.actionableInsights) {
      console.log("\n战略建议:");
      summarizerData.actionableInsights.strategicRecommendations.forEach(
        (rec: any, index: number) => {
          console.log(`${index + 1}. ${rec.title} (优先级: ${rec.priority})`);
          console.log(`   ${rec.description}`);
        }
      );
    }
    
    console.log(`\n结论: ${summarizerData.detailedReport.conclusion}`);
    
    // 6. 汇报执行时间
    const totalTime = Date.now() - executionContext.state.executionMetadata.startTime;
    console.log(`\n工作流完成，总执行时间: ${totalTime}ms`);
    
  } catch (error) {
    console.error("工作流执行失败:", error);
  }
}

// 如果直接运行此脚本，执行测试工作流
if (require.main === module) {
  const testKeyword = process.argv[2] || "人工智能";
  runTestWorkflow(testKeyword).catch(console.error);
}