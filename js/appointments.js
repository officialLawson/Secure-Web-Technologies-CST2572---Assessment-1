// Helper function
function normalizeTimeHHMM(str) {
  if (typeof str !== "string") return null;

  const parts = str.split(":");
  if (parts.length !== 2) return null;

  let [hour, minute] = parts;

  // Pad with leading zeros if needed
  hour = hour.padStart(2, "0");
  minute = minute.padStart(2, "0");

  // Validate ranges
  const hourNum = parseInt(hour, 10);
  const minuteNum = parseInt(minute, 10);

  if (
    isNaN(hourNum) || isNaN(minuteNum) ||
    hourNum < 0 || hourNum > 23 ||
    minuteNum < 0 || minuteNum > 59
  ) {
    return null;
  }

  return `${hour}:${minute}`;
}

let appointmentToCancel = null;

let allRenderedCofirmedAppointments = []; // holds sanitized, display-ready rows
let allRenderedAppointments = []; // holds sanitized, display-ready rows

// Search Feature
function renderConfirmedAppointments(data) {
  const tbodyConfirmed = document.getElementById('appointmentsConfirmedBody');
  tbodyConfirmed.innerHTML = "";

  if (data.length === 0) {
    tbodyConfirmed.innerHTML = "<tr><td colspan='5'>No matching confirmed appointments found.</td></tr>";
    return;
  }

  const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();

  data.forEach(app => {
    const row = document.createElement("tr");
    const safeId = DOMPurify.sanitize(app.appointmentId);
    const safeStatus = DOMPurify.sanitize(app.status);
    const safeDateTime = DOMPurify.sanitize(`${app.date} - ${app.time}`);
    const safeDoctor = DOMPurify.sanitize(app.doctorName);
    const safePatient = DOMPurify.sanitize(app.patientName);
    const safeReason = DOMPurify.sanitize(app.reason);
    const safeRole = DOMPurify.sanitize(app.role);

    if (userRole === 'doctor') {
        // Only show "Mark Completed" button if status is "Confirmed"
        const markCompletedBtn = app.status === "Confirmed" 
          ? `<button class="complete-btn" data-id="${safeId}">Mark Completed</button>` 
          : '';
      row.innerHTML = `
        <td>${safePatient}</td>
        <td>${safeReason}</td>
        <td>${safeDateTime}</td>
        <td>${safeStatus}</td>
        <td>
          <button class="btn-edit" data-id="${safeId}" data-role="${safeRole}">Edit</button>
          <button class="btn-cancel" data-id="${safeId}">Cancel</button>
           ${markCompletedBtn}
        </td>
      `;
    } else if (userRole === 'patient') {
      row.innerHTML = `
        <td>${safeDoctor}</td>
        <td>${safeReason}</td>
        <td>${safeDateTime}</td>
        <td>${safeStatus}</td>
        <td>
          <button class="btn-edit" data-id="${safeId}" data-role="${safeRole}">Edit</button>
          <button class="btn-cancel" data-id="${safeId}">Cancel</button>

        </td>
      `;
    } else if (userRole === 'admin') {
      row.innerHTML = `
        <td>Dr. ${safeDoctor}</td>
        <td>${safePatient}</td>
        <td>${safeDateTime}</td>
        <td>${safeStatus}</td>
        <td>
          <button class="btn-cancel" data-id="${safeId}">Cancel</button>
        </td>
      `;
    }

    tbodyConfirmed.appendChild(row);
  });

}


