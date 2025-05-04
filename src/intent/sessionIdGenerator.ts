/**
 * KeywordNova 会话ID生成器
 * 提供生成统一格式、全局唯一的会话ID
 */
import { createHash } from 'crypto';

/**
 * 会话类型枚举
 */
export type SessionType = 'iteration' | 'report' | 'analysis' | 'categorization' | 'query';

/**
 * 生成会话ID
 * 确保全局唯一性，同时包含足够的信息便于调试和分析
 * 
 * 格式：kn_[类型]_[版本]_[关键词哈希]_[时间戳]_[随机码]_[后缀]
 * 
 * @param type 会话类型
 * @param keyword 原始关键词
 * @param suffix 可选后缀，如迭代号
 * @returns 全局唯一的会话ID
 */
export function generateSessionId(type: SessionType, keyword: string, suffix?: string): string {
  const prefix = 'kn'; // 应用标识 - KeywordNova
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  const keywordHash = createHash('md5').update(keyword).digest('hex').substring(0, 8);
  const version = '2_4'; // 当前版本2.4
  
  return `${prefix}_${type}_${version}_${keywordHash}_${timestamp}_${randomStr}${suffix ? '_' + suffix : ''}`;
}

/**
 * 从会话ID中提取信息
 * 用于调试和日志分析
 * 
 * @param sessionId 会话ID
 * @returns 解析后的会话信息
 */
export function parseSessionId(sessionId: string): {
  type?: SessionType;
  version?: string;
  keywordHash?: string;
  timestamp?: number;
  suffix?: string;
} {
  try {
    const parts = sessionId.split('_');
    if (parts.length < 6) {
      return {}; // 不符合格式的ID无法解析
    }
    
    return {
      type: parts[1] as SessionType,
      version: parts[2],
      keywordHash: parts[3],
      timestamp: parseInt(parts[4], 10),
      suffix: parts.length > 6 ? parts.slice(6).join('_') : undefined
    };
  } catch (e) {
    console.warn(`[会话ID] 解析失败: ${sessionId}`);
    return {};
  }
}

/**
 * 检查会话ID是否是特定类型
 * 
 * @param sessionId 会话ID
 * @param type 会话类型
 * @returns 是否匹配类型
 */
export function isSessionType(sessionId: string, type: SessionType): boolean {
  const info = parseSessionId(sessionId);
  return info.type === type;
} 