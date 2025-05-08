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

// 基础Agent配置类型
export interface BaseAgentConfig {
  verbose?: boolean;
  temperature?: number;
  modelName?: string;
  maxRetries?: number;
  apiKey?: string;
  apiBaseUrl?: string;
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
  
  constructor(config: BaseAgentConfig = {}) {
    this.config = {
      verbose: false,
      temperature: 0.7,
      modelName: process.env.LLM_MODEL || "gpt-4",
      maxRetries: 3,
      apiKey: process.env.OPENAI_API_KEY,
      apiBaseUrl: process.env.LLM_BASE_URL,
      ...config
    };
    
    this.name = this.constructor.name;
    
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
      // Some versions use different property names
      modelConfig.apiUrl = this.config.apiBaseUrl;
    }
    
    this.model = new ChatOpenAI(modelConfig);
    
    // 初始化工具
    this.setupTools();
  }
  
  /**
   * 设置Agent所需的工具
   * 子类需要重写此方法
   */
  protected abstract setupTools(): void;
  
  /**
   * 执行Agent逻辑
   * 子类需要重写此方法
   */
  public abstract execute(state: S, config?: RunnableConfig): Promise<R>;
  
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