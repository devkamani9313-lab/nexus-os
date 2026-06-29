import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath);

const tables = ['finance_transactions', 'finance_debts', 'finance_wishlist', 'finance_portfolio'];

db.serialize(() => {
  tables.forEach(table => {
    db.run(`UPDATE ${table} SET chat_id = REPLACE(chat_id, '.0', '') WHERE chat_id LIKE '%.0'`, (err) => {
      if (err) console.error(`Error updating ${table}:`, err);
      else console.log(`Fixed chat_ids in ${table}`);
    });
  });
});

db.close(() => console.log('Done'));
