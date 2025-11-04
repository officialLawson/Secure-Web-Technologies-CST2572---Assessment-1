// Appointments Management
async function loadAppointments() {
  const tbody = document.getElementById('appointmentsBody');
  const tbodyConfirmed = document.getElementById('appointmentsConfirmedBody');
  tbody.innerHTML = "" // clear previous rows
  tbodyConfirmed.innerHTML = "";

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
                  tbodyConfirmed.innerHTML="<tr><td colspan='5'>No appointments found.</td></tr>";
                  
                  return;
                }

                // Populate Table
                switch (user.role.toLowerCase()) {
                case 'doctor':
                    const appointmentsDoctor = appointments.filter(p => p.doctorId === user.linkedId) || [];

                    if (!appointmentsDoctor || appointmentsDoctor.length === 0) {
                      tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                      tbodyConfirmed.innerHTML="<tr><td colspan='5'>No appointments found.</td></tr>";
                      
                      return;
                    }

                    appointmentsDoctor.forEach(app => {
                    const row = document.createElement('tr');
                    const doctorName = doctorMap[app.doctorId] || 'Unknown';
                    const patientName = patientMap[app.patientId] || 'Unknown';


                    if (app.status === "Confirmed") {
                      row.innerHTML = `
                          <td>${patientName}</td>
                          <td>${app.reason || 'Unknown'}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-edit" data-id="${app.appointmentId}" data-role="${user.role.toLowerCase()}">Edit</button>
                            <button class="btn-cancel" data-id="${app.appointmentId}">Cancel</button>
                          </td>
                      `;

                      tbodyConfirmed.appendChild(row);
                    } else if (app.status === "Completed") {
                      row.innerHTML = `
                          <td>${patientName}</td>
                          <td>${app.reason || 'Unknown'}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                          </td>
                      `;

                      tbody.appendChild(row);
                    } else if (app.status === "Cancelled") {
                      row.innerHTML = `
                          <td>${patientName}</td>
                          <td>${app.reason || 'Unknown'}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                          </td>
                      `;

                      tbody.appendChild(row);
                    }
                    });
                    break;
                case 'patient':
                  const appointmentsPatient = appointments.filter(p => p.patientId === user.linkedId) || [];
                  
                  if (!appointmentsPatient || appointmentsPatient.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                    tbodyConfirmed.innerHTML="<tr><td colspan='5'>No appointments found.</td></tr>";
                      
                      return;
                    }
                    
                    appointmentsPatient.forEach(app => {
                      const row = document.createElement('tr');
                      const doctorName = doctorMap[app.doctorId] || 'Unknown';
                      
                      if (app.status === "Confirmed") {
                        row.innerHTML = `
                        <td>Dr. ${doctorName}</td>
                        <td>${app.reason || 'Unknown'}</td>
                        <td>${app.date || '-'} - ${app.time || '-'}</td>
                        <td>${app.status || 'Pending'}</td>
                        <td>
                        <button class="btn-edit" data-id="${app.appointmentId}" data-role="${user.role.toLowerCase()}">Edit</button>
                        <button class="btn-cancel" data-id="${app.appointmentId}">Cancel</button>
                        </td> 
                        `;
                        
                        tbodyConfirmed.appendChild(row);
                      } else if (app.status === "Completed") {
                        row.innerHTML = `
                          <td>Dr. ${doctorName}</td>
                          <td>${app.reason || 'Unknown'}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                          </td>
                        `;

                        tbody.appendChild(row);
                    } else if (app.status === "Cancelled") {
                        row.innerHTML = `
                          <td>Dr. ${doctorName}</td>
                          <td>${app.reason || 'Unknown'}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                          </td>
                        `;

                      tbody.appendChild(row);
                    }
                    });
                    break;
                case 'admin':
                    appointments.forEach(app => {
                    const row = document.createElement('tr');
                    const doctorName = doctorMap[app.doctorId] || 'Unknown';
                    const patientName = patientMap[app.patientId] || 'Unknown';

                    if (app.status === "Confirmed") {
                      row.innerHTML = `
                          <td>Dr. ${doctorName}</td>
                          <td>${patientName}</td>
                          <td>${app.date || '-'} - ${app.time || '-'}</td>
                          <td>${app.status || 'Pending'}</td>
                          <td>
                            <button class="btn-cancel" data-id="${app.appointmentId}">Cancel</button>
                          </td>
                      `;

                      tbodyConfirmed.appendChild(row);
                    } else if (app.status === "Completed") {
                        row.innerHTML = `
                            <td>Dr. ${doctorName}</td>
                            <td>${patientName}</td>
                            <td>${app.date || '-'} - ${app.time || '-'}</td>
                            <td>${app.status || 'Pending'}</td>
                            <td>
                              <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                            </td>
                        `;

                        tbody.appendChild(row);
                    } else if (app.status === "Cancelled") {
                        row.innerHTML = `
                            <td>Dr. ${doctorName}</td>
                            <td>${patientName}</td>
                            <td>${app.date || '-'} - ${app.time || '-'}</td>
                            <td>${app.status || 'Pending'}</td>
                            <td>
                              <button class="btn-delete" data-id="${app.appointmentId}">Delete</button>
                            </td>
                        `;

                        tbody.appendChild(row);
                    }
                    });
                    break;
                default:
                    tbody.innerHTML = "<tr><td colspan='5'>Unauthorized access.</td></tr>";
                    return;
                }

                

                // Attach button listeners
                tbodyConfirmed.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  const { id, role } = e.target.dataset;

                  if (role === 'patient') {
                    window.location.href = `edit-appointment-patient.html?role=${role}&id=${id}`;
                  } else if (role === 'doctor') {
                    window.location.href = `edit-appointment-doctor.html?role=${role}&id=${id}`;
                  } else {
                    console.warn(`Unknown role: ${role}`);
                  }
                });
                });

                tbody.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    deleteAppointment(id);
                });
                });

                tbodyConfirmed.querySelectorAll('.btn-cancel').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    cancelAppointment(id);
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
      if (dropdown) {
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
      }
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

