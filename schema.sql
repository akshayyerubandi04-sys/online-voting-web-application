-- Database schema for the Secure Online Voting Web Application

-- Users table stores authentication credentials
-- To maintain privacy, we store only the SHA-256 hash of the national identity number,
-- plus a masked version for UI rendering.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_hash TEXT UNIQUE NOT NULL,
  identity_masked TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Voters table stores voter eligibility details
-- A user can only register once as a voter.
CREATE TABLE IF NOT EXISTS voters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  constituency TEXT NOT NULL,
  status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Candidates table stores candidacy profiles
-- A user can only file one candidacy application.
CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  candidate_name TEXT NOT NULL,
  party_affiliation TEXT NOT NULL,
  constituency TEXT NOT NULL,
  manifesto TEXT NOT NULL,
  document_url TEXT,
  status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