function renderCancelledAppointments(data) {
  const tbody = document.getElementById('appointmentsBody');
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>No matching cancelled/completed appointments found.</td></tr>";
    return;
  }

  const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();

  data.forEach(app => {
    const row = document.createElement("tr");
    const safeId = DOMPurify.sanitize(app.appointmentId);
    const safeStatus = DOMPurify.sanitize(app.status);
    const safeDateTime = DOMPurify.sanitize(`${app.date} - ${app.time}`);
    const safeDoctor = DOMPurify.sanitize(app.doctorName);
    const safePatient = DOMPurify.sanitize(app.patientName);
    const safeReason = DOMPurify.sanitize(app.reason);

    if (userRole === 'doctor' || userRole === 'patient') {
      row.innerHTML = `
        <td>${userRole === 'doctor' ? safePatient : safeDoctor}</td>
        <td>${safeReason}</td>
        <td>${safeDateTime}</td>
        <td>${safeStatus}</td>
        <td>
          <button class="btn-delete" data-id="${safeId}">Delete</button>
        </td>
      `;
    } else if (userRole === 'admin') {
      row.innerHTML = `
        <td>Dr. ${safeDoctor}</td>
        <td>${safePatient}</td>
        <td>${safeDateTime}</td>
        <td>${safeStatus}</td>
        <td>
          <button class="btn-delete" data-id="${safeId}">Delete</button>
        </td>
      `;
    }

    tbody.appendChild(row);
  });

  if (window.__markAppointmentCompletedClient && typeof window.__markAppointmentCompletedClient === 'function') {
      // Re-inject "Mark Completed" buttons after dynamic rendering
      if (window.injectButtonsIntoRows) {
          try { window.injectButtonsIntoRows(); } catch (err) { console.error(err); }
      }
  }

}



document.addEventListener("DOMContentLoaded", () => {
  const confirmedInput = document.getElementById("searchConfirmed");
  if (confirmedInput) {
    confirmedInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();

      console.log(query);

      const filtered = query === ""
        ? allRenderedCofirmedAppointments
        : allRenderedCofirmedAppointments.filter(app =>
            (app.doctorName || "").toLowerCase().includes(query) ||
            (app.patientName || "").toLowerCase().includes(query) ||
            (app.status || "").toLowerCase().includes(query) ||
            (app.reason || "").toLowerCase().includes(query) ||
            (app.date || "").toLowerCase().includes(query) ||
            (app.time || "").toLowerCase().includes(query)
          );

        console.log(filtered);

      renderConfirmedAppointments(filtered);
    });
  }

  const cancelledInput = document.getElementById("searchCancelled");
  if (cancelledInput) {
    cancelledInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();

      const filtered = query === ""
        ? allRenderedAppointments
        : allRenderedAppointments.filter(app =>
            (app.doctorName || "").toLowerCase().includes(query) ||
            (app.patientName || "").toLowerCase().includes(query) ||
            (app.status || "").toLowerCase().includes(query) ||
            (app.reason || "").toLowerCase().includes(query) ||
            (app.date || "").toLowerCase().includes(query) ||
            (app.time || "").toLowerCase().includes(query)
          );

      renderCancelledAppointments(filtered);
    });
  }
});

