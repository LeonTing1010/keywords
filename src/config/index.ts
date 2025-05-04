/**
 * Configuration index file
 * Re-exports all configuration from configSettings.ts
 */

// Re-export all configuration from configSettings.ts
export * from './configSettings';

// Re-export default configuration
import defaultConfig from './configSettings';
export default defaultConfig;