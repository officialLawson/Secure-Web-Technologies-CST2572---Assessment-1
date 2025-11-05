
const enc = new TextEncoder();
const dec = new TextDecoder();

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
              return resolve(null); // No doctor found with that email
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
              return resolve(null); // No doctor found with that email
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
                return resolve(null); // No user found for that doctor
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

/* ========== UI & Form Handling ========== */
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".container");
  const registerBtn = document.querySelector(".register-btn");
  const loginBtn = document.querySelector(".login-btn");
  const loginRole = document.getElementById("loginRole");
  const roleFields = document.querySelectorAll("#roleFields [data-role]");
  const themeSwitch = document.getElementById("theme-switch");

  if (!container) {
    console.error("Container element not found!");
    return;
  }

  // Ensure DB is open early
  if (typeof openClinicDB === 'function') {
    try {
      await openClinicDB();
    } catch (err) {
      console.warn("Could not open database on init:", err);
    }
  }

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
    const registerForm = document.querySelector(".form-box.register");
    if (registerForm) {
      registerForm.scrollTop = 0;
    }
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
    const newRegisterBtn = document.querySelector(".register-btn");
    if (newRegisterBtn) {
      newRegisterBtn.removeEventListener("click", switchToRegister);
      newRegisterBtn.addEventListener("click", switchToRegister);
    }
  }

  function updateBluePanelForRegister() {
    const bluePanel = document.querySelector(".blue-panel");
    bluePanel.innerHTML = `
      <img src="../images/logo.png" alt="MedTrack Logo" class="panel-logo">
      <h1>Welcome Back!</h1>
      <p>Already have an account?</p>
      <button class="btn login-btn">Login</button>
    `;
    const newLoginBtn = document.querySelector(".login-btn");
    if (newLoginBtn) {
      newLoginBtn.removeEventListener("click", switchToLogin);
      newLoginBtn.addEventListener("click", switchToLogin);
    }
  }

  updateBluePanelForLogin();

  if (registerBtn) {
    registerBtn.addEventListener("click", switchToRegister);
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", switchToLogin);
  }

  if (loginRole) {
    loginRole.addEventListener("change", (e) => {
      const selectedRole = e.target.value;
      roleFields.forEach(field => {
        const input = field.querySelector('input');
        if (field.dataset.role === selectedRole) {
          // Show and require
          field.hidden = false;
          if (input) input.required = true;
        } else {
          // Hide and remove required
          field.hidden = true;
          if (input) input.required = false;
        }
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
          alert(result.message); // or show in UI
          btn.textContent = originalBtnText;
          btn.disabled = false;
        }
      } catch (err) {
        console.error("Login error:", err);
        alert("An unexpected error occurred. Please try again.");
        btn.textContent = originalBtnText;
        btn.disabled = false;
      }
    });
  }

  // ===== REGISTER FORM (prevent for now) =====
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      alert("Registration is not yet implemented.");
    });
  }

  // ===== THEME SWITCH =====
  if (themeSwitch) {
    themeSwitch.addEventListener("click", () => {
      document.body.classList.toggle("darkmode");
      const isDark = document.body.classList.contains("darkmode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });

    const savedTheme = localStorage.getItem("theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.body.classList.add("darkmode");
    }
  }
});