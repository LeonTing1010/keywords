/**
 * BaseAgent.ts - LangGraph Agent 基类
 * 所有特定Agent的共同基础类，提供基本功能和与LangGraph集成
 */
import { ChatOpenAI } from "@langchain/openai";
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
  protected model: BaseChatModel;
  protected tools: StructuredTool[] = [];
  protected config: BaseAgentConfig;
  protected name: string;
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
    
    // 初始化LLM模型 - 使用基本配置
    const modelConfig: any = {
      modelName: this.config.modelName,
      temperature: this.config.temperature,
      openAIApiKey: this.config.apiKey,
      verbose: this.config.verbose,
      maxRetries: this.config.maxRetries,
    };
    
    // 如果有自定义API URL，以兼容不同版本的方式添加
    if (this.config.apiBaseUrl) {
      modelConfig.endpoint = this.config.apiBaseUrl;
      modelConfig.apiUrl = this.config.apiBaseUrl;
      modelConfig.baseUrl = this.config.apiBaseUrl;
      modelConfig.basePath = this.config.apiBaseUrl;
      modelConfig.openAIApiBase = this.config.apiBaseUrl;
    }
    
    this.model = new ChatOpenAI(modelConfig);
    
    // 拦截模型调用以进行跟踪
    if (this.isTracking) {
      this.interceptModelCalls();
    }
    
    // 注册通用工具
    this.registerTool(saveJsonTool);
    this.registerTool(generateMarkdownTool);
    this.registerTool(agentTrackerTool);
    const searchTools = new SearchTools();
    this.registerTools(searchTools.getAllTools());
    
    // 初始化子类工具
    this.setupTools();
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
        return originalCall(input);
      }
      
      // 记录LLM调用
      globalTracker.trackLLMCall(
        agent.sessionId,
        agent.name,
        input,
        { modelName: agent.config.modelName, temperature: agent.config.temperature }
      );
      
      try {
        // 执行原始调用
        const result = await originalCall(input);
        
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
    // 开始跟踪
    if (this.isTracking) {
      this.startTracking(state);
    }
    
    try {
      // 子类实现具体的执行逻辑
      const result = await this.executeImpl(state, config);
      
      // 结束跟踪
      if (this.isTracking && this.sessionId) {
        this.endTracking(result);
      }
      
      return result;
    } catch (error) {
      // 记录错误
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
    if (!this.isTracking) return;
    
    this.sessionId = globalTracker.startSession(this.name, input);
    logger.debug(`Started tracking for ${this.name}`, { sessionId: this.sessionId });
  }
  
  /**
   * 结束跟踪会话
   */
  protected endTracking(output: any): void {
    if (!this.isTracking || !this.sessionId) return;
    
    globalTracker.endSession(this.sessionId, output);
    logger.debug(`Ended tracking for ${this.name}`, { sessionId: this.sessionId });
    this.sessionId = undefined;
  }
  
  /**
   * 跟踪中间步骤
   */
  protected trackStep(step: string, data: any): void {
    if (!this.isTracking || !this.sessionId) return;
    
    globalTracker.trackIntermediateStep(this.sessionId, this.name, step, data);
  }
  
  /**
   * 跟踪工具调用
   */
  protected trackToolCall(toolName: string, args: any, result: any): void {
    if (!this.isTracking || !this.sessionId) return;
    
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
    this.tools.push(tool);
  }
  
  /**
   * 注册多个工具到Agent
   */
  protected registerTools(tools: StructuredTool[]): void {
    this.tools.push(...tools);
  }
  
  /**
   * 创建StateGraph节点
   * 为LangGraph的状态图创建节点配置
   */
  public createGraphNode() {
    return async (state: S) => {
      try {
        const result = await this.execute(state);
        return result;
      } catch (error) {
        console.error(`Error in ${this.name}:`, error);
        throw error;
      }
    };
  }
} 