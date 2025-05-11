/**
 * 集成测试脚本
 * 测试问题发现系统的基本功能
 */

import { v4 as uuidv4 } from 'uuid';
import { ProblemMiner } from '../agents/roles/ProblemMiner';
import { MockLLMService } from './mocks/MockLLMService';
import { Coordinator, Workflow, Node, Edge } from '../core/coordinator/Coordinator';
import { WorkflowInput } from '../types';

// 创建一个简单的模拟LLM服务用于测试
class TestLLMService extends MockLLMService {
  // 添加responses属性存储预设响应
  private responses: Record<string, string>;

  constructor() {
    super();
    
    // 初始化预设响应
    this.responses = {
      // 模拟问题挖掘结果
      'generate30SearchAutocompletes': JSON.stringify([
        '远程办公 工具',
        '远程办公 如何提高效率',
        '远程办公 团队协作软件',
        '远程办公 视频会议哪个好',
        '远程办公 安全问题',
        '远程办公 最佳实践',
        '远程办公 如何避免孤独感',
        '远程办公 时间管理',
        '远程办公 设备推荐'
      ]),
      // 模拟自动补全转问题结果
      'autocompleteToProblems': JSON.stringify([
        {
          "title": "如何在远程办公时提高工作效率？",
          "description": "用户寻找能够在居家远程工作时提高效率的方法和策略，包括时间管理、减少干扰和保持专注。",
          "originalQuery": "远程办公 如何提高效率",
          "confidence": 0.9
        },
        {
          "title": "远程办公环境下团队协作的最佳工具是什么？",
          "description": "用户需要寻找适合远程团队使用的协作软件，以便有效地进行项目管理、文件共享和沟通。",
          "originalQuery": "远程办公 团队协作软件",
          "confidence": 0.85
        },
        {
          "title": "远程办公时如何解决网络安全问题？",
          "description": "用户担忧在家办公时可能面临的网络安全风险，如数据泄露、不安全的网络连接等，并寻求保护措施。",
          "originalQuery": "远程办公 安全问题",
          "confidence": 0.8
        }
      ]),
      // 模拟LLM生成问题结果
      'llmMineProblems': JSON.stringify([
        {
          "title": "远程办公导致的工作与生活界限模糊",
          "description": "远程工作使得工作和个人生活的界限变得模糊，许多人发现自己难以\"下班\"，导致工作时间延长、休息不足和潜在的职业倦怠。",
          "category": ["工作生活平衡", "心理健康"],
          "userScale": 8,
          "severity": 7
        },
        {
          "title": "远程团队沟通效率低下",
          "description": "远程工作环境下，团队成员之间的沟通往往依赖于文字或视频会议，缺乏面对面交流的即时性和丰富性，导致信息传递效率降低、误解增加。",
          "category": ["团队协作", "沟通"],
          "userScale": 9,
          "severity": 8
        }
      ]),
      // 模拟问题排序结果
      'rankProblems': JSON.stringify([
        {
          "id": "test-id-1",
          "overallValue": 85,
          "universality": 9,
          "severity": 8,
          "urgency": 8,
          "solvability": 7,
          "marketOpportunity": 9
        },
        {
          "id": "test-id-2",
          "overallValue": 75,
          "universality": 8,
          "severity": 7,
          "urgency": 7,
          "solvability": 8,
          "marketOpportunity": 8
        },
        {
          "id": "test-id-3",
          "overallValue": 65,
          "universality": 7,
          "severity": 6,
          "urgency": 6,
          "solvability": 9,
          "marketOpportunity": 7
        }
      ])
    };
  }

  // 根据请求内容返回不同的模拟响应
  async chatToJSON<T>(messages: any[], jsonSchema: any, options?: any): Promise<T> {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    if (userMessage.includes('生成30个可能的搜索引擎自动补全结果')) {
      return JSON.parse(this.responses['generate30SearchAutocompletes']) as T;
    } else if (userMessage.includes('搜索查询列表') && userMessage.includes('转化为明确的问题陈述')) {
      return JSON.parse(this.responses['autocompleteToProblems']) as T;
    } else if (userMessage.includes('分析并发现该领域中用户可能面临的')) {
      return JSON.parse(this.responses['llmMineProblems']) as T;
    } else if (userMessage.includes('评估以下问题的价值和重要性')) {
      return JSON.parse(this.responses['rankProblems']) as T;
    }

    // 默认返回空数组
    return [] as unknown as T;
  }
}

