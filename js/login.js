const enc = new TextEncoder();
const dec = new TextDecoder();
let confirmedPassword = null;

/* ========== Decrypt Data ========== */
async function decryptData(encrypted) {
  try {
    if (!encrypted || !encrypted.iv || !encrypted.data) {
      console.error("Invalid encrypted data:", encrypted);
      return null;
    }

    const key = await getCryptoKey(); // from IndexedDB.js
    const iv = new Uint8Array(encrypted.iv);
    const data = new Uint8Array(encrypted.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );

    return dec.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    return null;
  }
}

/* ========== Login Logic ========== */
async function loginUser(username, password, role) {
  if (!db) await openClinicDB();

  if (!username || !password)
    return { success: false, message: "Please enter both username and password." };

  // Helper to check users/admins stores
  async function checkStore(storeName) {
    const tx = db.transaction(storeName, "readonly");
    let index;

    if (storeName === "users") {
      // For users, we index by role + identifier
      if (role === "patient") {
        const userTx = db.transaction(storeName, "readonly");
        const userIndex = userTx.objectStore(storeName);

        return new Promise((resolve, reject) => {
          const req = userIndex.getAll();

          req.onsuccess = e => {
            const patient = e.target.result;

            const patientFiltered = patient.filter(u => u.linkedId === username) || [];

            const patientSelected = patientFiltered[0];

            if (!patientFiltered) {
              return resolve(null);
            }


            resolve(patientSelected);
          }

          req.onerror = () => reject(req.error);
        });
      }
    } else if (storeName === "doctors") {
      if (role === "doctor") {
        const doctorIndex = tx.objectStore(storeName).index("email");

        return new Promise((resolve, reject) => {
          const doctorReq = doctorIndex.get(username);

          doctorReq.onsuccess = e => {
            const doctor = e.target.result;

            if (!doctor) {
              return resolve(null);
            }

            const linkedId = doctor.id;

            const userTx = db.transaction("users", "readonly");
            const userIndex = userTx.objectStore("users");
            const userReq = userIndex.getAll();

            userReq.onsuccess = ev => {
              const user = ev.target.result;

              const userFiltered = user.filter(u => u.linkedId === linkedId) || [];

              const userSelected = userFiltered[0];

              if (!userSelected) {
                return resolve(null);
              }

              // Optionally attach doctor profile to user object
              user._linkedDoctor = doctor;

              resolve(userSelected);
            };

            userReq.onerror = () => reject(userReq.error);
          };

          doctorReq.onerror = () => reject(doctorReq.error);
        });
      }
    } else if (storeName === "admins") {
      index = tx.objectStore(storeName).index("username");
      return new Promise((resolve, reject) => {
        const req = index.get(username);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
      });
    }
  }

  let user = null;
  let detectedRole = role;

  if (role === "patient") {
    user = await checkStore("users");
    detectedRole = "patient";
  } else if (role === "admin") {
    user = await checkStore("admins");
    detectedRole = "admin";
  } else if (role === "doctor") {
    user = await checkStore("doctors")
    detectedRole = "doctor";
  }

  if (!user) return { success: false, message: "User not found." };

  // Decrypt stored password
  const decryptedPassword = await decryptData(user.password);

  if (!decryptedPassword) {
    return { success: false, message: "Error reading password. Please try again." };
  }

  if (password !== decryptedPassword) {
    return { success: false, message: "Invalid username or password." };
  }

  console.log(`🔓 Login successful as ${detectedRole}`);
  return { success: true, user: { ...user, role: detectedRole } };
}

