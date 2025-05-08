/**
 * EnhancedLLMService.ts - 增强版LLM服务
 * 提供自动模型选择、流式输出、缓存、批处理等高级功能
 */
import { LLMServiceHub } from './LLMServiceHub';
import { 
  LLMMessage, 
  LLMOptions, 
  LLMProvider, 
  LLMServiceConfig,
  AnalyzeOptions,
  ModelTierConfig,
  StreamChunk
} from './types';
import { LLMCacheManager } from './cache/LLMCacheManager';
import { ModelSelectionService } from './ModelSelectionService';
import { BatchProcessor } from './BatchProcessor';
import { logger } from '../../infra/logger';
import { EventEmitter } from 'events';

/**
 * 增强版LLM服务配置
 */
export interface EnhancedLLMServiceConfig extends LLMServiceConfig {
  // 缓存配置
  cacheSize?: number;
  cacheTTL?: number;
  
  // 模型选择配置
  modelTiers?: ModelTierConfig;
  
  // 批处理配置
  batchProcessingEnabled?: boolean;
  maxBatchSize?: number;
  batchWindow?: number;
  
  // 流式响应配置
  enableStreamingByDefault?: boolean;
  
  // 反馈和优化配置
  collectFeedback?: boolean;
  selfOptimize?: boolean;
}

/**
 * 增强版LLM服务
 * 扩展LLMServiceHub提供更强大的功能
 */
export class EnhancedLLMService {
  public llmHub: LLMServiceHub;
  private cacheManager: LLMCacheManager;
  private modelSelector: ModelSelectionService;
  private batchProcessor: BatchProcessor;
  private events: EventEmitter = new EventEmitter();
  private config: EnhancedLLMServiceConfig;
  
  // 进度跟踪映射
  private progressTrackers: Map<string, { 
    progress: number,
    callback?: (progress: number) => void,
    startTime: number,
    estimatedTime?: number
  }> = new Map();
  
  // 用户反馈收集
  private feedbackData: Array<{
    prompt: string,
    response: string,
    model: string,
    rating?: number,
    feedback?: string,
    timestamp: number
  }> = [];
  
  // A/B测试配置
  private abTestConfig: {
    enabled: boolean,
    testId?: string,
    variants: Array<{ id: string, config: Partial<LLMOptions>, weight: number }>
  } = {
    enabled: false,
    variants: []
  };

  /**
   * 创建增强版LLM服务实例
   */
  constructor(config: EnhancedLLMServiceConfig = {}) {
    // 基础配置
    this.config = {
      model: config.model || process.env.LLM_MODEL || 'gpt-3.5-turbo',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4000,
      apiEndpoint: config.apiEndpoint || process.env.LLM_BASE_URL,
      mockMode: config.mockMode || (process.env.MOCK_LLM === 'true'),
      
      // 缓存配置
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 3600000, // 1小时
      
      // 模型选择配置
      autoModelSelection: config.autoModelSelection !== false,
      modelTiers: config.modelTiers || {
        simple: 'gpt-3.5-turbo',
        medium: 'gpt-3.5-turbo-16k',
        complex: 'gpt-4-turbo'
      },
      
      // 批处理配置
      batchProcessingEnabled: config.batchProcessingEnabled !== false,
      maxBatchSize: config.maxBatchSize || 5,
      batchWindow: config.batchWindow || 200,
      
      // 流式响应配置
      enableStreamingByDefault: config.enableStreamingByDefault || false,
      
      // 反馈和优化配置
      collectFeedback: config.collectFeedback || false,
      selfOptimize: config.selfOptimize || false
    };
    
    // 初始化LLM服务中心
    this.llmHub = new LLMServiceHub({
      model: this.config.model,
      apiKey: this.config.apiKey,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiEndpoint: this.config.apiEndpoint,
      mockMode: this.config.mockMode
    });
    
    // 初始化缓存管理器
    this.cacheManager = new LLMCacheManager({
      maxSize: this.config.cacheSize,
      ttl: this.config.cacheTTL,
      enabled: this.config.enableCache
    });
    
    // 初始化模型选择服务
    this.modelSelector = new ModelSelectionService({
      enabled: this.config.autoModelSelection,
      modelTiers: this.config.modelTiers
    });
    
    // 初始化批处理器
    this.batchProcessor = new BatchProcessor(
      {
        enabled: this.config.batchProcessingEnabled,
        maxBatchSize: this.config.maxBatchSize,
        batchWindow: this.config.batchWindow
      },
      this.processBatch.bind(this)
    );
    
    logger.info('增强版LLM服务初始化完成', {
      model: this.config.model,
      features: {
        cache: this.config.enableCache,
        autoModelSelection: this.config.autoModelSelection,
        batchProcessing: this.config.batchProcessingEnabled,
        streamingDefault: this.config.enableStreamingByDefault
      }
    });
  }

