// Debug script for SearchTools
const { exec } = require('child_process');

// Run ts-node to execute a debug script
const command = 'ts-node -e "import { SearchTools } from \'./src/tools/search/SearchTools\'; const tools = new SearchTools(); console.log(\'SearchTools initialized\'); console.log(\'getAllTools exists:\', typeof tools.getAllTools === \'function\'); console.log(\'Tool methods:\', Object.getOwnPropertyNames(Object.getPrototypeOf(tools))); const allTools = tools.getAllTools(); console.log(\'getAllTools returns:\', allTools.length, \'tools\');"';

console.log('Running debug command:', command);

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
}); 