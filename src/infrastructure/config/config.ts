export const config = {
  llm: {
    defaultModel: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000
  },
  output: {
    defaultFormat: 'json',
    defaultLanguage: 'zh' as 'zh' | 'en'
  },
  analysis: {
    maxIterations: 3,
    satisfactionThreshold: 0.85
  }
}; 