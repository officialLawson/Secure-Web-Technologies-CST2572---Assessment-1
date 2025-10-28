// Appointments Management
async function loadAppointments() {
  const tbody = document.getElementById('appointmentsBody');
  tbody.innerHTML = ''; // clear previous rows

  try {
    const db = await openClinicDB();
    
    const user = JSON.parse(localStorage.getItem('currentUser'));

    // Fetch doctors first and build a lookup map
    const doctorTx = db.transaction('doctors', 'readonly');
    const doctorStore = doctorTx.objectStore('doctors');
    const doctorsReq = doctorStore.getAll();

    doctorsReq.onsuccess = function() {
      const doctors = doctorsReq.result || [];
      const doctorMap = {};
      doctors.forEach(doc => {
        doctorMap[doc.id] = doc.name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim();
      });

        // Fetch patients first and build a lookup map
        const patientTx = db.transaction('patients', 'readonly');
        const patientStore = patientTx.objectStore('patients');
        const patientsReq = patientStore.getAll();

        patientsReq.onsuccess = function() {
            const patients = patientsReq.result || [];
            const patientMap = {};
            patients.forEach(pat => {
                patientMap[pat.NHS] = pat.name || `${pat.Title || ''} ${pat.First || ''} ${pat.Last || ''}`.trim();
            });

            // Now fetch appointments
            const tx = db.transaction('appointments', 'readonly');
            const store = tx.objectStore('appointments');
            const request = store.getAll();

            request.onsuccess = function() {
                const appointments = request.result;

                if (!appointments || appointments.length === 0) {
                tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                return;
                }

                // Populate Table
                switch (user.role.toLowerCase()) {
                case 'doctor':
                    appointments.forEach(app => {
                    const row = document.createElement('tr');
                    const doctorName = doctorMap[app.doctorId] || 'Unknown';
                    const patientName = patientMap[app.patientId] || 'Unknown';

                    row.innerHTML = `
                        <td>${patientName}</td>
                        <td>${app.reason || 'Unknown'}</td>
                        <td>${app.date || '-'} - ${app.time || '-'}</td>
                        <td>${app.status || 'Pending'}</td>
                        <td>
                        <button class="btn-edit" data-id="${app.appointmentId}">Edit</button>
                        <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                        </td>
                    `;

                    tbody.appendChild(row);
                    });
                    break;
                case 'patient':
                    appointments.forEach(app => {
                    const row = document.createElement('tr');
                    const doctorName = doctorMap[app.doctorId] || 'Unknown';

                    row.innerHTML = `
                        <td>${doctorName}</td>
                        <td>${app.reason || 'Unknown'}</td>
                        <td>${app.date || '-'} - ${app.time || '-'}</td>
                        <td>${app.status || 'Pending'}</td>
                        <td>
                        <button class="btn-edit" data-id="${app.appointmentId}">Edit</button>
                        <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                        </td>
                    `;

                    tbody.appendChild(row);
                    });
                    break;
                case 'admin':
                    appointments.forEach(app => {
                    const row = document.createElement('tr');
                    const doctorName = doctorMap[app.doctorId] || 'Unknown';
                    const patientName = patientMap[app.patientId] || 'Unknown';

                    row.innerHTML = `
                        <td>${doctorName}</td>
                        <td>${patientName}</td>
                        <td>${app.date || '-'} - ${app.time || '-'}</td>
                        <td>${app.status || 'Pending'}</td>
                        <td>
                        <button class="btn-edit" data-id="${app.appointmentId}">Edit</button>
                        <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                        </td>
                    `;

                    tbody.appendChild(row);
                    });
                    break;
                default:
                    tbody.innerHTML = "<tr><td colspan='5'>Unauthorized access.</td></tr>";
                    return;
                }

                

                // Attach button listeners
                tbody.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    editAppointment(id);
                });
                });

                tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    deleteAppointment(id);
                });
                });
            };

            request.onerror = function() {
                console.error('Failed to load appointments:', request.error);
                tbody.innerHTML = "<tr><td colspan='5'>Error loading appointments.</td></tr>";
            };
        };

        patientsReq.onerror = function() {
        console.error('Failed to load patients:', patientsReq.error);
        tbody.innerHTML = "<tr><td colspan='5'>Error loading patients data.</td></tr>";
        };
    };

    doctorsReq.onerror = function() {
      console.error('Failed to load doctors:', doctorsReq.error);
      tbody.innerHTML = "<tr><td colspan='5'>Error loading doctors data.</td></tr>";
    };

  } catch (err) {
    console.error('Error opening DB:', err);
    tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
  }
}

async function populateDoctorDropdown() {
  try {
    const db = await openClinicDB(); // 👈 use your existing IndexedDB open function
    const tx = db.transaction('doctors', 'readonly');
    const store = tx.objectStore('doctors');
    const request = store.getAll();

    request.onsuccess = function () {
      const doctors = request.result || [];
      const dropdown = document.getElementById("doctorName");

      // Clear existing options
      dropdown.innerHTML = '<option value="">Select a doctor</option>';

      // Populate doctors
      doctors.forEach(doctor => {
        const fullName =
          doctor.name ||
          `${doctor.first_name || ''} ${doctor.last_name || ''}`.trim() ||
          'Unknown Doctor';

        const option = document.createElement('option');
        option.value = doctor.id;   // ID for reference
        option.textContent = fullName; // Name shown in dropdown

        dropdown.appendChild(option);
      });
    };

    request.onerror = function () {
      console.error("Failed to fetch doctors:", request.error);
    };

  } catch (error) {
    console.error("Error populating doctor dropdown:", error);
  }
}



// Placeholder functions for Edit/Delete
function editAppointment(id) {
  alert(`Edit appointment with ID: ${id}`);
  // TODO: open form or modal here
}

function deleteAppointment(id) {
  if (confirm('Are you sure you want to delete this appointment?')) {
    openClinicDB().then(db => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      store.delete(id);

      tx.oncomplete = () => {
        alert('Appointment deleted.');
        loadAppointments(); // Refresh the table
      };
      tx.onerror = () => {
        alert('Error deleting appointment.');
      };
    });
  }
}

function addAppointment(doctorId, patientId, reason, date, time) {
  openClinicDB().then(db => {
    const tx = db.transaction('appointments', 'readwrite');
    const store = tx.objectStore('appointments');
    const newAppointment = {
      doctorId,
      patientId,
      reason,
      date,
      time,
      status: 'Pending'
    };
    store.add(newAppointment);

    tx.oncomplete = () => {
      alert('Appointment added.');
      loadAppointments(); // Refresh the table
    }

    tx.onerror = () => {
      alert('Error adding appointment.');
    };
  });
}

function handleAddAppointment() {
  const doctorId = document.getElementById('doctorId').value;
  const patientId = document.getElementById('patientId').value;
  const reason = document.getElementById('reason').value;
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;

  addAppointment(doctorId, patientId, reason, date, time);
}

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadAppointments();
  populateDoctorDropdown();
});
