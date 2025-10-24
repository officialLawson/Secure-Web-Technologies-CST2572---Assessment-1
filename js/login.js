// login.js
// Requires: IndexedDB.js (which defines openClinicDB, db, and getCryptoKey)

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
async function loginUser(username, password) {
  if (!db) await openClinicDB();

  if (!username || !password)
    return { success: false, message: "Please enter both username and password." };

  // Helper to check users/admins stores
  async function checkStore(storeName) {
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index("username");

    return new Promise((resolve, reject) => {
      const req = index.get(username);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => reject(req.error);
    });
  }

  let user = await checkStore("users");
  let role = user?.role || "user";

  if (!user) {
    user = await checkStore("admins");
    if (user) role = "admin";
  }

  if (!user) return { success: false, message: "User not found." };

  // Decrypt stored password
  const decryptedPassword = await decryptData(user.password);

  if (!decryptedPassword) {
    return { success: false, message: "Error reading password. Please try again." };
  }

  // Compare entered password
  if (password !== decryptedPassword) {
    return { success: false, message: "Invalid username or password." };
  }

  console.log(`🔓 Login successful as ${role}`);
  return { success: true, user: { ...user, role } };
}

/* ========== Handle Login Form ========== */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const msg = document.getElementById("msg");

  if (!form) {
    console.error("❌ loginForm not found in DOM.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    msg.textContent = "Logging in...";
    msg.style.color = "gray";

    try {
      const result = await loginUser(username, password);

      if (result.success) {
        msg.textContent = "Login successful! Redirecting...";
        msg.style.color = "green";

        localStorage.setItem("currentUser", JSON.stringify(result.user));

        console.log("👤 Current user set in localStorage:", result.user.username);
         // 🆕 Step 1: Open DB and filter+import data specific to this user
        try {
          await openClinicDB();
          await fetchAndImportAllFiltered(result.user); // 🆕 filter + import relevant data
          console.log("✅ Filtered data imported for:", result.user.username);
        } catch (importErr) {
          console.error("Error during filtered import:", importErr);
        }

        // 🆕 Step 2: Continue with redirect

        // Determine redirect based on role
        let redirectUrl = "../html/dashboard.html"; // fallback

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
            redirectUrl = "../html/dashboard-doctor.html";
        }
        
        window.location.href = redirectUrl;

      } else {
        msg.textContent = result.message;
        msg.style.color = "red";
      }
    } catch (err) {
      console.error("Login error:", err);
      msg.textContent = "An unexpected error occurred. Please try again.";
      msg.style.color = "red";
    }
  });
});