let appointmentToDelete = null;

function deleteAppointment(id) {
  appointmentToDelete = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}
// Handle "Yes, Delete" in modal
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (appointmentToDelete) {
    try {
      const db = await openClinicDB();
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      store.delete(appointmentToDelete);

      tx.oncomplete = () => {
        loadAppointments(); // Refresh the table
        document.getElementById('deleteModal').classList.add('hidden');
        appointmentToDelete = null;
      };
      tx.onerror = () => {
        alert('Error deleting appointment.');
        appointmentToDelete = null;
      };
    } catch (err) {
      console.error("Delete failed:", err);
      alert('Error deleting appointment.');
      appointmentToDelete = null;
    }
  }
});

// Handle "Cancel"
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden');
  userToDelete = null;
});

let appointmentToCancel = null;

function cancelAppointment(id) {
  appointmentToCancel = id;
  document.getElementById('cancelModal').classList.remove('hidden');
}
// Handle "Yes, Cancel" in modal
document.getElementById('confirmCancel').addEventListener('click', async () => {
  if (appointmentToCancel) {
    try {
      const db = await openClinicDB();
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      const request = store.getAll();

      request.onsuccess = function() {
        const appointments = request.result || [];

        const appointment = appointments.find(app => app.appointmentId === appointmentToCancel) || [];

        if (appointment) {
          appointment.status = "Cancelled"; // or whatever new status you want
        }

        const updateReq = store.put(appointment); // put replaces the record with the same key

        updateReq.onsuccess = () => {
          console.log("✅ Appointment status updated.");
          loadAppointments(); // Refresh the table
          document.getElementById('cancelModal').classList.add('hidden');
          appointmentToCancel = null;
        };

        updateReq.onerror = () => {
          console.error("❌ Failed to update appointment:", updateReq.error);
        };
        
      };
      request.onerror = () => {
        alert('Error deleting appointment.');
        appointmentToCancel = null;
      };
    } catch (err) {
      console.error("Cancel failed:", err);
      alert('Error deleting appointment.');
      appointmentToCancel = null;
    }
  }
});

// Handle "Cancel"
document.getElementById('cancelCancel').addEventListener('click', () => {
  document.getElementById('cancelModal').classList.add('hidden');
  userToCancel = null;
});