// Appointments Management
async function loadAppointments() {
  allRenderedAppointments = []; // clear previous cache
  allRenderedCofirmedAppointments = []; // clear previous cache
  const tbody = document.getElementById('appointmentsBody');
  const tbodyConfirmed = document.getElementById('appointmentsConfirmedBody');
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  tbody.innerHTML = "" // clear previous rows
  tbodyConfirmed.innerHTML = "";
  try {
    const db = await openClinicDB();

   
    const user = JSON.parse(localStorage.getItem('currentUser'));
        // Define update function ONLY for doctors/admins
    if (['doctor', 'admin'].includes(user.role.toLowerCase())) {
      window.updateAppointmentStatus = async (id, newStatus) => {
        const appt = await clinicDB.getItem('appointments', id);
        if (!appt) throw new Error(`Appointment ${id} not found`);
        appt.status = newStatus;
        if (newStatus === 'Completed') {
          appt.completedAt = new Date().toISOString();
        }
        await clinicDB.updateItem('appointments', appt);
        return appt;
      };
    }
        // Fetch doctors first and build a lookup map
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();
        doctorsReq.onsuccess = function() {
          const doctors = doctorsReq.result || [];
          const doctorMap = {};
          doctors.forEach(doc => {
            const name = doc.name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim();
            doctorMap[doc.id] = sanitize(name);
          });
            // Fetch patients first and build a lookup map
            const patientTx = db.transaction('patients', 'readonly');
            const patientStore = patientTx.objectStore('patients');
            const patientsReq = patientStore.getAll();
            patientsReq.onsuccess = function() {
                const patients = patientsReq.result || [];
                const patientMap = {};
                patients.forEach(pat => {
                    const name = pat.name || `${pat.Title || ''} ${pat.First || ''} ${pat.Last || ''}`.trim();
                    patientMap[pat.NHS] = sanitize(name);
                });
                // Now fetch appointments
                const tx = db.transaction('appointments', 'readonly');
                const store = tx.objectStore('appointments');
                const request = store.getAll();
                request.onsuccess = function() {
                    const appointments = request.result;
                    if (!appointments || appointments.length === 0) {
                      tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                      tbodyConfirmed.innerHTML= "<tr><td colspan='5'>No appointments found.</td></tr>";
                    
                      return;
                    }
                    // Populate Table
                    switch (user.role.toLowerCase()) {
                    case 'doctor':
                        const appointmentsDoctor = appointments.filter(p => p.doctorId === user.linkedId) || [];
                        if (!appointmentsDoctor || appointmentsDoctor.length === 0) {
                          tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                          tbodyConfirmed.innerHTML= "<tr><td colspan='5'>No appointments found.</td></tr>";
                        
                          return;
                        }
                        appointmentsDoctor.forEach(app => {
                        const row = document.createElement('tr');
                        row.dataset.id = sanitize(app.appointmentId);
                        row.dataset.date = sanitize(app.date);
                        row.dataset.status = sanitize(app.status);
                        const doctorName = doctorMap[app.doctorId] || 'Unknown';
                        const patientName = patientMap[app.patientId] || 'Unknown';
                        const safeReason = sanitize(app.reason || 'Unknown');
                        const safeDate = sanitize(app.date || '-');
                        const safeTime = sanitize(app.time || '-');
                        const safeStatus = sanitize(app.status || 'Pending');
                        const safeId = sanitize(app.appointmentId);
                        if (app.status === "Confirmed") {
                          
                          row.innerHTML = `
                              <td>${patientName}</td>
                              <td>${safeReason}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-edit" data-id="${safeId}" data-role="${sanitize(user.role.toLowerCase())}">Edit</button>
                                <button class="btn-cancel" data-id="${safeId}">Cancel</button>
                                <button class="complete-btn" data-id="${safeId}">Mark Completed</button>
                              </td>
                          `;

                          tbodyConfirmed.appendChild(row);

                          allRenderedCofirmedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: patientName || '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });

                        } else if (app.status === "Completed") {
                          row.innerHTML = `
                              <td>${patientName}</td>
                              <td>${safeReason}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-delete" data-id="${safeId}">Delete</button>
                              </td>
                          `;
                          

                          allRenderedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: patientName || '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });


                          tbody.appendChild(row);

                        } else if (app.status === "Cancelled") {
                          row.innerHTML = `
                              <td>${patientName}</td>
                              <td>${safeReason}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-delete" data-id="${safeId}">Delete</button>
                              </td>
                          `;

                      allRenderedAppointments.push({
                          html: row.innerHTML,
                          status: app.status,
                          doctorName: doctorName || '',
                          patientName: patientName || '',
                          reason: app.reason || '',
                          date: app.date || '',
                          time: app.time || ''
                        });

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
                      const safeReason = sanitize(app.reason || 'Unknown');
                      const safeDate = sanitize(app.date || '-');
                      const safeTime = sanitize(app.time || '-');
                      const safeStatus = sanitize(app.status || 'Pending');
                      const safeId = sanitize(app.appointmentId);
                      if (app.status === "Confirmed") {
                        row.innerHTML = `
                        <td>Dr. ${doctorName}</td>
                        <td>${safeReason}</td>
                        <td>${safeDate} - ${safeTime}</td>
                        <td>${safeStatus}</td>
                        <td>
                        <button class="btn-edit" data-id="${safeId}" data-role="${sanitize(user.role.toLowerCase())}">Edit</button>
                        <button class="btn-cancel" data-id="${safeId}">Cancel</button>
                        </td>
                        `;
                       
                        tbodyConfirmed.appendChild(row);

                            allRenderedCofirmedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
                          } else if (app.status === "Completed") {
                            row.innerHTML = `
                              <td>Dr. ${doctorName}</td>
                              <td>${safeReason}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-delete" data-id="${safeId}">Delete</button>
                              </td>
                            `;
                            tbody.appendChild(row);

                            allRenderedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
                        } else if (app.status === "Cancelled") {
                            row.innerHTML = `
                              <td>Dr. ${doctorName}</td>
                              <td>${safeReason}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-delete" data-id="${safeId}">Delete</button>
                              </td>
                            `;
                          tbody.appendChild(row);

                          allRenderedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
                        }
                        });
                        break;
                    case 'admin':
                        appointments.forEach(app => {
                        const row = document.createElement('tr');
                        const doctorName = doctorMap[app.doctorId] || 'Unknown';
                        const patientName = patientMap[app.patientId] || 'Unknown';
                        const safeDate = sanitize(app.date || '-');
                        const safeTime = sanitize(app.time || '-');
                        const safeStatus = sanitize(app.status || 'Pending');
                        const safeId = sanitize(app.appointmentId);
                        if (app.status === "Confirmed") {
                          row.innerHTML = `
                              <td>Dr. ${doctorName}</td>
                              <td>${patientName}</td>
                              <td>${safeDate} - ${safeTime}</td>
                              <td>${safeStatus}</td>
                              <td>
                                <button class="btn-cancel" data-id="${safeId}">Cancel</button>
                              </td>
                          `;
                          tbodyConfirmed.appendChild(row);

                          allRenderedCofirmedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: patientName || '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
                        } else if (app.status === "Completed") {
                            row.innerHTML = `
                                <td>Dr. ${doctorName}</td>
                                <td>${patientName}</td>
                                <td>${safeDate} - ${safeTime}</td>
                                <td>${safeStatus}</td>
                                <td>
                                  <button class="btn-delete" data-id="${safeId}">Delete</button>
                                </td>
                            `;
                            tbody.appendChild(row);

                            allRenderedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: patientName || '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
                        } else if (app.status === "Cancelled") {
                            row.innerHTML = `
                                <td>Dr. ${doctorName}</td>
                                <td>${patientName}</td>
                                <td>${safeDate} - ${safeTime}</td>
                                <td>${safeStatus}</td>
                                <td>
                                  <button class="btn-delete" data-id="${safeId}">Delete</button>
                                </td>
                            `;
                            tbody.appendChild(row);

                            allRenderedAppointments.push({
                              html: row.innerHTML,
                              status: app.status,
                              doctorName: doctorName || '',
                              patientName: patientName || '',
                              reason: app.reason || '',
                              date: app.date || '',
                              time: app.time || ''
                            });
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
                      const id = sanitize(e.target.dataset.id);
                      const role = sanitize(e.target.dataset.role);
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
                        const id = sanitize(e.target.dataset.id);
                        deleteAppointment(id);
                    });
                    });
                    tbodyConfirmed.querySelectorAll('.btn-cancel').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = sanitize(e.target.dataset.id);
                        cancelAppointment(id);
                    });
                    });
                    // Add click handler for Mark Completed buttons
                    tbodyConfirmed.querySelectorAll('.confirm-complete').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                      const id = e.target.dataset.id;
                      try {
                        const db = await openClinicDB();
                        const tx = db.transaction('appointments', 'readwrite');
                        const store = tx.objectStore('appointments');
                        const request = store.get(id);

                        request.onsuccess = async () => {
                          const appointment = request.result;
                          if (appointment && appointment.status === "Confirmed") {
                            appointment.status = "Completed";
                            appointment.completedAt = new Date().toISOString(); // optional

                            const updateReq = store.put(appointment);
                            updateReq.onsuccess = async () => {
                              console.log(`Appointment ${id} marked as Completed`);
                              // Refresh the entire table
                              await loadAppointments();
                            
                            };

                            
                            updateReq.onerror = () => {
                              alert('Error updating appointment.');
                            };
                            //  Rebind cancel and complete buttons after render
                            tbodyConfirmed.querySelectorAll('.btn-cancel').forEach(btn => {
                              btn.addEventListener('click', (e) => {
                                const id = sanitize(e.target.dataset.id);
                                cancelAppointment(id);
                              });
                            });

                          }
                        };
                        
                        request.onerror = () => {
                          alert('Error fetching appointment.');
                        };
                      } catch (err) {
                        console.error("Mark completed failed:", err);
                        alert('Error marking appointment as completed.');
                      }
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
      document.dispatchEvent(new Event('appointmentsRendered'));
}
async function populateDoctorDropdown() {
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  try {
    const db = await openClinicDB();
    const tx = db.transaction('doctors', 'readonly');
    const store = tx.objectStore('doctors');
    const request = store.getAll();
    request.onsuccess = async function () {
      const encryptedDoctors = request.result || [];
      // Decrypt all patients in parallel
      const decryptedDoctors = await Promise.all(
          encryptedDoctors.map(p => decryptDoctorInfo(p))
      );
      const doctors = decryptedDoctors || [];
      const dropdown = document.getElementById("doctorNameEdit");
      if (!dropdown) {
        console.log("Cannot find dropdown");
        return;
      }
      dropdown.innerHTML = sanitize('<option value="">Select a doctor</option>');
      doctors.forEach(doctor => {
        if (!doctor.id) return;
        const fullName = doctor.name?.trim() ||
          [doctor.first_name, doctor.last_name].filter(Boolean).join(' ').trim() ||
          'Unknown Doctor';
        const option = document.createElement('option');
        option.value = sanitize(doctor.id);
        option.textContent = sanitize(fullName);
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
let appointmentToDelete = null;

function deleteAppointment(id) {
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  appointmentToDelete = sanitize(id);
  document.getElementById('deleteModal').classList.remove('hidden');
}
document.addEventListener("DOMContentLoaded", () => {
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const deleteModal = document.getElementById("deleteModal");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));

      if (appointmentToDelete) {
        try {
          const db = await openClinicDB();
          const tx = db.transaction("appointments", "readwrite");
          const store = tx.objectStore("appointments");
          store.delete(appointmentToDelete);

          tx.oncomplete = async function () {
            const role = user.role.toLowerCase();
            const logId = role === "patient" ? appointmentToCancel : appointmentToDelete;
            const logMsg = role === "patient"
              ? `Patient with NHS ${user.linkedId} deleted an appointment`
              : `Doctor with ID ${user.linkedId} deleted an appointment`;

            await logCurrentUserActivity("deleteAppointment", logId, logMsg);
            loadAppointments();
            if (deleteModal) deleteModal.classList.add("hidden");
            appointmentToDelete = null;
          };

          tx.onerror = () => {
            alert("Error deleting appointment.");
            appointmentToDelete = null;
          };
        } catch (err) {
          console.error("Delete failed:", err);
          alert("Error deleting appointment.");
          appointmentToDelete = null;
        }
      }
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      if (deleteModal) deleteModal.classList.add("hidden");
      userToDelete = null;
    });
  }
});


async function cancelAppointment(id) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  appointmentToCancel = id;
  await logCurrentUserActivity("cancelAppointment", appointmentToCancel, `User with ID ${user.linkedId} cancelled an appointment`);
  document.getElementById('cancelModal').classList.remove('hidden');
}
document.addEventListener("DOMContentLoaded", () => {
  const confirmCancelBtn = document.getElementById("confirmCancel");
  const cancelCancelBtn = document.getElementById("cancelCancel");
  const cancelModal = document.getElementById("cancelModal");

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener("click", async () => {
      if (appointmentToCancel) {
        try {
          const db = await openClinicDB();
          const tx = db.transaction("appointments", "readwrite");
          const store = tx.objectStore("appointments");
          const request = store.getAll();

          request.onsuccess = function () {
            const appointments = request.result || [];
            const appointment = appointments.find(app => app.appointmentId === appointmentToCancel);

            if (appointment) {
              appointment.status = "Cancelled";
              const updateReq = store.put(appointment);

              updateReq.onsuccess = () => {
                console.log("✅ Appointment status updated.");
                loadAppointments();
                if (cancelModal) cancelModal.classList.add("hidden");
                appointmentToCancel = null;
              };

              updateReq.onerror = () => {
                console.error("❌ Failed to update appointment:", updateReq.error);
              };
            }
          };

          request.onerror = () => {
            alert("Error loading appointments.");
            appointmentToCancel = null;
          };
        } catch (err) {
          console.error("Cancel failed:", err);
          alert("Error cancelling appointment.");
          appointmentToCancel = null;
        }
      }
    });
  }

  if (cancelCancelBtn) {
    cancelCancelBtn.addEventListener("click", () => {
      if (cancelModal) cancelModal.classList.add("hidden");
      userToCancel = null;
    });
  }
});

