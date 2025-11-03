document.addEventListener('DOMContentLoaded', async () => {
  await clinicDB.openClinicDB();

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

// Global index for prescription fields
let prescriptionIndex = 0;

function addPrescription() {
  const container = document.getElementById('prescriptions-container');
  const div = document.createElement('div');
  div.className = 'prescription-entry';
  div.style.marginBottom = '1rem';
  div.innerHTML = `
    <fieldset style="border:1px solid #ccc; padding:10px; border-radius:6px;">
      <legend>Prescription ${prescriptionIndex + 1}</legend>
      <div style="margin-bottom:8px;">
        <label style="display:block; margin-bottom:4px;">Medicine Name:</label>
        <input type="text" name="medicineName_${prescriptionIndex}" placeholder="e.g. Paracetamol" required style="width:100%; padding:6px;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:block; margin-bottom:4px;">Dosage:</label>
        <input type="text" name="dosage_${prescriptionIndex}" placeholder="e.g. 500mg" required style="width:100%; padding:6px;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:block; margin-bottom:4px;">Duration:</label>
        <input type="text" name="duration_${prescriptionIndex}" placeholder="e.g. 5 days" required style="width:100%; padding:6px;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="display:block; margin-bottom:4px;">Instructions:</label>
        <textarea name="instructions_${prescriptionIndex}" rows="2" placeholder="Take with food..." style="width:100%; padding:6px; resize:vertical;"></textarea>
      </div>
      <button type="button" onclick="this.closest('.prescription-entry').remove()" 
              style="background:#e74c3c; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">
        Remove
      </button>
    </fieldset>
  `;
  container.appendChild(div);
  prescriptionIndex++;
}

async function handleAddMedicalRecord(event) {
  event.preventDefault();

  // === 1. Get form values ===
  const appointmentDate = document.getElementById('appointmentDate').value.trim();
  const diagnosis = document.getElementById('userDiagnosis').value.trim();
  const treatment = document.getElementById('userTreatment').value.trim();

  if (!appointmentDate || !diagnosis || !treatment) {
    alert('Please fill in Date, Diagnosis, and Treatment.');
    return;
  }

  // === 2. Collect prescriptions ===
  const prescriptions = [];
  document.querySelectorAll('.prescription-entry').forEach(entry => {
    const name = entry.querySelector(`[name^="medicineName_"]`).value.trim();
    const dosage = entry.querySelector(`[name^="dosage_"]`).value.trim();
    const duration = entry.querySelector(`[name^="duration_"]`).value.trim();
    const instructions = entry.querySelector(`[name^="instructions_"]`).value.trim();

    if (name && dosage && duration) {
      prescriptions.push({ name, dosage, duration, instructions });
    }
  });

  if (prescriptions.length === 0) {
    alert('Please add at least one prescription.');
    return;
  }

  // === 3. Get patientId and doctorId ===
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

  // === 4. Build record ===
  const record = {
    recordId: crypto.randomUUID(), // strong unique ID
    patientId,
    doctorId,
    date: appointmentDate,
    diagnosis,
    treatment,
    prescriptions
  };

  try {
    // === 5. Add via clinicDB (encrypts diagnosis+treatment) ===
    await clinicDB.addMedicalRecord(record);
    alert('Medical record added successfully!');
    window.location.href = `medical-records-doctor.html?patientId=${patientId}`;
  } catch (err) {
    console.error('Failed to add medical record:', err);
    alert('Error saving record. Check console.');
  }
}