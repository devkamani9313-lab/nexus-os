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
          checkAndPrint(item, `String at Index ${idx}`, idx);
        }
        // Search inside objects
        else if (item && typeof item === 'object') {
          const stringified = JSON.stringify(item);
          if (stringified.length > 150 && (stringified.includes('output') || stringified.includes('text'))) {
            // Let's print the object keys
            console.log(`\n[Object at Index ${idx} (Length: ${stringified.length})] Keys:`, Object.keys(item));
            
            // Check all string properties of the object
            for (const key in item) {
              if (typeof item[key] === 'string') {
                checkAndPrint(item[key], `Object[${key}] at Index ${idx}`, idx);
              } else if (item[key] && typeof item[key] === 'object') {
                // Check nested string properties
                for (const subKey in item[key]) {
                  if (typeof item[key][subKey] === 'string') {
                    checkAndPrint(item[key][subKey], `Object[${key}][${subKey}] at Index ${idx}`, idx);
                  }
                }
              }
            }
          }
        }
      });
    } else {
      console.log("Data is not an array.");
    }
  } catch (e) {
    console.error("Failed to parse execution data JSON:", e.message);
  }
}

function checkAndPrint(text, label, index) {
  const lower = text.toLowerCase();
  // We want to find the actual news text which is long and has titles/bullet points
  if (text.length > 200 && (lower.includes('news') || lower.includes('india') || lower.includes('world') || lower.includes('global'))) {
    // Exclude the formula itself
    if (text.includes('.replace(') && text.includes('$(')) return;
    
    console.log(`\n========================================`);
    console.log(`FOUND NEWS TEXT (${label}, Length: ${text.length}):`);
    console.log(`========================================`);
    console.log(text);
    console.log(`========================================`);
    validateHtml(text);
  }
}

function validateHtml(html) {
  // Let's check for basic Telegram HTML violations:
  // 1. Unescaped ampersands or angle brackets
  // 2. Mismatched quotes
  
  let hasError = false;
  
  // 1. Check for unescaped ampersands outside of entities
  const ampersands = html.match(/&(?![a-zA-Z0-9#]+;)/g);
  if (ampersands) {
    hasError = true;
    console.log(`❌ ERROR: Found ${ampersands.length} unescaped ampersands (&)!`);
    // Print lines with ampersands
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
