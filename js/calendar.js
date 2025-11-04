// calendar.js
document.addEventListener('DOMContentLoaded', async function () {
    // 1. Initialize clinicDB if not already open
    if (!db) {
        try {
            await clinicDB.openClinicDB();
        } catch (err) {
            console.error('Failed to open clinicDB:', err);
            return;
        }
    }

    // 2. Validate current user
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role.toLowerCase() !== 'doctor') {
        console.error('Not a doctor session');
        return;
    }

    const doctorId = currentUser.linkedId;
    const today = new Date().toISOString().split('T')[0];

    // 3. Fetch all appointments for this doctor
    let allAppointments = [];
    try {
        allAppointments = await clinicDB.getAppointmentsByDoctorId(doctorId);
    } catch (err) {
        console.error('Failed to load appointments:', err);
        return;
    }

    // 4.  UPDATE "TODAY'S APPOINTMENTS" LIST
    const todayAppointments = allAppointments.filter(appt => appt.date === today);
    const appointmentList = document.querySelector('.appointment-list');
    if (appointmentList) {
        if (todayAppointments.length === 0) {
            appointmentList.innerHTML = '<li><em>No appointments scheduled for today.</em></li>';
        } else {
            // Sort by time
            todayAppointments.sort((a, b) => a.time.localeCompare(b.time));

            // Build list items with patient names
            const promises = todayAppointments.map(async (appt) => {
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

                return `
                    <li>
                        <strong>${appt.time} — ${patientName}</strong><br>
                        <span>${appt.reason}${appt.status === 'Completed' ? ' ✅' : ''}</span>
                    </li>
                `;
            });

            appointmentList.innerHTML = (await Promise.all(promises)).join('');
        }
    }

    // 5. ➤ BUILD FULL CALENDAR EVENTS
    const events = [];
    for (const appt of allAppointments) {
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

        // Build start datetime
        const startDateTime = `${appt.date}T${appt.time}:00`;

        // Compute end time (assume 30-minute slots)
        const [hours, minutes] = appt.time.split(':').map(Number);
        const end = new Date(`${appt.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
        end.setMinutes(end.getMinutes() + 30);
        const endDateTime = end.toISOString().slice(0, 16);

        // Build title
        let title = `${patientName} – ${appt.reason}`;
        if (appt.status === 'Completed') title += ' ✅';

        events.push({
            title: title,
            start: startDateTime,
            end: endDateTime,
            backgroundColor: appt.status === 'Completed' ? '#28a745' : '#007bff',
            borderColor: appt.status === 'Completed' ? '#218838' : '#0056b3'
        });
    }

    // 6. ➤ RENDER FULLCALENDAR
    const calendarEl = document.getElementById('calendar');
    if (calendarEl) {
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth'
            },
            events: events,
            editable: false,
            selectable: false,
            height: 'auto',
            dayMaxEvents: true,
            eventClick: function (info) {
                alert(`Appointment: ${info.event.title}`);
            }
        });

        calendar.render();
    }
});