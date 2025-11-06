/* ==============================
   editmedicalrecord.js
   – works with encrypted payload
   – uses clinicDB.getMedicalRecordById()
   – uses clinicDB.updateMedicalRecord()
   – populates medicine <select> from medicines store
   ============================== */

let currentRecord = null;

// DOM elements -------------------------------------------------
const form               = document.getElementById('editRecordForm');
const diagnosisInput     = document.getElementById('userDiagnosis');
const treatmentInput     = document.getElementById('userTreatment');
const prescriptionsContainer = document.getElementById('prescriptions-container');
const addPrescriptionBtn = document.querySelector('.btn-add-prescription');
const saveBtn            = document.getElementById('editRecordBtn');
const submitBtn          = form.querySelector('.submit-btn');
const recordIdInput      = document.getElementById('recordId');
const patientIdInput     = document.getElementById('patientId');

// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await initializeEditPage();
});

/* --------------------------------------------------------------
   1. Initialise page – load record, check ownership, fill form
   -------------------------------------------------------------- */
async function initializeEditPage() {
    try {
        // 1. DB ready?
        if (!window.clinicDB?.openClinicDB) throw new Error('clinicDB not loaded');
        await clinicDB.openClinicDB();

        // 2. URL params
        const urlParams = new URLSearchParams(window.location.search);
        const recordId  = urlParams.get('recordId');
        const patientId = urlParams.get('patientId');
        if (!recordId || !patientId) {
            console.error('Missing recordId or patientId');
            history.back(); return;
        }
        recordIdInput.value  = recordId;
        patientIdInput.value = patientId;

        // 3. Load + decrypt record
        currentRecord = await clinicDB.getMedicalRecordById(recordId);
        if (!currentRecord) {
            console.error('Record not found');
            history.back(); return;
        }

        // 4. Ownership check
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (user.role !== 'doctor' || user.linkedId !== currentRecord.doctorId) {
            alert('You can only edit your own records');
            history.back(); return;
        }

        // 5. Fill the form
        populateForm(currentRecord);

        // 6. Show Save button
        saveBtn.style.display = 'inline-block';
        saveBtn.onclick = () => form.requestSubmit();

        // 7. Submit handler
        form.addEventListener('submit', handleSubmit);
    } catch (e) {
        console.error('Init error: ' + e.message);
    }
}

/* --------------------------------------------------------------
   2. Populate diagnosis / treatment + prescription rows
   -------------------------------------------------------------- */
function populateForm(rec) {
    diagnosisInput.value = DOMPurify.sanitize(rec.diagnosis || '');
    treatmentInput.value = DOMPurify.sanitize(rec.treatment || '');

    prescriptionsContainer.innerHTML = '';
    const pres = rec.prescriptions || [];
    if (pres.length === 0) addPrescription();               // at least one row
    else pres.forEach(p => addPrescription(p));
}

/* --------------------------------------------------------------
   3. Add a prescription row (empty or pre-filled)
   -------------------------------------------------------------- */
function addPrescription(prescription = null) {
    const index = prescriptionsContainer.children.length;
    const row   = document.createElement('div');
    row.className = 'prescription-row';
    row.innerHTML = `
        <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr auto;gap:.5rem;align-items:end;">
            <div class="form-group">
                <select class="medicine-select" required>
                    <option value="">Select Medicine</option>
                </select>
            </div>
            <div class="form-group">
                <input type="text" class="dosage-input" placeholder="Dosage" value="${prescription?.dosage||''}" required>
            </div>
            <div class="form-group">
                <input type="text" class="duration-input" placeholder="Duration" value="${prescription?.duration||''}" required>
            </div>
            <div class="form-group">
                <input type="text" class="instructions-input" placeholder="Instructions" value="${prescription?.instructions||''}">
            </div>
            <button type="button" class="btn-remove-prescription" title="Remove">Remove</button>
        </div>`;
    prescriptionsContainer.appendChild(row);

    const select = row.querySelector('.medicine-select');
    populateMedicineSelect(select, prescription?.medicineId);

    row.querySelector('.btn-remove-prescription').onclick = () => {
        if (prescriptionsContainer.children.length > 1) row.remove();
        else {
            const error = document.getElementById('prescriptions-form-error');
            error.innerText = 'At least one prescription required.';
        }    
    };
}
addPrescriptionBtn.onclick = () => addPrescription();

