/**
 * Integration Test and Verification Script
 * Launches the voting application, simulates client requests, and validates all security constraints.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Clean up previous database to ensure clean state
const dbFile = path.join(__dirname, 'voting.db');
if (fs.existsSync(dbFile)) {
  try {
    fs.unlinkSync(dbFile);
    console.log('Removed old database file for testing.');
  } catch (err) {
    console.warn('Could not clean db file:', err.message);
  }
}

// Global configurations
const TEST_PORT = 3123;
const BASE_URL = `http://localhost:${TEST_PORT}`;
let serverProcess = null;
let savedCookie = '';

// Helper function to extract the cookie header
function getCookieHeader(responseHeaders) {
  const setCookie = responseHeaders['set-cookie'];
  if (setCookie && setCookie.length > 0) {
    // Extract the signature part of the cookie
    return setCookie[0].split(';')[0];
  }
  return '';
}

// Promise wrapper to handle JSON fetch requests via HTTP
function makeRequest(pathName, method, body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${pathName}`;
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const payload = body ? JSON.stringify(body) : '';
    const reqOptions = {
      method: method,
      headers: headers
    };

    const req = http.request(url, reqOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          parsed = responseBody;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(payload);
    }
    req.end();
  });
}

// Assert helper
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILURE: ${message}`);
    cleanupAndExit(1);
  } else {
    console.log(`✅ SUCCESS: ${message}`);
  }
}

function cleanupAndExit(code = 0) {
  if (serverProcess) {
    console.log('Stopping server process...');
    serverProcess.kill('SIGINT');
  }
  process.exit(code);
}

// -------------------------------------------------------------
// Test Pipeline
// -------------------------------------------------------------
async function runTests() {
  console.log('Starting integration tests...');

  // Start the server process
  serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: TEST_PORT },
    stdio: 'pipe'
  });

  // Wait for the server to spin up
  await new Promise((resolve) => {
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server] ${output.trim()}`);
      if (output.includes('Server started!')) {
        resolve();
      }
    });
    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString()}`);
    });
  });

  try {
    // -------------------------------------------------------------
    // Test Case 1: Sign up verification with invalid identity (10 digits instead of 12)
    // -------------------------------------------------------------
    const res1 = await makeRequest('/api/auth/register', 'POST', {
      identityNumber: '1234567890',
      password: 'StrongPassword123'
    });
    assert(res1.status === 400, 'Rejects registration with short Identity Number (10 digits)');
    assert(res1.data.error.includes('12-digit number'), 'Returns helpful format error message');

    // -------------------------------------------------------------
    // Test Case 2: Sign up verification with weak password (missing numbers/uppercase)
    // -------------------------------------------------------------
    const res2 = await makeRequest('/api/auth/register', 'POST', {
      identityNumber: '111122223333',
      password: 'weak'
    });
    assert(res2.status === 400, 'Rejects registration with weak password');
    assert(res2.data.error.includes('Password too weak'), 'Returns password rules error message');

    // -------------------------------------------------------------
    // Test Case 3: Valid Sign up & Auto-Login cookie verify
    // -------------------------------------------------------------
    const res3 = await makeRequest('/api/auth/register', 'POST', {
      identityNumber: '1111 2222 3333',
      password: 'SecurePassword1'
    });
    assert(res3.status === 201, 'Accepts valid registration format and hashes input');
    savedCookie = getCookieHeader(res3.headers);
    assert(savedCookie.includes('session'), 'Returns signed session cookie on signup');

    // -------------------------------------------------------------
    // Test Case 4: Duplicate registration conflict error
    // -------------------------------------------------------------
    const res4 = await makeRequest('/api/auth/register', 'POST', {
      identityNumber: '1111-2222-3333', // formatted differently but normalizes to same
      password: 'SecurePassword2'
    });
    assert(res4.status === 400, 'Enforces database constraint preventing duplicate registration of the same Identity');
    assert(res4.data.error.includes('already registered'), 'Returns correct message for duplicate identity');

    // -------------------------------------------------------------
    // Test Case 5: Route guard blocks anonymous dashboard status fetches
    // -------------------------------------------------------------
    const res5 = await makeRequest('/api/user/status', 'GET');
    assert(res5.status === 401, 'Auth middleware blocks access to dashboard status without session');

    // -------------------------------------------------------------
    // Test Case 6: Login using registered credentials
    // -------------------------------------------------------------
    const res6 = await makeRequest('/api/auth/login', 'POST', {
      identityNumber: '111122223333',
      password: 'SecurePassword1'
    });
    assert(res6.status === 200, 'Successfully authenticates user with correct credentials');
    const newCookie = getCookieHeader(res6.headers);
    assert(newCookie.includes('session'), 'Yields secure cookie header upon sign in');

    // -------------------------------------------------------------
    // Test Case 7: Access /api/user/status with active cookie
    // -------------------------------------------------------------
    const res7 = await makeRequest('/api/user/status', 'GET', null, newCookie);
    assert(res7.status === 200, 'Allows dashboard status fetch for authenticated session');
    assert(res7.data.user.identityMasked === 'XXXX-XXXX-3333', 'Returns masked Identity representation to protect user privacy');
    assert(res7.data.voter === null, 'Identifies user has not yet registered as a voter');
    assert(res7.data.candidate === null, 'Identifies user is not registered as a candidate');

    // -------------------------------------------------------------
    // Test Case 8: Attempt to file candidacy before voter registration
    // -------------------------------------------------------------
    const res8 = await makeRequest('/api/candidate/register', 'POST', {
      candidateName: 'John Citizen',
      partyAffiliation: 'Independent Party',
      constituency: 'Electoral Zone A',
      manifesto: 'This is my test campaign promise text.'
    }, newCookie);
    assert(res8.status === 400, 'Candidacy endpoint rejects application if not a registered voter');
    assert(res8.data.error.includes('voter first'), 'Rejection reasons inform about voter check prerequisite');

    // -------------------------------------------------------------
    // Test Case 9: Voter registration age check (underage date: 2020-01-01)
    // -------------------------------------------------------------
    const res9 = await makeRequest('/api/voter/register', 'POST', {
      fullName: 'John Doe Jr.',
      dob: '2020-01-01',
      constituency: 'Electoral Zone A'
    }, newCookie);
    assert(res9.status === 400, 'Enforces age eligibility rule (Minimum age limit 18+)');
    assert(res9.data.error.includes('18 years old'), 'Validation failure output displays age warning');

    // -------------------------------------------------------------
    // Test Case 10: Valid voter registration (Adult age: 1990-01-01)
    // -------------------------------------------------------------
    const res10 = await makeRequest('/api/voter/register', 'POST', {
      fullName: 'John Doe Sr.',
      dob: '1990-05-15',
      constituency: 'Electoral Zone A'
    }, newCookie);
    assert(res10.status === 201, 'Voter registration successfully accepts and processes eligible candidate');

    // -------------------------------------------------------------
    // Test Case 11: File candidacy now that the user is an approved voter
    // -------------------------------------------------------------
    const res11 = await makeRequest('/api/candidate/register', 'POST', {
      candidateName: 'John Doe Sr.',
      partyAffiliation: 'Green Alliance',
      constituency: 'Electoral Zone A',
      manifesto: 'We build sustainable infrastructures and improve local parks.'
    }, newCookie);
    assert(res11.status === 201, 'Successfully files candidate application');

    // -------------------------------------------------------------
    // Test Case 12: Verify dashboard status returns both records correctly
    // -------------------------------------------------------------
    const res12 = await makeRequest('/api/user/status', 'GET', null, newCookie);
    assert(res12.status === 200, 'Fetches current state updates');
    assert(res12.data.voter.status === 'APPROVED', 'Voter status returned is APPROVED');
    assert(res12.data.candidate.status === 'PENDING', 'Candidacy status is PENDING review');
    assert(res12.data.candidate.partyAffiliation === 'Green Alliance', 'Returns core candidate details correctly');

    console.log('\n🌟 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY! Foundational security parameters are verified.');
    cleanupAndExit(0);
  } catch (err) {
    console.error('Test Execution Error:', err);
    cleanupAndExit(1);
  }
}

runTests();