async function addAppointment(event, doctorId, patientId, reason, date, time) {
  // Prevent form submission reload
  if (event) event.preventDefault();
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
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
      // 1. Get all appointments to check for duplicates and determine next ID
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
        // Generate unique appointment ID (e.g., "AP7241")
        function generateAppointmentId() {
          const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
          const timestamp = Date.now().toString().slice(-4); // last 4 digits of timestamp (adds uniqueness)
          return `AP${randomNum}${timestamp}`;
        }
        const appointmentId = generateAppointmentId();

        const fixedTime = normalizeTimeHHMM(time);
        const fixedDoctorId = parseInt(doctorId);

        // Create the new appointment object
        const newAppointment = {
          appointmentId: appointmentId,
          doctorId: fixedDoctorId,
          patientId,
          reason,
          date,
          time: fixedTime,
          status: 'Confirmed',
        };
        const addReq = store.add(newAppointment);
        const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();
        addReq.onsuccess = async function() {
          await createNotification("New appointment scheduled", "Your appointment is confirmed.");
          await createNotificationForUser("New appointment scheduled", "A patient has scheduled an appointment", doctorId, "doctor");
          await logCurrentUserActivity("bookAppointment", appointmentId, `Patient with NHS ${patientId} booked an appointment`);
          console.log(`Added appointment: ${reason} (id: ${newAppointment.appointmentId})`);
          window.location.href = `appointments-${userRole}.html`; // Redirect after adding
        };
        addReq.onerror = (e) => {
          console.error("Failed to add appointment:", e.target.error);
        };
      };
      getAllReq.onerror = (e) => {
        console.error("Error fetching appointments:", e.target.error);
      };
    } catch (err) {
        console.error("Database error:", err);
    }
  }
}

