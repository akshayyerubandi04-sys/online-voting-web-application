const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const DB_PATH = isVercel ? path.join('/tmp', 'voting.db') : path.join(__dirname, 'voting.db');

// Connect to SQLite Database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database connection:', err.message);
  } else {
    console.log('Successfully connected to SQLite database at:', DB_PATH);
  }
});

// Promisified database helpers to support modern async/await syntax
const dbHelper = {
  /**
   * Run INSERT, UPDATE, or DELETE queries
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },

  /**
   * Fetch a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  /**
   * Fetch multiple rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  /**
   * Run raw batches of SQL commands
   */
  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
};

// Initialize schema on load
const schemaPath = path.join(__dirname, 'schema.sql');
try {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  dbHelper.exec(schemaSql)
    .then(() => {
      console.log('Database tables verified/initialized.');
    })
    .catch((err) => {
      console.error('Error executing schema SQL:', err.message);
    });
} catch (err) {
  console.error('Error reading schema.sql file:', err.message);
}

module.exports = dbHelper;
