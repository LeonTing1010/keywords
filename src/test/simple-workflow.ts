/**
 * 简化版工作流测试脚本
 * 仅使用ProblemMiner进行测试
 */

import { ProblemMiner } from '../agents/roles/ProblemMiner';
import { MockLLMService } from './mocks/MockLLMService';
import { MockToolFactory } from './mocks/MockToolFactory';
import { WorkflowContext } from '../types/schemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * 执行简化版测试工作流
 * @param keyword 关键词
 */
async function runSimpleWorkflow(keyword: string) {
  console.log(`============= 开始关键词"${keyword}"的简化问题探索工作流 =============`);
  
  // 创建模拟LLM服务
  const llmService = new MockLLMService();
  
  // 创建模拟工具工厂
  const toolFactory = new MockToolFactory();
  
  // 1. 创建ProblemMiner
  console.log("创建ProblemMiner...");
  const problemMiner = new ProblemMiner(llmService, {
    maxProblemsToReturn: 5,
    minConfidenceScore: 0.6
  });
  
  // 2. 注册工具
  console.log("注册工具...");
  problemMiner.registerTool(toolFactory.createSearchCompletionTool());
  problemMiner.registerTool(toolFactory.createCommunityInsightTool());
  
  // 收集所有注册的工具名称
  const allTools = problemMiner.getRegisteredTools();
  
  // 3. 创建执行上下文
  const executionContext: WorkflowContext = {
    workflowId: uuidv4(),
    state: {
      input: {
        keyword,
        options: {
          fast: true,
          maxProblems: 5
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
  
  // 4. 执行 ProblemMiner
  try {
    console.log("执行ProblemMiner...");
    const problemMinerOutput = await problemMiner.execute({
      data: { keyword },
      context: executionContext
    });
    
    if (problemMinerOutput.status !== 'success') {
      throw new Error(`问题挖掘失败: ${problemMinerOutput.error}`);
    }
    
    const problemMinerData = problemMinerOutput.data as any;
    console.log(`发现潜在问题: ${problemMinerData.problems.length}个`);
    
    // 更新上下文
    executionContext.state.completedNodeIds.push('ProblemMiner');
    executionContext.state.currentNodeId = 'Complete';
    executionContext.state.nodeOutputs.ProblemMiner = problemMinerOutput;
    
    // 5. 输出结果
    console.log("\n============= 发现的问题 =============");
    
    problemMinerData.problems.forEach((problem: any, index: number) => {
      console.log(`\n问题 ${index + 1}: ${problem.title}`);
      console.log(`描述: ${problem.description}`);
      console.log(`类别: ${problem.category.join(', ')}`);
      
      if (problem.evidence && problem.evidence.length > 0) {
        console.log(`证据数量: ${problem.evidence.length}`);
        console.log(`主要证据: ${problem.evidence[0].text}`);
      }
      
      if (problem.value) {
        console.log(`价值评分: ${problem.value.overall}/100`);
      }
    });
    
    // 6. 汇报执行时间
    const totalTime = Date.now() - executionContext.state.executionMetadata.startTime;
    console.log(`\n工作流完成，总执行时间: ${totalTime}ms`);
    
    return true;
  } catch (error) {
    console.error("工作流执行失败:", error);
    return false;
  }
}

// 如果直接运行此脚本，执行测试工作流
if (require.main === module) {
  const testKeyword = process.argv[2] || "人工智能";
  runSimpleWorkflow(testKeyword)
    .then(success => {
      console.log(`简化工作流${success ? '成功' : '失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('执行错误:', error);
      process.exit(1);
    });
} 