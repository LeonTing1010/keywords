/**
 * Simple test for SearchTools
 */
import { SearchTools } from './src/tools/search/SearchTools';
import { logger } from './src/infra/logger';

async function main() {
  try {
    console.log('Creating SearchTools instance...');
    const searchTools = new SearchTools();
    
    console.log('Getting tools...');
    const tools = searchTools.getAllTools();
    
    console.log(`Got ${tools.length} tools:`);
    tools.forEach((tool, index) => {
      console.log(`  Tool ${index+1}: ${tool.name}`);
    });
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
main().catch(console.error); 