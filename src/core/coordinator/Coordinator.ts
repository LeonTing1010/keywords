/**
 * Coordinator.ts - 协作协调器
 * 负责管理Agent之间的交互和工作流执行
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  AgentCritique, 
  AgentInput, 
  AgentOutput, 
  WorkflowAdjustment, 
  WorkflowInput, 
  WorkflowOutput, 
  WorkflowState
} from '../../types';
import { Agent } from '../../agents/base/Agent';

/**
 * 协调器配置选项
 */
export interface CoordinatorOptions {
  // 启用Agent间的相互质疑
  enableCritique?: boolean;
  // 默认质疑比例(0-1)，表示有多少Agent的输出会被随机质疑
  critiqueSamplingRate?: number;
  // 启用工作流动态调整
  enableDynamicRouting?: boolean;
  // 日志级别
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  // 最大执行时间(毫秒)
  maxExecutionTimeMs?: number;
  // 其他配置项
  [key: string]: any;
}

/**
 * 节点定义
 */
export interface Node {
  // 节点ID
  id: string;
  // 执行此节点的Agent
  agent: Agent;
  // 节点描述
  description?: string;
  // 是否为可选节点
  optional?: boolean;
  // 节点元数据
  metadata?: Record<string, any>;
}

/**
 * 边定义 - 定义节点之间的连接关系
 */
export interface Edge {
  // 来源节点ID
  from: string;
  // 目标节点ID
  to: string | ((state: WorkflowState) => string);
  // 边描述
  description?: string;
  // 条件函数(可选)，返回true时才沿着此边前进
  condition?: (state: WorkflowState) => boolean;
}

/**
 * 工作流定义
 */
export interface Workflow {
  // 工作流ID
  id: string;
  // 工作流名称
  name: string;
  // 工作流描述
  description?: string;
  // 节点列表
  nodes: Node[];
  // 边列表
  edges: Edge[];
  // 起始节点ID
  startNodeId: string;
  // 结束节点ID
  endNodeId: string;
  // 工作流元数据
  metadata?: Record<string, any>;
}

/**
 * 执行历史记录项
 */
interface ExecutionHistoryItem {
  // 节点ID
  nodeId: string;
  // 开始时间
  startTime: number;
  // 结束时间
  endTime?: number;
  // 输入摘要
  inputSummary?: Record<string, any>;
  // 输出摘要
  outputSummary?: Record<string, any>;
  // 是否执行成功
  success: boolean;
  // 可选的错误信息
  error?: string;
  // 质疑记录
  critiques?: {
    from: string;
    critique: AgentCritique;
    accepted: boolean;
  }[];
}

/**
 * 协调器类 - 负责工作流执行和Agent协作
 */
export class Coordinator {
  // 已注册的Agents
  private agents: Map<string, Agent> = new Map();
  // 已注册的工作流
  private workflows: Map<string, Workflow> = new Map();
  // 协调器配置
  private options: CoordinatorOptions;
  // 执行状态缓存
  private executionStates: Map<string, WorkflowState> = new Map();
  // 执行历史
  private executionHistory: Map<string, ExecutionHistoryItem[]> = new Map();

  /**
   * 构造函数
   * @param options 协调器配置选项
   */
  constructor(options: CoordinatorOptions = {}) {
    this.options = {
      enableCritique: true,
      critiqueSamplingRate: 0.3,
      enableDynamicRouting: true,
      logLevel: 'info',
      maxExecutionTimeMs: 5 * 60 * 1000, // 5分钟
      ...options
    };
  }

  /**
   * 注册单个Agent
   * @param agent Agent实例
   */
  registerAgent(agent: Agent): void {
    const metadata = agent.getMetadata();
    this.agents.set(metadata.name, agent);
    this.log('info', `Agent注册成功: ${metadata.name}`);
  }

  /**
   * 注册多个Agent
   * @param agents Agent实例数组
   */
  registerAgents(agents: Agent[]): void {
    for (const agent of agents) {
      this.registerAgent(agent);
    }
  }

