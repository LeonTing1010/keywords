/**
 * Debug script for inheritance issue in BaseAgent/KeywordAgent
 */
console.log('Starting debug script...');

// Import without instantiating yet
import { BaseAgent } from './src/agents/base/BaseAgent';
import { KeywordAgent } from './src/agents/keyword/KeywordAgent';

console.log('Imports completed');

// Create a subclass to test
class TestBaseAgent extends BaseAgent {
  private initOrder: string[] = [];
  private testProperty: any;
  
  constructor() {
    console.log('Starting TestBaseAgent constructor BEFORE super()');
    super(); // This will call setupTools()
    console.log('Completed TestBaseAgent constructor AFTER super()');
    
    // Initialize property after super() call
    this.testProperty = { value: 'test' };
    this.initOrder.push('testProperty initialized');
  }
  
  protected setupTools(): void {
    console.log('setupTools called from BaseAgent constructor');
    console.log('testProperty is:', this.testProperty);
    
    // Record that setupTools was called
    this.initOrder.push('setupTools called');
    
    if (!this.testProperty) {
      console.log('WARNING: testProperty is not initialized yet');
    } else {
      console.log('testProperty is already initialized');
    }
  }
  
  public getInitOrder(): string[] {
    return this.initOrder;
  }
  
  // Required abstract method
  public async execute(state: any): Promise<any> {
    return {};
  }
}

// Create instance and observe behavior
console.log('Creating TestBaseAgent instance...');
const testAgent = new TestBaseAgent();
console.log('Initialization order:', testAgent.getInitOrder());

// Now try to create a real KeywordAgent
console.log('\nNow testing real KeywordAgent...');
try {
  console.log('Creating KeywordAgent...');
  const agent = new KeywordAgent();
  console.log('KeywordAgent created successfully');
} catch (error) {
  console.error('Error creating KeywordAgent:', error);
}

console.log('Debug script completed'); 