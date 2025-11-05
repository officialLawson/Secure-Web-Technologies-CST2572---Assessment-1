/* ---- Helpers ---- */
function generateLogId() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12); // e.g. "202511051623"
  const rand = Math.floor(100 + Math.random() * 900); // 100–999
  return `L${stamp}${rand}`; // e.g. "L202511051623123"
}

async function logActivity({ userId, userRole, action, target, details }) {
  const logEntry = {
    logId: generateLogId(),
    userId,
    userRole,
    action,
    target,
    timestamp: new Date().toISOString(),
    details
  };

  try {
    const db = await openClinicDB();
    const tx = db.transaction('activityLogs', 'readwrite');
    const store = tx.objectStore('activityLogs');
    store.add(logEntry);

    tx.oncomplete = () => {
      console.log("✅ Activity logged:", logEntry);
    };

    tx.onerror = (e) => {
      console.error("❌ Failed to log activity:", e.target.error);
    };
  } catch (err) {
    console.error("⚠️ DB error while logging activity:", err);
  }
}

async function logCurrentUserActivity(action, target, details) {
    const user = JSON.parse(localStorage.getItem('currentUser'));

  try {
    const db = await openClinicDB();
    const tx = db.transaction('activityLogs', 'readwrite');
    const store = tx.objectStore('activityLogs');

    console.log("Logging.....");
    const logEntry = {
        logId: generateLogId(),
        userId: user.linkedId,
        userRole: user.role.toLowerCase(),
        action,
        target,
        timestamp: new Date().toISOString(),
        details
    };

    store.add(logEntry);

    tx.oncomplete = () => {
      console.log("✅ Activity logged:", logEntry);
    };

    tx.onerror = (e) => {
      console.error("❌ Failed to log activity:", e.target.error);
    };
  } catch (err) {
    console.error("⚠️ DB error while logging activity:", err);
  }
}