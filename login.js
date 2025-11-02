// ======= Merged JS for MedTrack toggle + role fields + password strength =======

// container + panel buttons used to slide the MedTrack overlay (do not change)
const container = document.getElementById('medContainer');
const panelRegisterBtn = document.getElementById('panelRegisterBtn');
const panelLoginBtn = document.getElementById('panelLoginBtn');

// in-form link triggers
const linkShowRegister = document.getElementById('linkShowRegister');
const linkShowLogin = document.getElementById('linkShowLogin');

// forms & role elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginType = document.getElementById('loginType');
const loginRoleFields = document.querySelectorAll('#loginRoleFields [data-role]');
const registerAs = document.getElementById('registerAs');
const extraField = document.getElementById('extraField');

// password strength
const regPassword = document.getElementById('regPassword');
const strengthBar = document.getElementById('strengthBar');
const strengthLabel = document.getElementById('strengthLabel');
const verifyText = document.getElementById('verifyText');

// ---------------- Toggle panel button behavior (preserve MedTrack behaviour) ----------------
panelRegisterBtn.addEventListener('click', () => {
  container.classList.add('active');
});

panelLoginBtn.addEventListener('click', () => {
  container.classList.remove('active');
});

// links inside forms should trigger same slide (keeps animation identical)
linkShowRegister.addEventListener('click', (e) => {
  e.preventDefault();
  container.classList.add('active');
  // focus first register input for better UX
  setTimeout(() => {
    const first = document.getElementById('fullName');
    if (first) first.focus();
  }, 420);
});

linkShowLogin.addEventListener('click', (e) => {
  e.preventDefault();
  container.classList.remove('active');
  setTimeout(() => {
    const first = document.getElementById('doctorEmail') || document.getElementById('adminUsername');
    if (first) first.focus();
  }, 420);
});

// ---------------- Login role switching (doctor / patient / admin) ----------------
function updateLoginRoleFields(selected) {
  loginRoleFields.forEach(field => {
    field.hidden = field.dataset.role !== selected;
  });
}

// initialize based on default
if (loginType) {
  updateLoginRoleFields(loginType.value);
  loginType.addEventListener('change', (e) => updateLoginRoleFields(e.target.value));
}

// ---------------- Registration extra fields (doctor / patient / admin) ----------------
function updateRegisterExtra(role) {
  if (!extraField) return;
  if (role === 'doctor') {
    extraField.innerHTML = `
      <label for="doctorID">Doctor ID</label>
      <input type="text" id="doctorID" name="doctorID" placeholder="Enter your Doctor ID" required />
    `;
  } else if (role === 'patient') {
    extraField.innerHTML = `
      <label for="patientNIC">NHS / NIC</label>
      <input type="text" id="patientNIC" name="patientNIC" placeholder="Enter your NHS/NIC" required />
    `;
  } else {
    extraField.innerHTML = '';
  }
}

// init and listener
if (registerAs) {
  updateRegisterExtra(registerAs.value);
  registerAs.addEventListener('change', (e) => updateRegisterExtra(e.target.value));
}

// ---------------- Password strength checker ----------------
function calcStrength(val) {
  let strength = 0;
  if (val.match(/[a-z]+/)) strength++;
  if (val.match(/[A-Z]+/)) strength++;
  if (val.match(/[0-9]+/)) strength++;
  if (val.match(/[$@#&!%*?~^()-_+=]+/)) strength++;
  if (val.length >= 8) strength++;
  return strength;
}

if (regPassword) {
  regPassword.addEventListener('input', () => {
    const val = regPassword.value;
    const s = calcStrength(val);
    const width = (s / 5) * 100;
    strengthBar.style.width = width + '%';

    // colors + label
    if (s <= 2) {
      strengthBar.style.background = 'linear-gradient(90deg, #ff4d4f, #ff7a7a)';
      if (strengthLabel) strengthLabel.textContent = 'Weak';
    } else if (s === 3 || s === 4) {
      strengthBar.style.background = 'linear-gradient(90deg, #ffa500, #ffbf66)';
      if (strengthLabel) strengthLabel.textContent = 'Medium';
    } else {
      strengthBar.style.background = 'linear-gradient(90deg, #2ecc71, #4caf50)';
      if (strengthLabel) strengthLabel.textContent = 'Strong';
    }
  });
}

// ---------------- Simulated verification on register submit ----------------
if (registerForm) {
  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // keep the message
    if (verifyText) {
      verifyText.textContent = "✅ Verification code sent to your email. Please check to complete registration.";
      // small visual emphasis
      verifyText.style.opacity = '1';
    }
    // optionally we could reset the form fields (commented out)
    // registerForm.reset();
    // reset strength bar
    // strengthBar.style.width = '0%';
  });
}

// ---------------- Basic login submit handling (prevent page reload for demo) ----------------
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // demo behaviour: just show console message
    console.log('Login submitted (demo) — implement auth handling as needed.');
  });
}
