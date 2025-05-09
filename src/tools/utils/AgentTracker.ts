/**
 * Agent Tracker - 用于监控和记录Agent的执行过程
 * 
 * 提供跟踪Agent整个生命周期的能力，包括：
 * - 输入数据
 * - 处理过程
 * - 输出结果
 * - LLM调用的参数和响应
 * - 性能指标
 */

import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import * as path from "path";
import { logger } from "../../infra/logger";

// 跟踪事件类型
export enum TrackEventType {
  AGENT_START = "agent_start",
  AGENT_END = "agent_end",
  LLM_CALL_START = "llm_call_start",
  LLM_CALL_END = "llm_call_end",
  TOOL_CALL = "tool_call",
  INTERMEDIATE_STEP = "intermediate_step",
  ERROR = "error"
}

// 跟踪事件接口
export interface TrackEvent {
  type: TrackEventType;
  timestamp: string;
  agentName: string;
  data: any;
  metadata?: Record<string, any>;
}

// Agent会话状态
interface AgentSession {
  agentName: string;
  sessionId: string;
  startTime: string;
  endTime?: string;
  input: any;
  output?: any;
  events: TrackEvent[];
  duration?: number;
  llmCalls: number;
  llmTokensUsed?: number;
  errors: any[];
}

// AgentTracker类
export class AgentTracker {
  private sessions: Map<string, AgentSession> = new Map();
  private outputDir: string;
  
  constructor(outputDir: string = "./logs/agent_tracker") {
    this.outputDir = outputDir;
    mkdirSync(outputDir, { recursive: true });
    logger.info(`AgentTracker initialized with output directory: ${outputDir}`);
  }
  
