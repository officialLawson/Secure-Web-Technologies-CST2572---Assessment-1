// sessionTimeout.js
// Auto-logout after 30 minutes of inactivity (client-side only)
//for doctor, patient, admin dasboard
const SESSION_TIMEOUT_MINUTES = 30;
let sessionTimeout;

function startSessionTimeout() {
  // Clear any existing timer
  clearTimeout(sessionTimeout);

  sessionTimeout = setTimeout(() => {
    if (confirm("⚠️ Your session has expired due to inactivity.\nClick OK to log out.")) {
      signOut();
    } else {
      // User cancels → restart timer (grace period)
      startSessionTimeout();
    }
  }, SESSION_TIMEOUT_MINUTES * 60 * 1000);
}

function resetSessionTimeout() {
  if (localStorage.getItem("currentUser")) {
    startSessionTimeout();
  }
}

// Track user activity to reset timer
function trackUserActivity() {
  const events = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, resetSessionTimeout, true);
  });
}

// Safe sign-out (reusable)
function signOut() {
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  window.location.href = "../html/login.html";
}

// Start on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("currentUser")) {
      trackUserActivity();
      resetSessionTimeout();
    }
  });
} else {
  if (localStorage.getItem("currentUser")) {
    trackUserActivity();
    resetSessionTimeout();
  }
}

// Expose for manual use (e.g., in sidebar.js)
window.signOut = signOut;