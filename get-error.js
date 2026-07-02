import sqlite3 from 'sqlite3';

const dbPath = '/root/.n8n/database.sqlite';
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening n8n database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.get("SELECT data FROM execution_data WHERE executionId = 53", [], (err, dataRow) => {
    if (dataRow) {
      findStringInPool(dataRow.data);
    } else {
      console.log("Execution ID 53 data not found.");
    }
    db.close();
  });
});

function findStringInPool(jsonData) {
  try {
    const parsed = JSON.parse(jsonData);
    if (Array.isArray(parsed)) {
      console.log(`\n=== String Pool Search (Array length: ${parsed.length}) ===`);
      
      let found = false;
      parsed.forEach((item, idx) => {
        // Search inside strings
        if (typeof item === 'string') {
          if (checkAndPrint(item, `String at Index ${idx}`, idx)) {
            found = true;
          }
        }
        // Search inside objects
        else if (item && typeof item === 'object') {
          const stringified = JSON.stringify(item);
          if (stringified.length > 100) {
            // Check all string properties of the object
            for (const key in item) {
              if (typeof item[key] === 'string') {
                if (checkAndPrint(item[key], `Object[${key}] at Index ${idx}`, idx)) {
                  found = true;
                }
              } else if (item[key] && typeof item[key] === 'object') {
                // Check nested string properties
                for (const subKey in item[key]) {
                  if (typeof item[key][subKey] === 'string') {
                    if (checkAndPrint(item[key][subKey], `Object[${key}][${subKey}] at Index ${idx}`, idx)) {
                      found = true;
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!found) {
        console.log("No long text matching criteria was found.");
      }
    } else {
      console.log("Data is not an array.");
    }
  } catch (e) {
    console.error("Failed to parse execution data JSON:", e.message);
  }
}

function checkAndPrint(text, label, index) {
  // We want to find the actual text which is long
  if (text.length > 150) {
    // Exclude the n8n formula itself
    if (text.includes('.replace(') && text.includes('$(')) return false;
    
    console.log(`\n========================================`);
    console.log(`FOUND RAW TEXT (${label}, Length: ${text.length}):`);
    console.log(`========================================`);
    console.log(text);
    console.log(`========================================`);
    validateHtml(text);
    return true;
  }
  return false;
}

function validateHtml(html) {
  let hasError = false;
  
  // 1. Check for unescaped ampersands outside of entities
  const ampersands = html.match(/&(?![a-zA-Z0-9#]+;)/g);
  if (ampersands) {
    hasError = true;
    console.log(`❌ ERROR: Found ${ampersands.length} unescaped ampersands (&)!`);
    const lines = html.split('\n');
    lines.forEach((line, idx) => {
      if (line.match(/&(?![a-zA-Z0-9#]+;)/)) {
        console.log(`   Line ${idx+1}: "${line.trim()}"`);
      }
    });
  }
  
  // 2. Check for unescaped < or > (any < or > that is not part of a valid HTML tag)
  const badLessThans = html.match(/<(?!\/?(b|strong|i|em|u|ins|s|strike|del|span|a|code|pre)\b)/gi);
  if (badLessThans) {
    hasError = true;
    console.log("❌ ERROR: Found invalid or unescaped '<' characters!");
    console.log("   Matches:", badLessThans);
  }
  
  // 3. Check for nested/invalid quotes in <a> tags
  const rawATags = html.match(/<a\s+href=[^>]+/gi) || [];
  const validATags = html.match(/<a\s+href="[^"]*"/gi) || [];
  if (rawATags.length !== validATags.length) {
    hasError = true;
    console.log(`❌ ERROR: Mismatch in <a> tag href attributes! Some links might have unescaped quotes or spaces inside their href attribute.`);
    console.log("   Found raw <a> tags:", rawATags);
  }
  
  if (!hasError) {
    console.log("✅ No obvious HTML violations found in this string.");
  }
}
