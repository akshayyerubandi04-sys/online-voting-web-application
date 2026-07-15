const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const DB_PATH = isVercel ? path.join('/tmp', 'voting_db.json') : path.join(__dirname, 'voting_db.json');

// Helper to load/save JSON database
function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading JSON database:', err.message);
  }
  return { users: [], voters: [], candidates: [] };
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing JSON database:', err.message);
  }
}

// Promisified database helpers mimicking sqlite3 API but using pure JS and JSON storage
const dbHelper = {
  /**
   * Run INSERT, UPDATE, or DELETE queries
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const data = loadDb();
        const sqlLower = sql.toLowerCase();

        if (sqlLower.includes('insert into users')) {
          // INSERT INTO users (identity_hash, identity_masked, password_hash) VALUES (?, ?, ?)
          const identity_hash = params[0];
          const identity_masked = params[1];
          const password_hash = params[2];

          // Enforce UNIQUE constraint on identity_hash
          if (data.users.some(u => u.identity_hash === identity_hash)) {
            return reject(new Error('UNIQUE constraint failed: users.identity_hash'));
          }

          const newUser = {
            id: data.users.length + 1,
            identity_hash,
            identity_masked,
            password_hash,
            created_at: new Date().toISOString()
          };
          data.users.push(newUser);
          saveDb(data);
          resolve({ id: newUser.id, changes: 1 });
        } else if (sqlLower.includes('insert into voters')) {
          // INSERT INTO voters (user_id, full_name, dob, constituency, status) VALUES (?, ?, ?, ?, 'APPROVED')
          const user_id = params[0];
          const full_name = params[1];
          const dob = params[2];
          const constituency = params[3];
          const status = 'APPROVED';

          // Enforce UNIQUE constraint on user_id
          if (data.voters.some(v => v.user_id === user_id)) {
            return reject(new Error('UNIQUE constraint failed: voters.user_id'));
          }

          const newVoter = {
            id: data.voters.length + 1,
            user_id,
            full_name,
            dob,
            constituency,
            status,
            registered_at: new Date().toISOString()
          };
          data.voters.push(newVoter);
          saveDb(data);
          resolve({ id: newVoter.id, changes: 1 });
        } else if (sqlLower.includes('insert into candidates')) {
          // INSERT INTO candidates (user_id, candidate_name, party_affiliation, constituency, manifesto, status) VALUES (?, ?, ?, ?, ?, 'PENDING')
          const user_id = params[0];
          const candidate_name = params[1];
          const party_affiliation = params[2];
          const constituency = params[3];
          const manifesto = params[4];
          const status = 'PENDING';

          // Enforce UNIQUE constraint on user_id
          if (data.candidates.some(c => c.user_id === user_id)) {
            return reject(new Error('UNIQUE constraint failed: candidates.user_id'));
          }

          const newCandidate = {
            id: data.candidates.length + 1,
            user_id,
            candidate_name,
            party_affiliation,
            constituency,
            manifesto,
            status,
            submitted_at: new Date().toISOString()
          };
          data.candidates.push(newCandidate);
          saveDb(data);
          resolve({ id: newCandidate.id, changes: 1 });
        } else {
          reject(new Error(`Unsupported write statement: ${sql}`));
        }
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Fetch a single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const data = loadDb();
        const sqlLower = sql.toLowerCase();

        if (sqlLower.includes('from users')) {
          if (sqlLower.includes('identity_hash =')) {
            const identity_hash = params[0];
            const user = data.users.find(u => u.identity_hash === identity_hash);
            resolve(user ? { ...user } : null);
          } else if (sqlLower.includes('id =')) {
            const id = Number(params[0]);
            const user = data.users.find(u => u.id === id);
            if (user) {
              resolve({ id: user.id, identity_masked: user.identity_masked });
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } else if (sqlLower.includes('from voters')) {
          if (sqlLower.includes('user_id =')) {
            const user_id = Number(params[0]);
            const voter = data.voters.find(v => v.user_id === user_id);
            resolve(voter ? { ...voter } : null);
          } else {
            resolve(null);
          }
        } else if (sqlLower.includes('from candidates')) {
          if (sqlLower.includes('user_id =')) {
            const user_id = Number(params[0]);
            const candidate = data.candidates.find(c => c.user_id === user_id);
            resolve(candidate ? { ...candidate } : null);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Fetch multiple rows
   */
  all(sql, params = []) {
    return new Promise((resolve) => {
      resolve([]);
    });
  },

  /**
   * Run raw batches of SQL commands
   */
  exec(sql) {
    return new Promise((resolve) => {
      // Create empty db structures if not present
      const data = loadDb();
      saveDb(data);
      resolve();
    });
  }
};

module.exports = dbHelper;
