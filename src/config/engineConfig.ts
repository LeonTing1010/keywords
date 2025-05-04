import { SearchEngineConfig } from '../types';

/**
 * 搜索引擎配置管理器
 */
export class EngineConfigManager {
  private static instance: EngineConfigManager;
  private configs: Map<string, SearchEngineConfig>;

  private constructor() {
    this.configs = new Map();
  }

  /**
   * 获取配置管理器实例
   */
  public static getInstance(): EngineConfigManager {
    if (!EngineConfigManager.instance) {
      EngineConfigManager.instance = new EngineConfigManager();
    }
    return EngineConfigManager.instance;
  }

  /**
   * 注册搜索引擎配置
   */
  public registerConfig(engineName: string, config: SearchEngineConfig): void {
    this.configs.set(engineName, {
      ...config,
      // 添加默认值
      retryAttempts: config.retryAttempts || 3,
      timeout: config.timeout || 30000,
      waitTime: config.waitTime || 2000
    });
  }

  /**
   * 获取搜索引擎配置
   */
  public getConfig(engineName: string): SearchEngineConfig | undefined {
    return this.configs.get(engineName);
  }

  /**
   * 更新搜索引擎配置
   */
  public updateConfig(engineName: string, config: Partial<SearchEngineConfig>): void {
    const existingConfig = this.configs.get(engineName);
    if (existingConfig) {
      this.configs.set(engineName, { ...existingConfig, ...config });
    }
  }

  /**
   * 获取所有搜索引擎配置
   */
  public getAllConfigs(): Map<string, SearchEngineConfig> {
    return new Map(this.configs);
  }

  /**
   * 重置搜索引擎配置
   */
  public resetConfig(engineName: string): void {
    this.configs.delete(engineName);
  }

  /**
   * 清空所有配置
   */
  public clearAllConfigs(): void {
    this.configs.clear();
  }
}

// 导出单例实例
export const engineConfig = EngineConfigManager.getInstance();