/* ========== UI & Registration Logic ========== */
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".container");
  const themeSwitch = document.getElementById("theme-switch");
  const loginRole = document.getElementById("loginRole");
  const roleFields = document.querySelectorAll("#roleFields [data-role]");

  const passwordModal = document.getElementById("passwordModal");
  const emailModal = document.getElementById("emailModal");
  const otpModal = document.getElementById("otpModal");

  const openPasswordBtn = document.getElementById("openPasswordModal");
  const completeRegBtn = document.getElementById("completeRegistration");
  const openOtpBtn = document.getElementById("openOtpModal");
  const verifyOtpBtn = document.getElementById("verifyOtp");

  const closeButtons = document.querySelectorAll(".close-modal");
  const password1 = document.getElementById("password1");
  const password2 = document.getElementById("password2");
  const strengthFill = document.getElementById("strengthFill");
  const strengthLabel = document.getElementById("strengthLabel");
  const passwordError = document.getElementById("passwordError");
  const agreePolicy = document.getElementById("agreePolicy");

  const regDOB = document.getElementById("regDOB");
  const ageWarning = document.getElementById("ageWarning");
  const nhsWarning = document.getElementById("nhsWarning");
  const emailWarning = document.getElementById("emailWarning");
  const phoneWarning = document.getElementById("phoneWarning");
  const allWarning = document.getElementById("allWarning");
  const otpInput = document.getElementById("otpInput");
  const otpError = document.getElementById("otpError");
  const emailError = document.getElementById("emailError");
  const registerForm = document.getElementById("registerForm");

  // ---------------------------
  // THEME SWITCH
  // ---------------------------
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

  // ---------------------------
  // BLUE PANEL TOGGLE FIX
  // ---------------------------
  function switchToLogin() {
    container.classList.remove("active");
    updateBluePanelForLogin();
    document.querySelector(".form-box.login").style.visibility = "visible";
    document.querySelector(".form-box.register").style.visibility = "hidden";
    console.log("Switched to Login");
  }

  function switchToRegister() {
    container.classList.add("active");
    updateBluePanelForRegister();
    document.querySelector(".form-box.login").style.visibility = "hidden";
    document.querySelector(".form-box.register").style.visibility = "visible";
    const registerFormEl = document.querySelector(".form-box.register");
    if (registerFormEl) registerFormEl.scrollTop = 0;
    console.log("Switched to Register");
  }

  function updateBluePanelForLogin() {
    const bluePanel = document.querySelector(".blue-panel");
    bluePanel.innerHTML = `
      <img src="../images/logo.png" alt="MedTrack Logo" class="panel-logo">
      <h1>Hello, Welcome!</h1>
      <p>Don't have an account?</p>
      <button class="btn register-btn">Register</button>
    `;
    const newRegisterBtn = bluePanel.querySelector(".register-btn");
    if (newRegisterBtn) newRegisterBtn.addEventListener("click", switchToRegister);
  }

  function updateBluePanelForRegister() {
    const bluePanel = document.querySelector(".blue-panel");
    bluePanel.innerHTML = `
      <img src="../images/logo.png" alt="MedTrack Logo" class="panel-logo">
      <h1>Welcome Back!</h1>
      <p>Already have an account?</p>
      <button class="btn login-btn">Login</button>
    `;
    const newLoginBtn = bluePanel.querySelector(".login-btn");
    if (newLoginBtn) newLoginBtn.addEventListener("click", switchToLogin);
  }

  updateBluePanelForLogin();

  // ---------------------------
  // CLOSE MODALS
  // ---------------------------
  closeButtons.forEach(btn =>
    btn.addEventListener("click", () => btn.closest(".modal").classList.add("hidden"))
  );

  // ---------------------------
  // ROLE SWITCHING
  // ---------------------------
  if (loginRole) {
    loginRole.addEventListener("change", e => {
      const selected = e.target.value;
      roleFields.forEach(field => {
        const input = field.querySelector("input");
        field.hidden = field.dataset.role !== selected;
        if (input) input.required = !field.hidden;
      });
    });
    loginRole.dispatchEvent(new Event("change"));
  }

  // ===== REAL LOGIN HANDLER =====
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const selectedRole = document.getElementById("loginRole").value;

      let username;
      if (selectedRole === "doctor") {
        username = document.getElementById("doctorEmail").value.trim();
      } else if (selectedRole === "patient") {
        username = document.getElementById("patientNHS").value.trim();
      } else if (selectedRole === "admin") {
        username = document.getElementById("adminUsername").value.trim();
      }

      const password = document.getElementById("loginPassword").value;

      // Optional: show loading message
      const originalBtnText = document.querySelector("#loginForm .btn").textContent;
      const btn = document.querySelector("#loginForm .btn");
      btn.textContent = "Logging in...";
      btn.disabled = true;

      try {
        const result = await loginUser(username, password, selectedRole);

        if (result.success) {
          // Save user
          localStorage.setItem("currentUser", JSON.stringify(result.user));

          // Redirect
          let redirectUrl = "../html/dashboard.html";
          switch (result.user.role?.toLowerCase()) {
            case "doctor":
              
              redirectUrl = "../html/dashboard-doctor.html";
              break;
            case "admin":
              redirectUrl = "../html/dashboard-admin.html";
              break;
            case "patient":
              redirectUrl = "../html/dashboard-patient.html";
              break;
            default:
              redirectUrl = "login.html";
          }

          await logCurrentUserActivity("logIn", result.user.linkedId, `User with ID ${result.user.linkedId} has logged in`);
          window.location.href = redirectUrl;

        } else {
          const userError = document.getElementById('userError');
          userError.textContent = result.message; // or show in UI
          btn.textContent = originalBtnText;
          btn.disabled = false;
        }
      } catch (err) {
        console.error("Login error:", err);
        btn.textContent = originalBtnText;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------
  // PASSWORD STRENGTH
  // ---------------------------
  let passwordStrengthLevel = 0;
  password1.addEventListener("input", () => {
    const val = password1.value;
    passwordStrengthLevel = 0;
    if (val.length >= 8) passwordStrengthLevel++;
    if (/[A-Z]/.test(val)) passwordStrengthLevel++;
    if (/[0-9]/.test(val)) passwordStrengthLevel++;
    if (/[^A-Za-z0-9]/.test(val)) passwordStrengthLevel++;

    const colors = ["red", "orange", "yellow", "green"];
    const labels = ["Weak", "Fair", "Good", "Strong"];
    strengthFill.style.width = `${(passwordStrengthLevel / 4) * 100}%`;
    strengthFill.style.backgroundColor = colors[Math.max(0, passwordStrengthLevel - 1)] || "red";
    strengthLabel.textContent = "Strength: " + (labels[Math.max(0, passwordStrengthLevel - 1)] || "Weak");
  });

  // ---------------------------
  // OTP GENERATION
  // ---------------------------
  let currentOTP = "";
  function generateOTP() {
    currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated OTP (for testing):", currentOTP);
    return currentOTP;
  }

  function sendOtpToEmail(email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      passwordError.textContent = "Invalid email. Please check your address before sending OTP.";
      return false;
    }
    console.log(`Simulated sending OTP ${currentOTP} to ${email}`);
    return true;
  }

  // ---------------------------
  // REGISTRATION FIELD VALIDATION
  // ---------------------------
  openPasswordBtn.addEventListener("click", () => {
    const regNHS = document.getElementById("regNHS");
    const regFirstName = document.getElementById("regFirstName");
    const regLastName = document.getElementById("regLastName");
    const regGender = document.getElementById("regGender");
    const regAddress = document.getElementById("regAddress");
    const regEmail = document.getElementById("regEmail");
    const regTelephone = document.getElementById("regTelephone");

    if (
      !regNHS.value || !regFirstName.value || !regLastName.value ||
      !regGender.value || !regAddress.value || !regEmail.value || !regTelephone.value
    ) {
      allWarning.style.display = "block";
      return;
    } else allWarning.style.display = "none";

    const nhsValue = regNHS.value.trim();
    const isValidNHS = /^\d{10}$/.test(nhsValue);

    nhsWarning.style.display = isValidNHS ? "none" : "block";
    if (!isValidNHS) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.value.trim())) {
      emailWarning.style.display = "block";
      return;
    } else emailWarning.style.display = "none";

    if (!/^\+\d{1,3}-\d+$/.test(regTelephone.value.trim())) {
      phoneWarning.style.display = "block";
      return;
    } else phoneWarning.style.display = "none";

    if (regDOB.value) {
      const dob = new Date(regDOB.value);
      const age = new Date().getFullYear() - dob.getFullYear();
      if (age < 16) {
        ageWarning.style.display = "block";
        return;
      } else ageWarning.style.display = "none";
    }

    passwordModal.classList.remove("hidden");
  });

  // ---------------------------
  // COMPLETE REGISTRATION
  // ---------------------------
  completeRegBtn.addEventListener("click", () => {
    passwordError.textContent = "";

    if (password1.value !== password2.value) {
      passwordError.textContent = "Passwords do not match.";
      return;
    }
    if (passwordStrengthLevel < 2) {
      passwordError.textContent = "Password strength must be Fair or stronger.";
      return;
    }
    if (!agreePolicy.checked) {
      passwordError.textContent = "You must agree to the privacy policy before continuing.";
      return;
    }

    const regEmail = document.getElementById("regEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      passwordError.textContent = "Invalid email. Please correct it before verification.";
      return;
    }

    confirmedPassword = password1;

    passwordModal.classList.add("hidden");
    emailModal.classList.remove("hidden");

    generateOTP();
    sendOtpToEmail(regEmail);
  });

  // ---------------------------
  // EMAIL TO OTP
  // ---------------------------
  openOtpBtn.addEventListener("click", () => {
    emailError.textContent = "";
    emailModal.classList.add("hidden");
    otpModal.classList.remove("hidden");
  });

  // ---------------------------
  // OTP VERIFICATION
  // ---------------------------
   verifyOtpBtn.addEventListener("click", () => {
    otpError.textContent = "";
    if (otpInput.value.trim() === currentOTP) {
      const regEmail = document.getElementById("regEmail").value.trim();
      const regFirstName = document.getElementById("regFirstName").value.trim();
      const regLastName = document.getElementById("regLastName").value.trim();
      const userData = {
        nhs: document.getElementById("regNHS").value,
        name: regFirstName + " " + regLastName,
        email: regEmail,
        telephone: document.getElementById("regTelephone").value,
      };
      if (!localStorage.getItem('currentUser')) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
      }
      otpSuccess.textContent = "OTP verified successfully! Redirecting to dashboard...";
      otpModal.classList.add("hidden");
      (async () => {
        try {
          const db = await openClinicDB();

          // 1. Collect registration fields
          const regNHS = document.getElementById("regNHS").value.trim();
          const regFirstName = document.getElementById("regFirstName").value.trim();
          const regLastName = document.getElementById("regLastName").value.trim();
          const regGender = document.getElementById("regGender").value.trim();
          const regDOB = document.getElementById("regDOB").value.trim();
          const regAddress = document.getElementById("regAddress").value.trim();
          const regEmail = document.getElementById("regEmail").value.trim();
          const regTelephone = document.getElementById("regTelephone").value.trim();
          const regPassword = confirmedPassword;

          // 2. Generate new patient ID
          const patientTx = db.transaction("patients", "readonly");
          const patientStore = patientTx.objectStore("patients");
          const getAllPatients = patientStore.getAll();

          getAllPatients.onsuccess = async () => {
            const patients = getAllPatients.result || [];
            const newPatientId = patients.length > 0
              ? Math.max(...patients.map(p => parseInt(p.id))) + 1
              : 1;

            // 3. Encrypt patient info
            const encryptedPatient = await encryptPatientInfo({
              id: newPatientId,
              NHS: regNHS,
              Title: '',
              First: regFirstName,
              Last: regLastName,
              Gender: regGender,
              DOB: regDOB,
              Address: regAddress,
              Email: regEmail,
              Telephone: regTelephone
            });

            // 4. Store in patients table
            const addPatientTx = db.transaction("patients", "readwrite");
            const addPatientStore = addPatientTx.objectStore("patients");
            addPatientStore.add(encryptedPatient);

            // 5. Generate unique username
            const baseUsername = (regFirstName + regLastName).toLowerCase();
            let username = baseUsername;
            let suffix = 1;

            const userTx = db.transaction("users", "readonly");
            const userStore = userTx.objectStore("users");
            const allUsersReq = userStore.getAll();

            allUsersReq.onsuccess = async () => {
              const users = allUsersReq.result || [];
              const existingUsernames = users.map(u => u.username);

              while (existingUsernames.includes(username)) {
                username = `${baseUsername}${suffix++}`;
              }

              async function encryptPassword() {
                  const encrypted = await encryptData(regPassword);
                  return encrypted;
              }

              // 6. Encrypt password
              const encryptedPassword = await encryptPassword(regPassword);

              // 7. Store in users table
              const addUserTx = db.transaction("users", "readwrite");
              const addUserStore = addUserTx.objectStore("users");
              addUserStore.add({
                username,
                password: encryptedPassword,
                role: "patient",
                linkedId: regNHS
              });

              // 8. Save to localStorage for session
              localStorage.setItem("currentUser", JSON.stringify({
                username,
                role: "patient",
                linkedId: regNHS
              }));

              confirmedPassword = null;
              // 9. Redirect
              window.location.href = "../html/dashboard-patient.html";
            };
          };
        } catch (err) {
          console.error("Registration error:", err);
          otpError.textContent = "Something went wrong during registration.";
        }
      })();
    } else {
      otpError.textContent = "Incorrect OTP. Please try again.";
      otpInput.value = "";
    }
  });
 

  // ---------------------------
  // AGE DISPLAY
  // ---------------------------
  regDOB.addEventListener("change", () => {
    const dob = new Date(regDOB.value);
    const age = new Date().getFullYear() - dob.getFullYear();
    ageWarning.style.display = age < 16 ? "block" : "none";
  });

