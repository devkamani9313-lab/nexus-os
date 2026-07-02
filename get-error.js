import sqlite3 from 'sqlite3';

const dbPath = '/root/.n8n/database.sqlite';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening n8n database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      db.close();
      return;
    }
    
    const tableNames = tables.map(t => t.name);
    
    if (tableNames.includes('execution_data')) {
      db.get("SELECT data FROM execution_data WHERE executionId = 53", [], (err, dataRow) => {
        if (dataRow) {
          inspectArray(dataRow.data);
        } else {
          console.log("Execution ID 53 data not found in execution_data.");
        }
        db.close();
      });
    } else {
      console.log("execution_data table not found.");
      db.close();
    }
  });
});

function inspectArray(jsonData) {
  try {
    const parsed = JSON.parse(jsonData);
    if (Array.isArray(parsed)) {
      console.log(`\n=== Data is an array of length ${parsed.length} ===`);
      // In some versions, n8n saves execution steps as an array. Let's look for the one corresponding to 'Send Reply' node
      const sendReplyStep = parsed.find(step => 
        (step.node && step.node.includes('Send Reply')) || 
        (step.nodeName && step.nodeName.includes('Send Reply')) ||
        (step.name && step.name.includes('Send Reply'))
      );
      
      if (sendReplyStep) {
        console.log("Found 'Send Reply' step:", JSON.stringify(sendReplyStep, null, 2));
      } else {
        // Let's print the first 5 elements to see their structure
        console.log("First 3 elements of the array:");
        parsed.slice(0, 3).forEach((item, idx) => {
          console.log(`\nIndex ${idx}:`, JSON.stringify(item).substring(0, 300));
        });
        
        // Let's search if any element mentions 'Send Reply' or has an error field
        console.log("\nSearching for steps with errors...");
        parsed.forEach((step, idx) => {
          if (step.error || (step.data && step.data.error) || JSON.stringify(step).includes('Bad request')) {
            console.log(`\n[Error Step at Index ${idx}]:`, JSON.stringify(step, null, 2).substring(0, 2000));
          }
        });
      }
    } else {
      console.log("Data keys:", Object.keys(parsed));
    }
  } catch (e) {
    console.error("Failed to parse execution data JSON:", e.message);
  }
}
