document.addEventListener('DOMContentLoaded', async () => {
  const db = await clinicDB.openClinicDB();

  // Fix form submit handler
  const form = document.querySelector('form');
  if (form) {
    form.onsubmit = handleAddMedicalRecord;
  }

  // Fix "Cancel" link
  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.addEventListener('click', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const patientId = urlParams.get('patientId');
      window.location.href = `medical-records-doctor.html?patientId=${patientId}`;
    });
  }

  // Initialize one prescription row
  addPrescription();
});
let prescriptionCount = 0;

function addPrescription() {
  prescriptionCount++;
  const container = document.getElementById('prescriptions-container');
  const entry = document.createElement('div');
  entry.className = 'prescription-entry';
  entry.innerHTML = `
    <div class="form-group">
      <label>Prescription ${prescriptionCount}</label>
      <input type="text" name="medicineName_${prescriptionCount}" placeholder="Medicine Name" required>
      <input type="text" name="dosage_${prescriptionCount}" placeholder="Dosage (e.g., 500mg)" required>
      <input type="text" name="duration_${prescriptionCount}" placeholder="Duration (e.g., 3 months)" required>
      <input type="text" name="instructions_${prescriptionCount}" placeholder="Instructions">
      <button type="button" class="remove-btn" onclick="this.parentElement.parentElement.remove()">Remove</button>
    </div>
  `;
  container.appendChild(entry);
}

async function handleAddMedicalRecord(event) {
  event.preventDefault();

  // Auto-capture current date and time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const currentDate = `${year}-${month}-${day}`;
  const currentTime = `${hours}:${minutes}`;
  const dateTime = `${currentDate} - ${currentTime}`;

  // Optional: set hidden input
  document.getElementById('appointmentDate').value = currentDate;

  const diagnosis = document.getElementById('userDiagnosis').value.trim();
  const treatment = document.getElementById('userTreatment').value.trim();

  if (!diagnosis || !treatment) {
    alert('Please fill in Diagnosis and Treatment.');
    return;
  }

  const prescriptionInputs = [];
  document.querySelectorAll('.prescription-entry').forEach(entry => {
    const name = entry.querySelector(`[name^="medicineName_"]`).value.trim();
    const dosage = entry.querySelector(`[name^="dosage_"]`).value.trim();
    const duration = entry.querySelector(`[name^="duration_"]`).value.trim();
    const instructions = entry.querySelector(`[name^="instructions_"]`).value.trim();

    if (name && dosage && duration) {
      prescriptionInputs.push({ name, dosage, duration, instructions });
    }
  });

  if (prescriptionInputs.length === 0) {
    alert('Please add at least one prescription.');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const patientId = urlParams.get('patientId');
  if (!patientId) {
    alert('Missing patient ID.');
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser || currentUser.role !== 'doctor') {
    alert('Unauthorized. Please log in as a doctor.');
    window.location.href = 'login.html';
    return;
  }
  const doctorId = currentUser.linkedId;

  let db;
  try {
    db = await clinicDB.openClinicDB();
  } catch (err) {
    alert('Failed to open database.');
    console.error(err);
    return;
  }

  const medicineTx = db.transaction('medicines', 'readonly');
  const medicineStore = medicineTx.objectStore('medicines');
  const allMeds = await new Promise((resolve, reject) => {
    const req = medicineStore.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const prescriptions = [];
  for (const p of prescriptionInputs) {
    // Fixed: Use "Drug" field
    const med = allMeds.find(m =>
      m.Drug?.toLowerCase() === p.name.toLowerCase()
    );

    if (!med) {
      alert(`Medicine not found: "${p.name}". Please add it in Medicines first.`);
      return;
    }

    prescriptions.push({
      medicineId: med.id,
      dosage: p.dosage,
      duration: p.duration,
      instructions: p.instructions
    });
  }

  const record = {
    recordId: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    doctorId,
    dateTime: dateTime,
    diagnosis,
    treatment,
    prescriptions
  };

  try {
    await clinicDB.addMedicalRecord(record);
    alert('Medical record added successfully!');
    window.location.href = `medical-records-doctor.html?patientId=${patientId}`;
  } catch (err) {
    console.error('Failed to save record:', err);
    alert('Error saving record. Check console.');
  }
}

// DOM Ready – attach form, back button, and init first prescription
document.addEventListener('DOMContentLoaded', async () => {
  const db = await clinicDB.openClinicDB();

  // Attach form submit
  const form = document.querySelector('form');
  if (form) {
    form.onsubmit = handleAddMedicalRecord;
  }

  // "Cancel" link goes back to patient records
  const backLink = document.getElementById('back');
  if (backLink) {
    backLink.addEventListener('click', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const patientId = urlParams.get('patientId');
      window.location.href = `medical-records-doctor.html?patientId=${patientId}`;
    });
  }

  // Start with one prescription row
  addPrescription();
});