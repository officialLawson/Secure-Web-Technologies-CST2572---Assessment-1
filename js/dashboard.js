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
}

// Run immediately
createDashboardAnalytics();
getUserInfo();