/**
 * MockSearchEngine.ts - 模拟搜索引擎实现
 * 用于测试和开发环境，不发起实际的网络请求
 */
import { SearchEngine } from '../SearchEngine';
import { SearchOptions, AutocompleteSuggestion } from '../types';
import { logger } from '../../logger';

/**
 * 模拟搜索引擎
 * 提供可预测的测试数据，不发起实际网络请求
 */
export class MockSearchEngine implements SearchEngine {
  private keyword: string = '';
  private mockData: Map<string, any> = new Map();
  private config = {
    name: 'Mock',
    defaultDomain: 'example.com',
    supportsProxy: false,
    supportsSystemBrowser: false,
    description: 'Mock search engine for testing',
    retryAttempts: 0,
    timeout: 1000,
    waitTime: 0
  };

  constructor(customData?: Map<string, any>) {
    // 允许注入自定义模拟数据
    if (customData) {
      this.mockData = customData;
    } else {
      this.setupDefaultMockData();
    }
    logger.debug('MockSearchEngine initialized');
  }

  /**
   * 设置默认的模拟数据
   */
  private setupDefaultMockData(): void {
    // 为常见AI相关关键词设置模拟数据
    this.addMockDataForKeyword('AI agent', [
      { 
        title: 'Understanding AI Agents: A Comprehensive Guide',
        snippet: 'AI agents are software entities that can perceive their environment, make decisions, and take actions to achieve specific goals. This article explores how they work and their applications.',
        url: 'https://example.com/ai-agents-guide'
      },
      { 
        title: 'The Difference Between AI Agents and Traditional Software',
        snippet: 'Unlike traditional software, AI agents can adapt to new situations, learn from experience, and operate with some degree of autonomy. Learn about the key differences.',
        url: 'https://example.com/ai-vs-traditional'
      },
      {
        title: 'Building Your First AI Agent: Tutorial',
        snippet: 'A step-by-step guide to creating your first AI agent using Python and modern frameworks. Includes code examples and best practices.',
        url: 'https://example.com/build-ai-agent'
      }
    ]);
    
    // 为该关键词设置自动补全建议
    this.addMockSuggestionsForKeyword('AI agent', [
      'AI agent frameworks',
      'AI agent examples',
      'AI agent vs chatbot',
      'AI agent development',
      'AI agent architecture',
      'AI agent use cases',
      'AI agent python',
      'AI agent with memory'
    ]);
    
    // 添加更多AI相关关键词的模拟数据
    this.addMockDataForKeyword('AI', [
      { 
        title: 'Artificial Intelligence: An Introduction',
        snippet: 'Learn about the fundamentals of artificial intelligence and how it is transforming industries around the world.',
        url: 'https://example.com/ai-intro'
      },
      { 
        title: 'The Future of AI: Trends and Predictions',
        snippet: 'Experts predict how artificial intelligence will evolve in the coming years and the impact it will have on society.',
        url: 'https://example.com/ai-future'
      }
    ]);

    logger.debug('Default mock data setup completed');
  }

  /**
   * 为特定关键词添加模拟搜索结果
   */
  public addMockDataForKeyword(keyword: string, results: Array<{ title: string; snippet: string; url: string }>): void {
    this.mockData.set(`results:${keyword.toLowerCase()}`, results);
  }
  
  /**
   * 为特定关键词添加模拟自动补全建议
   */
  public addMockSuggestionsForKeyword(keyword: string, suggestions: string[]): void {
    const autocompleteSuggestions: AutocompleteSuggestion[] = suggestions.map((query, index) => ({
      query,
      position: index + 1,
      source: 'mock',
      timestamp: Date.now()
    }));
    this.mockData.set(`suggestions:${keyword.toLowerCase()}`, autocompleteSuggestions);
  }

  /**
   * 初始化搜索引擎
   */
  async initialize(options?: SearchOptions): Promise<void> {
    logger.debug('MockSearchEngine initialized with options', { options });
    return Promise.resolve();
  }
  
  /**
   * 获取自动补全建议
   */
  async getSuggestions(keyword: string): Promise<AutocompleteSuggestion[]> {
    this.keyword = keyword;
    logger.debug('Getting suggestions for keyword', { keyword });
    
    // 检查是否有针对该关键词的特定模拟数据
    const mockSuggestions = this.mockData.get(`suggestions:${keyword.toLowerCase()}`);
    if (mockSuggestions) {
      return Promise.resolve(mockSuggestions);
    }
    
    // 如果没有特定数据，生成通用模拟数据
    return Promise.resolve([
      { query: `${keyword} example 1`, position: 1, source: 'mock', timestamp: Date.now() },
      { query: `${keyword} example 2`, position: 2, source: 'mock', timestamp: Date.now() },
      { query: `${keyword} tutorial`, position: 3, source: 'mock', timestamp: Date.now() },
      { query: `${keyword} best practices`, position: 4, source: 'mock', timestamp: Date.now() },
      { query: `${keyword} for beginners`, position: 5, source: 'mock', timestamp: Date.now() }
    ]);
  }
  
  /**
   * 获取搜索结果
   */
  async getSearchResults(keyword: string): Promise<{ title: string; snippet: string; url: string }[]> {
    this.keyword = keyword;
    logger.debug('Getting search results for keyword', { keyword });
    
    // 检查是否有针对该关键词的特定模拟数据
    const mockResults = this.mockData.get(`results:${keyword.toLowerCase()}`);
    if (mockResults) {
      return Promise.resolve(mockResults);
    }
    
    // 如果没有特定数据，生成通用模拟数据
    return Promise.resolve([
      { 
        title: `What is ${keyword}? - A Comprehensive Guide`,
        snippet: `This guide explains everything you need to know about ${keyword}, including key concepts and practical applications.`,
        url: `https://example.com/${keyword.replace(/\s+/g, '-').toLowerCase()}-guide`
      },
      { 
        title: `Top 10 ${keyword} Tools and Resources`,
        snippet: `Discover the best tools and resources for working with ${keyword} in 2023. Includes both free and premium options.`,
        url: `https://example.com/top-${keyword.replace(/\s+/g, '-').toLowerCase()}-tools`
      },
      { 
        title: `${keyword} Tutorial for Beginners`,
        snippet: `Learn the fundamentals of ${keyword} with this step-by-step tutorial designed for beginners. No prior experience required.`,
        url: `https://example.com/${keyword.replace(/\s+/g, '-').toLowerCase()}-tutorial`
      }
    ]);
  }
  
  /**
   * 获取搜索引擎配置
   */
  getConfig() {
    return this.config;
  }
  
  /**
   * 设置代理服务器
   */
  setProxy(proxyServer: string): void {
    logger.debug('Mock setProxy called', { proxyServer });
    // 模拟实现 - 不做实际操作
  }
  
  /**
   * 设置是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void {
    logger.debug('Mock useSystemBrowser called', { useSystem });
    // 模拟实现 - 不做实际操作
  }
  
  /**
   * 设置搜索域名
   */
  setDomain(domain: string): void {
    logger.debug('Mock setDomain called', { domain });
    this.config.defaultDomain = domain;
  }
  
  /**
   * 获取引擎类型
   */
  getEngineType(): string { 
    return 'mock'; 
  }
  
  /**
   * 关闭搜索引擎资源
   */
  async close(): Promise<void> {
    logger.debug('MockSearchEngine closed');
    return Promise.resolve();
  }
} 