// ---------------------------
// OTP GENERATION, TIMER, RESEND
// ---------------------------
let otpExpiry = null;
let otpInterval = null;
const otpDuration = 120; // seconds
const resendCooldown = 30; // seconds
const otpTimerDisplay = document.getElementById("otpTimer");
const resendOtpBtn = document.getElementById("resendOtp");

function generateOTP() {
  currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP (for testing):", currentOTP);
  otpExpiry = Date.now() + otpDuration * 1000;
  startOtpCountdown();
  return currentOTP;
}

function startOtpCountdown() {
  clearInterval(otpInterval);
  otpInterval = setInterval(() => {
    const remaining = Math.max(0, Math.floor((otpExpiry - Date.now()) / 1000));
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    otpTimerDisplay.textContent = `OTP expires in ${minutes}:${seconds}`;

    if (remaining <= 0) {
      clearInterval(otpInterval);
      otpTimerDisplay.textContent = "OTP expired. Please resend.";
      resendOtpBtn.disabled = false;
    }
  }, 1000);
}



// Open OTP Modal
openOtpBtn.addEventListener("click", () => {
  emailError.textContent = "";
  emailModal.classList.add("hidden");
  otpModal.classList.remove("hidden");
  generateOTP();
  const regEmail = document.getElementById("regEmail").value.trim();
  sendOtpToEmail(regEmail);
});

