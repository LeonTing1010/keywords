/**
 * BaseAgent.ts - LangGraph Agent 基类
 * 所有特定Agent的共同基础类，提供基本功能和与LangGraph集成
 */
import { AgentAction, AgentFinish, AgentStep } from "langchain/agents";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { StructuredTool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { saveJsonTool } from "../../tools/utils/saveJsonTool";
import { generateMarkdownTool } from "../../tools/utils/generateMarkdownTool";
import { SearchTools } from "../../tools/search/SearchTools";
import { agentTrackerTool, globalTracker, TrackEventType } from "../../tools/utils/AgentTracker";
import { logger } from "../../infra/logger";
import { MultiSearchTools } from "../../tools/search/MultiSearchTools";
import { AgentLLMService } from "../../core/llm/AgentLLMService";

// 基础Agent配置类型
export interface BaseAgentConfig {
  verbose?: boolean;
  temperature?: number;
  modelName?: string;
  maxRetries?: number;
  apiKey?: string;
  apiBaseUrl?: string;
  trackExecution?: boolean; // 是否跟踪执行过程
}

/**
 * LangGraph Agent 基类
 * 提供所有Agent共有的基础功能
 */
export abstract class BaseAgent<S = any, R = any> {
  protected model: AgentLLMService;
  protected tools: StructuredTool[] = [];
  protected config: BaseAgentConfig;
  public name: string;
  protected sessionId?: string; // 当前会话ID
  protected isTracking: boolean; // 是否开启了追踪
  
  constructor(config: BaseAgentConfig = {}) {
    this.config = {
      verbose: false,
      temperature: 0.7,
      modelName: process.env.LLM_MODEL || "gpt-4",
      maxRetries: 3,
      apiKey: process.env.OPENAI_API_KEY,
      apiBaseUrl: process.env.LLM_BASE_URL,
      trackExecution: true, // 默认开启跟踪
      ...config
    };
  
    this.name = this.constructor.name;
    this.isTracking = this.config.trackExecution !== false;
    
    logger.debug({ 
      name: this.name, 
      isTracking: this.isTracking,
      modelName: this.config.modelName,
      temperature: this.config.temperature
    }, `Initializing ${this.name} agent`);
    
    // 初始化LLM模型 - 使用AgentLLMService
    this.model = new AgentLLMService({
      model: this.config.modelName,
      temperature: this.config.temperature,
      apiKey: this.config.apiKey,
      apiBaseUrl: this.config.apiBaseUrl,
      maxTokens: 4000,
      mockMode: false,
      enableCache: true
    });
    
    // 拦截模型调用以进行跟踪
    if (this.isTracking) {
      logger.debug({ name: this.name }, `Setting up model call interception for tracking`);
      this.interceptModelCalls();
    }
    
    // 注册通用工具
    this.registerTool(saveJsonTool);
    this.registerTool(generateMarkdownTool);
    this.registerTool(agentTrackerTool);
    const searchTools = new MultiSearchTools();
    this.registerTools(searchTools.getAllTools());
    logger.debug({ name: this.name, toolCount: this.tools.length }, `Registered common tools`);
    
    // 初始化子类工具
    this.setupTools();
    logger.debug({ name: this.name, toolCount: this.tools.length }, `Completed tools setup`);
  }
  
  /**
   * 拦截模型调用以进行跟踪
   */
  private interceptModelCalls() {
    const originalCall = this.model.invoke.bind(this.model);
    const agent = this;
    
    // 重写invoke方法以加入跟踪逻辑
    this.model.invoke = async function(input: any) {
      // 如果没有有效会话，不进行跟踪
      if (!agent.sessionId) {
        logger.debug({ name: agent.name }, `Model call without active session - skipping tracking`);
        return originalCall(input);
      }
      
      logger.debug({ 
        name: agent.name, 
        sessionId: agent.sessionId,
        inputType: typeof input,
        inputLength: JSON.stringify(input).length
      }, `Intercepted LLM call`);
      
      // 记录LLM调用
      globalTracker.trackLLMCall(
        agent.sessionId,
        agent.name,
        input,
        { modelName: agent.config.modelName, temperature: agent.config.temperature }
      );
      
      try {
        logger.debug({ name: agent.name, sessionId: agent.sessionId }, `Executing original LLM call`);
        // 执行原始调用
        const result = await originalCall(input);
        
        logger.debug({ 
          name: agent.name, 
          sessionId: agent.sessionId,
          responseType: typeof result,
          responseLength: JSON.stringify(result).length
        }, `LLM call completed successfully`);
        
        // 记录LLM响应
        globalTracker.trackLLMResponse(
          agent.sessionId,
          agent.name,
          input,
          result,
          { totalTokens: -1 } // 这里无法准确获取token数量
        );
        
        return result;
      } catch (error) {
        // 记录错误
        logger.debug({ 
          name: agent.name, 
          sessionId: agent.sessionId,
          error: String(error)
        }, `LLM call failed with error`);
        
        globalTracker.trackError(
          agent.sessionId,
          agent.name,
          error
        );
        throw error;
      }
    };
  }
  
  /**
   * 设置Agent所需的工具
   * 子类需要重写此方法
   */
  protected abstract setupTools(): void;
  
  /**
   * 执行Agent逻辑
   * 子类需要重写此方法，但应确保先调用startTracking和endTracking
   */
  public async execute(state: S, config?: RunnableConfig): Promise<R> {
    logger.debug({ 
      name: this.name, 
      isTracking: this.isTracking,
      stateType: typeof state,
      stateKeys: Object.keys(state as object || {})
    }, `Agent execution started`);
    
    // 开始跟踪
    if (this.isTracking) {
      this.startTracking(state);
    }
    
    try {
      logger.debug({ name: this.name, sessionId: this.sessionId }, `Calling executeImpl`);
      // 子类实现具体的执行逻辑
      const result = await this.executeImpl(state, config);
      
      logger.debug({ 
        name: this.name, 
        sessionId: this.sessionId,
        resultType: typeof result,
        resultKeys: typeof result === 'object' ? Object.keys(result || {}) : null
      }, `Agent execution completed successfully`);
      
      // 结束跟踪
      if (this.isTracking && this.sessionId) {
        this.endTracking(result);
      }
      
      return result;
    } catch (error) {
      // 记录错误
      logger.debug({ 
        name: this.name, 
        sessionId: this.sessionId,
        error: String(error)
      }, `Agent execution failed with error`);
      
      if (this.isTracking && this.sessionId) {
        globalTracker.trackError(this.sessionId, this.name, error);
        this.endTracking({ error: String(error) });
      }
      throw error;
    }
  }
  
  /**
   * 具体的执行实现
   * 子类需要重写此方法
   */
  protected abstract executeImpl(state: S, config?: RunnableConfig): Promise<R>;
  
  /**
   * 开始跟踪会话
   */
  protected startTracking(input: S): void {
    if (!this.isTracking) {
      logger.debug({ name: this.name }, `Tracking disabled, skipping startTracking`);
      return;
    }
    
    this.sessionId = globalTracker.startSession(this.name, input);
    logger.debug({ 
      name: this.name, 
      sessionId: this.sessionId,
      inputSize: JSON.stringify(input).length
    }, `Started tracking for ${this.name}`);
  }
  
  /**
   * 结束跟踪会话
   */
  protected endTracking(output: any): void {
    if (!this.isTracking || !this.sessionId) {
      logger.debug({ name: this.name }, `Tracking disabled or no sessionId, skipping endTracking`);
      return;
    }
    
    logger.debug({ 
      name: this.name, 
      sessionId: this.sessionId,
      outputSize: JSON.stringify(output).length
    }, `Ending tracking session`);
    
    globalTracker.endSession(this.sessionId, output);
    logger.debug({ name: this.name, sessionId: this.sessionId }, `Ended tracking for ${this.name}`);
    this.sessionId = undefined;
  }
  
  /**
   * 跟踪中间步骤
   */
  protected trackStep(step: string, data: any): void {
    if (!this.isTracking || !this.sessionId) {
      logger.debug({ name: this.name }, `Tracking disabled or no sessionId, skipping trackStep`);
      return;
    }
    
    logger.debug({ 
      name: this.name, 
      sessionId: this.sessionId,
      step,
      dataSize: JSON.stringify(data).length
    }, `Tracking intermediate step: ${step}`);
    
    globalTracker.trackIntermediateStep(this.sessionId, this.name, step, data);
  }
  
  /**
   * 跟踪工具调用
   */
  protected trackToolCall(toolName: string, args: any, result: any): void {
    if (!this.isTracking || !this.sessionId) {
      logger.debug({ name: this.name }, `Tracking disabled or no sessionId, skipping trackToolCall`);
      return;
    }
    
    logger.debug({ 
      name: this.name, 
      sessionId: this.sessionId,
      toolName,
      argsSize: JSON.stringify(args).length,
      resultSize: JSON.stringify(result).length
    }, `Tracking tool call: ${toolName}`);
    
    globalTracker.trackToolCall(this.sessionId, this.name, toolName, args, result);
  }
  
  /**
   * 获取Agent的名称
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * 获取Agent的工具列表
   */
  public getTools(): StructuredTool[] {
    return this.tools;
  }
  
  /**
   * 注册工具到Agent
   */
  protected registerTool(tool: StructuredTool): void {
    logger.debug({ name: this.name, toolName: tool.name }, `Registering tool: ${tool.name}`);
    this.tools.push(tool);
  }
  
  /**
   * 注册多个工具到Agent
   */
  protected registerTools(tools: StructuredTool[]): void {
    const toolNames = tools.map(t => t.name).join(', ');
    logger.debug({ name: this.name, toolCount: tools.length }, `Registering ${tools.length} tools: ${toolNames}`);
    this.tools.push(...tools);
  }
  
  /**
   * 创建StateGraph节点
   * 为LangGraph的状态图创建节点配置
   */
  public createGraphNode() {
    return async (state: S) => {
      logger.debug({ 
        name: this.name, 
        stateType: typeof state,
        stateKeys: Object.keys(state as object || {})
      }, `Graph node execution started`);
      
      try {
        const result = await this.execute(state);
        logger.debug({ 
          name: this.name, 
          resultType: typeof result,
          resultKeys: typeof result === 'object' ? Object.keys(result || {}) : null
        }, `Graph node execution completed successfully`);
        return result;
      } catch (error) {
        logger.debug({ name: this.name, error: String(error) }, `Graph node execution failed with error`);
        console.error(`Error in ${this.name}:`, error);
        throw error;
      }
    };
  }
} 