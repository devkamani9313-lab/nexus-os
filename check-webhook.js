import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN not found in .env file.");
  process.exit(1);
}

const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;

console.log("Querying Telegram webhook info...");

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.ok) {
        console.log("\n================ Telegram Webhook Info ================");
        console.log("Status: Success");
        console.log("Registered URL:", response.result.url || "None (No webhook registered!)");
        console.log("Has Custom Certificate:", response.result.has_custom_certificate);
        console.log("Pending Update Count:", response.result.pending_update_count);
        console.log("Last Error Date:", response.result.last_error_date ? new Date(response.result.last_error_date * 1000).toLocaleString() : "None");
        console.log("Last Error Message:", response.result.last_error_message || "None");
        console.log("Max Connections:", response.result.max_connections);
        console.log("========================================================\n");
        
        if (!response.result.url) {
          console.log("💡 Suggestion: The webhook is empty. n8n needs to be active/published to register its webhook.");
        } else if (response.result.url.includes('loca.lt')) {
          console.log("💡 Suggestion: The webhook is still pointing to localtunnel (loca.lt). We need to force n8n on the VPS to re-register its URL.");
        }
      } else {
        console.error("❌ Telegram API returned error:", response.description);
      }
    } catch (e) {
      console.error("❌ Failed to parse response:", e.message);
      console.log("Raw response:", data);
    }
  });
}).on('error', (err) => {
  console.error("❌ HTTPS request failed:", err.message);
});