// 测试工具的模拟实现
class MockSearchTool {
  async execute(params: any) {
    return {
      success: true,
      data: [
        '搜索结果1',
        '搜索结果2',
        '搜索结果3'
      ],
      metadata: {
        toolName: 'searchAutocomplete',
        timestamp: Date.now()
      }
    };
  }
}

/**
 * 运行集成测试
 */
async function runIntegrationTest() {
  console.log("开始集成测试 - 问题发现系统");
  
  try {
    // 创建模拟LLM服务
    const llmService = new TestLLMService();
    
    // 创建问题挖掘Agent
    const problemMiner = new ProblemMiner(llmService, {
      maxProblems: 5,
      useAutocomplete: true
    });
    
    // 注册工具
    const mockSearchTool = new MockSearchTool();
    problemMiner.registerTool({
      getName: () => 'searchAutocomplete',
      getDescription: () => '搜索自动补全工具',
      getUsage: () => '用于获取搜索引擎的自动补全建议',
      getParameterDescriptions: () => ({ keyword: '搜索关键词', depth: '搜索深度' }),
      execute: mockSearchTool.execute.bind(mockSearchTool)
    });
    
    // 创建协调器
    const coordinator = new Coordinator({
      enableCritique: true,
      logLevel: 'info'
    });
    
    // 注册Agent
    coordinator.registerAgent(problemMiner);
    
    // 定义工作流
    const workflow: Workflow = {
      id: 'test-workflow',
      name: '测试工作流',
      description: '用于测试的简单工作流',
      nodes: [
        {
          id: 'start',
          agent: problemMiner,
          description: '开始节点'
        },
        {
          id: 'end',
          agent: problemMiner, // 简化测试，使用同一个Agent
          description: '结束节点'
        }
      ],
      edges: [
        {
          from: 'start',
          to: 'end',
          description: '从开始到结束'
        }
      ],
      startNodeId: 'start',
      endNodeId: 'end'
    };
    
    // 注册工作流
    coordinator.registerWorkflow(workflow);
    
    // 执行工作流
    const input: WorkflowInput = {
      keyword: '远程办公',
      options: {
        fast: true,
        maxProblems: 5
      }
    };
    
    console.log(`执行工作流: ${workflow.name}, 关键词: ${input.keyword}`);
    const result = await coordinator.executeWorkflow(workflow.id, input);
    
    // 验证结果
    console.log('\n测试结果:');
    console.log(`工作流执行${result.success ? '成功' : '失败'}`);
    console.log(`处理关键词: ${result.keyword}`);
    console.log(`执行时间: ${result.metrics?.executionTimeMs}ms`);
    
    // 直接测试Agent
    console.log('\n直接测试ProblemMiner:');
    const agentResult = await problemMiner.process({
      data: { keyword: '远程办公' },
      context: {
        workflowId: 'test',
        state: {
          input: { keyword: '远程办公' },
          currentNodeId: 'test',
          completedNodeIds: [],
          nodeOutputs: {},
          executionMetadata: {
            startTime: Date.now(),
            currentTime: Date.now(),
            errors: []
          }
        },
        sharedMemory: {},
        availableTools: ['searchAutocomplete']
      }
    });
    
    console.log(`Agent执行${agentResult.status === 'success' ? '成功' : '失败'}`);
    if (agentResult.status === 'success') {
      console.log(`发现问题数量: ${agentResult.data.problems.length}`);
      console.log('\n问题示例:');
      console.log(JSON.stringify(agentResult.data.problems[0], null, 2));
    } else {
      console.error(`失败原因: ${agentResult.error}`);
    }
    
    console.log("\n集成测试完成");
    return result.success;
  } catch (error) {
    console.error('集成测试失败:', error);
    return false;
  }
}

// 运行测试
runIntegrationTest()
  .then(success => {
    console.log(`集成测试${success ? '通过' : '失败'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('测试执行错误:', error);
    process.exit(1);
  }); 