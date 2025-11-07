let allRenderedMedicalRecords = [];
let allRenderedDoctorViewRecords = [];

function renderMedicalRecords(data) {
  const tbody = document.getElementById("medicalRecordsBody");
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const userId = sanitize(JSON.parse(localStorage.getItem('currentUser')).linkedId);

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = "<tr><td colspan='5'>No matching records found.</td></tr>";
    return;
  }

  data.forEach(rec => {
    const safeDoctor = sanitize(rec.doctorName);
    const safeDiagnosis = sanitize(rec.diagnosis);
    const safeTreatment = sanitize(rec.treatment);
    const safeDateTime = sanitize(rec.dateTime);
    const safeId = sanitize(rec.recordId);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${safeDoctor}</td>
      <td>${safeDiagnosis}</td>
      <td>${safeTreatment}</td>
      <td>${safeDateTime}</td>
      <td><button class="btn-view" data-id="${safeId}" data-patientid="${userId}">View</button></td>
    `;
    tbody.appendChild(row);
  });
}

function renderDoctorViewRecords(data) {
  const tbody = document.getElementById("medicalRecordsBody");
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = "<tr><td colspan='5'>No matching records found.</td></tr>";
    return;
  }

  const user = JSON.parse(localStorage.getItem('currentUser'));

  data.forEach(rec => {
    const safeDoctor = sanitize(rec.doctorName);
    const safeDiagnosis = sanitize(rec.diagnosis);
    const safeTreatment = sanitize(rec.treatment);
    const safeDateTime = sanitize(rec.dateTime);
    const safeId = sanitize(rec.recordId);
    const safeSelfName = sanitize(rec.selfName);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${safeDoctor}</td>
      <td>${safeDiagnosis}</td>
      <td>${safeTreatment}</td>
      <td>${safeDateTime}</td>
      <td>
        ${rec.isOwner
          ? `<button class="btn-view-doctor" data-id="${safeId}">View</button>`
          : `<button class="btn-view-request" data-id="${safeId}" data-ownerid="${rec.doctorId}" data-myname="${safeSelfName}">Request Access</button>`
        }
      </td>
    `;
    tbody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchRecordsInput = document.getElementById("searchMedicalRecords");
  if (searchRecordsInput) {
    searchRecordsInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();

      if (query === "") {
        renderMedicalRecords(allRenderedMedicalRecords);
        return;
      }

      const filtered = allRenderedMedicalRecords.filter(rec =>
        (rec.doctorName || "").toLowerCase().includes(query) ||
        (rec.diagnosis || "").toLowerCase().includes(query) ||
        (rec.treatment || "").toLowerCase().includes(query) ||
        String(rec.dateTime).toLowerCase().includes(query)
      );

      renderMedicalRecords(filtered);
    });
  }

  const searchDoctorViewInput = document.getElementById("searchDoctorViewRecords");
  if (searchDoctorViewInput) {
    searchDoctorViewInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();

      if (query === "") {
        renderDoctorViewRecords(allRenderedDoctorViewRecords);
        return;
      }

      const filtered = allRenderedDoctorViewRecords.filter(rec =>
        (rec.doctorName || "").toLowerCase().includes(query) ||
        (rec.diagnosis || "").toLowerCase().includes(query) ||
        (rec.treatment || "").toLowerCase().includes(query) ||
        String(rec.dateTime).toLowerCase().includes(query)
      );

      renderDoctorViewRecords(filtered);
    });
    }
});

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

        allRenderedMedicalRecords = [];

        myRecords.forEach(rec => {
        const doctor = decryptedDoctors.find(d => d.id == rec.doctorId);
        const doctorName = doctor ? `Dr ${doctor.first_name} ${doctor.last_name}` : 'Unknown';

        allRenderedMedicalRecords.push({
            doctorName,
            diagnosis: rec.diagnosis || '-',
            treatment: rec.treatment || '-',
            dateTime: rec.dateTime || '-',
            recordId: rec.recordId
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sanitize(doctorName)}</td>
            <td>${sanitize(rec.diagnosis || '-')}</td>
            <td>${sanitize(rec.treatment || '-')}</td>
            <td>${sanitize(rec.dateTime || '-')}</td>
            <td><button class="btn-view" data-id="${sanitize(rec.recordId)}" data-patientid="${user.linkedId}">View</button></td>
        `;
        tbody.appendChild(row);
        });

    } catch (err) {
        console.error('fetchPatientRecords error:', err);
        tbody.innerHTML = '<tr><td colspan="5">Error loading records.</td></tr>';
    }
}

// ======================
// 2. DOCTOR: List patient's records
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

        // Current doctor's name
        const selfDoctor = decryptedDoctors.find(d => d.id === user.linkedId);
        const selfName = selfDoctor ? `Dr ${selfDoctor.first_name} ${selfDoctor.last_name}` : 'Unknown';

        const patientRecords = decryptedRecords.filter(r => r.patientId === patientId);

        tbody.innerHTML = '';
        if (patientRecords.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No medical records found.</td></tr>';
            return;
        }

        allRenderedDoctorViewRecords = [];

        patientRecords.forEach(rec => {
            const doctor = decryptedDoctors.find(d => d.id == rec.doctorId);
            const doctorName = doctor ? `Dr ${doctor.first_name} ${doctor.last_name}` : 'Unknown';
            const isOwner = user.linkedId == rec.doctorId;

            allRenderedDoctorViewRecords.push({
                doctorName,
                diagnosis: rec.diagnosis || '-',
                treatment: rec.treatment || '-',
                dateTime: rec.dateTime || '-',
                recordId: rec.recordId,
                isOwner,
                doctorId: rec.doctorId,
                selfName
            });

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
// 3. DOCTOR: Load single record view
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
            console.warn('Missing record or patient');
            return;
        }

        const rec = await clinicDB.getMedicalRecordById(recordId);
        if (!rec) {
            console.warn('Record not found');
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
            const allMeds = await clinicDB.getAllItems('medicines');
            const medicineMap = {};
            allMeds.forEach(m => {
                if (m.id !== undefined) {
                    medicineMap[String(m.id)] = m;
                }
            });

            for (const p of prescriptions) {
                const med = medicineMap[String(p.medicineId)];
                const drugName = med?.Drug
                    ? DOMPurify.sanitize(med.Drug) 
                    : `<em style="color: #ff6b6b;">[Deleted Medicine]</em>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${drugName}</td>
                    <td>${DOMPurify.sanitize(p.dosage || '-')}</td>
                    <td>${DOMPurify.sanitize(p.duration || '-')}</td>
                    <td>${DOMPurify.sanitize(p.instructions || '-')}</td>
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
        console.warn('Failed to load record');
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
        await loadSingleRecordView();
    } else if (patientId) {
        await fetchPatientRecordsforDoctor(patientId);
    } else {
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
            console.warn("Failed to send request.");
        }
    }
});