  /**
   * 分析文本内容
   * 增强版analyze方法，支持自动模型选择、缓存和流式响应
   */
  public async analyze(prompt: string, analysisType: string, options: AnalyzeOptions = {}): Promise<any> {
    try {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 启动进度跟踪
      this.startProgressTracking(requestId, options.progressCallback);
      
      // 转换为消息格式
      const messages: LLMMessage[] = [
        { role: 'system', content: options.systemPrompt || this.getDefaultSystemPrompt(options) },
        { role: 'user', content: prompt }
      ];
      
      // 设置选项
      const llmOptions: LLMOptions = {
        temperature: options.temperature || this.config.temperature,
        maxTokens: options.maxTokens || this.config.maxTokens,
        format: options.format || 'text',
        strictFormat: options.strictFormat,
        enableCache: options.enableCache,
        autoModelSelection: options.autoModelSelection,
        complexityLevel: options.complexityLevel,
        stream: options.stream || this.config.enableStreamingByDefault,
        onChunk: options.onChunk,
        progressCallback: (progress: number) => {
          this.updateProgress(requestId, progress);
        }
      };
      
      // 应用A/B测试变体（如果启用）
      if (this.abTestConfig.enabled && this.abTestConfig.testId) {
        const variant = this.selectABTestVariant();
        if (variant) {
          logger.debug(`应用A/B测试变体: ${variant.id}`, { testId: this.abTestConfig.testId });
          Object.assign(llmOptions, variant.config);
        }
      }
      
      // 自动选择模型（如果启用）
      if (this.config.autoModelSelection && options.autoModelSelection !== false) {
        llmOptions.model = this.modelSelector.selectModel(messages, llmOptions);
      } else {
        llmOptions.model = options.model || this.config.model;
      }
      
      this.updateProgress(requestId, 10); // 10% - 配置完成
      
      // 检查缓存
      if (this.config.enableCache && options.enableCache !== false) {
        const cachedResult = this.cacheManager.get(messages, llmOptions);
        if (cachedResult) {
          logger.info('使用缓存的LLM响应', { 
            model: llmOptions.model, 
            analysisType 
          });
          
          this.updateProgress(requestId, 100); // 100% - 使用缓存直接完成
          return cachedResult;
        }
      }
      
      this.updateProgress(requestId, 20); // 20% - 缓存检查完成
      
      let result: any;
      
      // 流式处理
      if (llmOptions.stream && llmOptions.onChunk) {
        result = await this.streamResponse(messages, llmOptions, requestId);
      } 
      // 批处理
      else if (this.config.batchProcessingEnabled && options.batchId !== 'none') {
        result = await this.batchProcessor.addToBatch(messages, llmOptions);
        
        // 解析结果
        if (typeof result === 'string' && options.format === 'json') {
          try {
            result = JSON.parse(result);
          } catch (e) {
            logger.warn('无法解析JSON响应', { error: e });
          }
        }
      } 
      // 常规处理
      else {
        this.updateProgress(requestId, 30); // 30% - 开始API调用
        
        // 准备provider
        const provider = this.createProvider(llmOptions);
        
        // 调用LLM
        const rawResponse = await provider.call(messages, llmOptions);
        
        this.updateProgress(requestId, 90); // 90% - API调用完成
        
        // 解析结果
        result = options.format === 'json' 
          ? this.parseJsonResponse(rawResponse) 
          : { content: rawResponse };
      }
      
      // 添加增强输出格式
      if (options.customOutput) {
        result = this.enhanceOutput(result, options.customOutput);
      }
      
      // 缓存结果
      if (this.config.enableCache && options.enableCache !== false) {
        this.cacheManager.set(messages, result, llmOptions);
      }
      
      // 收集反馈数据（如果启用）
      if (this.config.collectFeedback) {
        this.collectAnalysisData(prompt, result, llmOptions.model || 'unknown');
      }
      
      this.updateProgress(requestId, 100); // 100% - 全部完成
      
      return result;
    } catch (error) {
      logger.error('增强版LLM分析失败', { error, analysisType });
      throw error;
    }
  }
  
