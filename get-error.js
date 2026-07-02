import sqlite3 from 'sqlite3';

const dbPath = '/root/.n8n/database.sqlite';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening n8n database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Query last 10 executions for the Router Workflow (ID: 61KAx6PJqYvaM2ai)
  const query = `
    SELECT id, status, startedAt, stoppedAt 
    FROM execution_entity 
    WHERE workflowId = '61KAx6PJqYvaM2ai' 
    ORDER BY id DESC 
    LIMIT 10
  `;
  
  db.all(query, [], (err, executions) => {
    if (err) {
      console.error("Error querying executions:", err.message);
      db.close();
      return;
    }
    
    console.log("=== LAST 10 ROUTER WORKFLOW EXECUTIONS ===");
    console.table(executions);
    
    let processed = 0;
    if (executions.length === 0) {
      db.close();
      return;
    }
    
    executions.forEach(exec => {
      db.get("SELECT data FROM execution_data WHERE executionId = ?", [exec.id], (err, dataRow) => {
        processed++;
        if (dataRow) {
          console.log(`\n----------------------------------------`);
          console.log(`Execution ID ${exec.id} | Status: ${exec.status} | Started: ${exec.startedAt}`);
          console.log(`----------------------------------------`);
          parseExecutionData(dataRow.data);
        }
        
        if (processed === executions.length) {
          db.close();
        }
      });
    });
  });
});

function parseExecutionData(jsonData) {
  try {
    const parsed = JSON.parse(jsonData);
    if (!Array.isArray(parsed)) return;
    
    // Find Telegram Trigger node data (incoming message)
    const triggerStep = parsed.find(step => step.node && step.node.includes('Telegram Trigger'));
    if (triggerStep) {
      // n8n saves step output in step.data or similar. Let's search inside the step object
      const stepStr = JSON.stringify(triggerStep);
      const textMatch = stepStr.match(/"text":"([^"]+)"/);
      if (textMatch) {
        console.log("Incoming Message:", textMatch[1]);
      }
    }
    
    // Find Send Reply node error or text
    const sendReplyStep = parsed.find(step => step.node && (step.node.includes('Send Reply') || step.node.includes('Reply Command')));
    if (sendReplyStep) {
      if (sendReplyStep.error) {
        console.log("❌ Node Error:", sendReplyStep.error);
      }
      
      // Let's find any long strings in this execution that might be the text sent to Telegram
      parsed.forEach(item => {
        if (typeof item === 'string' && item.length > 100 && !item.includes('.replace(')) {
          // If it contains LeetCode, Gym, Finance, or DSA instructions
          if (item.includes('prep') || item.includes('Switched to') || item.includes('calories') || item.includes('news')) {
            console.log("Evaluated Output:", item.substring(0, 300) + "... [Truncated]");
          }
        }
      });
    }
  } catch (e) {
    // Ignore parse errors
  }
}
