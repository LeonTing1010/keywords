/**
 * AgentTracking.ts - 应用级别的Agent追踪配置
 * 
 * 提供全局Agent跟踪的初始化和配置功能
 */
import { globalTracker } from "../../tools/utils/AgentTracker";
import { 
  instrumentAllAgents, 
  instrumentCustomAgent 
} from "../../tools/utils/AgentInstrumenter";
import { logger } from "../logger";

/**
 * 全局Agent跟踪配置
 */
export interface AgentTrackingConfig {
  enabled?: boolean;
  outputDirectory?: string;
  includeAllMethods?: boolean;
  trackLLMCalls?: boolean;
  trackToolCalls?: boolean;
}

/**
 * Agent跟踪管理器
 * 提供应用级别的Agent跟踪功能
 */
export class AgentTrackingManager {
  private static instance: AgentTrackingManager;
  private isInitialized: boolean = false;
  private isEnabled: boolean = true;
  
  /**
   * 获取单例实例
   */
  public static getInstance(): AgentTrackingManager {
    if (!AgentTrackingManager.instance) {
      AgentTrackingManager.instance = new AgentTrackingManager();
    }
    return AgentTrackingManager.instance;
  }
  
  /**
   * 初始化Agent跟踪
   * @param config 跟踪配置
   */
  public initialize(config: AgentTrackingConfig = {}): void {
    if (this.isInitialized) {
      logger.warn({}, "AgentTrackingManager already initialized");
      return;
    }
    
    this.isEnabled = config.enabled !== false;
    
    if (!this.isEnabled) {
      logger.info({}, "Agent tracking is disabled");
      return;
    }
    
    logger.info({}, "Initializing agent tracking subsystem");
    
    // 为所有继承自BaseAgent的Agent启用追踪
    instrumentAllAgents();
    
    // 如果指定了输出目录，更新全局跟踪器的输出目录
    if (config.outputDirectory) {
      globalTracker.setOutputDirectory(config.outputDirectory);
    }
    
    this.isInitialized = true;
    logger.info({}, "Agent tracking initialized successfully");
  }
  
  /**
   * 添加自定义Agent跟踪
   * @param agent 需要跟踪的自定义Agent实例
   */
  public trackCustomAgent(agent: any): string {
    if (!this.isEnabled) {
      return "tracking-disabled";
    }
    
    return instrumentCustomAgent(agent);
  }
  
  /**
   * 创建一个包含所有Agent执行的报告
   * @param startDate 开始日期
   * @param endDate 结束日期
   */
  public async generateExecutionReport(
    startDate: Date = new Date(0), 
    endDate: Date = new Date()
  ): Promise<any> {
    // 这个方法将在未来实现
    // 可以从日志文件读取数据并生成报告
    return {
      message: "Report generation not implemented yet",
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    };
  }
}

// 导出单例以便快速使用
export const agentTrackingManager = AgentTrackingManager.getInstance();

// 在模块加载时自动初始化
agentTrackingManager.initialize({
  enabled: process.env.AGENT_TRACKING_ENABLED !== "false",
  outputDirectory: process.env.AGENT_TRACKING_DIR
}); 