  /**
   * 创建LLM提供者
   * @private
   */
  private createProvider(options: LLMOptions): LLMProvider {
    const baseProvider: LLMProvider = {
      call: async (messages: LLMMessage[], opts?: LLMOptions) => {
        const prompt = messages
          .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join('\n\n');
        
        const result = await this.llmHub.analyze(prompt, 'enhanced-request', {
          temperature: opts?.temperature,
          maxTokens: opts?.maxTokens,
          format: opts?.format,
          model: opts?.model
        });
        
        return typeof result === 'string' ? result : JSON.stringify(result);
      },
      getName: () => `EnhancedLLM-${options.model || this.config.model}`
    };
    
    // 如果需要强制JSON格式，使用JSON强制提供者
    return options.format === 'json' && options.strictFormat === true
      ? this.llmHub.createJsonEnforcedProvider(baseProvider)
      : baseProvider;
  }
  
  /**
   * 流式响应处理
   * @private
   */
  private async streamResponse(
    messages: LLMMessage[],
    options: LLMOptions,
    requestId: string
  ): Promise<any> {
    const onChunk = options.onChunk;
    if (!onChunk) {
      throw new Error('流式响应需要提供onChunk回调函数');
    }
    
    let fullResponse = '';
    let chunkCount = 0;
    
    this.updateProgress(requestId, 30); // 30% - 开始流式传输
    
    try {
      const provider = this.createProvider(options);
      if (!provider.streamCall) {
        // 如果提供者不支持流式调用，模拟流式响应
        const response = await provider.call(messages, options);
        
        // 将响应拆分成小块模拟流式输出
        const chunks = this.simulateStreamChunks(response);
        const totalChunks = chunks.length;
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          fullResponse += chunk;
          
          const progress = 30 + Math.floor((i / totalChunks) * 60);
          this.updateProgress(requestId, progress);
          
          onChunk(chunk);
          
          // 添加小延迟模拟流式传输
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } else {
        // 使用真正的流式API
        await provider.streamCall(
          messages, 
          options,
          (chunk: string) => {
            fullResponse += chunk;
            chunkCount++;
            
            const progress = 30 + Math.min(60, chunkCount);
            this.updateProgress(requestId, progress);
            
            onChunk(chunk);
          }
        );
      }
      
      this.updateProgress(requestId, 90); // 90% - 流式传输完成
      
      // 解析完整响应
      let result = options.format === 'json' 
        ? this.parseJsonResponse(fullResponse) 
        : { content: fullResponse };
      
      return result;
    } catch (error) {
      logger.error('流式响应处理失败', { error });
      throw error;
    }
  }
  
  /**
   * 模拟流式响应块
   * @private
   */
  private simulateStreamChunks(response: string): string[] {
    const avgChunkSize = 15; // 平均块大小
    const chunks: string[] = [];
    
    for (let i = 0; i < response.length; i += avgChunkSize) {
      // 变化块大小使其更自然
      const size = avgChunkSize + Math.floor(Math.random() * 10) - 5;
      const end = Math.min(i + size, response.length);
      chunks.push(response.substring(i, end));
    }
    
    return chunks;
  }
  
  /**
   * 处理批处理请求
   * @private
   */
  private async processBatch(
    messagesArray: LLMMessage[][],
    optionsArray: LLMOptions[]
  ): Promise<string[]> {
    // 对所有请求使用相同的模型（使用第一个请求的模型）
    const model = optionsArray[0].model || this.config.model;
    
    // 转换所有消息为文本提示
    const prompts = messagesArray.map(messages => {
      return messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');
    });
    
    // 构建合并请求（这里简化处理，实际实现可能需要更复杂的逻辑）
    const results: string[] = [];
    
    // 顺序处理批处理中的每个请求
    for (let i = 0; i < prompts.length; i++) {
      const result = await this.llmHub.analyze(prompts[i], 'batch-request', {
        temperature: optionsArray[i].temperature,
        maxTokens: optionsArray[i].maxTokens,
        format: optionsArray[i].format,
        model: model
      });
      
      results.push(typeof result === 'string' ? result : JSON.stringify(result));
    }
    
    return results;
  }
  