  /**
   * 注册工作流
   * @param workflow 工作流定义
   */
  registerWorkflow(workflow: Workflow): void {
    // 验证工作流
    this.validateWorkflow(workflow);
    this.workflows.set(workflow.id, workflow);
    this.log('info', `工作流注册成功: ${workflow.name} (${workflow.id})`);
  }

  /**
   * 执行工作流
   * @param workflowId 要执行的工作流ID
   * @param input 工作流输入
   * @returns 工作流执行结果
   */
  async executeWorkflow(workflowId: string, input: WorkflowInput): Promise<WorkflowOutput> {
    // 检查工作流是否存在
    if (!this.workflows.has(workflowId)) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    const workflow = this.workflows.get(workflowId)!;
    const executionId = uuidv4();
    
    // 初始化执行状态
    const state: WorkflowState = {
      input,
      currentNodeId: workflow.startNodeId,
      completedNodeIds: [],
      nodeOutputs: {},
      executionMetadata: {
        startTime: Date.now(),
        currentTime: Date.now(),
        errors: []
      }
    };

    // 存储执行状态
    this.executionStates.set(executionId, state);
    this.executionHistory.set(executionId, []);

    this.log('info', `开始执行工作流: ${workflow.name} (${workflow.id}), 执行ID: ${executionId}`);

    try {
      // 执行工作流直到结束
      await this.runWorkflowUntilCompletion(executionId, workflow, state);

      // 构建输出
      const output = this.buildWorkflowOutput(executionId, workflow, state);
      
      this.log('info', `工作流执行完成: ${workflow.name} (${workflow.id}), 执行ID: ${executionId}`);
      return output;
    } catch (error) {
      // 处理执行错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('error', `工作流执行失败: ${workflow.name} (${workflow.id}), 执行ID: ${executionId}, 错误: ${errorMessage}`);
      
      return {
        success: false,
        keyword: input.keyword,
        error: errorMessage
      };
    } finally {
      // 清理执行状态
      // 注意: 在实际使用中，可能需要保留执行状态以供后续分析或恢复
      // this.executionStates.delete(executionId);
    }
  }

  /**
   * 获取执行历史
   * @param executionId 执行ID
   * @returns 执行历史记录
   */
  getExecutionHistory(executionId: string): ExecutionHistoryItem[] | undefined {
    return this.executionHistory.get(executionId);
  }

  /**
   * 获取执行状态
   * @param executionId 执行ID
   * @returns 执行状态
   */
  getExecutionState(executionId: string): WorkflowState | undefined {
    return this.executionStates.get(executionId);
  }

  /**
   * 处理Agent间质疑
   * @param executionId 执行ID
   * @param sourceAgentName 提出质疑的Agent名称
   * @param targetAgentName 被质疑的Agent名称
   * @param critique 质疑内容
   */
  async handleCritique(
    executionId: string,
    sourceAgentName: string,
    targetAgentName: string,
    critique: AgentCritique
  ): Promise<void> {
    // 获取相关Agent
    const sourceAgent = this.agents.get(sourceAgentName);
    const targetAgent = this.agents.get(targetAgentName);

    if (!sourceAgent || !targetAgent) {
      throw new Error(`处理质疑失败: Agent不存在`);
    }

    this.log('info', `质疑: ${sourceAgentName} -> ${targetAgentName}: ${critique.content}`);

    // 让目标Agent处理质疑
    const response = await targetAgent.handleCritique(critique);

    // 记录质疑结果
    const history = this.executionHistory.get(executionId);
    if (history) {
      // 找到目标Agent最近的执行记录
      const targetHistory = [...history]
        .reverse()
        .find(item => {
          const node = this.findNodeById(this.workflows.values(), item.nodeId);
          return node && node.agent.getMetadata().name === targetAgentName;
        });

      if (targetHistory) {
        if (!targetHistory.critiques) {
          targetHistory.critiques = [];
        }
        targetHistory.critiques.push({
          from: sourceAgentName,
          critique,
          accepted: response.accepted
        });
      }
    }

    this.log('info', `质疑响应: ${targetAgentName} ${response.accepted ? '接受' : '拒绝'} - ${response.content}`);

    // 如果被接受且有更新的输出，则更新输出
    if (response.accepted && response.updatedOutput) {
      // 更新状态
      const state = this.executionStates.get(executionId);
      if (state) {
        // 找到目标节点
        const targetNode = this.findNodeByAgentName(this.workflows.values(), targetAgentName);
        if (targetNode && state.nodeOutputs[targetNode.id]) {
          // 更新输出
          state.nodeOutputs[targetNode.id] = response.updatedOutput;
          this.log('info', `已更新 ${targetAgentName} 的输出`);
        }
      }
    }
  }

