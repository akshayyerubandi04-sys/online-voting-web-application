/**
 * Secure Online Voting Web Application - Client Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  // Detect current page and initialize appropriate modules
  const isAuthPage = !!document.getElementById('authForm');
  const isDashboardPage = !!document.getElementById('voterCard');

  if (isAuthPage) {
    initAuthPage();
  }

  if (isDashboardPage) {
    initDashboard();
  }
});

// ==========================================================================
// Theme Engine (Persistent across pages)
// ==========================================================================
function initTheme() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeBtnText = document.getElementById('themeBtnText');
  
  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButtonUI(savedTheme, themeBtnText);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeButtonUI(newTheme, themeBtnText);
    });
  }
}

function updateThemeButtonUI(theme, textEl) {
  if (!textEl) return;
  if (theme === 'dark') {
    textEl.textContent = '☀️ Light Mode';
  } else {
    textEl.textContent = '🌙 Dark Mode';
  }
}

// ==========================================================================
// Authentication Page Logic (index.html)
// ==========================================================================
function initAuthPage() {
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const authFormTitle = document.getElementById('authFormTitle');
  const authFormSubtitle = document.getElementById('authFormSubtitle');
  const identityInput = document.getElementById('identityInput');
  const passwordInput = document.getElementById('passwordInput');
  const passwordCriteria = document.getElementById('passwordCriteria');
  const submitBtnText = document.getElementById('submitBtnText');
  const authForm = document.getElementById('authForm');
  const statusBanner = document.getElementById('statusBanner');
  
  let isSignUpMode = false;

  // Toggle Tab Focus
  tabSignIn.addEventListener('click', () => setAuthMode(false));
  tabSignUp.addEventListener('click', () => setAuthMode(true));

  function setAuthMode(signUpMode) {
    isSignUpMode = signUpMode;
    clearBanner();
    
    if (isSignUpMode) {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      authFormTitle.textContent = 'Create Credentials';
      authFormSubtitle.textContent = 'Register your identity card details to request onboarding.';
      passwordCriteria.style.display = 'block';
      submitBtnText.textContent = 'Complete Onboarding';
    } else {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      authFormTitle.textContent = 'Welcome Portal';
      authFormSubtitle.textContent = 'Verify your identity to enter the secure portal.';
      passwordCriteria.style.display = 'none';
      submitBtnText.textContent = 'Access Dashboard';
    }
  }

  // Aadhaar auto-formatting input hook: Adds spacing "0000 0000 0000"
  identityInput.addEventListener('input', (e) => {
    // Retain only numeric values
    let val = e.target.value.replace(/\D/g, '');
    
    // Group in sets of four digits
    let formattedVal = '';
    for (let i = 0; i < val.length && i < 12; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedVal += ' ';
      }
      formattedVal += val[i];
    }
    
    e.target.value = formattedVal;
    
    // Visual error indication for Aadhaar length format
    const digits = formattedVal.replace(/\s/g, '').length;
    if (digits > 0 && digits < 12) {
      identityInput.style.borderColor = 'var(--warning)';
    } else if (digits === 12) {
      identityInput.style.borderColor = 'var(--success)';
    } else {
      identityInput.style.borderColor = 'var(--border-color)';
    }
  });

  // Password complexity check hook (Real-time triggers during typing)
  passwordInput.addEventListener('input', (e) => {
    if (!isSignUpMode) return;
    const val = e.target.value;
    
    // Test validations
    const lengthValid = val.length >= 8;
    const upperValid = /[A-Z]/.test(val);
    const lowerValid = /[a-z]/.test(val);
    const numberValid = /\d/.test(val);

    updateRuleUI('ruleLength', lengthValid);
    updateRuleUI('ruleUpper', upperValid);
    updateRuleUI('ruleLower', lowerValid);
    updateRuleUI('ruleNumber', numberValid);
  });

  function updateRuleUI(elemId, isValid) {
    const el = document.getElementById(elemId);
    if (isValid) {
      el.classList.add('valid');
      el.classList.remove('invalid');
    } else {
      el.classList.add('invalid');
      el.classList.remove('valid');
    }
  }

  // Onboarding Form Submit Handler
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearBanner();

    const identityNum = identityInput.value.replace(/\s/g, '');
    const password = passwordInput.value;

    // Frontend validations
    if (identityNum.length !== 12) {
      showBanner('Identity number must be exactly 12 digits (Aadhaar format).', 'error');
      return;
    }

    if (isSignUpMode) {
      // Validate all criteria are met
      const lengthValid = password.length >= 8;
      const upperValid = /[A-Z]/.test(password);
      const lowerValid = /[a-z]/.test(password);
      const numberValid = /\d/.test(password);

      if (!lengthValid || !upperValid || !lowerValid || !numberValid) {
        showBanner('Please satisfy all password complexity rules before registering.', 'error');
        return;
      }
    }

    // Submit API
    const endpoint = isSignUpMode ? '/api/auth/register' : '/api/auth/login';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityNumber: identityNum, password })
      });
      
      const data = await response.json();

      if (!response.ok) {
        showBanner(data.error || 'Request failed.', 'error');
        return;
      }

      showBanner(isSignUpMode ? 'Account created! Loading dashboard...' : 'Success! Directing to portal...', 'success');
      
      // Delay redirection slightly so user sees success feedback
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);

    } catch (err) {
      console.error(err);
      showBanner('Failed to contact registration server. Make sure it is active.', 'error');
    }
  });

  function showBanner(message, type) {
    statusBanner.textContent = message;
    statusBanner.className = `status-banner ${type}`;
  }

  function clearBanner() {
    statusBanner.textContent = '';
    statusBanner.className = 'status-banner';
  }
}

// ==========================================================================
// Dashboard Page Logic (dashboard.html)
// ==========================================================================
function initDashboard() {
  const logoutBtn = document.getElementById('logoutBtn');
  const userMaskedId = document.getElementById('userMaskedId');
  
  // Voter DOM
  const voterStatusBadge = document.getElementById('voterStatusBadge');
  const btnOpenVoterModal = document.getElementById('btnOpenVoterModal');
  const voterDetailsBlock = document.getElementById('voterDetailsBlock');
  const voterValName = document.getElementById('voterValName');
  const voterValDob = document.getElementById('voterValDob');
  const voterValConstituency = document.getElementById('voterValConstituency');
  const voterValTime = document.getElementById('voterValTime');
  
  // Candidate DOM
  const candidateStatusBadge = document.getElementById('candidateStatusBadge');
  const btnOpenCandidateModal = document.getElementById('btnOpenCandidateModal');
  const candidateDetailsBlock = document.getElementById('candidateDetailsBlock');
  const candidateCardDesc = document.getElementById('candidateCardDesc');
  const candidateValName = document.getElementById('candidateValName');
  const candidateValParty = document.getElementById('candidateValParty');
  const candidateValConstituency = document.getElementById('candidateValConstituency');
  const candidateValManifesto = document.getElementById('candidateValManifesto');
  
  // Modal Overlays
  const voterModal = document.getElementById('voterModal');
  const voterCloseBtn = document.getElementById('voterCloseBtn');
  const voterForm = document.getElementById('voterForm');
  const voterModalStatusBanner = document.getElementById('voterModalStatusBanner');
  
  const candidateModal = document.getElementById('candidateModal');
  const candidateCloseBtn = document.getElementById('candidateCloseBtn');
  const candidateForm = document.getElementById('candidateForm');
  const candidateConstituencyInput = document.getElementById('candidateConstituency');
  const candidateModalStatusBanner = document.getElementById('candidateModalStatusBanner');

  // Load user data on startup
  loadDashboardData();

  async function loadDashboardData() {
    try {
      const response = await fetch('/api/user/status');
      
      if (response.status === 401) {
        // Session unauthorized: redirect to onboarding landing page
        window.location.href = '/';
        return;
      }
      
      const data = await response.json();
      
      // Populate User details
      userMaskedId.textContent = `Identity Card: ${data.user.identityMasked}`;
      
      // Update Voter details
      if (data.voter) {
        voterStatusBadge.textContent = data.voter.status;
        voterStatusBadge.className = `badge-status ${data.voter.status.toLowerCase()}`;
        btnOpenVoterModal.style.display = 'none';
        
        // Show voter details card
        voterValName.textContent = data.voter.fullName;
        voterValDob.textContent = data.voter.dob;
        voterValConstituency.textContent = data.voter.constituency;
        voterValTime.textContent = new Date(data.voter.registeredAt).toLocaleString();
        voterDetailsBlock.style.display = 'flex';
        
        // Activate Candidate Registry Option pathway since voter status is approved
        if (data.voter.status === 'APPROVED') {
          btnOpenCandidateModal.disabled = false;
          candidateStatusBadge.textContent = 'Not Applied';
          candidateStatusBadge.className = 'badge-status not-registered';
          candidateConstituencyInput.value = data.voter.constituency; // Autofill constituency
        }
      } else {
        voterStatusBadge.textContent = 'Not Registered';
        voterStatusBadge.className = 'badge-status not-registered';
        btnOpenVoterModal.style.display = 'block';
        voterDetailsBlock.style.display = 'none';
        
        // Lock candidacy pathway
        btnOpenCandidateModal.disabled = true;
        candidateStatusBadge.textContent = 'Disabled';
        candidateStatusBadge.className = 'badge-status not-registered';
        candidateCardDesc.innerHTML = `<span style="color: var(--error);">⚠️ You must register and clear voter eligibility verification before applying for candidacy.</span>`;
      }
      
      // Update Candidate details
      if (data.candidate) {
        candidateStatusBadge.textContent = data.candidate.status;
        candidateStatusBadge.className = `badge-status ${data.candidate.status.toLowerCase()}`;
        btnOpenCandidateModal.style.display = 'none';
        
        // Populate candidate details card
        candidateValName.textContent = data.candidate.candidateName;
        candidateValParty.textContent = data.candidate.partyAffiliation;
        candidateValConstituency.textContent = data.candidate.constituency;
        candidateValManifesto.textContent = data.candidate.manifesto;
        candidateDetailsBlock.style.display = 'flex';
      } else if (data.voter && data.voter.status === 'APPROVED') {
        btnOpenCandidateModal.style.display = 'block';
        candidateDetailsBlock.style.display = 'none';
      }

    } catch (err) {
      console.error(err);
    }
  }

  // Log Out Trigger
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  // ==========================================================
  // Modal Overrides & Triggers
  // ==========================================================
  
  // Voter Modal control
  btnOpenVoterModal.addEventListener('click', () => {
    voterModalStatusBanner.style.display = 'none';
    voterModal.classList.add('active');
  });
  voterCloseBtn.addEventListener('click', () => voterModal.classList.remove('active'));

  // Candidate Modal control
  btnOpenCandidateModal.addEventListener('click', () => {
    candidateModalStatusBanner.style.display = 'none';
    candidateModal.classList.add('active');
  });
  candidateCloseBtn.addEventListener('click', () => candidateModal.classList.remove('active'));

  // Close modal when clicking outside contents
  window.addEventListener('click', (e) => {
    if (e.target === voterModal) voterModal.classList.remove('active');
    if (e.target === candidateModal) candidateModal.classList.remove('active');
  });

  // Support ESC keyboard accessibility to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      voterModal.classList.remove('active');
      candidateModal.classList.remove('active');
    }
  });

  // Voter registration submission
  voterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    voterModalStatusBanner.style.display = 'none';

    const fullName = document.getElementById('voterFullName').value;
    const dob = document.getElementById('voterDob').value;
    const constituency = document.getElementById('voterConstituency').value;

    // Client-side age validation (Check if user >= 18)
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      voterModalStatusBanner.textContent = `Eligibility rejection: You must be at least 18 years old. (Calculated age: ${age})`;
      voterModalStatusBanner.style.display = 'block';
      return;
    }

    try {
      const response = await fetch('/api/voter/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, dob, constituency })
      });

      const data = await response.json();
      if (!response.ok) {
        voterModalStatusBanner.textContent = data.error || 'Failed to submit voter registration.';
        voterModalStatusBanner.style.display = 'block';
        return;
      }

      voterModal.classList.remove('active');
      voterForm.reset();
      loadDashboardData();

    } catch (err) {
      console.error(err);
      voterModalStatusBanner.textContent = 'Server communication error. Try again.';
      voterModalStatusBanner.style.display = 'block';
    }
  });

  // Candidate registration submission
  candidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    candidateModalStatusBanner.style.display = 'none';

    const candidateName = document.getElementById('candidateName').value;
    const partyAffiliation = document.getElementById('partyAffiliation').value;
    const constituency = candidateConstituencyInput.value;
    const manifesto = document.getElementById('candidateManifesto').value;

    try {
      const response = await fetch('/api/candidate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName, partyAffiliation, constituency, manifesto })
      });

      const data = await response.json();
      if (!response.ok) {
        candidateModalStatusBanner.textContent = data.error || 'Failed to submit candidate application.';
        candidateModalStatusBanner.style.display = 'block';
        return;
      }

      candidateModal.classList.remove('active');
      candidateForm.reset();
      loadDashboardData();

    } catch (err) {
      console.error(err);
      candidateModalStatusBanner.textContent = 'Server communication error. Try again.';
      candidateModalStatusBanner.style.display = 'block';
    }
  });
}
