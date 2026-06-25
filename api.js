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
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
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

    // Move start position down to account for the global header we will draw later
    doc.moveDown(5);

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

      // Premium Footer
      doc.rect(20, doc.page.height - 60, doc.page.width - 40, 40).fill('#0f172a');
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(`Page ${i + 1} of ${pages.count} • Generated by Nexus OS`, 20, doc.page.height - 45, { width: doc.page.width - 40, align: 'center' });
    }

    doc.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
