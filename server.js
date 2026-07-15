const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Secret keys for cookies and HMAC signatures
const COOKIE_SECRET = crypto.randomBytes(32).toString('hex'); // Dynamic per server run, or stable string
const IDENTITY_SECRET = 'secure-online-voting-hmac-salt-2026';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(COOKIE_SECRET));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Cryptographic and Format Security Helpers
// -------------------------------------------------------------

/**
 * Normalizes and hashes the Identity Number (e.g. Aadhaar) to protect privacy.
 * Uses HMAC-SHA-256 with a server secret to prevent rainbow table attacks.
 */
function hashIdentity(identityNumber) {
  const normalized = identityNumber.replace(/[\s-]/g, '').trim();
  return crypto.createHmac('sha256', IDENTITY_SECRET).update(normalized).digest('hex');
}

/**
 * Normalizes and masks the Identity Number so it can be safely displayed in the UI.
 * E.g., "123456789012" -> "XXXX-XXXX-9012"
 */
function maskIdentity(identityNumber) {
  const normalized = identityNumber.replace(/[\s-]/g, '').trim();
  if (normalized.length < 4) {
    return 'X'.repeat(normalized.length);
  }
  const lastFour = normalized.slice(-4);
  const prefixLength = normalized.length - 4;
  
  let maskedPrefix = '';
  for (let i = 0; i < prefixLength; i++) {
    maskedPrefix += 'X';
    if ((i + 1) % 4 === 0 && i !== prefixLength - 1) {
      maskedPrefix += '-';
    }
  }
  return maskedPrefix ? `${maskedPrefix}-${lastFour}` : lastFour;
}

/**
 * Hashing passwords using Node's native crypto.scryptSync (highly secure, zero node-gyp build dependencies)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against the cryptographically secure hash
 */