/* --------------------------------------------------------------
   4. Fill medicine <select>
   -------------------------------------------------------------- */
async function populateMedicineSelect(selectEl, selectedId = null) {
    try {
        const meds = await clinicDB.getAllItems('medicines');
        meds.forEach(m => {
            const opt = new Option(`${m.Drug}`, m.id);
            if (m.id == selectedId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    } catch (e) {
        console.warn(e);
        selectEl.innerHTML = '<option>Error loading</option>';
    }
}

/* --------------------------------------------------------------
   5. Collect form data (ready for DB)
   -------------------------------------------------------------- */
function collectFormData() {
    const rows = prescriptionsContainer.querySelectorAll('.prescription-row');
    const prescriptions = Array.from(rows).map(r => ({
        medicineId:   parseInt(r.querySelector('.medicine-select').value),
        dosage:       r.querySelector('.dosage-input').value.trim(),
        duration:     r.querySelector('.duration-input').value.trim(),
        instructions: r.querySelector('.instructions-input').value.trim()
    }));

    return {
        recordId:  recordIdInput.value,
        patientId: patientIdInput.value,
        doctorId:  currentRecord.doctorId,
        dateTime:  currentRecord.dateTime,
        diagnosis: diagnosisInput.value.trim(),
        treatment: treatmentInput.value.trim(),
        prescriptions
    };
}

/* --------------------------------------------------------------
   6. Submit → encrypt → update DB
   -------------------------------------------------------------- */
async function handleSubmit(e) {
    e.preventDefault();

    // ---- basic validation ----
    if (!diagnosisInput.value.trim()) return showError(diagnosisInput, 'Diagnosis required');
    if (!treatmentInput.value.trim()) return showError(treatmentInput, 'Treatment required');

    const rows = prescriptionsContainer.querySelectorAll('.prescription-row');
    for (const r of rows) {
        const sel = r.querySelector('.medicine-select');
        if (!sel.value) return showError(sel, 'Select a medicine');
        if (!r.querySelector('.dosage-input').value.trim())   return showError(r.querySelector('.dosage-input'),   'Dosage required');
        if (!r.querySelector('.duration-input').value.trim()) return showError(r.querySelector('.duration-input'), 'Duration required');
    }

    // ---- UI lock ----
    submitBtn.disabled = saveBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
        const updated = collectFormData();
        await clinicDB.updateMedicalRecord(updated);          // encrypts inside
        await logCurrentUserActivity("editMedicalRecord", updated.recordId, `Doctor with ID ${updated.doctorId} edited a medical record`)
        await createNotificationForUser("Medical Record Updated", `A doctor with ID ${updated.doctorId} updated medical record: ${updated.recordId}`, updated.patientId, 'patient')
        console.log('Record updated');
        location.href = `view-medical-record-doctor.html?patientId=${updated.patientId}&recordId=${updated.recordId}`;
    } catch (err) {
        console.error('Save failed: ' + err.message);
    } finally {
        submitBtn.disabled = saveBtn.disabled = false;
        submitBtn.textContent = 'Update Record';
    }
}

/* --------------------------------------------------------------
   7. Tiny inline error helper
   -------------------------------------------------------------- */
function showError(el, msg) {
    let err = el.parentElement.querySelector('.error-message');
    if (!err) {
        err = document.createElement('p');
        err.className = 'error-message';
        el.parentElement.appendChild(err);
    }
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 5000);
}

/* --------------------------------------------------------------
   8. Auto-re-populate selects if they are empty (slow load)
   -------------------------------------------------------------- */
setTimeout(async () => {
    document.querySelectorAll('.medicine-select').forEach(async s => {
        if (s.children.length <= 1) await populateMedicineSelect(s);
    });
}, 1200);