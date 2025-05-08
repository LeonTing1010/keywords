/**
 * Export search engines and types
 */
export * from './types';
export * from './SearchEngine';
export * from './engines/BaiduSearchEngine';
export * from './engines/GoogleSearchEngine';
export * from './engines/MockSearchEngine';
export * from './engines/WebSearchEngine';

// Import concrete search engine implementations
import { BaiduSearchEngine } from './engines/BaiduSearchEngine';
import { GoogleSearchEngine } from './engines/GoogleSearchEngine';
import { MockSearchEngine } from './engines/MockSearchEngine';
import { WebSearchEngine } from './engines/WebSearchEngine';

// Create a factory function to get a search engine instance
export function getSearchEngine(type: string, config?: any) {
  switch (type.toLowerCase()) {
    case 'baidu':
      return new BaiduSearchEngine();
    case 'google':
      return new GoogleSearchEngine();
    case 'mock':
      return new MockSearchEngine();
    case 'web':
    case 'web-search':
      return new WebSearchEngine();
    default:
      // Default to WebSearchEngine for real search results
      return new WebSearchEngine();
  }
}

// Export WebSearchEngine as default
export default WebSearchEngine; 