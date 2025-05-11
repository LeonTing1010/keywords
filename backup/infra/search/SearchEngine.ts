import { SearchEngineConfig, SearchOptions, AutocompleteSuggestion } from './types';

/**
 * Search engine interface defining required functionality
 */
export interface SearchEngine {
  /**
   * Get search engine configuration
   */
  getConfig(): SearchEngineConfig;

  /**
   * Set proxy server
   */
  setProxy(proxyServer: string): void;

  /**
   * Set whether to use system browser
   */
  useSystemBrowser(useSystem: boolean): void;

  /**
   * Get engine type
   */
  getEngineType(): string;

  /**
   * Initialize search engine
   */
  initialize(options?: SearchOptions): Promise<void>;

  /**
   * Get search suggestions
   */
  getSuggestions(keyword: string, options?: SearchOptions): Promise<AutocompleteSuggestion[]>;

  /**
   * Get search results
   */
  getSearchResults(keyword: string, options?: { maxResults?: number }): Promise<{ title: string; snippet: string; url: string }[]>;
  
  /**
   * Get webpage content by URL
   */
  getWebpageContent(url: string, options?: SearchOptions): Promise<string>;
  
  /**
   * Close search engine
   */
  close(): Promise<void>;
} 