// ======================
// 7. Expose for debugging
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


async function viewMedicalRecord(medicalrecordId) {
    const recordId = medicalrecordId;
    const recordDoctorName = document.getElementById("recordDoctorName");
    const recordDate = document.getElementById("recordDate");
    const recordDiagnosis = document.getElementById("recordDiagnosis");
    const recordTreatment = document.getElementById("recordTreatment");
    const prescriptionsBody = document.getElementById("prescriptionsBody");
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();
        doctorsReq.onsuccess = async function() {
            const encryptedDoctors = doctorsReq.result || [];
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );
            const tx = db.transaction('medicalRecord', 'readonly');
            const store = tx.objectStore('medicalRecord');
            const request = store.getAll();
           
            request.onsuccess = async function() {
                const encryptedMedicalRecords = request.result || [];
                const decryptedMedicalRecords = await Promise.all(
                    encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                );
                const medicalrecords = decryptedMedicalRecords.filter(med => med.recordId === recordId) || [];
                const medicalrecord = medicalrecords[0];
                
                if (!medicalrecord) {
                    console.error('Medical record not found');
                    recordDoctorName.innerText = 'N/A';
                    recordDate.innerText = 'N/A';
                    recordDiagnosis.innerText = 'Record not found';
                    recordTreatment.innerText = 'N/A';
                    prescriptionsBody.innerHTML = sanitize("<tr><td colspan='4'>Medical record not found.</td></tr>");
                    return;
                }
                
                const currentUserData = decryptedDoctors.filter(d => d.id == medicalrecord.doctorId) || [];
                const doctor = currentUserData[0];
                
                let doctorFullName = 'Unknown Doctor';
                if (doctor && doctor.first_name && doctor.last_name) {
                    doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                }
                
                const safeDoctor = sanitize(doctorFullName);
                const safeDate = sanitize(medicalrecord.dateTime || 'N/A');
                const safeDiagnosis = sanitize(medicalrecord.diagnosis || 'N/A');
                const safeTreatment = sanitize(medicalrecord.treatment || 'N/A');
                
                recordDoctorName.innerText = safeDoctor;
                recordDate.innerText = safeDate;
                recordDiagnosis.innerText = safeDiagnosis;
                recordTreatment.innerText = safeTreatment;
                prescriptionsBody.innerHTML = '';
                const recordPrescriptions = medicalrecord.prescriptions || [];
           
                if (!recordPrescriptions || recordPrescriptions.length === 0) {
                    prescriptionsBody.innerHTML = sanitize("<tr><td colspan='4'>No prescriptions found.</td></tr>");
                    return;
                }
                const medicineTx = db.transaction('medicines', 'readonly');
                const medicineStore = medicineTx.objectStore('medicines');
                const medReq = medicineStore.getAll();
               
                medReq.onsuccess = async function() {
                    const medicines = medReq.result || [];
                    recordPrescriptions.forEach(pre => {
                        const row = document.createElement('tr');
                        const medicine = medicines.find(m => m.id == pre.medicineId);
                        const safeDrug = sanitize(medicine?.Drug || 'Unknown (ID: ' + pre.medicineId + ')');
                        const safeDosage = sanitize(pre.dosage || '-');
                        const safeDuration = sanitize(pre.duration || '-');
                        const safeInstructions = sanitize(pre.instructions || '-');
                        row.innerHTML = `
                            <td>${safeDrug}</td>
                            <td>${safeDosage}</td>
                            <td>${safeDuration}</td>
                            <td>${safeInstructions}</td>
                        `;
                        prescriptionsBody.appendChild(row);
                    });
                };
                medReq.onerror = function() {
                    console.error('Failed to load medicine info:', medReq.error);
                };
            };
           
            request.onerror = function() {
                console.error('Failed to load medical records:', request.error);
            };
        };
        doctorsReq.onerror = function() {
            console.error('Failed to load doctors info:', doctorsReq.error);
        };
    } catch (err) {
        console.error('Error opening DB:', err);
        prescriptionsBody.innerHTML = sanitize("<tr><td colspan='4'>Error connecting to database.</td></tr>");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get('recordId');
    if (recordId) {
        viewMedicalRecord(recordId);
    }
});