// Verify OTP
verifyOtpBtn.addEventListener("click", () => {
    otpError.textContent = "";
    if (otpInput.value.trim() === currentOTP) {
      const regEmail = document.getElementById("regEmail").value.trim();
      const regFirstName = document.getElementById("regFirstName").value.trim();
      const regLastName = document.getElementById("regLastName").value.trim();
      const userData = {
        nhs: document.getElementById("regNHS").value,
        name: regFirstName + " " + regLastName,
        email: regEmail,
        telephone: document.getElementById("regTelephone").value,
      };
      if (!localStorage.getItem('currentUser')) {
        localStorage.setItem('currentUser', JSON.stringify(userData));
      }
      otpSuccess.textContent = "OTP verified successfully! Redirecting to dashboard...";
      otpModal.classList.add("hidden");
      (async () => {
        try {
          const db = await openClinicDB();

          // 1. Collect registration fields
          const regNHS = document.getElementById("regNHS").value.trim();
          const regFirstName = document.getElementById("regFirstName").value.trim();
          const regLastName = document.getElementById("regLastName").value.trim();
          const regGender = document.getElementById("regGender").value.trim();
          const regDOB = document.getElementById("regDOB").value.trim();
          const regAddress = document.getElementById("regAddress").value.trim();
          const regEmail = document.getElementById("regEmail").value.trim();
          const regTelephone = document.getElementById("regTelephone").value.trim();
          const regPassword = confirmedPassword;

          // 2. Generate new patient ID
          const patientTx = db.transaction("patients", "readonly");
          const patientStore = patientTx.objectStore("patients");
          const getAllPatients = patientStore.getAll();

          getAllPatients.onsuccess = async () => {
            const patients = getAllPatients.result || [];
            const newPatientId = patients.length > 0
              ? Math.max(...patients.map(p => parseInt(p.id))) + 1
              : 1;

            // 3. Encrypt patient info
            const encryptedPatient = await encryptPatientInfo({
              id: newPatientId,
              NHS: regNHS,
              Title: '',
              First: regFirstName,
              Last: regLastName,
              Gender: regGender,
              DOB: regDOB,
              Address: regAddress,
              Email: regEmail,
              Telephone: regTelephone
            });

            // 4. Store in patients table
            const addPatientTx = db.transaction("patients", "readwrite");
            const addPatientStore = addPatientTx.objectStore("patients");
            addPatientStore.add(encryptedPatient);

            // 5. Generate unique username
            const baseUsername = (regFirstName + regLastName).toLowerCase();
            let username = baseUsername;
            let suffix = 1;

            const userTx = db.transaction("users", "readonly");
            const userStore = userTx.objectStore("users");
            const allUsersReq = userStore.getAll();

            allUsersReq.onsuccess = async () => {
              const users = allUsersReq.result || [];
              const existingUsernames = users.map(u => u.username);

              while (existingUsernames.includes(username)) {
                username = `${baseUsername}${suffix++}`;
              }

              async function encryptPassword() {
                  const encrypted = await encryptData(regPassword);
                  return encrypted;
              }

              // 6. Encrypt password
              const encryptedPassword = await encryptPassword(regPassword);

              // 7. Store in users table
              const addUserTx = db.transaction("users", "readwrite");
              const addUserStore = addUserTx.objectStore("users");
              addUserStore.add({
                username,
                password: encryptedPassword,
                role: "patient",
                linkedId: regNHS
              });

              // 8. Save to localStorage for session
              localStorage.setItem("currentUser", JSON.stringify({
                username,
                role: "patient",
                linkedId: regNHS
              }));

              confirmedPassword = null;
              // 9. Redirect
              window.location.href = "../html/dashboard-patient.html";
            };
          };
        } catch (err) {
          console.error("Registration error:", err);
          otpError.textContent = "Something went wrong during registration.";
        }
      })();
    } else {
      otpError.textContent = "Incorrect OTP. Please try again.";
      otpInput.value = "";
    }
  });

// Resend OTP
resendOtpBtn.addEventListener("click", () => {
  resendOtpBtn.disabled = true;
  const regEmail = document.getElementById("regEmail").value.trim();
  generateOTP();
  sendOtpToEmail(regEmail);
});


});