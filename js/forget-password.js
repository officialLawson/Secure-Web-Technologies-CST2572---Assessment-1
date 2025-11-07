// Minimal, self-contained — uses only your existing DB functions
let currentRole = 'doctor';
let currentUsername = '';
let currentLinkedId = '';
let lastAttemptTime = 0;
const COOLDOWN_MS = 5000; // 5 seconds
let otpExpiry = 0;
let encryptedOtp = null;

// Clear sensitive data on page exit
window.addEventListener('beforeunload', () => {
  encryptedOtp = null;
  document.querySelectorAll('input').forEach(el => el.value = '');
});

// Email masking (GDPR-safe)
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  const visible = Math.min(3, Math.floor(local.length / 2));
  const maskedLocal = local.substring(0, visible) + '*'.repeat(local.length - visible);
  return `${maskedLocal}@${domain}`;
}

// OTP encryption helpers
async function setEncryptedOtp(plainOtp) {
  encryptedOtp = await encryptData(plainOtp);
  otpExpiry = Date.now() + 2 * 60 * 1000; // 2 minutes
  return encryptedOtp;
}

async function getDecryptedOtp() {
  if (!encryptedOtp || Date.now() >= otpExpiry) {
    encryptedOtp = null;
    return null;
  }
  return await decryptData(encryptedOtp);
}

// =============== COOLDOWN HELPER (Forget Password Only) ===============
function isOnCooldown() {
  return Date.now() - lastAttemptTime < COOLDOWN_MS;
}

function getRemainingCooldown() {
  const elapsed = Date.now() - lastAttemptTime;
  return Math.max(0, COOLDOWN_MS - elapsed);
}
// =====================================================================

// =============== VALIDATION HELPERS ===============
function isValidNHS(nhs) {
  return /^\d{10}$/.test(nhs);
}
function isValidISODate(dateStr) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 10) === dateStr;
}
function isValidName(name) {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50 && /^[a-zA-Z\s\-']+$/.test(trimmed);
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// ===============================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!db) await openClinicDB();

  // Role switch
  document.getElementById('role').addEventListener('change', (e) => {
    currentRole = e.target.value;
    document.getElementById('doctorFields').style.display = currentRole === 'doctor' ? 'block' : 'none';
    document.getElementById('patientFields').style.display = currentRole === 'patient' ? 'block' : 'none';
  });

  // Buttons
  document.getElementById('submitIdentity').addEventListener('click', submitIdentity);
  document.getElementById('verifyOtp').addEventListener('click', verifyOtp);
  document.getElementById('resetPassword').addEventListener('click', resetPassword);
  document.getElementById('resendOtp').addEventListener('click', resendOtp);

  // Password strength & match
  const passwordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  const matchMessage = document.getElementById('matchMessage');

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      const password = passwordInput.value;
      let strength = 0;
      let color = '#ccc';
      let text = 'Password strength';

      if (password.length === 0) {
        strength = 0;
        text = 'Password strength';
        color = '#ccc';
      } else if (password.length < 6) {
        strength = 20;
        text = 'Too short';
        color = '#ff6b6b';
      } else {
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        const hasLength = password.length >= 8;

        if (hasLower) strength += 20;
        if (hasUpper) strength += 20;
        if (hasNumber) strength += 20;
        if (hasSpecial) strength += 20;
        if (hasLength) strength += 20;
        strength = Math.min(strength, 100);

        if (strength < 40) {
          text = 'Weak';
          color = '#ff6b6b';
        } else if (strength < 80) {
          text = 'Medium';
          color = '#ffd166';
        } else {
          text = 'Strong';
          color = '#06d6a0';
        }
      }

      strengthFill.style.width = `${strength}%`;
      strengthFill.style.backgroundColor = color;
      strengthText.textContent = text;
      strengthText.style.color = color;
      checkPasswordMatch();
    });
  }

  function checkPasswordMatch() {
    const pass1 = passwordInput?.value || '';
    const pass2 = confirmPasswordInput?.value || '';
    if (pass2 === '') {
      matchMessage.textContent = '';
      matchMessage.className = 'password-match-message';
    } else if (pass1 === pass2) {
      matchMessage.textContent = '✓ Passwords match';
      matchMessage.className = 'password-match-message match';
    } else {
      matchMessage.textContent = '✗ Passwords do not match';
      matchMessage.className = 'password-match-message no-match';
    }
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);
  }
});