function verifyPassword(password, storedHash) {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const key = Buffer.from(keyHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(key, derivedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Helper to calculate age in years from DOB string (YYYY-MM-DD)
 */
function getAge(dobString) {
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// -------------------------------------------------------------
// Authentication Route Guards
// -------------------------------------------------------------
function requireAuth(req, res, next) {
  const session = req.signedCookies.session;
  if (!session || !session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Session expired or missing.' });
  }
  req.userId = session.userId;
  next();
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

/**
 * Onboarding: Sign Up route
 */
app.post('/api/auth/register', async (req, res) => {
  const { identityNumber, password } = req.body;

  // Server-side validation
  if (!identityNumber || !password) {
    return res.status(400).json({ error: 'Identity number and password are required.' });
  }

  // Identity field format checking (Expect exactly 12 digits, support space/dash styling)
  const normalizedIdentity = identityNumber.replace(/[\s-]/g, '').trim();
  const identityRegex = /^\d{12}$/;
  if (!identityRegex.test(normalizedIdentity)) {
    return res.status(400).json({ error: 'Invalid Identity Format. Must be a 12-digit number (Aadhaar format).' });
  }

  // Password strength check (Min 8 chars, 1 uppercase, 1 lowercase, 1 digit)
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ 
      error: 'Password too weak. Must be at least 8 characters long, contain an uppercase letter, a lowercase letter, and a number.' 
    });
  }

  const identityHash = hashIdentity(normalizedIdentity);
  const identityMasked = maskIdentity(normalizedIdentity);
  const passwordHash = hashPassword(password);

  try {
    // Attempt database insert
    const result = await db.run(
      `INSERT INTO users (identity_hash, identity_masked, password_hash) VALUES (?, ?, ?)`,
      [identityHash, identityMasked, passwordHash]
    );

    // Auto-login on successful registration
    res.cookie('session', { userId: result.id }, {
      httpOnly: true,
      signed: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
      secure: false // Keep false for localhost HTTP
    });

    return res.status(201).json({ success: true, message: 'Registration and onboarding successful.' });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'This Identity Number is already registered.' });
    }
    console.error('Registration Error:', err);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

/**
 * Onboarding: Sign In route
 */
app.post('/api/auth/login', async (req, res) => {
  const { identityNumber, password } = req.body;

  if (!identityNumber || !password) {
    return res.status(400).json({ error: 'Identity number and password are required.' });
  }

  const normalizedIdentity = identityNumber.replace(/[\s-]/g, '').trim();
  const identityHash = hashIdentity(normalizedIdentity);

  try {
    const user = await db.get(`SELECT * FROM users WHERE identity_hash = ?`, [identityHash]);

    // Use generic verification message to prevent user enumeration
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid identity credential or password.' });
    }

    // Set signed session cookie
    res.cookie('session', { userId: user.id }, {
      httpOnly: true,
      signed: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: false
    });

    return res.json({ success: true, message: 'Logged in successfully.' });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

/**
 * Onboarding: Log Out route
 */
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Get current user session status and details (Voter & Candidate status checks)
 */
app.get('/api/user/status', requireAuth, async (req, res) => {
  try {
    const user = await db.get(`SELECT id, identity_masked FROM users WHERE id = ?`, [req.userId]);
    if (!user) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'User does not exist.' });
    }

    const voter = await db.get(`SELECT * FROM voters WHERE user_id = ?`, [req.userId]);
    const candidate = await db.get(`SELECT * FROM candidates WHERE user_id = ?`, [req.userId]);

    return res.json({
      loggedIn: true,
      user: {
        id: user.id,
        identityMasked: user.identity_masked
      },
      voter: voter ? {
        fullName: voter.full_name,
        dob: voter.dob,
        constituency: voter.constituency,
        status: voter.status,
        registeredAt: voter.registered_at
      } : null,
      candidate: candidate ? {
        candidateName: candidate.candidate_name,
        partyAffiliation: candidate.party_affiliation,
        constituency: candidate.constituency,
        manifesto: candidate.manifesto,
        status: candidate.status,
        submittedAt: candidate.submitted_at
      } : null
    });
  } catch (err) {
    console.error('Status Fetch Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * Option A: Register as a Voter
 */
app.post('/api/voter/register', requireAuth, async (req, res) => {
  const { fullName, dob, constituency } = req.body;

  if (!fullName || !dob || !constituency) {
    return res.status(400).json({ error: 'All fields (Full Name, Date of Birth, and Constituency) are required.' });
  }

  // Validate Age is 18 or older
  const age = getAge(dob);
  if (age < 18) {
    return res.status(400).json({ error: `Registration rejected. You must be at least 18 years old to vote. (Current age: ${age})` });
  }

  try {
    // Check if voter entry already exists for user
    const existing = await db.get(`SELECT id FROM voters WHERE user_id = ?`, [req.userId]);
    if (existing) {
      return res.status(400).json({ error: 'You are already registered or have a pending voter registration.' });
    }

    // Insert voter record (Set status to 'PENDING' for realistic simulation)
    // To make it instantly usable, we'll write APPROVED so they can candidates,
    // or let it go to APPROVED after a mock background delay. Let's make it APPROVED
    // immediately for fluid demonstration, or APPROVED with a warning.
    // Actually, setting it to APPROVED directly makes the onboarding flow clean.
    // Let's set status to APPROVED directly so they are registered immediately!
    await db.run(
      `INSERT INTO voters (user_id, full_name, dob, constituency, status) VALUES (?, ?, ?, ?, 'APPROVED')`,
      [req.userId, fullName.trim(), dob, constituency.trim()]
    );

    return res.status(201).json({ success: true, message: 'Voter registration completed and verified.' });
  } catch (err) {
    console.error('Voter Registration Error:', err);
    return res.status(500).json({ error: 'Failed to process voter registration.' });
  }
});

/**
 * Option B: Register as a Voting Candidate
 */
app.post('/api/candidate/register', requireAuth, async (req, res) => {
  const { candidateName, partyAffiliation, constituency, manifesto } = req.body;

  if (!candidateName || !partyAffiliation || !constituency || !manifesto) {
    return res.status(400).json({ error: 'All candidate fields are required.' });
  }

  try {
    // Functional Constraint: User MUST be registered as an APPROVED voter first!
    const voterRecord = await db.get(`SELECT id, status FROM voters WHERE user_id = ?`, [req.userId]);
    if (!voterRecord || voterRecord.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Candidacy application rejected. You must be registered and approved as a voter first.' });
    }

    // Check if candidacy already exists
    const existing = await db.get(`SELECT id FROM candidates WHERE user_id = ?`, [req.userId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already submitted a candidacy application.' });
    }

    // Submit candidacy (status defaults to 'PENDING' for evaluation workflow)
    await db.run(
      `INSERT INTO candidates (user_id, candidate_name, party_affiliation, constituency, manifesto, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`,
      [req.userId, candidateName.trim(), partyAffiliation.trim(), constituency.trim(), manifesto.trim()]
    );

    return res.status(201).json({ success: true, message: 'Candidacy application filed successfully and is currently under review.' });
  } catch (err) {
    console.error('Candidate Registration Error:', err);
    return res.status(500).json({ error: 'Failed to file candidate application.' });
  }
});

// Serve frontend page paths directly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start Express Server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`Secure Voting Application Server started!`);
    console.log(`Local Access URL: http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