  /**
   * 动态调整工作流
   * @param executionId 执行ID
   * @param state 当前工作流状态
   * @returns 工作流调整建议
   */
  async adjustWorkflow(executionId: string, state: WorkflowState): Promise<WorkflowAdjustment> {
    if (!this.options.enableDynamicRouting) {
      return { adjusted: false };
    }

    // 基于当前状态进行简单的调整判断
    // 这里可以根据需要实现更复杂的策略
    
    // 示例: 如果某节点执行失败超过一定次数，则跳过
    const currentNodeErrors = state.executionMetadata.errors.filter(
      e => e.nodeId === state.currentNodeId
    );
    
    if (currentNodeErrors.length >= 3) {
      const workflow = this.findWorkflowByNodeId(state.currentNodeId);
      if (workflow) {
        // 找到下一个可能的节点
        const nextNodes = this.getNextNodes(workflow, state.currentNodeId);
        if (nextNodes.length > 0) {
          return {
            adjusted: true,
            type: 'skip',
            targetNodeId: nextNodes[0],
            reason: `节点 ${state.currentNodeId} 多次执行失败，跳过`
          };
        }
      }
    }

    // 示例: 如果处理时间过长，切换到快速路径
    const elapsedTime = Date.now() - state.executionMetadata.startTime;
    if (elapsedTime > this.options.maxExecutionTimeMs! * 0.7) {
      // 如果已经消耗了70%的最大执行时间，考虑切换到快速路径
      return {
        adjusted: true,
        type: 'redirect',
        targetNodeId: this.findFastPathNode(state),
        reason: '执行时间过长，切换到快速路径'
      };
    }

    return { adjusted: false };
  }

  // 内部私有方法

  /**
   * 执行工作流直到完成
   * @param executionId 执行ID
   * @param workflow 工作流定义
   * @param state 工作流状态
   */
  private async runWorkflowUntilCompletion(
    executionId: string,
    workflow: Workflow,
    state: WorkflowState
  ): Promise<void> {
    // 时间限制检查
    const startTime = state.executionMetadata.startTime;
    
    // 循环直到达到结束节点或超时
    while (state.currentNodeId !== workflow.endNodeId) {
      // 检查是否超时
      if (Date.now() - startTime > this.options.maxExecutionTimeMs!) {
        throw new Error('工作流执行超时');
      }

      // 更新当前时间
      state.executionMetadata.currentTime = Date.now();

      // 执行当前节点
      await this.executeNode(executionId, workflow, state);

      // 如果是结束节点，退出循环
      if (state.currentNodeId === workflow.endNodeId) {
        break;
      }

      // 寻找下一个节点
      const nextNodeId = await this.determineNextNode(workflow, state);
      if (!nextNodeId) {
        throw new Error(`无法确定下一个节点，当前节点: ${state.currentNodeId}`);
      }

      // 更新当前节点
      state.currentNodeId = nextNodeId;
    }
  }

