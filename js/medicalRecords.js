// medicalrecord.js - FULL COMPLETE VERSION
// Handles:
// - Patient's own record list
// - Doctor's view of a patient's record list (with Request Access)
// - Doctor's single record view (with Edit button for owner)
// - All decryption, medicine resolution, sanitization

let recordToView = null;

// ======================
// 1. PATIENT: List own records
// ======================
async function fetchPatientRecords() {
    const tbody = document.getElementById("medicalRecordsBody");
    if (!tbody) return;

    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    tbody.innerHTML = sanitize('<tr><td colspan="5">Loading medical records...</td></tr>');

    try {
        await clinicDB.openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));

        const [encryptedDoctors, encryptedRecords] = await Promise.all([
            clinicDB.getAllItems('doctors'),
            clinicDB.getAllItems('medicalRecord')
        ]);

        const decryptedDoctors = await Promise.all(encryptedDoctors.map(d => clinicDB.decryptDoctorInfo(d)));
        const decryptedRecords = await Promise.all(encryptedRecords.map(r => clinicDB.decryptMedicalRecord(r)));

        const myRecords = decryptedRecords.filter(r => r.patientId === user.linkedId);

        tbody.innerHTML = '';
        if (myRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No medical records found.</td></tr>';
            return;
        }

        myRecords.forEach(rec => {
            const doctor = decryptedDoctors.find(d => d.id == rec.doctorId);
            const doctorName = doctor ? `Dr ${doctor.first_name} ${doctor.last_name}` : 'Unknown';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sanitize(doctorName)}</td>
                <td>${sanitize(rec.diagnosis || '-')}</td>
                <td>${sanitize(rec.treatment || '-')}</td>
                <td>${sanitize(rec.dateTime || '-')}</td>
                <td><button class="btn-view" data-id="${sanitize(rec.recordId)}">View</button></td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error('fetchPatientRecords error:', err);
        tbody.innerHTML = '<tr><td colspan="5">Error loading records.</td></tr>';
    }
}

// ======================
// 2. DOCTOR: List patient's records (with Request Access)
// ======================
async function fetchPatientRecordsforDoctor(patientId) {
    const tbody = document.getElementById("medicalRecordsBody");
    const patientNameDisplay = document.getElementById("patientNameDisplay");
    if (!tbody) return;

    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        await clinicDB.openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));

        const [doctors, patients, records] = await Promise.all([
            clinicDB.getAllItems('doctors'),
            clinicDB.getAllItems('patients'),
            clinicDB.getAllItems('medicalRecord')
        ]);

        const decryptedDoctors = await Promise.all(doctors.map(d => clinicDB.decryptDoctorInfo(d)));
        const decryptedPatients = await Promise.all(patients.map(p => clinicDB.decryptPatientInfo(p)));
        const decryptedRecords = await Promise.all(records.map(r => clinicDB.decryptMedicalRecord(r)));

        // Patient name header
        const patient = decryptedPatients.find(p => p.NHS === patientId);
        const patientName = patient ? `${patient.Title} ${patient.First} ${patient.Last}` : 'Unknown Patient';
        if (patientNameDisplay) patientNameDisplay.textContent = sanitize(patientName);

        // Current doctor's name (for request button)
        const selfDoctor = decryptedDoctors.find(d => d.id === user.linkedId);
        const selfName = selfDoctor ? `Dr ${selfDoctor.first_name} ${selfDoctor.last_name}` : 'Unknown';

        const patientRecords = decryptedRecords.filter(r => r.patientId === patientId);

        tbody.innerHTML = '';
        if (patientRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No medical records found.</td></tr>';
            return;
        }

        patientRecords.forEach(rec => {
            const doctor = decryptedDoctors.find(d => d.id == rec.doctorId);
            const doctorName = doctor ? `Dr ${doctor.first_name} ${doctor.last_name}` : 'Unknown';
            const isOwner = user.linkedId == rec.doctorId;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sanitize(doctorName)}</td>
                <td>${sanitize(rec.diagnosis || '-')}</td>
                <td>${sanitize(rec.treatment || '-')}</td>
                <td>${sanitize(rec.dateTime || '-')}</td>
                <td>
                    ${isOwner
                        ? `<button class="btn-view-doctor" data-id="${rec.recordId}">View</button>`
                        : `<button class="btn-view-request" data-id="${rec.recordId}" data-ownerid="${rec.doctorId}" data-myname="${sanitize(selfName)}">Request Access</button>`
                    }
                </td>
            `;
            tbody.appendChild(row);
        });

    } catch (err) {
        console.error('fetchPatientRecordsforDoctor error:', err);
        tbody.innerHTML = '<tr><td colspan="5">Error loading records.</td></tr>';
    }
}

// ======================
// 3. DOCTOR: Load single record view (with Edit button)
// ======================
async function loadSingleRecordView() {
    const tbody = document.getElementById('prescriptionsBody');
    const recordDoctorName = document.getElementById('recordDoctorName');
    const recordDate = document.getElementById('recordDate');
    const recordDiagnosis = document.getElementById('recordDiagnosis');
    const recordTreatment = document.getElementById('recordTreatment');
    const editBtn = document.getElementById('editRecordBtn');

    if (!tbody || !recordDoctorName) return;

    const sanitize = (s) => DOMPurify.sanitize(String(s), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    try {
        await clinicDB.openClinicDB();

        const params = new URLSearchParams(location.search);
        const recordId = params.get('recordId');
        const patientId = params.get('patientId');

        if (!recordId || !patientId) {
            alert('Missing record or patient');
            return;
        }

        const rec = await clinicDB.getMedicalRecordById(recordId);
        if (!rec) {
            alert('Record not found');
            return;
        }

        // Doctor name
        const doctor = await clinicDB.getItem('doctors', rec.doctorId);
        recordDoctorName.textContent = doctor
            ? sanitize(`${doctor.first_name} ${doctor.last_name}`)
            : 'Unknown';

        // Basic fields
        recordDate.textContent = sanitize(rec.dateTime || '-');
        recordDiagnosis.textContent = sanitize(rec.diagnosis || '-');
        recordTreatment.textContent = sanitize(rec.treatment || '-');

        // Prescriptions
        tbody.innerHTML = '';
        const prescriptions = rec.prescriptions || [];
        if (prescriptions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No prescriptions</td></tr>';
        } else {
            for (const p of prescriptions) {
                const med = await clinicDB.getItem('medicines', p.medicineId);
                const drugName = med?.Drug ? sanitize(med.Drug) : '—';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${drugName}</td>
                    <td>${sanitize(p.dosage || '-')}</td>
                    <td>${sanitize(p.duration || '-')}</td>
                    <td>${sanitize(p.instructions || '-')}</td>
                `;
                tbody.appendChild(tr);
            }
        }

        // Edit button
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (editBtn && user.role === 'doctor' && user.linkedId == rec.doctorId) {
            editBtn.style.display = 'inline-block';
            editBtn.onclick = () => {
                location.href = `edit-medical-record.html?recordId=${recordId}&patientId=${patientId}`;
            };
        } else if (editBtn) {
            editBtn.style.display = 'none';
        }

    } catch (err) {
        console.error('loadSingleRecordView error:', err);
        alert('Failed to load record');
    }
}

