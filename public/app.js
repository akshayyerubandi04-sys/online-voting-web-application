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
  const emailFormGroup = document.getElementById('emailFormGroup');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const passwordToggleBtn = document.getElementById('passwordToggleBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const authForm = document.getElementById('authForm');
  const statusBanner = document.getElementById('statusBanner');
  
  let isSignUpMode = false;

  // Password visibility toggle
  if (passwordToggleBtn) {
    passwordToggleBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      passwordToggleBtn.textContent = type === 'password' ? '👁️' : '🙈';
    });
  }

  // Toggle Tab Focus
  tabSignIn.addEventListener('click', () => setAuthMode(false));
  tabSignUp.addEventListener('click', () => setAuthMode(true));

  function setAuthMode(signUpMode) {
    isSignUpMode = signUpMode;
    clearBanner();
    resetValidation('identityInput', 'identityValidationMsg');
    resetValidation('passwordInput', 'passwordValidationMsg');
    resetValidation('emailInput', 'emailValidationMsg');
    
    if (isSignUpMode) {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      authFormTitle.textContent = 'Create Credentials';
      authFormSubtitle.textContent = 'Register your User Name details to request onboarding.';
      if (emailFormGroup) emailFormGroup.style.display = 'block';
      submitBtnText.textContent = 'Complete Onboarding';
    } else {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      authFormTitle.textContent = 'Welcome Portal';
      authFormSubtitle.textContent = 'Verify your User Name to enter the secure portal.';
      if (emailFormGroup) emailFormGroup.style.display = 'none';
      submitBtnText.textContent = 'Access Dashboard';
    }
  }

  function setInvalid(inputId, msgId, message) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (input) input.style.borderColor = 'var(--error)';
    if (msg) {
      msg.textContent = message;
      msg.style.display = 'block';
    }
  }

  function resetValidation(inputId, msgId) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (input) input.style.borderColor = 'var(--border-color)';
    if (msg) msg.style.display = 'none';
  }

  // Onboarding Form Submit Handler
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearBanner();
    resetValidation('identityInput', 'identityValidationMsg');
    resetValidation('passwordInput', 'passwordValidationMsg');
    resetValidation('emailInput', 'emailValidationMsg');

    const identityNum = identityInput.value.trim();
    const password = passwordInput.value;
    const email = isSignUpMode ? emailInput.value.trim() : '';

    // Frontend validations
    let hasError = false;

    if (!identityNum) {
      setInvalid('identityInput', 'identityValidationMsg', 'User Name is required.');
      hasError = true;
    }

    if (isSignUpMode) {
      if (!email) {
        setInvalid('emailInput', 'emailValidationMsg', 'Email address is required.');
        hasError = true;
      }
    }

    if (!password) {
      setInvalid('passwordInput', 'passwordValidationMsg', 'Password is required.');
      hasError = true;
    }

    if (hasError) return;

    // Submit API
    const endpoint = isSignUpMode ? '/api/auth/register' : '/api/auth/login';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityNumber: identityNum, password, email })
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
    statusBanner.style.display = 'block';
  }

  function clearBanner() {
    statusBanner.textContent = '';
    statusBanner.className = 'status-banner';
    statusBanner.style.display = 'none';
  }
}

