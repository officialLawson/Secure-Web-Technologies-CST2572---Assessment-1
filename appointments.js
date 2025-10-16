let currentPatient = null;
let allDoctors = [];

async function initAppointments() {
  await clinicDB.openClinicDB();
  const user = JSON.parse(sessionStorage.getItem('loggedUser'));
  if (!user || user.role !== 'patient') {
    alert("Unauthorized. Please log in as a patient.");
    window.location.href = 'login.html';
    return;
  }
  currentPatient = user.linkedId; // NHS

  // Load doctors for dropdown
  allDoctors = await clinicDB.getAllItems('doctors');
  const select = document.getElementById('doctorSelect');
  select.innerHTML = '<option value="">-- Select Doctor --</option>';
  allDoctors.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.first_name || d.First} ${d.last_name || d.Last} (${d.specialty || 'General'})`;
    select.appendChild(opt);
  });

  loadAppointments();
}

async function loadAppointments() {
  const appts = await clinicDB.getAllByIndex('appointments', 'patientNHS', currentPatient);
  const tbody = document.querySelector('#appointmentsTable tbody');
  tbody.innerHTML = '';

  appts.forEach(a => {
    const doc = allDoctors.find(d => d.id === a.doctorId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.appointmentId}</td>
      <td>${doc ? doc.first_name + ' ' + doc.last_name : a.doctorId}</td>
      <td>${a.date}</td>
      <td>${a.time}</td>
      <td>
        <button onclick="editAppointment(${a.appointmentId})">Edit</button>
        <button onclick="deleteAppointment(${a.appointmentId})">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function showAppointmentForm() {
  document.getElementById('appointmentForm').style.display = 'block';
}

function hideAppointmentForm() {
  document.getElementById('appointmentForm').style.display = 'none';
}

document.getElementById('newAppointmentForm').onsubmit = async (e) => {
  e.preventDefault();
  const doctorId = parseInt(document.getElementById('doctorSelect').value);
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;

  const appointment = {
    doctorId,
    patientNHS: currentPatient,
    date,
    time,
    startIso: new Date(`${date}T${time}`).toISOString(),
  };

  await clinicDB.addItem('appointments', appointment);
  alert("Appointment booked!");
  hideAppointmentForm();
  loadAppointments();
};

async function deleteAppointment(id) {
  if (confirm("Cancel this appointment?")) {
    await clinicDB.deleteItem('appointments', id);
    loadAppointments();
  }
}

function editAppointment(id) {
  alert("Editing not yet implemented. You can add it later with updateItem().");
}

window.onload = initAppointments;