// ======================
// 4. SMART DOMContentLoaded
// ======================
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const recordId = params.get('recordId');
    const patientId = params.get('patientId');

    if (recordId && patientId) {
        // Doctor viewing a specific record
        await loadSingleRecordView();
    } else if (patientId) {
        // Doctor viewing patient's list
        await fetchPatientRecordsforDoctor(patientId);
    } else {
        // Patient viewing own list
        await fetchPatientRecords();
    }
});

// ======================
// 5. Click handlers
// ======================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-view')) {
        const id = DOMPurify.sanitize(e.target.dataset.id);
        if (id) {
            window.location.href = `view-medical-record.html?recordId=${id}`;
        }
    }

    if (e.target.classList.contains('btn-view-doctor')) {
        const id = DOMPurify.sanitize(e.target.dataset.id);
        const patientId = new URLSearchParams(window.location.search).get('patientId');
        if (id && patientId) {
            window.location.href = `view-medical-record-doctor.html?recordId=${id}&patientId=${patientId}`;
        }
    }
});

// ======================
// 6. Request Access Button
// ======================
document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-view-request")) {
        const button = e.target;
        const recordId = DOMPurify.sanitize(button.dataset.id);
        const recordDoctorId = DOMPurify.sanitize(button.dataset.ownerid);
        const requestingDoctorFullName = DOMPurify.sanitize(button.dataset.myname);
        const requestingDoctorId = JSON.parse(localStorage.getItem('currentUser')).linkedId;

        if (!recordId || !requestingDoctorFullName) return;

        try {
            const message = `${requestingDoctorFullName} has requested access to record ${recordId} [requester:${requestingDoctorId}]`;
            await createNotificationForUser(
                "Access Request Received",
                message,
                parseInt(recordDoctorId),
                "doctor"
            );

            await logCurrentUserActivity(
                "requestAccess",
                parseInt(recordId),
                `Doctor ${requestingDoctorId} requested access to record ${recordId} from doctor ${recordDoctorId}`
            );

            button.textContent = "Request Sent";
            button.disabled = true;
            button.classList.add("request-sent");

        } catch (err) {
            console.error("Failed to send access request:", err);
            alert("Failed to send request.");
        }
    }
});

// ======================
// 7. Expose for debugging (optional)
// ======================
window.clinicDB = window.clinicDB || {};
window.clinicDB.decryptDoctorInfo = decryptDoctorInfo;
window.clinicDB.decryptPatientInfo = decryptPatientInfo;
window.clinicDB.decryptMedicalRecord = decryptMedicalRecord;
window.clinicDB.medicalRecords = {
    fetchPatientRecords,
    fetchPatientRecordsforDoctor,
    loadSingleRecordView
};
