/**
 * AgentInstrumenter.ts - 自动为所有Agent添加追踪功能
 * 
 * 提供自动查找和包装所有Agent方法的功能，确保全面跟踪执行过程
 */

import { BaseAgent } from "../../agents/base/BaseAgent";
import { EnhancedBaseAgent } from "../../agents/base/EnhancedBaseAgent";
import { globalTracker } from "./AgentTracker";
import { logger } from "../../infra/logger";

/**
 * 可追踪方法的配置
 */
interface MethodConfig {
  methodNames: string[];  // 需要追踪的方法名
  includeInherited?: boolean;  // 是否包括继承的方法
}

/**
 * 为每种类型的Agent提供默认跟踪的方法
 */
const DEFAULT_TRACKED_METHODS: Record<string, MethodConfig> = {
  // BaseAgent 类通用跟踪方法
  "BaseAgent": {
    methodNames: [
      "execute", 
      "executeImpl",
      "setupTools",
      "createGraphNode"
    ],
    includeInherited: true
  },
  
  // EnhancedBaseAgent 类通用跟踪方法
  "EnhancedBaseAgent": {
    methodNames: [
      "execute",
      "createGraphNode"
    ],
    includeInherited: true
  },
  
  // 特定的Agent类型追踪方法 - Discovery相关
  "MarketNeedExplorerAgent": {
    methodNames: [
      "process",
      "discoverHighValueProblems",
      "extractAndExpandQuestions",
      "getAutocompleteSuggestions",
      "performWebSearch"
    ]
  },
  
  "UserJourneySimulatorAgent": {
    methodNames: [
      "process",
      "simulateUserJourney",
      "simulateUserSearch",
      "simulateUserDecision"
    ]
  },
  
  "OpportunityStrategistAgent": {
    methodNames: [
      "process",
      "identifyOpportunities",
      "evaluateOpportunitySize",
      "prioritizeOpportunities"
    ]
  },
  
  "SolutionEvaluatorAgent": {
    methodNames: [
      "process",
      "evaluateSolutions",
      "simulateImplementation",
      "predictUserSatisfaction"
    ]
  }
};

/**
 * Agent自动插桩工具
 * 自动为Agent添加跟踪功能
 */
export class AgentInstrumenter {
  /**
   * 为单个Agent实例添加跟踪
   * @param agent Agent实例
   * @param methodNames 可选的手动指定方法名，否则使用默认方法
   * @param sessionId 可选的会话ID
   */
  public static instrumentAgent(
    agent: BaseAgent | EnhancedBaseAgent | any,
    methodNames?: string[],
    sessionId?: string
  ): string {
    const agentName = agent.constructor.name;
    
    // 确定要跟踪的方法
    let methodsToTrack: string[];
    
    if (methodNames && methodNames.length > 0) {
      // 使用手动指定的方法名
      methodsToTrack = methodNames;
    } else {
      // 使用默认配置，如果有
      const config = DEFAULT_TRACKED_METHODS[agentName];
      
      if (config) {
        methodsToTrack = config.methodNames;
        
        // 如果需要包括继承的方法，获取所有可枚举的方法
        if (config.includeInherited) {
          const allMethods = AgentInstrumenter.getAllMethodNames(agent);
          methodsToTrack = [...new Set([...methodsToTrack, ...allMethods])];
        }
      } else {
        // 没有默认配置，获取所有方法
        methodsToTrack = AgentInstrumenter.getAllMethodNames(agent);
      }
    }
    
    // 过滤掉不需要跟踪的内部方法
    methodsToTrack = methodsToTrack.filter(name => 
      name !== 'constructor' && 
      name !== 'toString' && 
      !name.startsWith('_') &&
      typeof agent[name] === 'function'
    );
    
    logger.debug(
      { agentName, methods: methodsToTrack.length }, 
      `Instrumenting agent ${agentName} with ${methodsToTrack.length} methods`
    );
    
    // 使用AgentTracker包装方法
    return globalTracker.wrapAgentMethods(agent, methodsToTrack, sessionId);
  }
  
  /**
   * 获取对象的所有方法名
   * @param obj 目标对象
   */
  private static getAllMethodNames(obj: any): string[] {
    let methods: string[] = [];
    let currentObj = obj;
    
    // 遍历原型链
    while (currentObj && currentObj !== Object.prototype) {
      const props = Object.getOwnPropertyNames(currentObj);
      
      // 过滤出方法名
      for (const prop of props) {
        if (typeof obj[prop] === 'function') {
          methods.push(prop);
        }
      }
      
      // 移动到原型
      currentObj = Object.getPrototypeOf(currentObj);
    }
    
    return [...new Set(methods)]; // 去重
  }
  
  /**
   * 应用给定类型的所有实例的插桩
   * 这可以在应用启动时调用，以确保所有Agent都被跟踪
   */
  public static instrumentAllAgents(): void {
    logger.info({}, "Auto-instrumenting all agents in the system");
    
    // 不做任何事情，因为BaseAgent类已经内置了跟踪功能
    // 这个方法只是作为一个入口点，可以在系统启动时调用
    logger.info(
      {}, 
      "All agents using BaseAgent are already instrumented via inheritance"
    );
  }
  
  /**
   * 为不继承自BaseAgent的代理类添加追踪
   * @param agentInstance 代理实例
   */
  public static instrumentCustomAgent(agentInstance: any): string {
    if (!agentInstance) {
      throw new Error("Agent instance is required");
    }
    
    const agentName = agentInstance.constructor.name;
    logger.info({ agentName }, `Instrumenting custom agent: ${agentName}`);
    
    // 从所有方法中获取可能的执行方法
    const allMethods = AgentInstrumenter.getAllMethodNames(agentInstance);
    const executionMethods = allMethods.filter(m => 
      m.includes('execute') || 
      m.includes('process') || 
      m.includes('run') ||
      m.includes('perform') ||
      m.includes('handle')
    );
    
    // 使用运行方法和所有自定义方法
    return AgentInstrumenter.instrumentAgent(agentInstance, executionMethods);
  }
  
  /**
   * 生成一个agent.run()调用的包装器
   * 这对于快速包装单次Agent调用非常有用
   */
  public static wrapAgentRun<T, R>(
    agentInstance: any, 
    runMethod: string = 'execute'
  ): (input: T) => Promise<R> {
    return async (input: T): Promise<R> => {
      const agentName = agentInstance.constructor.name;
      const sessionId = globalTracker.startSession(agentName, input);
      
      try {
        globalTracker.trackMethodCall(
          sessionId, 
          agentName, 
          runMethod, 
          [input]
        );
        
        const result = await agentInstance[runMethod](input);
        
        globalTracker.endSession(sessionId, result);
        return result;
      } catch (error) {
        globalTracker.trackError(sessionId, agentName, error);
        globalTracker.endSession(sessionId, { error: String(error) });
        throw error;
      }
    };
  }
}

// 导出单例版本以便快速使用
export const instrumentAgent = AgentInstrumenter.instrumentAgent;
export const instrumentAllAgents = AgentInstrumenter.instrumentAllAgents;
export const instrumentCustomAgent = AgentInstrumenter.instrumentCustomAgent;
export const wrapAgentRun = AgentInstrumenter.wrapAgentRun; 