function handleAddAppointment(event) {
  if (event) event.preventDefault();
  const doctorId = document.getElementById('doctorName').value;
  const patientId = JSON.parse(localStorage.getItem('currentUser')).linkedId;
  const reason = document.getElementById('appointmentReason').value;
  const date = document.getElementById('appointmentDate').value;
  const time = document.getElementById('appointmentTime').value;
  addAppointment(event, doctorId, patientId, reason, date, time);
}

// Edit Appointment
async function loadAppointmentForEdit(id) {
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
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
        console.error("Appointment not found.");
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
        const doctorFullName = doctor.name?.trim() ||
            [doctor.first_name, doctor.last_name].filter(Boolean).join(' ').trim() ||
            'Unknown Doctor';
        // Step 3: Parse time string to HH:MM format
        function parseTimeString(strTime) {
          if (/^\d{2}:\d{2}$/.test(strTime)) return strTime;
          const timeObj = new Date(strTime);
          if (isNaN(timeObj.getTime())) throw new Error("Invalid time format");
          return timeObj.toTimeString().slice(0, 5); // "HH:MM"
        }
        // Step 4: Populate form fields
        document.getElementById('doctorNameEdit').value = sanitize(doctor.id);
        document.getElementById('appointmentDateEdit').value = sanitize(appointment.date || '');
        document.getElementById('appointmentTimeEdit').value = parseTimeString(appointment.time);
        document.getElementById('appointmentReasonEdit').value = sanitize(appointment.reason || '');
      };
      docReq.onerror = function (e) {
        console.error("Error loading doctor:", e.target.error);
      };
    };
    appointmentReq.onerror = function (e) {
      console.error("Error loading appointments:", e.target.error);
    };
  } catch (err) {
    console.error("Database error:", err);
  }
}
async function editAppointment(event, doctorId, patientId, reason, date, time) {
  // Prevent form submission reload
  if (event) event.preventDefault();
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get('id');
  if (!appointmentId) {
    console.error("No appointment ID found in URL.");
    return;
  }
  // Field validation (same structure as patient)
    const fields = [
        { value: doctorNameEdit, id: "doctorNameEdit", message: "Please select a doctor." },
        { value: appointmentDateEdit, id: "appointmentDateEdit", message: "Please enter a last name." },
        { value: appointmentTimeEdit, id: "appointmentTimeEdit", message: "Please select an appointment date." },
        { value: appointmentReasonEdit, id: "appointmentReasonEdit", message: "Please select an appointment reason." }
    ];
    for (const field of fields) {
      const input = document.getElementById(field.id);
      const error = document.getElementById(`${field.id}-form-error`);
      if (!input || !error) {
        console.warn(`Missing field or error element for ID: ${field.id}`);
        continue; // Skip this field
      }
      if (!field.value) {
        input.style.borderColor = "red";
        error.innerHTML = field.message;
        return;
      } else {
        input.style.borderColor = "";
        error.innerHTML = "";
      }
    }
  if (new Date(`${date}T${time}`) < new Date()) {
    const inputError = document.getElementById("appointmentTimeEdit");
    inputError.style.borderColor = "red";
    const error = document.getElementById("appointmentTimeEdit-form-error");
    error.innerHTML = `Appointment date and time must be in the future.`;
    return;
  } else {
    const inputError = document.getElementById("appointmentTimeEdit");
    inputError.style.borderColor = "";
    const error = document.getElementById("appointmentTimeEdit-form-error");
    error.innerHTML = ``;
    try {
      const db = await openClinicDB();
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore("appointments");
      // 1. Get all appointments to check for duplicates and determine next ID
      const getAllReq = store.getAll();
      getAllReq.onsuccess = function() {
        const appointments = getAllReq.result || [];
        const existSame = appointments.find(app =>
          app.appointmentId !== appointmentId &&
          app.doctorId === doctorId &&
          app.patientId === patientId &&
          app.date === date &&
          app.time === time
        );
        if (existSame) {
          const error = document.getElementById("appointmentTimeEdit-form-error");
          error.innerHTML = `Appointment with the same details already exists.`;
          return;
        }
        const existDifferent = appointments.find(app =>
          app.appointmentId !== appointmentId &&
          app.doctorId === doctorId &&
          app.date === date &&
          app.time === time
        );
        if (existDifferent) {
          const error = document.getElementById("appointmentTimeEdit-form-error");
          error.innerHTML = `Appointment at this specified time is not possible.`;
          return;
        }
        const appointment = appointments.find(d => d.appointmentId === appointmentId) || [];

        const fixedTime = normalizeTimeHHMM(time);
        const fixedDoctorId = parseInt(doctorId);

        // Create the new appointment object
        const updatedAppointment = {
          appointmentId: appointmentId,
          doctorId: fixedDoctorId,
          patientId,
          reason,
          date,
          time: fixedTime,
          status: 'Confirmed',
        };
        
        const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();
        const updateReq = store.put(updatedAppointment);
        updateReq.onsuccess = async function () {

          if (userRole === 'patient') {
            await createNotification("Appointment Rescheduled", "Your appointment is rescheduled.");
            await createNotificationForUser("Appoinment Rescheduled", "A patient has rescheduled an appointment", doctorId, "doctor");
            await logCurrentUserActivity("editAppointment", appointmentId, `Patient with NHS ${patientId} rescheduled an appointment`);
            console.log("Appointment updated successfully.");
            window.location.href = `appointments-${userRole}.html`;
          } else if (userRole === 'doctor') {
            await createNotification("Appoinment Rescheduled", "Your appointment is rescheduled.");
            await createNotificationForUser("Appointment Rescheduled", "A doctor has rescheduled an appointment", patientId, "patient");
            await logCurrentUserActivity("editAppointment", appointmentId, `Doctor with ID ${doctorId} rescheduled an appointment`);
            console.log("Appointment updated successfully.");
            window.location.href = `appointments-${userRole}.html`;
          }
        };
        updateReq.onerror = function (e) {
            console.error("Failed to update appointment:", e.target.error);
        };
      };
      getAllReq.onerror = (e) => {
        console.error("Error fetching appointments:", e.target.error);
      };
    } catch (err) {
        console.error("Database error:", err);
    }
  }
}
function handleEditAppointment(event) {
  const doctorId = document.getElementById('doctorNameEdit').value;
  const patientId = JSON.parse(localStorage.getItem('currentUser')).linkedId;
  const reason = document.getElementById('appointmentReasonEdit').value;
  const date = document.getElementById('appointmentDateEdit').value;
  const time = document.getElementById('appointmentTimeEdit').value;
  editAppointment(event, doctorId, patientId, reason, date, time);
}
