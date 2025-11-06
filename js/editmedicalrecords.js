let currentRecord = null;
let originalPrescriptions = [];

// DOM Elements
const form = document.getElementById('editRecordForm');
const diagnosisInput = document.getElementById('userDiagnosis');
const treatmentInput = document.getElementById('userTreatment');
const prescriptionsContainer = document.getElementById('prescriptions-container');
const addPrescriptionBtn = document.querySelector('.btn-add-prescription');
const saveBtn = document.getElementById('editRecordBtn');
const submitBtn = form.querySelector('.submit-btn');
const recordIdInput = document.getElementById('recordId');
const patientIdInput = document.getElementById('patientId');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initializeEditPage();
});

/**
 * Main initialization
 */
async function initializeEditPage() {
    try {
        // 1. Check DB
        if (!window.clinicDB?.openClinicDB) {
            throw new Error('clinicDB not loaded');
        }

        await clinicDB.openClinicDB();

        // 2. Get URL params
        const urlParams = new URLSearchParams(window.location.search);
        const recordId = urlParams.get('recordId');
        const patientId = urlParams.get('patientId');

        if (!recordId || !patientId) {
            alert('Missing record ID or patient ID. Please go back and try again.');
            window.history.back();
            return;
        }

        recordIdInput.value = recordId;
        patientIdInput.value = patientId;

        // 3. Load record
        currentRecord = await clinicDB.getMedicalRecordById(recordId);
        if (!currentRecord) {
            alert('Medical record not found.');
            window.history.back();
            return;
        }

        // 4. Check ownership (only doctor who created it)
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (currentUser.role !== 'doctor' || currentUser.linkedId !== currentRecord.doctorId) {
            alert('You can only edit your own records.');
            window.history.back();
            return;
        }

        // 5. Populate form
        populateForm(currentRecord);

        // 6. Show Save button
        saveBtn.style.display = 'inline-block';
        saveBtn.onclick = () => form.requestSubmit();

        // 7. Setup form submit
        form.addEventListener('submit', handleSubmit);

    } catch (err) {
        console.error('Init error:', err);
        alert('Failed to load record: ' + err.message);
    }
}

/**
 * Fill form with record data
 */
function populateForm(record) {
    diagnosisInput.value = DOMPurify.sanitize(record.diagnosis || '');
    treatmentInput.value = DOMPurify.sanitize(record.treatment || '');

    // Clear and repopulate prescriptions
    prescriptionsContainer.innerHTML = '';
    originalPrescriptions = (record.prescriptions || []).map(p => ({ ...p }));

    if (originalPrescriptions.length === 0) {
        addPrescription(); // add one empty row
    } else {
        originalPrescriptions.forEach(prescription => addPrescription(prescription));
    }
}

/**
 * Add a prescription row (empty or pre-filled)
 */
function addPrescription(prescription = null) {
    const index = prescriptionsContainer.children.length;

    const row = document.createElement('div');
    row.className = 'prescription-row';
    row.innerHTML = `
        <div class="form-grid" style="grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 0.5rem; align-items: end;">
            <div class="form-group">
                <select class="medicine-select" required>
                    <option value="">Select Medicine</option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Dosage" class="dosage-input" value="${prescription?.dosage || ''}" required>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Duration" class="duration-input" value="${prescription?.duration || ''}" required>
            </div>
            <div class="form-group">
                <input type="text" placeholder="Instructions" class="instructions-input" value="${prescription?.instructions || ''}" required>
            </div>
            <button type="button" class="btn-remove-prescription" title="Remove">Remove</button>
        </div>
    `;

    prescriptionsContainer.appendChild(row);

    // Populate medicine dropdown
    const select = row.querySelector('.medicine-select');
    populateMedicineSelect(select, prescription?.medicineId);

    // Remove button
    row.querySelector('.btn-remove-prescription').onclick = () => {
        if (prescriptionsContainer.children.length > 1) {
            row.remove();
        } else {
            alert('At least one prescription is required.');
        }
    };
}

// Add prescription button
addPrescriptionBtn.onclick = () => addPrescription();

/**
 * Populate medicine dropdown
 */
async function populateMedicineSelect(selectElement, selectedId = null) {
    try {
        const medicines = await clinicDB.getAllItems('medicines');
        medicines.forEach(med => {
            const opt = document.createElement('option');
            opt.value = med.id;
            opt.textContent = `${med.Drug} (${med.Dosage})`;
            if (med.id == selectedId) opt.selected = true;
            selectElement.appendChild(opt);
        });
    } catch (err) {
        console.warn('Failed to load medicines:', err);
        selectElement.innerHTML = '<option value="">Error loading</option>';
    }
}

/**
 * Collect form data
 */
function collectFormData() {
    const prescriptions = Array.from(prescriptionsContainer.querySelectorAll('.prescription-row')).map(row => {
        const select = row.querySelector('.medicine-select');
        const medicineId = select.value;
        const dosage = row.querySelector('.dosage-input').value.trim();
        const duration = row.querySelector('.duration-input').value.trim();
        const instructions = row.querySelector('.instructions-input').value.trim();

        return { medicineId: parseInt(medicineId), dosage, duration, instructions };
    });

    return {
        recordId: recordIdInput.value,
        patientId: patientIdInput.value,
        doctorId: currentRecord.doctorId,
        dateTime: currentRecord.dateTime,
        diagnosis: diagnosisInput.value.trim(),
        treatment: treatmentInput.value.trim(),
        prescriptions
    };
}

/**
 * Form submit handler
 */
async function handleSubmit(e) {
    e.preventDefault();

    // Basic validation
    if (!diagnosisInput.value.trim()) {
        showError('userDiagnosis', 'Diagnosis is required.');
        return;
    }
    if (!treatmentInput.value.trim()) {
        showError('userTreatment', 'Treatment is required.');
        return;
    }

    const prescriptions = Array.from(prescriptionsContainer.querySelectorAll('.prescription-row'));
    for (const row of prescriptions) {
        const select = row.querySelector('.medicine-select');
        const dosage = row.querySelector('.dosage-input').value.trim();
        const duration = row.querySelector('.duration-input').value.trim();
        const instructions = row.querySelector('.instructions-input').value.trim();

        if (!select.value) {
            showError(select, 'Select a medicine.');
            return;
        }
        if (!dosage || !duration || !instructions) {
            alert('All prescription fields are required.');
            return;
        }
    }

    // Disable buttons
    submitBtn.disabled = true;
    saveBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const updatedRecord = collectFormData();

        // Save to IndexedDB
        await clinicDB.updateMedicalRecord(updatedRecord);


        // Success
        alert('Medical record updated successfully!');
        window.location.href = `view-medical-record-doctor.html?recordId=${updatedRecord.recordId}&patientId=${updatedRecord.patientId}`;

    } catch (err) {
        console.error('Save error:', err);
        alert('Failed to save: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        saveBtn.disabled = false;
        submitBtn.textContent = 'Update Record';
    }
}

/**
 * Show inline error
 */
function showError(element, message) {
    let errorEl;
    if (typeof element === 'string') {
        errorEl = document.getElementById(element + '-form-error');
    } else {
        errorEl = element.parentElement.querySelector('.error-message') || document.createElement('p');
        errorEl.className = 'error-message';
        element.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => errorEl.style.display = 'none', 5000);
}

// Auto-populate medicines on load (in case of slow load)
setTimeout(async () => {
    const selects = document.querySelectorAll('.medicine-select');
    for (const select of selects) {
        if (select.children.length <= 1) {
            await populateMedicineSelect(select, select.value);
        }
    }
}, 1000);