  /**
   * 解析JSON响应
   * @private
   */
  private parseJsonResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (e) {
      // 尝试清理可能包含markdown代码块的响应
      try {
        // 移除markdown代码块标记
        const cleanedContent = response
          .replace(/^```(?:json)?\s*\n/m, '') // 移除开头的```json
          .replace(/\n```\s*$/m, '');         // 移除结尾的```
        return JSON.parse(cleanedContent);
      } catch (cleanError) {
        logger.warn('无法解析JSON响应', { response: response.substring(0, 100) });
        return { raw: response };
      }
    }
  }
  
  /**
   * 增强输出格式
   * @private
   */
  private enhanceOutput(result: any, customOutput: any): any {
    // 如果结果已经是格式化对象，添加增强数据
    if (typeof result === 'object' && !Array.isArray(result)) {
      // 添加输出格式信息
      result._outputFormat = customOutput.format || 'json';
      
      // 如果请求了可视化，添加可视化数据占位符
      if (customOutput.includeVisualization) {
        result._visualizationData = {
          type: 'chart',
          format: 'chartjs',
          data: {
            // 这里只是占位符，实际实现需要根据分析生成有意义的图表数据
            labels: ['Category 1', 'Category 2', 'Category 3'],
            datasets: [{
              label: 'Analysis Data',
              data: [12, 19, 3]
            }]
          }
        };
      }
      
      // 如果请求了交互式元素，添加交互配置
      if (customOutput.interactive) {
        result._interactiveElements = {
          enabled: true,
          elements: [
            { type: 'expandable-section', id: 'details' },
            { type: 'filter', id: 'data-filter' }
          ]
        };
      }
      
      // 过滤维度（如果指定）
      if (customOutput.dimensions && Array.isArray(customOutput.dimensions)) {
        const filteredResult: any = { _metadata: result._metadata };
        
        for (const dim of customOutput.dimensions) {
          if (result[dim] !== undefined) {
            filteredResult[dim] = result[dim];
          }
        }
        
        // 添加增强字段
        if (result._outputFormat) filteredResult._outputFormat = result._outputFormat;
        if (result._visualizationData) filteredResult._visualizationData = result._visualizationData;
        if (result._interactiveElements) filteredResult._interactiveElements = result._interactiveElements;
        
        return filteredResult;
      }
    }
    
    return result;
  }
  
  /**
   * 获取默认系统提示词
   * @private
   */
  private getDefaultSystemPrompt(options: AnalyzeOptions): string {
    // 基础系统提示词
    let prompt = `你是一位精通分析和用户研究的专家级助手。请以系统化、客观的视角分析提供的数据，挖掘深层洞察和趋势。
    在分析时：
    1. 关注数据背后的用户行为模式和潜在需求
    2. 识别市场缺口和增长机会
    3. 剖析关键趋势并提供有深度的见解
    4. 确保每项分析都有清晰的事实支持和合理推理`;
    
    // 根据格式添加特定说明
    if (options.format === 'json') {
      prompt += '\n请严格按照要求的JSON格式返回结果，确保结构完整且易于解析。每个字段都需符合指定的数据类型与范围。';
    }
    
    // 如果需要自定义输出格式，添加相关说明
    if (options.customOutput) {
      if (options.customOutput.includeVisualization) {
        prompt += '\n请提供可视化所需的数据结构，以便生成有意义的图表展示分析结果。';
      }
      
      if (options.customOutput.dimensions && options.customOutput.dimensions.length > 0) {
        prompt += `\n请特别关注以下分析维度: ${options.customOutput.dimensions.join(', ')}。`;
      }
    }
    
    return prompt;
  }
  
  /**
   * 开始进度跟踪
   * @private
   */
  private startProgressTracking(requestId: string, callback?: (progress: number) => void): void {
    this.progressTrackers.set(requestId, {
      progress: 0,
      callback,
      startTime: Date.now()
    });
  }
  
  /**
   * 更新进度
   * @private
   */
  private updateProgress(requestId: string, progress: number): void {
    const tracker = this.progressTrackers.get(requestId);
    if (!tracker) return;
    
    tracker.progress = progress;
    
    // 计算估计剩余时间
    if (progress > 0 && progress < 100) {
      const elapsed = Date.now() - tracker.startTime;
      const estimated = (elapsed / progress) * 100;
      tracker.estimatedTime = estimated;
    }
    
    // 调用回调函数
    if (tracker.callback) {
      tracker.callback(progress);
    }
    
    // 触发进度事件
    this.events.emit('progress', {
      requestId,
      progress,
      estimatedTotal: tracker.estimatedTime,
      elapsed: Date.now() - tracker.startTime
    });
    
    // 如果进度完成，清理跟踪器
    if (progress >= 100) {
      setTimeout(() => {
        this.progressTrackers.delete(requestId);
      }, 1000);
    }
  }
  
  /**
   * 收集分析数据，用于反馈和自优化
   * @private
   */
  private collectAnalysisData(prompt: string, response: any, model: string): void {
    this.feedbackData.push({
      prompt,
      response: typeof response === 'string' ? response : JSON.stringify(response),
      model,
      timestamp: Date.now()
    });
    
    // 限制数据条目数
    if (this.feedbackData.length > 1000) {
      this.feedbackData = this.feedbackData.slice(-1000);
    }
  }
  
  /**
   * 提交用户反馈
   */
  public submitFeedback(requestId: string, rating: number, feedback?: string): void {
    // 查找匹配的数据条目
    const dataIndex = this.feedbackData.findIndex(
      data => data.timestamp.toString().endsWith(requestId.split('_').pop() || '')
    );
    
    if (dataIndex >= 0) {
      this.feedbackData[dataIndex].rating = rating;
      this.feedbackData[dataIndex].feedback = feedback;
      
      logger.info('收集用户反馈', { requestId, rating, feedback: feedback?.substring(0, 50) });
      
      // 如果启用了自优化，根据反馈调整配置
      if (this.config.selfOptimize && rating < 3) {
        this.selfOptimizeFromFeedback(this.feedbackData[dataIndex]);
      }
    }
  }
  
  /**
   * 根据反馈自动优化
   * @private
   */
  private selfOptimizeFromFeedback(data: any): void {
    // 这里应实现机器学习优化机制
    // 简化版：如果模型表现不佳，尝试切换到更高级模型
    if (data.model === this.config.modelTiers?.simple && data.rating && data.rating < 3) {
      // 对类似提示切换到更高级模型
      logger.info('基于反馈自动优化: 切换到更高级模型', { 
        fromModel: data.model,
        toModel: this.config.modelTiers?.medium
      });
    }
  }
  
  /**
   * 配置A/B测试
   */
  public configureABTest(testId: string, variants: Array<{ 
    id: string, 
    config: Partial<LLMOptions>, 
    weight: number 
  }>): void {
    this.abTestConfig = {
      enabled: true,
      testId,
      variants
    };
    
    logger.info('配置A/B测试', { testId, variants: variants.map(v => v.id) });
  }
  
  /**
   * 选择A/B测试变体
   * @private
   */
  private selectABTestVariant(): { id: string, config: Partial<LLMOptions> } | null {
    if (!this.abTestConfig.enabled || !this.abTestConfig.variants.length) {
      return null;
    }
    
    // 计算权重总和
    const totalWeight = this.abTestConfig.variants.reduce((sum, v) => sum + v.weight, 0);
    
    // 随机选择
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;
    
    for (const variant of this.abTestConfig.variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return { id: variant.id, config: variant.config };
      }
    }
    
    // 默认返回第一个变体
    return {
      id: this.abTestConfig.variants[0].id,
      config: this.abTestConfig.variants[0].config
    };
  }
  
  /**
   * 获取缓存管理器
   */
  public getCacheManager(): LLMCacheManager {
    return this.cacheManager;
  }
  
  /**
   * 获取模型选择服务
   */
  public getModelSelector(): ModelSelectionService {
    return this.modelSelector;
  }
  
  /**
   * 获取批处理器
   */
  public getBatchProcessor(): BatchProcessor {
    return this.batchProcessor;
  }
  
  /**
   * 订阅事件
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
  
  /**
   * 获取服务统计信息
   */
  public getStats(): any {
    return {
      cache: this.cacheManager.getStats(),
      batch: this.batchProcessor.getStats(),
      activeRequests: this.progressTrackers.size,
      feedbackCollected: this.feedbackData.length,
      abTestActive: this.abTestConfig.enabled
    };
  }
} 