  /**
   * 执行单个节点
   * @param executionId 执行ID
   * @param workflow 工作流定义
   * @param state 工作流状态
   */
  private async executeNode(
    executionId: string,
    workflow: Workflow,
    state: WorkflowState
  ): Promise<void> {
    // 如果是结束节点，不需要执行
    if (state.currentNodeId === workflow.endNodeId) {
      return;
    }

    // 查找当前节点定义
    const node = workflow.nodes.find(n => n.id === state.currentNodeId);
    if (!node) {
      throw new Error(`节点不存在: ${state.currentNodeId}`);
    }

    this.log('info', `开始执行节点: ${node.id}`);
    
    const historyItem: ExecutionHistoryItem = {
      nodeId: node.id,
      startTime: Date.now(),
      success: false
    };
    
    // 将历史项添加到执行历史
    const history = this.executionHistory.get(executionId) || [];
    history.push(historyItem);
    this.executionHistory.set(executionId, history);

    try {
      // 准备输入
      const input: AgentInput = {
        data: this.prepareNodeInput(workflow, state, node),
        context: {
          workflowId: workflow.id,
          state,
          sharedMemory: {},
          availableTools: []
        },
        options: state.input.options
      };

      // 记录输入摘要
      historyItem.inputSummary = this.createSummary(input.data);

      // 执行Agent
      const output = await node.agent.process(input);

      // 存储输出
      state.nodeOutputs[node.id] = output;
      
      // 更新已完成节点列表
      state.completedNodeIds.push(node.id);

      // 记录输出摘要
      historyItem.outputSummary = this.createSummary(output.data);
      historyItem.success = output.status === 'success';
      historyItem.endTime = Date.now();

      // 处理质疑(如果启用)
      if (this.options.enableCritique && output.status === 'success') {
        await this.processCritiques(executionId, workflow, node, output);
      }

      // 处理可能的工作流调整
      const adjustment = await this.adjustWorkflow(executionId, state);
      if (adjustment.adjusted) {
        this.log('info', `工作流调整: ${adjustment.type}, 原因: ${adjustment.reason}`);
        
        // 根据调整类型处理
        if (adjustment.type === 'skip' && adjustment.targetNodeId) {
          state.currentNodeId = adjustment.targetNodeId;
        } else if (adjustment.type === 'redirect' && adjustment.targetNodeId) {
          state.currentNodeId = adjustment.targetNodeId;
        } else if (adjustment.type === 'terminate') {
          state.currentNodeId = workflow.endNodeId;
        }
      }

      this.log('info', `节点执行完成: ${node.id}, 状态: ${output.status}`);
    } catch (error) {
      // 处理执行错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('error', `节点执行失败: ${node.id}, 错误: ${errorMessage}`);
      
      // 更新历史记录
      historyItem.success = false;
      historyItem.error = errorMessage;
      historyItem.endTime = Date.now();
      
      // 添加到错误列表
      state.executionMetadata.errors.push({
        nodeId: node.id,
        error: errorMessage
      });

      // 如果节点是可选的，可以继续执行
      if (node.optional) {
        this.log('warn', `可选节点 ${node.id} 执行失败，将继续工作流`);
      } else {
        // 非可选节点失败，抛出异常
        throw error;
      }
    }
  }

  /**
   * 处理其他Agent对某个节点输出的质疑
   * @param executionId 执行ID
   * @param workflow 工作流定义
   * @param node 被质疑的节点
   * @param output 节点输出
   */
  private async processCritiques(
    executionId: string,
    workflow: Workflow,
    node: Node,
    output: AgentOutput
  ): Promise<void> {
    const nodeAgentName = node.agent.getMetadata().name;
    
    // 随机选择一部分Agent进行质疑
    const otherAgents = workflow.nodes
      .filter(n => n.id !== node.id)
      .map(n => n.agent);
    
    // 随机抽样，根据critiqueSamplingRate决定抽样比例
    const sampledAgents = this.sampleAgents(
      otherAgents,
      this.options.critiqueSamplingRate!
    );

    for (const agent of sampledAgents) {
      const agentName = agent.getMetadata().name;
      this.log('debug', `请求 ${agentName} 对 ${nodeAgentName} 的输出进行质疑`);
      
      // 请求质疑
      const critique = await agent.critiquePeerOutput(nodeAgentName, output);
      
      // 如果有质疑，处理质疑
      if (critique) {
        await this.handleCritique(executionId, agentName, nodeAgentName, critique);
      }
    }
  }