// ==========================================================================
// Dashboard Page Logic (dashboard.html)
// ==========================================================================
function initDashboard() {
  const logoutBtn = document.getElementById('logoutBtn');
  const userMaskedId = document.getElementById('userMaskedId');
  const welcomeTitle = document.getElementById('welcomeTitle');
  const voterStatusHeaderSummary = document.getElementById('voterStatusHeaderSummary');
  const votingStatusHeaderBadge = document.getElementById('votingStatusHeaderBadge');
  
  // Voter DOM
  const voterStatusBadge = document.getElementById('voterStatusBadge');
  const btnOpenVoterModal = document.getElementById('btnOpenVoterModal');
  const voterDetailsBlock = document.getElementById('voterDetailsBlock');
  const voterValName = document.getElementById('voterValName');
  const voterValDob = document.getElementById('voterValDob');
  const voterValConstituency = document.getElementById('voterValConstituency');
  const voterValVotingStatus = document.getElementById('voterValVotingStatus');
  const voterValTime = document.getElementById('voterValTime');
  
  // Candidate DOM
  const candidateStatusBadge = document.getElementById('candidateStatusBadge');
  const btnOpenCandidateModal = document.getElementById('btnOpenCandidateModal');
  const candidateDetailsBlock = document.getElementById('candidateDetailsBlock');
  const candidateCardDesc = document.getElementById('candidateCardDesc');
  const candidateValName = document.getElementById('candidateValName');
  const candidateValRole = document.getElementById('candidateValRole');
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

  // Confirmation Modal DOM
  const voteConfirmModal = document.getElementById('voteConfirmModal');
  const voteConfirmCloseBtn = document.getElementById('voteConfirmCloseBtn');
  const voteConfirmModalBody = document.getElementById('voteConfirmModalBody');

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
      userMaskedId.textContent = `User Name: ${data.user.identityMasked}`;
      
      // Update Voter details
      if (data.voter) {
        if (welcomeTitle) welcomeTitle.textContent = `Welcome, ${data.voter.fullName}`;
        
        // Show Dynamic status summaries
        if (voterStatusHeaderSummary) voterStatusHeaderSummary.style.display = 'flex';
        
        // Voting status badges
        if (votingStatusHeaderBadge) {
          if (data.voter.hasVoted) {
            votingStatusHeaderBadge.textContent = 'Voting Status: ✔ Vote Cast Successfully';
            votingStatusHeaderBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            votingStatusHeaderBadge.style.border = '1px solid var(--success)';
            votingStatusHeaderBadge.style.color = 'var(--success)';
          } else {
            votingStatusHeaderBadge.textContent = 'Voting Status: Not Voted Yet';
            votingStatusHeaderBadge.style.background = 'rgba(245, 158, 11, 0.1)';
            votingStatusHeaderBadge.style.border = '1px solid var(--warning)';
            votingStatusHeaderBadge.style.color = 'var(--warning)';
          }
        }

        voterStatusBadge.textContent = data.voter.status;
        voterStatusBadge.className = `badge-status ${data.voter.status.toLowerCase()}`;
        btnOpenVoterModal.style.display = 'none';
        
        // Show voter details card
        voterValName.textContent = data.voter.fullName;
        voterValDob.textContent = data.voter.dob;
        voterValConstituency.textContent = data.voter.constituency;
        voterValTime.textContent = new Date(data.voter.registeredAt).toLocaleString();
        
        if (voterValVotingStatus) {
          if (data.voter.hasVoted) {
            voterValVotingStatus.textContent = '✔ Vote Cast Successfully';
            voterValVotingStatus.style.color = 'var(--success)';
          } else {
            voterValVotingStatus.textContent = 'Not Voted Yet';
            voterValVotingStatus.style.color = 'var(--warning)';
          }
        }
        
        voterDetailsBlock.style.display = 'flex';
        
        // Activate Candidate Registry Option pathway since voter status is approved
        if (data.voter.status === 'APPROVED') {
          btnOpenCandidateModal.disabled = false;
          candidateStatusBadge.textContent = 'Not Applied';
          candidateStatusBadge.className = 'badge-status not-registered';
          candidateConstituencyInput.value = data.voter.constituency; // Autofill constituency
          
          // Render candidates ballot section
          loadVotingBooth();
        } else {
          document.getElementById('votingBoothSection').style.display = 'none';
        }
      } else {
        if (welcomeTitle) welcomeTitle.textContent = 'Voting Portal';
        if (voterStatusHeaderSummary) voterStatusHeaderSummary.style.display = 'none';

        voterStatusBadge.textContent = 'Not Registered';
        voterStatusBadge.className = 'badge-status not-registered';
        btnOpenVoterModal.style.display = 'block';
        voterDetailsBlock.style.display = 'none';
        
        // Lock candidacy pathway
        btnOpenCandidateModal.disabled = true;
        candidateStatusBadge.textContent = 'Disabled';
        candidateStatusBadge.className = 'badge-status not-registered';
        candidateCardDesc.innerHTML = `<span style="color: var(--error);">⚠️ You must register and clear voter eligibility verification before applying for candidacy.</span>`;
        document.getElementById('votingBoothSection').style.display = 'none';
      }
      
      // Update Candidate details
      if (data.candidate) {
        candidateStatusBadge.textContent = data.candidate.status;
        candidateStatusBadge.className = `badge-status ${data.candidate.status.toLowerCase()}`;
        btnOpenCandidateModal.style.display = 'none';
        
        // Populate candidate details card
        candidateValName.textContent = data.candidate.candidateName;
        if (candidateValRole) candidateValRole.textContent = data.candidate.role;
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

  // Voting Booth renderer
  async function loadVotingBooth() {
    const section = document.getElementById('votingBoothSection');
    const grid = document.getElementById('candidatesBallotGrid');
    const banner = document.getElementById('votingBoothStatusBanner');
    
    if (!section || !grid) return;

    try {
      const response = await fetch('/api/candidates/list');
      if (!response.ok) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Failed to load candidates list.</p>';
        section.style.display = 'block';
        return;
      }

      const data = await response.json();
      grid.innerHTML = '';
      
      if (data.hasVoted) {
        if (banner) {
          banner.textContent = '✅ You have successfully cast your ballot for this election. Thank you!';
          banner.className = 'status-banner success';
          banner.style.display = 'block';
        }
      } else {
        if (banner) banner.style.display = 'none';
      }

      if (data.candidates.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center; padding: 2rem;">No approved candidates are running in your constituency yet.</p>';
      } else {
        data.candidates.forEach(c => {
          const card = document.createElement('article');
          card.className = 'candidate-ballot-card';
          
          const svgPlaceholder = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2364748b'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>`;
          const src = c.photoUrl ? c.photoUrl : svgPlaceholder;

          card.innerHTML = `
            <div class="candidate-photo-container">
              <img src="${src}" onerror="this.src=\`${svgPlaceholder}\`" class="candidate-photo" alt="${c.candidateName}">
            </div>
            <h3 class="candidate-ballot-name">${c.candidateName}</h3>
            <p class="candidate-ballot-party">${c.role} &bull; ${c.partyAffiliation}</p>
            <div class="candidate-ballot-meta">
              <span><strong>Age:</strong> ${c.age}</span>
              <span><strong>Qual:</strong> ${c.qualification}</span>
            </div>
            <p class="candidate-ballot-manifesto">"${c.manifesto}"</p>
            <button class="btn-vote" ${data.hasVoted ? 'disabled' : ''}>
              ${data.hasVoted ? 'Ballot Cast' : 'Vote'}
            </button>
          `;

          const voteBtn = card.querySelector('.btn-vote');
          if (!data.hasVoted && voteBtn) {
            voteBtn.addEventListener('click', () => {
              openVoteConfirm(c);
            });
          }

          grid.appendChild(card);
        });
      }

      section.style.display = 'block';
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p style="color: var(--error);">Error loading ballot data.</p>';
      section.style.display = 'block';
    }
  }

  // Confirmation Modal Handlers
  let activeCandidate = null;

  function openVoteConfirm(candidate) {
    activeCandidate = candidate;
    
    // Reset confirmation modal body back to default confirm layout
    voteConfirmModalBody.innerHTML = `
      <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 1.05rem;">Are you sure you want to vote for:</p>
      <h2 id="confirmCandidateName" style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.6rem; font-family: var(--font-heading);">${candidate.candidateName}</h2>
      <p id="confirmCandidateParty" style="color: var(--accent); font-weight: 700; text-transform: uppercase; font-size: 0.95rem; margin-bottom: 2rem; letter-spacing: 0.05em;">${candidate.partyAffiliation}</p>
      
      <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
        <button class="btn-secondary" id="btnCancelVote" style="flex: 1; padding: 0.85rem; border-radius: var(--border-radius-sm);">Cancel</button>
        <button class="btn-primary" id="btnConfirmVote" style="flex: 1; padding: 0.85rem; border-radius: var(--border-radius-sm); margin-top: 0;">Confirm Vote</button>
      </div>
    `;

    // Attach listeners
    document.getElementById('btnCancelVote').addEventListener('click', () => {
      voteConfirmModal.classList.remove('active');
    });
    document.getElementById('btnConfirmVote').addEventListener('click', () => {
      submitVote(activeCandidate.id);
    });

    voteConfirmModal.classList.add('active');
  }

  async function submitVote(candidateId) {
    try {
      const response = await fetch('/api/vote/cast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        voteConfirmModalBody.innerHTML = `
          <span style="font-size: 3rem;">❌</span>
          <h2 style="color: var(--error); margin: 1rem 0 0.5rem 0;">Ballot Rejected</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem;">${resData.error || 'Failed to submit vote.'}</p>
          <button class="btn-primary" id="btnErrorClose" style="max-width: 150px; margin: 0 auto;">Close</button>
        `;
        document.getElementById('btnErrorClose').addEventListener('click', () => {
          voteConfirmModal.classList.remove('active');
          loadDashboardData();
        });
        return;
      }

      voteConfirmModalBody.innerHTML = `
        <span style="font-size: 3rem;">✅</span>
        <h2 style="color: var(--success); margin: 1rem 0 0.5rem 0;">Vote Submitted Successfully</h2>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">Thank you for participating in the election.</p>
        <button class="btn-primary" id="btnSuccessClose" style="max-width: 150px; margin: 0 auto;">Close</button>
      `;

      document.getElementById('btnSuccessClose').addEventListener('click', () => {
        voteConfirmModal.classList.remove('active');
        loadDashboardData();
      });

    } catch (err) {
      console.error(err);
      voteConfirmModalBody.innerHTML = `
        <span style="font-size: 3rem;">❌</span>
        <h2 style="color: var(--error); margin: 1rem 0 0.5rem 0;">Network Error</h2>
        <p style="color: var(--text-secondary); margin-bottom: 2rem;">Could not contact the election server.</p>
        <button class="btn-primary" id="btnErrorClose" style="max-width: 150px; margin: 0 auto;">Close</button>
      `;
      document.getElementById('btnErrorClose').addEventListener('click', () => {
        voteConfirmModal.classList.remove('active');
      });
    }
  }

  if (voteConfirmCloseBtn) {
    voteConfirmCloseBtn.addEventListener('click', () => {
      voteConfirmModal.classList.remove('active');
    });
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
    resetVoterValidation();
    voterModal.classList.add('active');
  });
  voterCloseBtn.addEventListener('click', () => voterModal.classList.remove('active'));

  // Candidate Modal control
  btnOpenCandidateModal.addEventListener('click', () => {
    candidateModalStatusBanner.style.display = 'none';
    resetCandidateValidation();
    candidateModal.classList.add('active');
  });
  candidateCloseBtn.addEventListener('click', () => candidateModal.classList.remove('active'));

  // Close modal when clicking outside contents
  window.addEventListener('click', (e) => {
    if (e.target === voterModal) voterModal.classList.remove('active');
    if (e.target === candidateModal) candidateModal.classList.remove('active');
    if (e.target === voteConfirmModal) voteConfirmModal.classList.remove('active');
  });

  // Support ESC keyboard accessibility to close modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      voterModal.classList.remove('active');
      candidateModal.classList.remove('active');
      voteConfirmModal.classList.remove('active');
    }
  });

  function resetVoterValidation() {
    const inputs = ['voterFullName', 'voterDob', 'voterConstituency'];
    const msgs = ['voterNameValidationMsg', 'voterDobValidationMsg', 'voterConstValidationMsg'];
    inputs.forEach((id, idx) => {
      const inputEl = document.getElementById(id);
      if (inputEl) inputEl.style.borderColor = 'var(--border-color)';
      const msgEl = document.getElementById(msgs[idx]);
      if (msgEl) msgEl.style.display = 'none';
    });
  }

  function setVoterInvalid(inputId, msgId, message) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (input) input.style.borderColor = 'var(--error)';
    if (msg) {
      msg.textContent = message;
      msg.style.display = 'block';
    }
  }

  // Voter registration submission
  voterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    voterModalStatusBanner.style.display = 'none';
    resetVoterValidation();

    const fullName = document.getElementById('voterFullName').value;
    const dob = document.getElementById('voterDob').value;
    const constituency = document.getElementById('voterConstituency').value;

    let hasVoterError = false;

    if (!fullName.trim()) {
      setVoterInvalid('voterFullName', 'voterNameValidationMsg', 'Legal Full Name is required.');
      hasVoterError = true;
    }
    if (!dob) {
      setVoterInvalid('voterDob', 'voterDobValidationMsg', 'Date of Birth is required.');
      hasVoterError = true;
    }
    if (!constituency.trim()) {
      setVoterInvalid('voterConstituency', 'voterConstValidationMsg', 'Electoral Constituency is required.');
      hasVoterError = true;
    }

    // Client-side age validation (Check if user >= 18)
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (dob && age < 18) {
      setVoterInvalid('voterDob', 'voterDobValidationMsg', `Eligibility rejection: Must be 18 years or older. (Calculated age: ${age})`);
      hasVoterError = true;
    }

    if (hasVoterError) return;

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

  function resetCandidateValidation() {
    const inputs = ['candidateName', 'partyAffiliation', 'candidateAge', 'candidateRole', 'candidateQualification', 'candidatePhotoUrl', 'candidateManifesto'];
    const msgs = ['candidateNameValidationMsg', 'candidatePartyValidationMsg', 'candidateAgeValidationMsg', 'candidateRoleValidationMsg', 'candidateQualValidationMsg', 'candidatePhotoValidationMsg', 'candidateManifestoValidationMsg'];
    inputs.forEach((id, idx) => {
      const el = document.getElementById(id);
      if (el) el.style.borderColor = 'var(--border-color)';
      const msgEl = document.getElementById(msgs[idx]);
      if (msgEl) msgEl.style.display = 'none';
    });
  }

  function setCandidateInvalid(inputId, msgId, message) {
    const input = document.getElementById(inputId);
    const msg = document.getElementById(msgId);
    if (input) input.style.borderColor = 'var(--error)';
    if (msg) {
      msg.textContent = message;
      msg.style.display = 'block';
    }
  }

  // Candidate registration submission
  candidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    candidateModalStatusBanner.style.display = 'none';
    resetCandidateValidation();

    const candidateName = document.getElementById('candidateName').value;
    const partyAffiliation = document.getElementById('partyAffiliation').value;
    const constituency = candidateConstituencyInput.value;
    const age = document.getElementById('candidateAge').value;
    const role = document.getElementById('candidateRole').value;
    const qualification = document.getElementById('candidateQualification').value;
    const photoUrl = document.getElementById('candidatePhotoUrl').value;
    const manifesto = document.getElementById('candidateManifesto').value;

    let hasCandidateError = false;

    if (!candidateName.trim()) {
      setCandidateInvalid('candidateName', 'candidateNameValidationMsg', 'Ballot Display Name is required.');
      hasCandidateError = true;
    }
    if (!partyAffiliation.trim()) {
      setCandidateInvalid('partyAffiliation', 'candidatePartyValidationMsg', 'Party Affiliation is required.');
      hasCandidateError = true;
    }
    if (!age) {
      setCandidateInvalid('candidateAge', 'candidateAgeValidationMsg', 'Candidate Age is required.');
      hasCandidateError = true;
    } else {
      const parsedAge = Number(age);
      if (isNaN(parsedAge) || parsedAge < 25) {
        setCandidateInvalid('candidateAge', 'candidateAgeValidationMsg', 'Candidate must be at least 25 years old.');
        hasCandidateError = true;
      }
    }
    if (!qualification.trim()) {
      setCandidateInvalid('candidateQualification', 'candidateQualValidationMsg', 'Educational Qualification is required.');
      hasCandidateError = true;
    }
    if (photoUrl.trim() !== '') {
      try {
        new URL(photoUrl.trim());
      } catch (_) {
        setCandidateInvalid('candidatePhotoUrl', 'candidatePhotoValidationMsg', 'Please enter a valid URL (e.g. https://...).');
        hasCandidateError = true;
      }
    }
    if (!manifesto.trim()) {
      setCandidateInvalid('candidateManifesto', 'candidateManifestoValidationMsg', 'Campaign Manifesto is required.');
      hasCandidateError = true;
    }

    if (hasCandidateError) return;

    try {
      const response = await fetch('/api/candidate/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName, partyAffiliation, constituency, manifesto, age, qualification, photoUrl, role })
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