// Step 1: Verify identity
async function submitIdentity() {
  const forgotPasswordError = document.getElementById('forgotPasswordError');
  // ===== COOLDOWN CHECK =====
  if (isOnCooldown()) {
    const remaining = getRemainingCooldown();
    const seconds = Math.ceil(remaining / 1000);
    forgotPasswordError.textContent = `Please wait ${seconds} second(s) before trying again.`;
    return;
  }

  let identifier, firstName, lastName, dob;
  if (currentRole === 'doctor') {
    identifier = document.getElementById('doctorEmail').value.trim();
    firstName = document.getElementById('doctorFirstName').value.trim();
    lastName = document.getElementById('doctorLastName').value.trim();

    // ✅ Validate doctor inputs
    if (!isValidEmail(identifier)) {
      forgotPasswordError.textContent = 'Please enter a valid email address.';
      return;
    }
    if (!isValidName(firstName) || !isValidName(lastName)) {
      forgotPasswordError.textContent = 'Please enter valid first and last names (letters, spaces, hyphens, or apostrophes only).';
      return;
    }
  } else {
    identifier = document.getElementById('patientNHS').value.trim();
    dob = document.getElementById('patientDOB').value.trim();
    firstName = document.getElementById('patientFirstName').value.trim();
    lastName = document.getElementById('patientLastName').value.trim();

    // ✅ Validate patient inputs
    if (!isValidNHS(identifier)) {
      forgotPasswordError.textContent = 'Please enter a valid 10-digit NHS number.';
      return;
    }
    if (!isValidISODate(dob)) {
      forgotPasswordError.textContent = 'Please select a valid date of birth.';
      return;
    }
    if (!isValidName(firstName) || !isValidName(lastName)) {
      forgotPasswordError.textContent = 'Please enter valid first and last names (letters, spaces, hyphens, or apostrophes only).';
      return;
    }
  }

  try {
    let user = null;

    if (currentRole === 'doctor') {
      const doctors = await getAllItems('doctors');
      const decrypted = await Promise.all(doctors.map(d => decryptDoctorInfo(d)));
      const doctor = decrypted.find(d =>
        d.email === identifier &&
        d.first_name.toLowerCase() === firstName.toLowerCase() &&
        d.last_name.toLowerCase() === lastName.toLowerCase()
      );
      if (!doctor) throw new Error('Doctor not found.');
      const users = await getAllItems('users');
      user = users.find(u => u.linkedId == doctor.id && u.role === 'doctor');
      if (!user) throw new Error('Account not found.');
      currentUsername = user.username;
      currentLinkedId = doctor.id;
    } else {
      // Convert HTML date (YYYY-MM-DD) to DD/MM/YYYY for DB comparison
      function formatDateToDDMMYYYY(isoDate) {
        if (!isoDate) return '';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
      }
      const formattedDOB = formatDateToDDMMYYYY(dob);

      const patients = await getAllItems('patients');
      const decrypted = await Promise.all(patients.map(p => decryptPatientInfo(p)));
      const patient = decrypted.find(p =>
        p.NHS === identifier &&
        p.DOB === formattedDOB && // ✅ Now matches DD/MM/YYYY
        p.First.toLowerCase() === firstName.toLowerCase() &&
        p.Last.toLowerCase() === lastName.toLowerCase()
      );
      const patientFiltered = decrypted.find(p=> p.NHS === identifier) || [];
      console.log(formattedDOB)
      console.log(patientFiltered.DOB);
      if (!patient) throw new Error('Patient not found.');
      const users = await getAllItems('users');
      user = users.find(u => u.linkedId === patient.NHS && u.role === 'patient');
      if (!user) throw new Error('Account not found.');
      currentUsername = user.username;
      currentLinkedId = patient.NHS;
    }

    // ===== RECORD ATTEMPT (for cooldown) =====
    lastAttemptTime = Date.now();

    // Generate and encrypt OTP
    const plainOtp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP: ", plainOtp)
    const encryptedOTP = await setEncryptedOtp(plainOtp);

    // Show email preview (mask patient email)
    const previewTo = currentRole === 'doctor'
      ? identifier
      : maskEmail(identifier);

    document.getElementById('previewTo').textContent = previewTo;
    document.getElementById('previewOtp').textContent = plainOtp;
    document.getElementById('emailPreview').style.display = 'block';

    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';

  } catch (err) {
    // Also record attempt on failure (to prevent brute force)
    lastAttemptTime = Date.now();
    // ✅ Generic error message (avoid user enumeration)
    forgotPasswordError.textContent = 'Details do not match our records.';
  }
}

