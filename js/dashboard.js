// Create analytics for display on dashboard
async function createDashboardAnalytics() {
    const db = await openClinicDB();
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Get user total number of user and patients
    const transaction = db.transaction("users", "readonly");
    const store = transaction.objectStore("users");

    const getAllReq = store.getAll();

    try {
      getAllReq.onsuccess = () => {
        const users = getAllReq.result;

        // Number of users and patients
        const totalUsers = users.length;
        const totalPatients = users.filter(u => u.role.toLowerCase() === 'patient').length;
        const totalDoctors = users.filter(u => u.role.toLowerCase() === 'doctor').length;

        // totalPatientsComparison
        const totalPatientsComparison = ((totalPatients) / totalUsers) * 100;
        const totalDoctorsComparison = ((totalDoctors) / totalUsers) * 100;

        if (totalDoctorsComparison > 0) {
            document.querySelector('#totalDoctorsComparison').classList.add('positive');
        } else {
            document.querySelector('#totalDoctorsComparison').classList.add('negative');
        }

        if (totalPatientsComparison > 0) {
            document.querySelector('#totalPatientsComparison').classList.add('positive');
        } else {
            document.querySelector('#totalPatientsComparison').classList.add('negative');
        }

        document.getElementById('totalDoctors').innerText = totalDoctors;
        document.getElementById('totalDoctorsComparison').innerText = `${totalDoctorsComparison.toFixed(2)}%`;
        document.getElementById('totalPatients').innerText = totalPatients;
        document.getElementById('totalPatientsComparison').innerText = `${totalPatientsComparison.toFixed(2)}%`;
        };

    } catch (err) {
      console.error("⚠️ Database error:", err);
    }

    // Get monthly appointment rate
    const appTransaction = db.transaction("appointments", "readonly");
    const appStore = appTransaction.objectStore("appointments");

    const appGetAllReq = appStore.getAll();

    try {
        appGetAllReq.onsuccess = () => {
            const appointments = appGetAllReq.result;
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const monthlyAppointments = appointments.filter(app => {
                const appDate = new Date(app.date);
                return appDate.getMonth() === currentMonth && appDate.getFullYear() === currentYear;
            }).length;

            const totalAppointments = appointments.length;
            const monthlyAppointmentRate = totalAppointments > 0 ? (monthlyAppointments / totalAppointments) * 100 : 0;

            document.getElementById('monthlyAppointments').innerText = `${monthlyAppointments}`;


            // Comparison of monthly appointment rate vs last month
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

            const lastMonthAppointments = appointments.filter(app => {
                const appDate = new Date(app.date);
                return appDate.getMonth() === lastMonth && appDate.getFullYear() === lastMonthYear;
            }).length;

            const lastMonthVsThisMonth = lastMonthAppointments > 0 ? ((monthlyAppointments - lastMonthAppointments) / lastMonthAppointments) * 100 : 0;

            if (lastMonthVsThisMonth > 0) {
                document.getElementById('monthlyAppointmentComparison').classList.add('positive');
            } else {
                document.getElementById('monthlyAppointmentComparison').classList.add('negative');
            }

            document.getElementById('monthlyAppointmentComparison').innerText = `${lastMonthVsThisMonth.toFixed(2)}%`;
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

// Call the function to create dashboard analytics
createDashboardAnalytics();
