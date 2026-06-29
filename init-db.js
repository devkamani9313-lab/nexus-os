import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.db');
console.log(`Initializing SQLite database at ${dbPath}...`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Create user sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      chat_id TEXT PRIMARY KEY,
      active_agent TEXT DEFAULT 'gym'
    )
  `, (err) => {
    if (err) console.error('Failed to create user_sessions table:', err.message);
  });

  // Create user profiles table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      chat_id TEXT PRIMARY KEY,
      age INTEGER,
      height REAL,
      target_calories INTEGER,
      target_protein INTEGER,
      target_carbs INTEGER,
      target_fat INTEGER,
      target_weight REAL,
      activity_level TEXT
    )
  `, (err) => {
    if (err) console.error('Failed to create user_profiles table:', err.message);
  });

  // Create weight history table
  db.run(`
    CREATE TABLE IF NOT EXISTS weight_history (
      chat_id TEXT,
      date TEXT,
      weight REAL,
      PRIMARY KEY (chat_id, date)
    )
  `, (err) => {
    if (err) console.error('Failed to create weight_history table:', err.message);
  });

  // Create workout plans table
  db.run(`
    CREATE TABLE IF NOT EXISTS workout_plans (
      chat_id TEXT,
      day_of_week TEXT,
      routine_text TEXT,
      PRIMARY KEY (chat_id, day_of_week)
    )
  `, (err) => {
    if (err) console.error('Failed to create workout_plans table:', err.message);
  });

  // Create workout logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date TEXT,
      exercise_name TEXT,
      weight REAL,
      reps INTEGER,
      sets INTEGER
    )
  `, (err) => {
    if (err) console.error('Failed to create workout_logs table:', err.message);
  });

  // Create nutrition logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date TEXT,
      food_name TEXT,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL
    )
  `, (err) => {
    if (err) console.error('Failed to create nutrition_logs table:', err.message);
  });

  // Create attendance logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      chat_id TEXT,
      date TEXT,
      status TEXT,
      PRIMARY KEY (chat_id, date)
    )
  `, (err) => {
    if (err) console.error('Failed to create attendance_logs table:', err.message);
  });
  // Create finance transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date TEXT,
      type TEXT,
      category TEXT,
      amount REAL,
      vendor TEXT
    )
  `, (err) => {
    if (err) console.error('Failed to create finance_transactions table:', err.message);
  });

  // Create finance debts table
  db.run(`
    CREATE TABLE IF NOT EXISTS finance_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date TEXT,
      person_name TEXT,
      amount_owed REAL,
      description TEXT
    )
  `, (err) => {
    if (err) console.error('Failed to create finance_debts table:', err.message);
  });

  // Create finance wishlist table
  db.run(`
    CREATE TABLE IF NOT EXISTS finance_wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date_added TEXT,
      item_name TEXT,
      url TEXT,
      target_price REAL
    )
  `, (err) => {
    if (err) console.error('Failed to create finance_wishlist table:', err.message);
  });

  // Create finance portfolio table
  db.run(`
    CREATE TABLE IF NOT EXISTS finance_portfolio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      asset_symbol TEXT,
      amount_owned REAL,
      average_buy_price REAL
    )
  `, (err) => {
    if (err) console.error('Failed to create finance_portfolio table:', err.message);
  });

  // Create finance stock transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS finance_stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      date TEXT,
      type TEXT,
      asset_symbol TEXT,
      shares REAL,
      price REAL,
      profit_loss REAL
    )
  `, (err) => {
    if (err) console.error('Failed to create finance_stock_transactions table:', err.message);
  });

  // Create dsa solved problems table
  db.run(`
    CREATE TABLE IF NOT EXISTS dsa_solved_problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      platform TEXT,
      title_slug TEXT,
      UNIQUE(chat_id, platform, title_slug)
    )
  `, (err) => {
    if (err) console.error('Failed to create dsa_solved_problems table:', err.message);
  });
});

db.close((err) => {
  if (err) {
    console.error('Failed to close database:', err.message);
  } else {
    console.log('Database initialized successfully.');
  }
});
