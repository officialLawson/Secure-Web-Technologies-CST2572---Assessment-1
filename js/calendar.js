/* calendar.js  */
document.addEventListener('DOMContentLoaded', async function () {
    // -------------------------------------------------
    // 1. Open the IndexedDB (clinicDB) if not already open
    // -------------------------------------------------
    if (!db) {
        try {
            await clinicDB.openClinicDB();
        } catch (err) {
            console.error('Failed to open clinicDB:', err);
            return;
        }
    }

    // -------------------------------------------------
    // 2. Helper: sanitize any string that will be inserted
    // -------------------------------------------------
    const sanitize = (dirty) => {
        // DOMPurify returns a *string* when we disallow all tags
        return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    };

    // -------------------------------------------------
    // 3. Validate the logged-in user
    // -------------------------------------------------
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role.toLowerCase() !== 'doctor') {
        console.error('Not a doctor session');
        return;
    }

    const doctorId = currentUser.linkedId;
    const today = new Date().toISOString().split('T')[0];

    // -------------------------------------------------
    // 4. Load all appointments for this doctor
    // -------------------------------------------------
    let allAppointments = [];
    try {
        allAppointments = await clinicDB.getAppointmentsByDoctorId(doctorId);
    } catch (err) {
        console.error('Failed to load appointments:', err);
        return;
    }

    // -------------------------------------------------
    // 5. TODAY’S APPOINTMENTS LIST
    // -------------------------------------------------
    const todayAppointments = allAppointments.filter(a => a.date === today);
    const appointmentList = document.querySelector('.appointment-list');

    if (appointmentList) {
        if (todayAppointments.length === 0) {
            appointmentList.innerHTML = '<li><em>No appointments scheduled for today.</em></li>';
        } else {
            todayAppointments.sort((a, b) => a.time.localeCompare(b.time));

            const rows = await Promise.all(
                todayAppointments.map(async (appt) => {
                    // ---- patient name -------------------------------------------------
                    let patientName = 'Unknown Patient';
                    try {
                        const patient = await clinicDB.getItem('patients', appt.patientId);
                        if (patient && patient.First) {
                            patientName = [patient.Title, patient.First, patient.Last]
                                .filter(Boolean)
                                .join(' ');
                        }
                    } catch (e) {
                        console.warn('Could not load patient:', appt.patientId);
                    }

                    // ---- sanitise everything that comes from the DB -----------------
                    const safeTime   = sanitize(appt.time);
                    const safeName   = sanitize(patientName);
                    const safeReason = sanitize(appt.reason);
                    const checkmark  = appt.status === 'Completed' ? ' Completed' : '';

                    return `
                        <li>
                            <strong>${safeTime} — ${safeName}</strong><br>
                            <span>${safeReason}${checkmark}</span>
                        </li>
                    `;
                })
            );

            appointmentList.innerHTML = rows.join('');
        }
    }

    // -------------------------------------------------
    // 6. BUILD FULLCALENDAR EVENTS
    // -------------------------------------------------
    const events = [];

    for (const appt of allAppointments) {
        // ---- patient name (same logic as above) -------------------------
        let patientName = 'Unknown Patient';
        try {
            const patient = await clinicDB.getItem('patients', appt.patientId);
            if (patient && patient.First) {
                patientName = [patient.Title, patient.First, patient.Last]
                    .filter(Boolean)
                    .join(' ');
            }
        } catch (e) {
            console.warn('Could not load patient for calendar:', appt.patientId);
        }

        // ---- datetime helpers -------------------------------------------
        const startDateTime = `${appt.date}T${appt.time}:00`;
        const [h, m] = appt.time.split(':').map(Number);
        const end = new Date(`${appt.date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
        end.setMinutes(end.getMinutes() + 30);
        const endDateTime = end.toISOString().slice(0, 16);

        // ---- sanitised title --------------------------------------------
        const safeName   = sanitize(patientName);
        const safeReason = sanitize(appt.reason);
        let title = `${safeName} – ${safeReason}`;
        if (appt.status === 'Completed') title += ' Completed';

        events.push({
            title,
            start: startDateTime,
            end:   endDateTime,
            backgroundColor: appt.status === 'Completed' ? '#28a745' : '#007bff',
            borderColor:     appt.status === 'Completed' ? '#218838' : '#0056b3'
        });
    }

    // -------------------------------------------------
    // 7. RENDER FULLCALENDAR
    // -------------------------------------------------
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left:  'prev,next today',
                center:'title',
                right: 'dayGridMonth'
            },
            events,
            editable:   false,
            selectable: false,
            height:     'auto',
            dayMaxEvents: true,
            eventClick: function (info) {
                // Even the alert must be safe
                const safeTitle = sanitize(info.event.title);
                alert(`Appointment: ${safeTitle}`);
            }
        });
        calendar.render();
    }
});