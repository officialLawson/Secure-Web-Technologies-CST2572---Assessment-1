// createDashboardAnalytics.js
async function createDashboardAnalytics() {
    // -------------------------------------------------
    // 1. Open DB + Get current user
    // -------------------------------------------------
    let db;
    try {
        db = await openClinicDB();
    } catch (err) {
        console.error('Failed to open clinicDB:', err);
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        console.warn('No current user found');
        return;
    }

    // -------------------------------------------------
    // 2. Sanitize helper (DOMPurify)
    // -------------------------------------------------
    const sanitize = (dirty) => {
        if (dirty === null || dirty === undefined) return '';
        return DOMPurify.sanitize(String(dirty), {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: []
        });
    };

    // -------------------------------------------------
    // 3. USER & PATIENT COUNTS
    // -------------------------------------------------
    const usersTransaction = db.transaction("users", "readonly");
    const usersStore = usersTransaction.objectStore("users");
    const usersReq = usersStore.getAll();

    usersReq.onsuccess = () => {
        const users = usersReq.result;

        const totalUsers = users.length;
        const totalPatients = users.filter(u => u.role?.toLowerCase() === 'patient').length;
        const totalDoctors = users.filter(u => u.role?.toLowerCase() === 'doctor').length;

        const patientsPct = totalUsers > 0 ? (totalPatients / totalUsers) * 100 : 0;
        const doctorsPct = totalUsers > 0 ? (totalDoctors / totalUsers) * 100 : 0;

        // Update DOM safely
        const safeDoctors = sanitize(totalDoctors);
        const safeDoctorsPct = sanitize(doctorsPct.toFixed(2));
        const safePatients = sanitize(totalPatients);
        const safePatientsPct = sanitize(patientsPct.toFixed(2));

        const elDoctors = document.getElementById('totalDoctors');
        const elDoctorsPct = document.getElementById('totalDoctorsComparison');
        const elPatients = document.getElementById('totalPatients');
        const elPatientsPct = document.getElementById('totalPatientsComparison');

        if (elDoctors) elDoctors.textContent = safeDoctors;
        if (elDoctorsPct) {
            elDoctorsPct.textContent = `${safeDoctorsPct}%`;
            elDoctorsPct.className = doctorsPct > 0 ? 'positive' : 'negative';
        }

        if (elPatients) elPatients.textContent = safePatients;
        if (elPatientsPct) {
            elPatientsPct.textContent = `${safePatientsPct}%`;
            elPatientsPct.className = patientsPct > 0 ? 'positive' : 'negative';
        }
    };

    // -------------------------------------------------
    // 4. MONTHLY APPOINTMENTS
    // -------------------------------------------------
    const apptTransaction = db.transaction("appointments", "readonly");
    const apptStore = apptTransaction.objectStore("appointments");
    const apptReq = apptStore.getAll();

    apptReq.onsuccess = () => {
        const appointments = apptReq.result || [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyAppointments = appointments.filter(app => {
            const d = new Date(app.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;

        const totalAppointments = appointments.length;
        const monthlyRate = totalAppointments > 0 ? (monthlyAppointments / totalAppointments) * 100 : 0;

        // Last month
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        const lastMonthAppointments = appointments.filter(app => {
            const d = new Date(app.date);
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
        }).length;

        const growthRate = lastMonthAppointments > 0
            ? ((monthlyAppointments - lastMonthAppointments) / lastMonthAppointments) * 100
            : 0;

        // Update DOM safely
        const safeMonthly = sanitize(monthlyAppointments);
        const safeGrowth = sanitize(growthRate.toFixed(2));

        const elMonthly = document.getElementById('monthlyAppointments');
        const elGrowth = document.getElementById('monthlyAppointmentComparison');

        if (elMonthly) elMonthly.textContent = safeMonthly;
        if (elGrowth) {
            elGrowth.textContent = `${safeGrowth}%`;
            elGrowth.className = growthRate > 0 ? 'positive' : 'negative';
        }
    };

    // -------------------------------------------------
    // 4. MONTHLY ACTIVITY LOGS
    // -------------------------------------------------

    const user = JSON.parse(localStorage.getItem("currentUser"));
    const logsPerMonth = {};

    try {
      const db = await openClinicDB();
      const tx = db.transaction("activityLogs", "readonly");
      const store = tx.objectStore("activityLogs");
      const request = store.getAll();

      request.onsuccess = () => {
        const logs = request.result || [];
        const userLogs = logs.filter(log => log.userId === user.linkedId);

        userLogs.forEach(log => {
          const date = new Date(log.timestamp);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          logsPerMonth[key] = (logsPerMonth[key] || 0) + 1;
        });

        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastKey = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, "0")}`;

        const currentMonthCount = logsPerMonth[currentKey] || 0;
        const lastMonthCount = logsPerMonth[lastKey] || 0;

        const growthRate = lastMonthCount > 0
          ? ((currentMonthCount - lastMonthCount) / lastMonthCount) * 100
          : currentMonthCount > 0 ? 100 : 0;

        const activityLogsCount = document.getElementById("activityLogsThisMonth");
        const activityLogsComparison = document.getElementById("activityLogsComparison");

        if (activityLogsCount) activityLogsCount.textContent = `${sanitize(currentMonthCount)}`;
        if (activityLogsComparison) {
          activityLogsComparison.textContent = `${sanitize(growthRate.toFixed(2))}%`;
          activityLogsComparison.className = growthRate > 0 ? "positive" : "negative";
        }
      };

      request.onerror = () => {
        console.error("Failed to load activity logs.");
      };
    } catch (err) {
      console.error("DB error:", err);
    }
    
}

async function getUserRoleCounts() {
  const roleCounts = {};

  try {
    const db = await openClinicDB();
    const tx = db.transaction("users", "readonly");
    const store = tx.objectStore("users");
    const request = store.getAll();

    return await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const users = request.result || [];

        users.forEach(user => {
          const role = user.role?.toLowerCase();
          if (!role) return;

          const label = role.charAt(0).toUpperCase() + role.slice(1); // e.g., "patient" → "Patient"
          roleCounts[label] = (roleCounts[label] || 0) + 1;
        });

        resolve(roleCounts);
      };

      request.onerror = () => {
        console.error("Failed to load users.");
        reject({});
      };
    });
  } catch (err) {
    console.error("DB error:", err);
    return {};
  }
}

function renderUserRoleChart(roleCounts) {
  const ctx = document.getElementById("userRoleChart")?.getContext("2d");
  if (!ctx) return;

  const labels = Object.keys(roleCounts);
  const data = Object.values(roleCounts);

  new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        label: "User Roles",
        data,
        backgroundColor: [
          "rgba(75, 192, 192, 0.6)",  // Patient
          "rgba(255, 159, 64, 0.6)",  // Doctor
          "rgba(153, 102, 255, 0.6)"  // Admin
        ],
        borderColor: "#fff",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const total = data.reduce((a, b) => a + b, 0);
              const value = context.raw;
              const percent = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${value} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

async function displayRecentActivityLogs() {
  const list = document.getElementById("activityLogsList");
  if (!list) return;

  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  list.innerHTML = "<li>Loading activity logs...</li>";

  try {
    const db = await openClinicDB();
    const user = JSON.parse(localStorage.getItem("currentUser"));

    const tx = db.transaction("activityLogs", "readonly");
    const store = tx.objectStore("activityLogs");
    const request = store.getAll();

    request.onsuccess = () => {
      const logs = request.result || [];

      // Filter logs for this user and sort by timestamp descending
      const userLogs = logs
        .filter(log => log.userId === user.linkedId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 3); // Take latest 5

      list.innerHTML = "";

      if (userLogs.length === 0) {
        list.innerHTML = "<li><em>No recent activity found.</em></li>";
        return;
      }

      userLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString();
        const action = sanitize(log.action || "Unknown action");
        const details = sanitize(log.details || "Unknown details");

        const item = document.createElement("li");
        item.innerHTML = `<strong>${action}</strong>: ${details} <p class="timestamp">${time}</p>`;
        list.appendChild(item);
      });
    };

    request.onerror = () => {
      list.innerHTML = "<li>Error loading activity logs.</li>";
    };
  } catch (err) {
    console.error("Error loading activity logs:", err);
    list.innerHTML = "<li>Database error.</li>";
  }
}

async function getUpcomingAppointmentsForPatient() {
  const list = document.getElementById("upcomingAppointmentsList");
  if (!list) return;

  const patientId = JSON.parse(localStorage.getItem("currentUser")).linkedId;

  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  list.innerHTML = "<li>Loading upcoming appointments...</li>";

  try {
    const db = await openClinicDB();
    const tx = db.transaction("appointments", "readonly");
    const store = tx.objectStore("appointments");
    const request = store.getAll();

    request.onsuccess = async function () {
      const appointments = request.result || [];

      // Filter for this patient and future confirmed appointments
      const upcoming = appointments
        .filter(app =>
          app.patientId === patientId &&
          app.status === "Confirmed" &&
          new Date(`${app.date} ${app.time}`) >= new Date()
        )
        .sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`))
        .slice(0, 5);

      list.innerHTML = "";

      if (upcoming.length === 0) {
        list.innerHTML = "<li><em>No upcoming appointments found.</em></li>";
        return;
      }

      // Optional: fetch doctor names
      const doctorTx = db.transaction("doctors", "readonly");
      const doctorStore = doctorTx.objectStore("doctors");
      const doctorReq = doctorStore.getAll();

      doctorReq.onsuccess = function () {
        const doctors = doctorReq.result || [];

        upcoming.forEach(app => {
          const doctor = doctors.find(d => d.id === app.doctorId);
          const doctorName = doctor ? `Dr ${doctor.first_name} ${doctor.last_name}` : "Unknown Doctor";

          const safeDateTime = sanitize(`${app.date} at ${app.time}`);
          const safeReason = sanitize(app.reason || "No reason provided");
          const safeDoctor = sanitize(doctorName);

          const item = document.createElement("li");
          item.innerHTML = `<strong>${safeDateTime}</strong> — ${safeDoctor}<br><span>${safeReason}</span>`;
          list.appendChild(item);
        });
      };

      doctorReq.onerror = function () {
        console.warn("Could not load doctor info.");
      };
    };

    request.onerror = function (e) {
      console.error("Failed to load appointments:", e.target.error);
    };
  } catch (err) {
    console.error("DB Error:", err);
    list.innerHTML = "<li>Error loading appointments.</li>";
  }
}


// Run immediately
createDashboardAnalytics();
getUserRoleCounts().then(roleCounts => {
  renderUserRoleChart(roleCounts); // from earlier chart function
});
getUserInfo();
displayRecentActivityLogs();
getUpcomingAppointmentsForPatient();