  /**
   * 确定下一个节点
   * @param workflow 工作流定义
   * @param state 工作流状态
   * @returns 下一个节点ID
   */
  private async determineNextNode(workflow: Workflow, state: WorkflowState): Promise<string | undefined> {
    // 找到从当前节点出发的所有边
    const outgoingEdges = workflow.edges.filter(edge => edge.from === state.currentNodeId);
    
    if (outgoingEdges.length === 0) {
      this.log('warn', `节点 ${state.currentNodeId} 没有出边`);
      return undefined;
    }

    // 找到第一个条件为真的边，或者第一个没有条件的边
    for (const edge of outgoingEdges) {
      // 如果有条件，检查条件
      if (edge.condition && !edge.condition(state)) {
        continue;
      }

      // 获取目标节点ID
      let targetNodeId: string;
      if (typeof edge.to === 'function') {
        targetNodeId = edge.to(state);
      } else {
        targetNodeId = edge.to;
      }

      return targetNodeId;
    }

    // 没有找到有效的下一个节点
    return undefined;
  }

  /**
   * 准备节点的输入数据
   * @param workflow 工作流定义
   * @param state 工作流状态
   * @param node 当前节点
   * @returns 准备好的输入数据
   */
  private prepareNodeInput(workflow: Workflow, state: WorkflowState, node: Node): any {
    // 基础输入始终包含关键词
    const input: any = {
      keyword: state.input.keyword,
      options: state.input.options || {}
    };

    // 添加之前节点的输出
    const prevOutputs: Record<string, any> = {};
    
    // 找到当前节点的所有前置节点
    const precedingNodes = this.findPrecedingNodes(workflow, node.id);
    
    // 收集所有前置节点的输出
    for (const nodeId of precedingNodes) {
      if (state.nodeOutputs[nodeId]) {
        // 获取节点定义以获取节点名称
        const nodeDefinition = workflow.nodes.find(n => n.id === nodeId);
        if (nodeDefinition) {
          const agentName = nodeDefinition.agent.getMetadata().name;
          prevOutputs[agentName] = state.nodeOutputs[nodeId].data;
        }
      }
    }

    input.previousOutputs = prevOutputs;
    
    return input;
  }

  /**
   * 查找某个节点的所有前置节点
   * @param workflow 工作流定义
   * @param nodeId 节点ID
   * @returns 前置节点ID列表
   */
  private findPrecedingNodes(workflow: Workflow, nodeId: string): string[] {
    const precedingNodes: string[] = [];
    
    // 查找直接指向该节点的边
    const incomingEdges = workflow.edges.filter(edge => {
      // 如果是函数，无法确定，将被排除
      if (typeof edge.to === 'function') {
        return false;
      }
      return edge.to === nodeId;
    });
    
    // 收集所有前置节点
    for (const edge of incomingEdges) {
      precedingNodes.push(edge.from);
      
      // 递归查找更前面的节点
      const morePrecedingNodes = this.findPrecedingNodes(workflow, edge.from);
      precedingNodes.push(...morePrecedingNodes);
    }
    
    // 去重
    return [...new Set(precedingNodes)];
  }

  /**
   * 构建工作流输出
   * @param executionId 执行ID
   * @param workflow 工作流定义
   * @param state 工作流状态
   * @returns 工作流输出
   */
  private buildWorkflowOutput(
    executionId: string,
    workflow: Workflow,
    state: WorkflowState
  ): WorkflowOutput {
    // 计算执行时间
    const executionTimeMs = Date.now() - state.executionMetadata.startTime;
    
    // 基础输出
    const output: WorkflowOutput = {
      success: true,
      keyword: state.input.keyword,
      metrics: {
        executionTimeMs,
        processedProblems: 0,
        valuableProblems: 0
      }
    };

    // 从各个Agent输出中收集问题信息
    // 实际应用中，这里需要根据具体业务逻辑处理
    
    return output;
  }

