import sqlite3 from 'sqlite3';

const dbPath = '/root/.n8n/database.sqlite';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening n8n database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Let's check what tables exist first to make sure we query the right place
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      db.close();
      return;
    }
    
    const tableNames = tables.map(t => t.name);
    console.log("Tables in database:", tableNames.join(', '));
    
    // In newer n8n versions, execution data might be in execution_entity or a separate table.
    // Let's search for columns in execution_entity
    db.all("PRAGMA table_info(execution_entity)", [], (err, columns) => {
      const colNames = columns.map(c => c.name);
      
      let query = "";
      if (colNames.includes('data')) {
        query = "SELECT data FROM execution_entity WHERE id = 53";
      } else {
        // Let's check if there is an execution_data table or similar
        query = "SELECT id, status, workflowId FROM execution_entity WHERE id = 53";
      }
      
      db.get(query, [], (err, row) => {
        if (err) {
          console.error("Error querying execution 53:", err.message);
          db.close();
          return;
        }
        if (!row) {
          console.log("Execution ID 53 not found.");
          db.close();
          return;
        }
        console.log("Execution metadata:", row);
        
        // Let's search for execution data in other tables if needed
        if (tableNames.includes('execution_data')) {
          db.get("SELECT data FROM execution_data WHERE executionId = 53", [], (err, dataRow) => {
            if (dataRow) {
              console.log("Found execution data in execution_data table!");
              printData(dataRow.data);
            }
            db.close();
          });
        } else {
          // If no separate table, print whatever we found or query latest executions
          db.close();
        }
      });
    });
  });
});

function printData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    // Find the Send Reply node's input or output
    console.log("\n=== Node Execution Data ===");
    // Let's traverse the n8n execution data structure
    // Typically it contains: data.resultData.runData
    const runData = data.resultData?.runData;
    if (runData) {
      const sendReplyData = runData['Send Reply'] || runData['Reply Command'];
      if (sendReplyData && sendReplyData[0]) {
        const firstRun = sendReplyData[0];
        console.log("Error message:", firstRun.error);
        const inputData = firstRun.input?.main?.[0]?.[0]?.json;
        if (inputData) {
          console.log("\nInput text to Telegram Node:\n", inputData.text || inputData.output);
        } else {
          console.log("Could not extract input JSON. Full run data:", JSON.stringify(firstRun, null, 2));
        }
      } else {
        console.log("Send Reply node data not found in runData. Available nodes:", Object.keys(runData));
      }
    } else {
      console.log("resultData.runData not found in execution data. Keys:", Object.keys(data));
    }
  } catch (e) {
    console.error("Failed to parse execution data JSON:", e.message);
  }
}
