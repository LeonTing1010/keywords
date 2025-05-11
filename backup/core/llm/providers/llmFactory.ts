/**
 * llmFactory.ts - Factory for creating LLM instances
 * 
 * Provides convenient access to LLM models throughout the system
 */

import { OpenAIProvider } from './OpenAIProvider';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../../../infra/logger';
import { AgentLLMService } from '../AgentLLMService';

/**
 * Get the default LLM model for the system
 */
export function getDefaultLLM(): BaseChatModel {
  try {
    // Create a new LLM model instance
    const modelConfig = {
      modelName: process.env.LLM_MODEL || 'gpt-4',
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
      verbose: false,
      maxRetries: 3,
    };
    
    // Add API URL if specified
    if (process.env.LLM_BASE_URL) {
      // Support different property names for different versions
      const baseUrl = process.env.LLM_BASE_URL;
      Object.assign(modelConfig, {
        endpoint: baseUrl,
        apiUrl: baseUrl,
        baseUrl: baseUrl,
        basePath: baseUrl,
        openAIApiBase: baseUrl
      });
    }
    
    return new ChatOpenAI(modelConfig);
  } catch (error) {
    logger.error({ error }, 'Failed to create default LLM model');
    
    // Fallback to a basic implementation if needed
    return new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7,
    });
  }
}

/**
 * Get the default AgentLLMService for the system
 */
export function getDefaultLLMService(): AgentLLMService {
  try {
    // Return a new LLMService
    return new AgentLLMService({
      model: process.env.LLM_MODEL || 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY,
      apiBaseUrl: process.env.LLM_BASE_URL,
      temperature: 0.7,
      enableCache: true,
      autoModelSelection: true,
      batchProcessing: true,
      enableStreaming: false
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create default LLM service');
    
    // Return a basic service
    return new AgentLLMService({
      model: 'gpt-3.5-turbo',
      apiKey: process.env.OPENAI_API_KEY,
      enableCache: true
    });
  }
}

/**
 * Create an LLM provider with specific configuration
 */
export function createLLMProvider(options: {
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseUrl?: string;
}) {
  // Get configuration values, falling back to environment variables
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
  const model = options.model || process.env.LLM_MODEL || 'gpt-4';
  const baseUrl = options.baseUrl || process.env.LLM_BASE_URL;
  const temperature = options.temperature ?? 0.7;
  
  // Create and return provider
  const provider = new OpenAIProvider({
    apiKey,
    defaultModel: model,
    baseUrl,
    timeout: 60000,
  });
  
  return provider;
} 