  /**
   * 验证工作流定义的有效性
   * @param workflow 工作流定义
   */
  private validateWorkflow(workflow: Workflow): void {
    // 检查节点是否都注册了对应的Agent
    for (const node of workflow.nodes) {
      const metadata = node.agent.getMetadata();
      if (!this.agents.has(metadata.name)) {
        throw new Error(`工作流 ${workflow.id} 使用了未注册的Agent: ${metadata.name}`);
      }
    }
    
    // 检查起始和结束节点是否存在
    const hasStartNode = workflow.nodes.some(node => node.id === workflow.startNodeId);
    const hasEndNode = workflow.nodes.some(node => node.id === workflow.endNodeId);
    
    if (!hasStartNode) {
      throw new Error(`工作流 ${workflow.id} 缺少起始节点: ${workflow.startNodeId}`);
    }
    
    if (!hasEndNode) {
      throw new Error(`工作流 ${workflow.id} 缺少结束节点: ${workflow.endNodeId}`);
    }
    
    // 检查是否每个节点都有路径可达
    // 这里简化处理，只检查非结束节点是否有出边
    for (const node of workflow.nodes) {
      if (node.id !== workflow.endNodeId) {
        const hasOutgoingEdge = workflow.edges.some(edge => edge.from === node.id);
        if (!hasOutgoingEdge && !node.optional) {
          throw new Error(`工作流 ${workflow.id} 中的节点 ${node.id} 没有出边`);
        }
      }
    }
  }

  /**
   * 查找指定名称的Agent所在的节点
   * @param workflows 工作流迭代器
   * @param agentName Agent名称
   * @returns 找到的节点或undefined
   */
  private findNodeByAgentName(workflows: IterableIterator<Workflow>, agentName: string): Node | undefined {
    for (const workflow of workflows) {
      for (const node of workflow.nodes) {
        if (node.agent.getMetadata().name === agentName) {
          return node;
        }
      }
    }
    return undefined;
  }

