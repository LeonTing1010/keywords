/**
 * 测试AgentTracker功能的简单脚本
 * 创建会话、跟踪事件并结束会话，验证AgentTracker是否正常工作
 */
const fs = require('fs');
const path = require('path');
const { AgentTracker, TrackEventType } = require('../../src/tools/utils/AgentTracker');

// 初始化AgentTracker，使用特定的测试输出目录
const outputDir = path.join(__dirname, '../../logs/agent_tracker/test');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const tracker = new AgentTracker(outputDir);
console.log(`Agent Tracker initialized with output directory: ${outputDir}`);

// 开始会话
const agentName = 'TestAgent';
const sessionId = tracker.startSession(agentName, { testInput: 'Testing agent tracker' });
console.log(`Session started: ${sessionId}`);

// 记录LLM调用
tracker.trackLLMCall(
  sessionId,
  agentName, 
  { prompt: 'This is a test prompt' },
  { modelName: 'test-model', temperature: 0.7 }
);
console.log('LLM call recorded');

// 记录LLM响应
tracker.trackLLMResponse(
  sessionId,
  agentName,
  { prompt: 'This is a test prompt' },
  { response: 'This is a test response' },
  { totalTokens: 100 }
);
console.log('LLM response recorded');

// 记录工具调用
tracker.trackToolCall(
  sessionId,
  agentName,
  'test_tool',
  { param1: 'value1' },
  { result: 'success' }
);
console.log('Tool call recorded');

// 记录中间步骤
tracker.trackIntermediateStep(
  sessionId,
  agentName,
  'test_step',
  { stepData: 'This is step data' }
);
console.log('Intermediate step recorded');

// 记录错误
tracker.trackError(
  sessionId,
  agentName,
  { message: 'Test error' }
);
console.log('Error recorded');

// 结束会话
const sessionResult = tracker.endSession(sessionId, { testOutput: 'Testing completed' });
console.log('Session ended');

console.log('\nTest completed successfully. Check the output directory for the saved session.');
console.log(`File saved at: ${outputDir}/${agentName}_*.json`); 