// Step 2: Verify OTP
async function verifyOtp() {
  const input = document.getElementById('otpInput').value.trim();
  const realOtp = await getDecryptedOtp();

  const OTPError = document.getElementById('OTPError');
  if (!realOtp) {
    OTPError.textContent = 'OTP has expired. Please request a new one.';
    return;
  }

  if (input === realOtp) {
    encryptedOtp = null;
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
    document.getElementById('emailPreview').style.display = 'none';
  } else {
    OTPError.textContent = 'Invalid OTP. Please try again.';
  }
}

// Resend OTP
async function resendOtp(e) {
  e.preventDefault();
  const OTPError = document.getElementById('OTPError');

  // ===== COOLDOWN CHECK FOR RESEND =====
  if (isOnCooldown()) {
    const remaining = getRemainingCooldown();
    const seconds = Math.ceil(remaining / 1000);
    OTPError.textContent = `Please wait ${seconds} second(s) before resending.`;
    return;
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  await setEncryptedOtp(newOtp);
  lastAttemptTime = Date.now(); // Record cooldown for resend too

  console.log(`[MedTrack OTP] Resent: ${newOtp}`);
  document.getElementById('previewOtp').textContent = newOtp;
}

// Step 3: Reset password
async function resetPassword() {
  const pass1 = document.getElementById('newPassword').value;
  const pass2 = document.getElementById('confirmPassword').value;

  const resetPasswordError = document.getElementById('resetPasswordError');
  if (pass1.length < 6) {
    resetPasswordError.textContent = 'Password must be at least 6 characters.';
    return;
  }
  if (pass1 !== pass2) {
    resetPasswordError.textContent = 'Passwords do not match.';
    return;
  }

  try {
    const encrypted = await encryptData(pass1);

    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const index = store.index('username');
    const req = index.get(currentUsername);
    const user = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!user) throw new Error('User account not found.');

    user.password = encrypted;
    await updateItem('users', user);

    console.log('✅ Password updated! Redirecting to login...');
    window.location.href = 'login.html';

  } catch (err) {
    console.warn('Failed to update password. Please try again.');
    console.error(err);
  }
}


// Theme Switcher
// ---------------------------
  // THEME SWITCH
  // ---------------------------

const themeSwitch = document.getElementById("theme-switch");

if (themeSwitch) {
  themeSwitch.addEventListener("click", () => {
    document.body.classList.toggle("darkmode");
    const isDark = document.body.classList.contains("darkmode");
    localStorage.setItem("darkmode", isDark ? "active" : "null");
  });

  const savedTheme = localStorage.getItem("darkmode");
  if (
    savedTheme === "dark" ||
    (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.body.classList.add("darkmode");
  }
}