  /**
   * 开始跟踪Agent会话
   */
  startSession(agentName: string, input: any, sessionId?: string): string {
    const sid = sessionId || `${agentName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.sessions.set(sid, {
      agentName,
      sessionId: sid,
      startTime: new Date().toISOString(),
      input,
      events: [],
      llmCalls: 0,
      errors: []
    });
    
    this.trackEvent(sid, {
      type: TrackEventType.AGENT_START,
      timestamp: new Date().toISOString(),
      agentName,
      data: input
    });
    
    logger.debug(`Agent session started`, { agentName, sessionId: sid });
    return sid;
  }
  
  /**
   * 跟踪事件
   */
  trackEvent(sessionId: string, event: TrackEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Tried to track event for unknown session ${sessionId}`);
      return;
    }
    
    session.events.push(event);
    
    // 更新LLM调用计数
    if (event.type === TrackEventType.LLM_CALL_END) {
      session.llmCalls++;
      
      // 尝试提取token使用量
      if (event.data?.tokenUsage) {
        session.llmTokensUsed = (session.llmTokensUsed || 0) + 
          (event.data.tokenUsage.totalTokens || 
           event.data.tokenUsage.total_tokens || 
           event.data.tokenUsage.completion_tokens + event.data.tokenUsage.prompt_tokens || 0);
      }
    }
    
    // 记录错误
    if (event.type === TrackEventType.ERROR) {
      session.errors.push(event.data);
    }
  }
  
  /**
   * 跟踪LLM调用
   */
  trackLLMCall(sessionId: string, agentName: string, prompt: any, metadata?: Record<string, any>): void {
    this.trackEvent(sessionId, {
      type: TrackEventType.LLM_CALL_START,
      timestamp: new Date().toISOString(),
      agentName,
      data: { prompt },
      metadata
    });
  }
  
  /**
   * 跟踪LLM响应
   */
  trackLLMResponse(sessionId: string, agentName: string, prompt: any, response: any, tokenUsage?: any, metadata?: Record<string, any>): void {
    this.trackEvent(sessionId, {
      type: TrackEventType.LLM_CALL_END,
      timestamp: new Date().toISOString(),
      agentName,
      data: { prompt, response, tokenUsage },
      metadata
    });
  }
  
  /**
   * 跟踪工具调用
   */
  trackToolCall(sessionId: string, agentName: string, toolName: string, args: any, result: any, metadata?: Record<string, any>): void {
    this.trackEvent(sessionId, {
      type: TrackEventType.TOOL_CALL,
      timestamp: new Date().toISOString(),
      agentName,
      data: { toolName, args, result },
      metadata
    });
  }
  
  /**
   * 跟踪中间步骤
   */
  trackIntermediateStep(sessionId: string, agentName: string, step: string, data: any, metadata?: Record<string, any>): void {
    this.trackEvent(sessionId, {
      type: TrackEventType.INTERMEDIATE_STEP,
      timestamp: new Date().toISOString(),
      agentName,
      data: { step, data },
      metadata
    });
  }
  
  /**
   * 跟踪错误
   */
  trackError(sessionId: string, agentName: string, error: any, metadata?: Record<string, any>): void {
    this.trackEvent(sessionId, {
      type: TrackEventType.ERROR,
      timestamp: new Date().toISOString(),
      agentName,
      data: error,
      metadata
    });
  }
  
  /**
   * 结束会话并保存结果
   */
  endSession(sessionId: string, output: any): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Tried to end unknown session ${sessionId}`);
      throw new Error(`Unknown session ${sessionId}`);
    }
    
    // 更新会话信息
    session.endTime = new Date().toISOString();
    session.output = output;
    session.duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
    
    // 添加结束事件
    this.trackEvent(sessionId, {
      type: TrackEventType.AGENT_END,
      timestamp: session.endTime,
      agentName: session.agentName,
      data: output
    });
    
    // 保存会话记录
    this.saveSession(session);
    
    // 移除会话
    this.sessions.delete(sessionId);
    
    logger.debug(`Agent session ended`, { 
      agentName: session.agentName,
      sessionId, 
      duration: session.duration,
      llmCalls: session.llmCalls
    });
    
    return session;
  }
  
  /**
   * 保存会话数据到文件
   */
  private saveSession(session: AgentSession): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
      const fileName = `${session.agentName}_${timestamp}.json`;
      const filePath = path.join(this.outputDir, fileName);
      
      writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8');
      logger.info(`Agent session saved to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save agent session`, { error, sessionId: session.sessionId });
    }
  }
}

// 创建AgentTracker的LangChain工具包装器
const schema = z.object({
  action: z.enum(['startSession', 'trackEvent', 'trackLLMCall', 'trackLLMResponse', 'trackToolCall', 'trackIntermediateStep', 'trackError', 'endSession']),
  sessionId: z.string().optional(),
  agentName: z.string(),
  data: z.any(),
  metadata: z.record(z.any()).optional()
});

type AgentTrackerInput = z.infer<typeof schema>;

// 全局单例AgentTracker实例
const globalTracker = new AgentTracker();

class AgentTrackerTool extends StructuredTool<typeof schema> {
  name = "agent_tracker";
  description = "跟踪和记录Agent处理过程的工具。参数: { action, sessionId?, agentName, data, metadata? }";
  schema = schema;
  tracker: AgentTracker;

  constructor(tracker?: AgentTracker) {
    super();
    this.tracker = tracker || globalTracker;
  }

  async _call({ action, sessionId, agentName, data, metadata }: AgentTrackerInput): Promise<string> {
    try {
      switch (action) {
        case 'startSession':
          const sid = this.tracker.startSession(agentName, data, sessionId);
          return JSON.stringify({ success: true, sessionId: sid });
          
        case 'trackEvent':
          if (!sessionId) throw new Error('sessionId is required for trackEvent');
          this.tracker.trackEvent(sessionId, {
            type: data.type,
            timestamp: new Date().toISOString(),
            agentName,
            data: data.data,
            metadata
          });
          return JSON.stringify({ success: true });
          
        case 'trackLLMCall':
          if (!sessionId) throw new Error('sessionId is required for trackLLMCall');
          this.tracker.trackLLMCall(sessionId, agentName, data, metadata);
          return JSON.stringify({ success: true });
          
        case 'trackLLMResponse':
          if (!sessionId) throw new Error('sessionId is required for trackLLMResponse');
          this.tracker.trackLLMResponse(
            sessionId, 
            agentName, 
            data.prompt, 
            data.response, 
            data.tokenUsage, 
            metadata
          );
          return JSON.stringify({ success: true });
          
        case 'trackToolCall':
          if (!sessionId) throw new Error('sessionId is required for trackToolCall');
          this.tracker.trackToolCall(
            sessionId, 
            agentName, 
            data.toolName, 
            data.args, 
            data.result, 
            metadata
          );
          return JSON.stringify({ success: true });
          
        case 'trackIntermediateStep':
          if (!sessionId) throw new Error('sessionId is required for trackIntermediateStep');
          this.tracker.trackIntermediateStep(
            sessionId, 
            agentName, 
            data.step, 
            data.data, 
            metadata
          );
          return JSON.stringify({ success: true });
          
        case 'trackError':
          if (!sessionId) throw new Error('sessionId is required for trackError');
          this.tracker.trackError(sessionId, agentName, data, metadata);
          return JSON.stringify({ success: true });
          
        case 'endSession':
          if (!sessionId) throw new Error('sessionId is required for endSession');
          const result = this.tracker.endSession(sessionId, data);
          return JSON.stringify({ success: true, session: result.sessionId });
          
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message });
    }
  }
}

export const agentTrackerTool = new AgentTrackerTool();
export { globalTracker }; 