  /**
   * 通过节点ID查找节点
   * @param workflows 工作流迭代器
   * @param nodeId 节点ID
   * @returns 找到的节点或undefined
   */
  private findNodeById(workflows: IterableIterator<Workflow>, nodeId: string): Node | undefined {
    for (const workflow of workflows) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (node) {
        return node;
      }
    }
    return undefined;
  }

  /**
   * 查找包含指定节点的工作流
   * @param nodeId 节点ID
   * @returns 工作流或undefined
   */
  private findWorkflowByNodeId(nodeId: string): Workflow | undefined {
    for (const workflow of this.workflows.values()) {
      if (workflow.nodes.some(node => node.id === nodeId)) {
        return workflow;
      }
    }
    return undefined;
  }

  /**
   * 获取指定节点的下一个可能节点列表
   * @param workflow 工作流
   * @param nodeId 当前节点ID
   * @returns 下一个可能节点ID列表
   */
  private getNextNodes(workflow: Workflow, nodeId: string): string[] {
    const nextNodes: string[] = [];
    
    // 找到所有从当前节点出发的边
    for (const edge of workflow.edges) {
      if (edge.from === nodeId) {
        if (typeof edge.to === 'string') {
          nextNodes.push(edge.to);
        }
        // 如果是函数，无法确定目标节点
      }
    }
    
    return nextNodes;
  }

  /**
   * 在紧急情况下找到快速路径节点
   * 这是一个简化的实现，实际应用中需要基于业务逻辑设计更合理的快速路径
   * @param state 当前工作流状态
   * @returns 快速路径节点ID或undefined
   */
  private findFastPathNode(state: WorkflowState): string | undefined {
    const workflow = this.findWorkflowByNodeId(state.currentNodeId);
    if (!workflow) {
      return undefined;
    }
    
    // 简单策略: 直接跳到倒数第二个节点
    // 假设倒数第二个节点是必要的总结节点
    const sortedNodes = [...workflow.nodes]
      .filter(node => node.id !== workflow.endNodeId) // 排除结束节点
      .sort((a, b) => {
        // 尝试通过边的连接关系确定顺序
        const aDistance = this.estimateDistanceToEnd(workflow, a.id);
        const bDistance = this.estimateDistanceToEnd(workflow, b.id);
        return aDistance - bDistance;
      });
    
    // 如果只有一个节点，或者当前已经是最后节点，则返回undefined
    if (
      sortedNodes.length <= 1 ||
      sortedNodes[sortedNodes.length - 1].id === state.currentNodeId
    ) {
      return undefined;
    }
    
    // 返回倒数第二个节点
    return sortedNodes[sortedNodes.length - 2].id;
  }

  /**
   * 估算节点到结束节点的距离
   * @param workflow 工作流
   * @param nodeId 节点ID
   * @returns 预估距离
   */
  private estimateDistanceToEnd(workflow: Workflow, nodeId: string): number {
    if (nodeId === workflow.endNodeId) {
      return 0;
    }
    
    // 使用BFS计算距离
    const queue: [string, number][] = [[nodeId, 0]]; // [节点ID, 距离]
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const [currentId, distance] = queue.shift()!;
      
      if (currentId === workflow.endNodeId) {
        return distance;
      }
      
      if (visited.has(currentId)) {
        continue;
      }
      
      visited.add(currentId);
      
      // 找到所有从当前节点出发的边
      for (const edge of workflow.edges) {
        if (edge.from === currentId) {
          if (typeof edge.to === 'string') {
            queue.push([edge.to, distance + 1]);
          }
        }
      }
    }
    
    // 如果无法到达结束节点，返回一个很大的值
    return Number.MAX_SAFE_INTEGER;
  }

  /**
   * 随机抽样一部分Agent
   * @param agents Agent列表
   * @param samplingRate 抽样比例(0-1)
   * @returns 抽样后的Agent列表
   */
  private sampleAgents(agents: Agent[], samplingRate: number): Agent[] {
    // 如果比例为1，返回所有
    if (samplingRate >= 1) {
      return [...agents];
    }
    
    // 如果比例为0，返回空数组
    if (samplingRate <= 0) {
      return [];
    }
    
    // 计算需要抽样的数量
    const sampleCount = Math.max(1, Math.round(agents.length * samplingRate));
    
    // 随机抽样
    const shuffled = [...agents].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, sampleCount);
  }

  /**
   * 创建对象摘要
   * 用于记录日志时，避免记录过大的对象
   * @param data 要摘要的对象
   * @returns 摘要对象
   */
  private createSummary(data: any): Record<string, any> {
    if (!data) {
      return { type: 'null' };
    }
    
    if (typeof data !== 'object') {
      return { type: typeof data, value: String(data).substring(0, 100) };
    }
    
    // 如果是数组，返回长度和前几个元素
    if (Array.isArray(data)) {
      return {
        type: 'array',
        length: data.length,
        sample: data.slice(0, 3).map(item => {
          if (typeof item === 'object') {
            return { type: 'object' };
          }
          return item;
        })
      };
    }
    
    // 如果是对象，返回键列表和少量值
    const keys = Object.keys(data);
    const summary: Record<string, any> = {
      type: 'object',
      keys: keys
    };
    
    // 添加少量键值作为样本
    if (keys.length > 0) {
      summary.sample = {};
      const sampleKeys = keys.slice(0, 3);
      for (const key of sampleKeys) {
        const value = data[key];
        if (typeof value === 'object') {
          summary.sample[key] = { type: 'object' };
        } else {
          summary.sample[key] = value;
        }
      }
    }
    
    return summary;
  }

  /**
   * 记录日志
   * @param level 日志级别
   * @param message 日志消息
   * @param data 可选的附加数据
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    // 如果日志级别设置为none，或者当前级别低于配置级别，则不记录
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
    if (
      this.options.logLevel === 'none' ||
      logLevels[level] < logLevels[this.options.logLevel!]
    ) {
      return;
    }
    
    // 简单的控制台日志实现
    // 实际应用中应该使用专门的日志库
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    const timestamp = new Date().toISOString();
    
    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG] ${message}${logData}`);
        break;
      case 'info':
        console.info(`[${timestamp}] [INFO] ${message}${logData}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}${logData}`);
        break;
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}${logData}`);
        break;
    }
  }
} 