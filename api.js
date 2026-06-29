import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import PDFDocument from 'pdfkit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.db');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.log('Query:', JSON.stringify(req.query));
  console.log('Body:', JSON.stringify(req.body));
  next();
});

const db = new sqlite3.Database(dbPath);

// Generic wrapper for running SQL
const runSql = (sql, params) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

const getSql = (sql, params) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Helper to parse the AI payload
function parsePayload(body, query) {
  if (body && typeof body === 'string') {
    try { return JSON.parse(body); } catch(e) {}
  }
  if (body && body.payload && typeof body.payload === 'string') {
    try { return JSON.parse(body.payload); } catch(e) {}
  }
  return Object.keys(body).length > 0 ? body : query;
}

// Workout routes
app.post('/api/workout', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, exercise_name, weight, reps, sets } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    await runSql(
      `INSERT INTO workout_logs (chat_id, date, exercise_name, weight, reps, sets) VALUES (?, ?, ?, ?, ?, ?)`,
      [chat_id, date, exercise_name, weight, reps, sets]
    );
    res.json({ status: 'success', message: 'Workout logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workout', async (req, res) => {
  try {
    const { chat_id, exercise_name } = req.query;
    let query = `SELECT * FROM workout_logs WHERE chat_id = ?`;
    const params = [chat_id];
    
    if (exercise_name) {
      query += ` AND exercise_name LIKE ?`;
      params.push(`%${exercise_name}%`);
    }
    
    query += ` ORDER BY date DESC LIMIT 10`;
    const rows = await getSql(query, params);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Workout Plan routes
app.post('/api/workout-plan', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, day_of_week, routine_text } = data;
    await runSql(
      `INSERT INTO workout_plans (chat_id, day_of_week, routine_text) VALUES (?, ?, ?) ON CONFLICT(chat_id, day_of_week) DO UPDATE SET routine_text = excluded.routine_text`,
      [chat_id, day_of_week, routine_text]
    );
    res.json({ status: 'success', message: 'Workout plan updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workout-plan', async (req, res) => {
  try {
    const { chat_id, day_of_week } = req.query;
    let query = `SELECT * FROM workout_plans WHERE chat_id = ?`;
    const params = [chat_id];
    
    if (day_of_week) {
      query += ` AND day_of_week = ?`;
      params.push(day_of_week);
    }
    
    const rows = await getSql(query, params);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nutrition routes
app.post('/api/nutrition', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, food_name, calories, protein, carbs, fat } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    await runSql(
      `INSERT INTO nutrition_logs (chat_id, date, food_name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chat_id, date, food_name, calories, protein, carbs, fat]
    );
    res.json({ status: 'success', message: 'Nutrition logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/nutrition', async (req, res) => {
  try {
    const { chat_id, date } = req.query;
    const queryDate = date || new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rows = await getSql(
      `SELECT * FROM nutrition_logs WHERE chat_id = ? AND date = ?`,
      [chat_id, queryDate]
    );
    
    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    rows.forEach(r => {
      totals.calories += r.calories || 0;
      totals.protein += r.protein || 0;
      totals.carbs += r.carbs || 0;
      totals.fat += r.fat || 0;
    });
    
    res.json({ status: 'success', totals, items: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Session routes
app.get('/api/session', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const rows = await getSql(`SELECT active_agent FROM user_sessions WHERE chat_id = ?`, [chat_id]);
    const active_agent = rows.length > 0 ? rows[0].active_agent : 'gym';
    res.json({ active_agent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session', async (req, res) => {
  try {
    const { chat_id, active_agent } = req.body;
    await runSql(
      `INSERT INTO user_sessions (chat_id, active_agent) VALUES (?, ?) ON CONFLICT(chat_id) DO UPDATE SET active_agent = ?`,
      [chat_id, active_agent, active_agent]
    );
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance routes
app.post('/api/attendance', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, status } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    await runSql(
      `INSERT INTO attendance_logs (chat_id, date, status) VALUES (?, ?, ?) ON CONFLICT(chat_id, date) DO UPDATE SET status = excluded.status`,
      [chat_id, date, status]
    );
    res.json({ status: 'success', message: 'Attendance logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const rows = await getSql(
      `SELECT * FROM attendance_logs WHERE chat_id = ? ORDER BY date DESC LIMIT 30`,
      [chat_id]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weight routes
app.post('/api/weight', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, weight } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    await runSql(
      `INSERT INTO weight_history (chat_id, date, weight) VALUES (?, ?, ?) ON CONFLICT(chat_id, date) DO UPDATE SET weight = excluded.weight`,
      [chat_id, date, weight]
    );
    res.json({ status: 'success', message: 'Weight logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weight', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const rows = await getSql(
      `SELECT * FROM weight_history WHERE chat_id = ? ORDER BY date DESC LIMIT 30`,
      [chat_id]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Finance Agent Routes ---

// Transactions
app.post('/api/finance/transaction', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, type, category, amount, vendor } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString();
    await runSql(
      `INSERT INTO finance_transactions (chat_id, date, type, category, amount, vendor) VALUES (?, ?, ?, ?, ?, ?)`,
      [chat_id, date, type, category, amount, vendor]
    );
    res.json({ status: 'success', message: 'Transaction logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finance/transaction', async (req, res) => {
  try {
    const { chat_id, days = 30 } = req.query;
    const dateLimit = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = await getSql(
      `SELECT * FROM finance_transactions WHERE chat_id = ? AND date >= ? ORDER BY date DESC`,
      [chat_id, dateLimit]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Debts
app.post('/api/finance/debt', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, person_name, amount_owed, description } = data;
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString();
    await runSql(
      `INSERT INTO finance_debts (chat_id, date, person_name, amount_owed, description) VALUES (?, ?, ?, ?, ?)`,
      [chat_id, date, person_name, amount_owed, description]
    );
    res.json({ status: 'success', message: 'Debt logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finance/debt', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const rows = await getSql(
      `SELECT person_name, SUM(amount_owed) as total_owed FROM finance_debts WHERE chat_id = ? GROUP BY person_name`,
      [chat_id]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wishlist
app.post('/api/finance/wishlist', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, item_name, url, target_price } = data;
    const date_added = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString();
    await runSql(
      `INSERT INTO finance_wishlist (chat_id, date_added, item_name, url, target_price) VALUES (?, ?, ?, ?, ?)`,
      [chat_id, date_added, item_name, url, target_price]
    );
    res.json({ status: 'success', message: 'Wishlist item added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finance/wishlist', async (req, res) => {
  try {
    const { chat_id } = req.query;
    let query = `SELECT * FROM finance_wishlist`;
    let params = [];
    if (chat_id) {
      query += ` WHERE chat_id = ?`;
      params.push(chat_id);
    }
    const rows = await getSql(query, params);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Trades
app.post('/api/finance/trade', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, type, asset_symbol, shares, price } = data; // type: 'buy' or 'sell'
    const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString();
    
    const existing = await getSql(`SELECT * FROM finance_portfolio WHERE chat_id = ? AND asset_symbol = ?`, [chat_id, asset_symbol]);
    const currentShares = existing.length > 0 ? existing[0].amount_owned : 0;
    const currentAvgPrice = existing.length > 0 ? existing[0].average_buy_price : 0;
    
    let profitLoss = 0;
    let newShares = currentShares;
    let newAvgPrice = currentAvgPrice;
    
    if (type.toLowerCase() === 'buy') {
      newShares = currentShares + parseFloat(shares);
      newAvgPrice = ((currentShares * currentAvgPrice) + (parseFloat(shares) * parseFloat(price))) / newShares;
    } else if (type.toLowerCase() === 'sell') {
      newShares = currentShares - parseFloat(shares);
      profitLoss = (parseFloat(price) - currentAvgPrice) * parseFloat(shares);
    }
    
    await runSql(
      `INSERT INTO finance_stock_transactions (chat_id, date, type, asset_symbol, shares, price, profit_loss) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chat_id, date, type.toLowerCase(), asset_symbol, shares, price, profitLoss]
    );
    
    if (newShares <= 0) {
      await runSql(`DELETE FROM finance_portfolio WHERE chat_id = ? AND asset_symbol = ?`, [chat_id, asset_symbol]);
    } else {
      if (existing.length > 0) {
        await runSql(`UPDATE finance_portfolio SET amount_owned = ?, average_buy_price = ? WHERE chat_id = ? AND asset_symbol = ?`, [newShares, newAvgPrice, chat_id, asset_symbol]);
      } else {
        await runSql(`INSERT INTO finance_portfolio (chat_id, asset_symbol, amount_owned, average_buy_price) VALUES (?, ?, ?, ?)`, [chat_id, asset_symbol, newShares, newAvgPrice]);
      }
    }
    
    res.json({ status: 'success', message: 'Trade logged successfully', profit_loss: profitLoss, new_shares: newShares });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/finance/trade', async (req, res) => {
  try {
    const { chat_id, limit } = req.query;
    const rows = await getSql(
      `SELECT * FROM finance_stock_transactions WHERE chat_id = ? ORDER BY date DESC LIMIT ?`,
      [chat_id, limit || 10]
    );
    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Portfolio
app.post('/api/finance/portfolio', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, asset_symbol, amount_owned, average_buy_price } = data;
    
    const existing = await getSql(`SELECT id FROM finance_portfolio WHERE chat_id = ? AND asset_symbol = ?`, [chat_id, asset_symbol]);
    
    if (existing.length > 0) {
      await runSql(
        `UPDATE finance_portfolio SET amount_owned = ?, average_buy_price = ? WHERE chat_id = ? AND asset_symbol = ?`,
        [amount_owned, average_buy_price, chat_id, asset_symbol]
      );
    } else {
      await runSql(
        `INSERT INTO finance_portfolio (chat_id, asset_symbol, amount_owned, average_buy_price) VALUES (?, ?, ?, ?)`,
        [chat_id, asset_symbol, amount_owned, average_buy_price]
      );
    }
    res.json({ status: 'success', message: 'Portfolio item logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/finance/portfolio', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const rows = await getSql(
      `SELECT asset_symbol, SUM(amount_owned) as total_shares, SUM(amount_owned * average_buy_price) / SUM(amount_owned) as avg_price FROM finance_portfolio WHERE chat_id = ? GROUP BY asset_symbol HAVING total_shares > 0`,
      [chat_id]
    );

    // Fetch real-time prices from Yahoo Finance
    for (let i = 0; i < rows.length; i++) {
      try {
        const symbolQuery = rows[i].asset_symbol;
        const searchRes = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbolQuery)}`);
        const searchData = await searchRes.json();
        if (searchData.quotes && searchData.quotes.length > 0) {
          let ticker = searchData.quotes[0].symbol;
          // Prioritize Indian stocks if found in the search results
          const nsiQuote = searchData.quotes.find(q => q.exchange === 'NSI' || q.exchange === 'BSE');
          if (nsiQuote) ticker = nsiQuote.symbol;

          const priceRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`);
          const priceData = await priceRes.json();
          const livePrice = priceData.chart.result[0].meta.regularMarketPrice;
          
          rows[i].current_live_price = livePrice;
          const totalInvested = rows[i].total_shares * rows[i].avg_price;
          const currentValue = rows[i].total_shares * livePrice;
          rows[i].profit_loss = currentValue - totalInvested;
        }
      } catch (e) {
        console.error("Live price fetch failed for", rows[i].asset_symbol);
      }
    }

    res.json({ status: 'success', data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Generator Route
app.post('/api/pdf', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, report_type } = data;
    
    let title = 'Gym Report';
    let records = [];
    let customContent = null;

    // Fetch relevant data
    if (report_type === 'custom') {
      title = data.title || 'Dev OS Report';
      customContent = data.content || '';
      if (!customContent) throw new Error('No content provided for custom report.');
    } else if (report_type === 'weight') {
      title = 'Body Weight History';
      records = await getSql(`SELECT date, weight || ' kg' as info FROM weight_history WHERE chat_id = ? ORDER BY date DESC LIMIT 30`, [chat_id]);
    } else if (report_type === 'workout') {
      title = 'Recent Workouts';
      records = await getSql(`SELECT date, exercise_name || ' (' || sets || 'x' || reps || ' @ ' || weight || 'kg)' as info FROM workout_logs WHERE chat_id = ? ORDER BY date DESC LIMIT 30`, [chat_id]);
    } else if (report_type === 'nutrition') {
      title = 'Nutrition Logs';
      records = await getSql(`SELECT date, food_name || ' (' || calories || ' cal, ' || protein || 'g protein)' as info FROM nutrition_logs WHERE chat_id = ? ORDER BY date DESC LIMIT 30`, [chat_id]);
    } else if (report_type === 'attendance') {
      title = 'Gym Attendance';
      records = await getSql(`SELECT date, status as info FROM attendance_logs WHERE chat_id = ? ORDER BY date DESC LIMIT 30`, [chat_id]);
    } else {
      throw new Error("Invalid report_type. Use weight, workout, nutrition, attendance, or custom.");
    }

    if (!customContent && records.length === 0) {
      throw new Error("No data found to generate a report.");
    }

    // Generate PDF with buffered pages so we can add headers/footers at the end
    const doc = new PDFDocument({ margins: { top: 120, bottom: 50, left: 50, right: 50 }, bufferPages: true });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    
    doc.on('end', async () => {
      const pdfData = Buffer.concat(buffers);
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken || botToken === "REPLACE_ME") {
        return res.status(500).json({ error: "Telegram Bot Token not configured in .env" });
      }

      const formData = new FormData();
      formData.append('chat_id', chat_id);
      formData.append('document', new Blob([pdfData], { type: 'application/pdf' }), 'NexusOS_Report.pdf');

      try {
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: 'POST',
          body: formData
        });
        const json = await resp.json();
        if (!json.ok) throw new Error(json.description);
        res.json({ status: 'success', message: 'PDF sent successfully' });
      } catch (e) {
        console.error("Telegram API Error:", e.message);
      }
    });

    // --- Premium Nexus OS Content Rendering ---
    
    // Helper to strip emojis and glitchy markdown separators
    const cleanText = (str) => str.replace(/[\u1000-\uFFFF]/g, '').replace(/=/g, '');

    // Title Section
    doc.fillColor('#1e293b').fontSize(24).font('Helvetica-Bold').text(cleanText(title), { align: 'left' });
    doc.moveDown(1);
    
    if (customContent) {
      // Render freeform text content using native wrapping
      const lines = customContent.split('\n');
      lines.forEach((line) => {
        let trimmed = cleanText(line.trim());
        const originalTrimmed = line.trim();
        
        if (trimmed === '') {
          doc.moveDown(0.5);
        } else if (trimmed.startsWith('###') || trimmed.startsWith('**') || (trimmed === trimmed.toUpperCase() && trimmed.length > 4)) {
          doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text(trimmed.replace(/[#*]/g, '').trim());
          doc.moveDown(0.2);
        } else {
           // Detect if it was a list item in the original text (started with emoji, dash, bullet, or number)
           const wasListItem = originalTrimmed.match(/^([-\•\*\u1000-\uFFFF]|\d+\.)/);
           
           if (wasListItem) {
             // If the cleaned text doesn't already start with a standard marker, add a bullet
             if (!trimmed.match(/^([-\•\*]|\d+\.)/)) {
               trimmed = '• ' + trimmed;
             }
             doc.fillColor('#334155').fontSize(11).font('Helvetica').text(trimmed, { indent: 20 });
           } else {
             doc.fillColor('#0f172a').fontSize(11).font('Helvetica').text(trimmed);
             doc.moveDown(0.2); // Add a tiny bit of spacing between normal paragraphs
           }
        }
      });
    } else {
      // Render database records with zebra striping
      let yPos = doc.y;
      records.forEach((r, index) => {
        // Wrap to new page if getting too close to footer
        if (yPos > doc.page.height - 100) {
          doc.addPage();
          yPos = doc.y + 20; // reset yPos on new page
        }
        
        if (index % 2 === 0) {
          doc.rect(50, yPos - 5, doc.page.width - 100, 25).fillColor('#f8fafc').fill();
        }
        
        doc.fillColor('#64748b').fontSize(11).font('Helvetica-Bold').text(cleanText(r.date), 60, yPos);
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica').text(cleanText(r.info), 180, yPos);
        
        yPos += 25;
        doc.y = yPos;
      });
    }

    // --- Apply Global Headers, Footers, and Borders ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Page Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).lineWidth(2).strokeColor('#0284c7').stroke();

      // Premium Header Background
      doc.rect(20, 20, doc.page.width - 40, 80).fill('#0f172a');
      doc.fillColor('#38bdf8').fontSize(28).font('Helvetica-Bold').text('NEXUS OS', 20, 35, { width: doc.page.width - 40, align: 'center', characterSpacing: 2 });
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text('Automated Fitness Analytics', 20, 70, { width: doc.page.width - 40, align: 'center', characterSpacing: 1 });
    }

    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DSA Solved Problems Tracking
app.post('/api/dsa/solved', async (req, res) => {
  try {
    const data = parsePayload(req.body, req.query);
    const { chat_id, platform, title_slug } = data;
    await runSql(
      `INSERT OR IGNORE INTO dsa_solved_problems (chat_id, platform, title_slug) VALUES (?, ?, ?)`,
      [chat_id, platform.toLowerCase(), title_slug.toLowerCase()]
    );
    res.json({ status: 'success', message: 'DSA problem marked as solved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dsa/solved', async (req, res) => {
  try {
    const { chat_id, platform } = req.query;
    let query = `SELECT title_slug FROM dsa_solved_problems WHERE chat_id = ?`;
    const params = [chat_id];
    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform.toLowerCase());
    }
    const rows = await getSql(query, params);
    res.json({ status: 'success', data: rows.map(r => r.title_slug) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

