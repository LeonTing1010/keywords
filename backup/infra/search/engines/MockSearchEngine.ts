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
    logger.debug({}, 'MockSearchEngine initialized');
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
    logger.debug({ options }, 'MockSearchEngine initialized with options');
    return Promise.resolve();
  }
  
  /**
   * 获取自动补全建议
   */
  async getSuggestions(keyword: string): Promise<AutocompleteSuggestion[]> {
    this.keyword = keyword;
    logger.debug( { keyword },'Getting suggestions for keyword');
    
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
    logger.debug( { keyword },'Getting search results for keyword');
    
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
    logger.debug({ proxyServer }, 'Mock setProxy called');
    // 模拟实现 - 不做实际操作
  }
  
  /**
   * 设置是否使用系统浏览器
   */
  useSystemBrowser(useSystem: boolean): void {
    logger.debug({ useSystem }, 'Mock useSystemBrowser called');
    // 模拟实现 - 不做实际操作
  }
  
  /**
   * 获取引擎类型
   */
  getEngineType(): string { 
    return 'mock';
  }
  
  /**
   * 获取网页内容
   * 通过URL获取整个网页的内容
   */
  async getWebpageContent(url: string, options?: SearchOptions): Promise<string> {
    logger.debug('Getting mock webpage content', { url });
    
    // 模拟网页内容
    const mockContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Webpage for ${url}</title>
</head>
<body>
  <header>
    <h1>Mock Content for ${url}</h1>
    <nav>
      <ul>
        <li><a href="#">Home</a></li>
        <li><a href="#">About</a></li>
        <li><a href="#">Services</a></li>
        <li><a href="#">Contact</a></li>
      </ul>
    </nav>
  </header>
  
  <main>
    <section>
      <h2>Sample Article</h2>
      <p>This is a mock webpage content generated for testing purposes. The requested URL was: ${url}</p>
      <p>In a real implementation, this would contain the actual HTML content of the requested page.</p>
    </section>
    
    <section>
      <h2>Additional Information</h2>
      <p>This mock response is generated by the MockSearchEngine class.</p>
      <p>Current timestamp: ${new Date().toISOString()}</p>
    </section>
  </main>
  
  <footer>
    <p>&copy; ${new Date().getFullYear()} Mock Search Engine. All rights reserved.</p>
  </footer>
</body>
</html>
`;
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return Promise.resolve(mockContent);
  }
  
  /**
   * 关闭搜索引擎
   */
  async close(): Promise<void> {
    logger.debug('MockSearchEngine closed');
    return Promise.resolve();
  }
} 