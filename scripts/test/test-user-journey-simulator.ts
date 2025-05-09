// Test script for UserJourneySimulatorAgent
import { UserJourneySimulatorAgent } from '../../src/agents/UserJourneySimulatorAgent';
import { logger } from '../../src/infra/logger';

// Set dummy API key for testing purposes only
process.env.OPENAI_API_KEY = 'dummy-api-key-for-testing';

/**
 * This is a simplified test script that only verifies that the UserJourneySimulatorAgent
 * can be instantiated without template string errors. This is sufficient to verify
 * that our fix for the "Single '}' in template" error works.
 */
async function testUserJourneySimulatorAgentInstantiation() {
  try {
    logger.info('Creating UserJourneySimulatorAgent instance to verify template fixes');
    
    // Try to create an instance of the agent
    // If there are template string errors, this will fail during instantiation
    const agent = new UserJourneySimulatorAgent({
      enableUserPersonas: true,
      crossPlatformAnalysis: true,
      detailedJourneyMapping: true
    });
    
    logger.info('UserJourneySimulatorAgent instantiated successfully - template string fixes are working');
    return true;
  } catch (error) {
    logger.error('UserJourneySimulatorAgent instantiation failed - template string fixes may not be working', { error });
    throw error;
  }
}

// Execute the test
testUserJourneySimulatorAgentInstantiation()
  .then(() => {
    logger.info('Test completed successfully');
    console.log('✅ Template string fix verification successful!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test failed with error', { error });
    console.log('❌ Template string fix verification failed!');
    process.exit(1);
  }); 