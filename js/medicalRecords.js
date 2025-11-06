async function fetchPatientRecords() {
    const tbody = document.getElementById("medicalRecordsBody");
    if (!tbody) return '';
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    tbody.innerHTML = sanitize('<tr><td colspan="5">Loading medical records...</td></tr>');
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
                const medicalrecords = decryptedMedicalRecords.filter(med => med.patientId === user.linkedId) || [];
                tbody.innerHTML = '';
                if (!medicalrecords || medicalrecords.length === 0) {
                    tbody.innerHTML = sanitize("<tr><td colspan='5'>No medical records found.</td></tr>");
                    return;
                }
                medicalrecords.forEach(med => {
                const row = document.createElement('tr');
                const currentUserData = decryptedDoctors.filter(d => d.id === med.doctorId) || [];
                const doctor = currentUserData[0];
                let doctorFullName = 'Unknown';
                if (doctor) {
                    doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                }
                const safeDoctor = sanitize(doctorFullName);
                const safeDiagnosis = sanitize(med.diagnosis || '-');
                const safeTreatment = sanitize(med.treatment || '-');
                const safeDate = sanitize(med.dateTime || '-');
                const safeId = sanitize(med.recordId);
                row.innerHTML = `
                        <td>${safeDoctor}</td>
                        <td>${safeDiagnosis}</td>
                        <td>${safeTreatment}</td>
                        <td>${safeDate}</td>
                        <td>
                        <button class="btn-view" data-id="${safeId}">View</button>
                        </td>
                    `;
                tbody.appendChild(row);
                });
            };
           
            request.onerror = function() {
                console.error('Failed to load medical records:', request.error);
            };
        };
    } catch (err) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = sanitize("<tr><td colspan='5'>Error connecting to database.</td></tr>");
    }
}
async function fetchPatientRecordsforDoctor(patientId) {
    const tbody = document.getElementById("medicalRecordsBody");
    const patientNameDisplay = document.getElementById("patientNameDisplay");
    if (!tbody) return '';
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    tbody.innerHTML = sanitize('<tr><td colspan="5">Loading medical records...</td></tr>');
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

            const user = JSON.parse(localStorage.getItem('currentUser'));

            const selfDetail = decryptedDoctors.find(d => d.id === user.linkedId) || [];
            const selfName = `Dr ${selfDetail.first_name} ${selfDetail.last_name}` || 'Unknown';
            const safeSelfName = sanitize(selfName);

            const patientTx = db.transaction('patients', 'readonly');
            const patientStore = patientTx.objectStore('patients');
            const patientsReq = patientStore.getAll();
            patientsReq.onsuccess = async function () {
                const encryptedPatients = patientsReq.result || [];
                const decryptedPatients = await Promise.all(
                    encryptedPatients.map(p => decryptPatientInfo(p))
                );
                const currentUserData = decryptedPatients.filter(d => d.NHS === patientId);
                const patient = currentUserData[0];
                const patientName = `${patient.Title} ${patient.First} ${patient.Last}` || 'Unknown Patient';
                const safePatientName = sanitize(patientName);
                patientNameDisplay.innerText = safePatientName;
                const tx = db.transaction('medicalRecord', 'readonly');
                const store = tx.objectStore('medicalRecord');
                const request = store.getAll();
               
                request.onsuccess = async function() {
                    const encryptedMedicalRecords = request.result || [];
                    const decryptedMedicalRecords = await Promise.all(
                        encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                    );
                    const medicalrecords = decryptedMedicalRecords.filter(med => med.patientId === patientId) || [];
                    tbody.innerHTML = '';
                    if (!medicalrecords || medicalrecords.length === 0) {
                        tbody.innerHTML = sanitize("<tr><td colspan='5'>No medical records found.</td></tr>");
                        return;
                    }
                    medicalrecords.forEach(med => {

                    const row = document.createElement('tr');
                    const currentUserData = decryptedDoctors.filter(d => d.id === med.doctorId) || [];

                    const doctor = currentUserData[0];

                    const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                    const safeDoctor = sanitize(doctorFullName);
                    const safeDoctorId = sanitize(med.doctorId);
                    const safeDiagnosis = sanitize(med.diagnosis || '-');
                    const safeTreatment = sanitize(med.treatment || '-');
                    const safeDate = sanitize(med.dateTime || '-');
                    const safeId = sanitize(med.recordId);
                    let safeButton;
                    if (med.accessedBy && med.accessedBy.includes(user.linkedId)) {
                        safeButton = `<button class="btn-view-doctor" data-id="${safeId}">View</button>`;
                    } else {
                        safeButton = `<button class="btn-view-request" data-id="${safeId}" data-ownerid="${safeDoctorId}" data-myname="${safeSelfName}">Request Access</button>`;
                    }
                    row.innerHTML = `
                            <td>${safeDoctor}</td>
                            <td>${safeDiagnosis}</td>
                            <td>${safeTreatment}</td>
                            <td>${safeDate}</td>
                            <td>
                            ${safeButton}
                            </td>
                        `;
                    tbody.appendChild(row);
                    });
                };
               
            };
            patientsReq.onerror = function() {
                console.error('Failed to load patients info:', patientsReq.error);
            };
        };
        doctorsReq.onerror = function() {
            console.error('Failed to load doctors info:', doctorsReq.error);
        };
    } catch (err) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = sanitize("<tr><td colspan='5'>Error connecting to database.</td></tr>");
    }
}
let recordToView = null
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-view')) {
    e.preventDefault();
    const safeId = DOMPurify.sanitize(e.target.dataset.id);
    recordToView = safeId;
    window.location.href = `view-medical-record.html?recordId=${recordToView}`;
  }
});
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-view-doctor')) {
    e.preventDefault();
    const safeId = DOMPurify.sanitize(e.target.dataset.id);
    recordToView = safeId;
    window.location.href = `view-medical-record-doctor.html?recordId=${recordToView}`;
  }
});
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
                
                // Check if medical record exists
                if (!medicalrecord) {
                    console.error('Medical record not found');
                    recordDoctorName.innerText = 'N/A';
                    recordDate.innerText = 'N/A';
                    recordDiagnosis.innerText = 'Record not found';
                    recordTreatment.innerText = 'N/A';
                    prescriptionsBody.innerHTML = sanitize("<tr><td colspan='4'>Medical record not found.</td></tr>");
                    return;
                }
                
                // Debug logging
                console.log('Medical record doctorId:', medicalrecord.doctorId, typeof medicalrecord.doctorId);
                console.log('Available doctors:', decryptedDoctors.map(d => ({ id: d.id, type: typeof d.id, name: `${d.first_name} ${d.last_name}` })));
                
                // Try both strict and loose comparison
                const currentUserData = decryptedDoctors.filter(d => d.id == medicalrecord.doctorId) || [];
                const doctor = currentUserData[0];
                
                // Check if doctor exists, provide fallback
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
async function viewMedicalRecordforDoctors(medicalrecordId) {
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
                
                // Check if medical record exists
                if (!medicalrecord) {
                    console.error('Medical record not found');
                    recordDoctorName.innerText = 'N/A';
                    recordDate.innerText = 'N/A';
                    recordDiagnosis.innerText = 'Record not found';
                    recordTreatment.innerText = 'N/A';
                    prescriptionsBody.innerHTML = sanitize("<tr><td colspan='4'>Medical record not found.</td></tr>");
                    return;
                }
                
                const currentUserData = decryptedDoctors.filter(d => d.id === medicalrecord.doctorId) || [];
                const doctor = currentUserData[0];
                
                // Check if doctor exists, provide fallback
                let doctorFullName = 'Unknown Doctor';
                if (doctor && doctor.first_name && doctor.last_name) {
                    doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                }
                
                console.log(doctorFullName);
                console.log(medicalrecord.dateTime);
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
                    const medicineList = medicines.filter(m => m.id === pre.medicineId ) || [];
                    const medicine = medicineList[0];
                    const safeDrug = sanitize(medicine?.Drug || 'Unknown');
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
    fetchPatientRecords();
});
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get('recordId');
    if (recordId) {
        viewMedicalRecord(recordId);
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');
    if (patientId) {
        fetchPatientRecordsforDoctor(patientId);
    }
});
window.clinicDB = {
    viewMedicalRecord,
    viewMedicalRecordforDoctors
};

// Request Access

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-view-request")) {
    const button = e.target;
    const recordId = DOMPurify.sanitize(button.dataset.id);
    const recordDoctorId = DOMPurify.sanitize(button.dataset.ownerid);
    const requestingDoctorFullName = DOMPurify.sanitize(button.dataset.myname);
    const requestingDoctorId = JSON.parse(localStorage.getItem('currentUser')).linkedId;

    if (recordId && requestingDoctorFullName) {
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
          `Doctor with ID ${parseInt(requestingDoctorId)} requested access to medical record with ID ${recordId} from doctor with ID ${recordDoctorId}`
        );

        // ✅ Update button text and disable it
        button.textContent = "Request Sent";
        button.disabled = true;
        button.classList.add("request-sent"); // Optional: style it differently

      } catch (err) {
        console.error("❌ Failed to send access request:", err);
        alert("Failed to send request. Please try again.");
      }
    }
  }
});