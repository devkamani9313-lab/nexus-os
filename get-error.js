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
      
      // Let's print all strings in the pool that are longer than 50 characters
      // or contain HTML formatting tags like <b>, <a>, <code> or &amp;
      let foundNews = false;
      parsed.forEach((item, idx) => {
        if (typeof item === 'string') {
          const lower = item.toLowerCase();
          
          // Look for ampersands, links, or general news content indicators
          if (item.length > 100 && (lower.includes('<a href') || lower.includes('<b>') || lower.includes('news') || lower.includes('&amp;'))) {
            foundNews = true;
            console.log(`\n[Found Text at Index ${idx} (Length: ${item.length})]:`);
            console.log("----------------------------------------");
            console.log(item);
            console.log("----------------------------------------");
            
            // Let's also validate the HTML of this item locally in the script!
            validateHtml(item);
          }
        }
      });
      
      if (!foundNews) {
        // If we didn't find any long matching strings, print any string that has links
        console.log("No long news strings found. Printing all strings containing 'http' or '<':");
        parsed.forEach((item, idx) => {
          if (typeof item === 'string' && (item.includes('http') || item.includes('<'))) {
            console.log(`Index ${idx}:`, item);
          }
        });
      }
    } else {
      console.log("Data is not an array. Root keys:", Object.keys(parsed));
    }
  } catch (e) {
    console.error("Failed to parse execution data JSON:", e.message);
  }
}

function validateHtml(html) {
  // Let's check for basic Telegram HTML violations:
  // 1. Unclosed tags
  // 2. Nested tags that aren't allowed
  // 3. Unescaped ampersands or angle brackets
  
  // Telegram only allows: <b>, <strong>, <i>, <em>, <u>, <ins>, <s>, <strike>, <del>, <span class="...">, <a href="...">, <code>, <pre>
  // Let's check if there are other tags
  const tags = html.match(/<[^>]+>/g) || [];
  console.log(`\n[HTML Validation Check] Found ${tags.length} HTML tags.`);
  
  // Check if every tag is valid and closed
  const stack = [];
  let hasError = false;
  
  // Simple check for unescaped ampersands outside of entities
  // An ampersand must be followed by a valid entity like amp;, lt;, gt;, quot;, apos; or #123;
  const ampersands = html.match(/&(?![a-zA-Z0-9#]+;)/g);
  if (ampersands) {
    hasError = true;
    console.log(`❌ WARNING: Found ${ampersands.length} unescaped ampersands (&) that are not part of an entity! Telegram requires all ampersands to be escaped as &amp;`);
  }
  
  // Check for unescaped < or > (any < or > that is not part of a valid HTML tag)
  // Let's check if there are any < that aren't followed by a valid tag name or /
  const badLessThans = html.match(/<(?!\/?(b|strong|i|em|u|ins|s|strike|del|span|a|code|pre)\b)/gi);
  if (badLessThans) {
    hasError = true;
    console.log("❌ WARNING: Found invalid or unescaped '<' characters! Any '<' must be escaped as &lt; unless it is a valid tag like <b> or <a>.");
    console.log("Bad matches:", badLessThans);
  }
  
  // Check for nested quotes in <a href="...">
  const aTags = html.match(/<a\s+href="([^"]*)"/gi) || [];
  const rawATags = html.match(/<a\s+href=[^>]+/gi) || [];
  if (aTags.length !== rawATags.length) {
    hasError = true;
    console.log(`❌ WARNING: Mismatch in <a> tag href attributes! Some links might have unescaped quotes or spaces inside their href attribute.`);
    console.log("Raw tags found:", rawATags);
  }
  
  if (!hasError) {
    console.log("✅ No obvious unescaped HTML characters or entity violations found in this string.");
  }
}