async function addAppointment(event, doctorId, patientId, reason, date, time) {

  // ✅ Prevent form submission reload
  if (event) event.preventDefault();

  if (!doctorId) {
    const inputError = document.getElementById("doctorName");
    inputError.style.borderColor = "red";
    const error = document.getElementById("doctorName-form-error");
    error.innerHTML = `Please select a doctor.`;
    return;
  } else {
    const inputError = document.getElementById("doctorName");
    inputError.style.borderColor = "";
    const error = document.getElementById("doctorName-form-error");
    error.innerHTML = ``;
  }
  if (!date) {
    const inputError = document.getElementById("appointmentDate");
    inputError.style.borderColor = "red";
    const error = document.getElementById("appointmentDate-form-error");
    error.innerHTML = `Please select an appointment date.`;
    return;
  } else {
    const inputError = document.getElementById("appointmentDate");
    inputError.style.borderColor = "";
    const error = document.getElementById("appointmentDate-form-error");
    error.innerHTML = ``;
  }
  if (!time) {
    const inputError = document.getElementById("appointmentTime");
    inputError.style.borderColor = "red";
    const error = document.getElementById("appointmentTime-form-error");
    error.innerHTML = `Please select an appointment time.`;
    return;
  } else {
    const inputError = document.getElementById("appointmentTime");
    inputError.style.borderColor = "";
    const error = document.getElementById("appointmentTime-form-error"); 
    error.innerHTML = ``;
  }
  if (!reason) {
    const inputError = document.getElementById("appointmentReason");
    inputError.style.borderColor = "red";
    const error = document.getElementById("appointmentReason-form-error");
    error.innerHTML = `Please select an appointment reason.`;
    return;
  } else {
    const inputError = document.getElementById("appointmentReason");
    inputError.style.borderColor = "";
    const error = document.getElementById("appointmentReason-form-error");
    error.innerHTML = ``;
  }

  if (new Date(`${date}T${time}`) < new Date()) {
    const inputError = document.getElementById("appointmentTime");
    inputError.style.borderColor = "red";
    const error = document.getElementById("appointmentTime-form-error");
    error.innerHTML = `Appointment date and time must be in the future.`;
    return;
  } else {
    const inputError = document.getElementById("appointmentTime");
    inputError.style.borderColor = "";
    const error = document.getElementById("appointmentTime-form-error");
    error.innerHTML = ``;


    try {
      const db = await openClinicDB();
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore("appointments");

      // ✅ 1. Get all medicines to check for duplicates and determine next ID
      const getAllReq = store.getAll();

      getAllReq.onsuccess = function() {
        const appointments = getAllReq.result || [];

        const existSame = appointments.find(app => 
          app.doctorId === doctorId &&
          app.patientId === patientId &&
          app.date === date &&
          app.time === time
        );

        if (existSame) {
          const error = document.getElementById("appointmentTime-form-error");
          error.innerHTML = `Appointment with the same details already exists.`;
          return;
        }

        const existDifferent = appointments.find(app => 
          app.doctorId === doctorId &&
          app.date === date &&
          app.time === time
        );

        if (existDifferent) {
          const error = document.getElementById("appointmentTime-form-error");
          error.innerHTML = `Appointment at this specified time is not possible.`;
          return;
        }

        // ✅ Generate unique appointment ID (e.g., "AP7241")
        function generateAppointmentId() {
          const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
          const timestamp = Date.now().toString().slice(-4); // last 4 digits of timestamp (adds uniqueness)
          return `AP${randomNum}${timestamp}`;
        }

        // ✅ Create the new appointment object
        const newAppointment = {
          appointmentId: generateAppointmentId(),
          doctorId,
          patientId,
          reason,
          date,
          time,
          status: 'Confirmed',
        };

        const addReq = store.add(newAppointment);

        const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();

        addReq.onsuccess = () => {
          console.log(`✅ Added appointment: ${reason} (id: ${newAppointment.appointmentId})`);
          window.location.href = `appointments-${userRole}.html`; // Redirect after adding
        };

        addReq.onerror = (e) => {
          console.error("❌ Failed to add appointment:", e.target.error);
        };
      };

      getAllReq.onerror = (e) => {
        console.error("❌ Error fetching appointments:", e.target.error);
      };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
  }
}

function handleAddAppointment(event) {
  const doctorId = document.getElementById('doctorName').value;
  const patientId = JSON.parse(localStorage.getItem('currentUser')).linkedId;
  const reason = document.getElementById('appointmentReason').value;
  const date = document.getElementById('appointmentDate').value;
  const time = document.getElementById('appointmentTime').value;

  addAppointment(event, doctorId, patientId, reason, date, time);

}

// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
  loadAppointments();
  populateDoctorDropdown();
});

// Edit Appointment
async function loadAppointmentForEdit(id) {
  console.log("Function triggered with id:", id);

  try {
    const db = await openClinicDB();

    // Step 1: Get the appointment
    const appointmentTx = db.transaction('appointments', 'readonly');
    const appointmentStore = appointmentTx.objectStore('appointments');
    const appointmentReq = appointmentStore.getAll();

    appointmentReq.onsuccess = function () {
      const appointments = appointmentReq.result || [];
      const appointment = appointments.find(app => app.appointmentId === id);

      if (!appointment) {
        console.error("❌ Appointment not found.");
        return;
      }

      // Step 2: Get the doctor
      const doctorTx = db.transaction('doctors', 'readonly');
      const doctorStore = doctorTx.objectStore('doctors');
      const docReq = doctorStore.getAll();

      docReq.onsuccess = async function () {
        const encryptedDoctors = docReq.result || [];

        const decryptedDoctors = await Promise.all(
          encryptedDoctors.map(p => decryptDoctorInfo(p))
        );

        const doctor = decryptedDoctors.find(d => d.id === parseInt(appointment.doctorId));
        const doctorFullName = doctor ? `${doctor.first_name} ${doctor.last_name}` : "";

        // Step 3: Parse time string to HH:MM format
        function parseTimeString(strTime) {
          if (/^\d{2}:\d{2}$/.test(strTime)) return strTime;

          const timeObj = new Date(strTime);
          if (isNaN(timeObj.getTime())) throw new Error("Invalid time format");

          return timeObj.toTimeString().slice(0, 5); // "HH:MM"
        }

        // Step 4: Populate form fields
        document.getElementById('doctorName').value = doctorFullName;
        document.getElementById('appointmentDate').value = appointment.date || '';
        document.getElementById('appointmentTimes').value = parseTimeString(appointment.time);
        document.getElementById('appointmentReason').value = appointment.reason || '';
      };

      docReq.onerror = function (e) {
        console.error("❌ Error loading doctor:", e.target.error);
      };
    };

    appointmentReq.onerror = function (e) {
      console.error("❌ Error loading appointments:", e.target.error);
    };
  } catch (err) {
    console.error("⚠️ Database error:", err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const role = params.get('role');

  if (id) {
    loadAppointmentForEdit(id); // ✅ This runs on the correct page
  }
});