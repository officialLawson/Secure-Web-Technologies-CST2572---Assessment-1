async function fetchPatientRecords() {
    const tbody = document.getElementById("medicalRecordsBody");
    if (!tbody) return '';
    tbody.innerHTML = '<tr><td colspan="5">Loading medical records...</td></tr>';

    try {
        const db = await openClinicDB();

        const user = JSON.parse(localStorage.getItem('currentUser'));

        // Fetch doctor Name
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();

        doctorsReq.onsuccess = async function() {
            const encryptedDoctors = doctorsReq.result || [];

            // Decrypt all doctors in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            // Fetch medical records
            const tx = db.transaction('medicalRecord', 'readonly');
            const store = tx.objectStore('medicalRecord');
            const request = store.getAll();
            
            request.onsuccess = async function() {
                const encryptedMedicalRecords = request.result || [];

                // Decrypt all medical records in parallel
                const decryptedMedicalRecords = await Promise.all(
                    encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                );

                const medicalrecords = decryptedMedicalRecords.filter(med => med.patientId === user.linkedId) || [];

                tbody.innerHTML = '';

                if (!medicalrecords || medicalrecords.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='5'>No medical records found.</td></tr>";
                    return;
                }

                medicalrecords.forEach(med => {
                const row = document.createElement('tr');

                // Get doctor name
                const currentUserData = decryptedDoctors.filter(d => d.id === med.doctorId) || [];

                const doctor = currentUserData[0];

                const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;

                row.innerHTML = `
                        <td>${doctorFullName || 'Unknown'}</td>
                        <td>${med.diagnosis || '-'}</td>
                        <td>${med.treatment || '-'}</td>
                        <td>${med.date || '-'}</td>
                        <td>
                        <button class="btn-view" data-id="${med.recordId}">View</button>
                        </td>
                    `;

                tbody.appendChild(row);

                });
            };
            
            request.onerror = function() {
                console.error('Failed to load medical records:', request.error);
            };

        };

        request.onerror = function() {
            console.error('Failed to load medical records:', request.error);
        };

    } catch (err) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}

async function fetchPatientRecordsforDoctor(patientId) {
    const tbody = document.getElementById("medicalRecordsBody");
    const patientNameDisplay = document.getElementById("patientNameDisplay");
    if (!tbody) return '';
    tbody.innerHTML = '<tr><td colspan="5">Loading medical records...</td></tr>';

    try {
        const db = await openClinicDB();

        const user = JSON.parse(localStorage.getItem('currentUser'));

        // Fetch doctor Name
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();

        doctorsReq.onsuccess = async function() {
            const encryptedDoctors = doctorsReq.result || [];

            // Decrypt all doctos in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            // Fetch patients first and build a lookup map
            const patientTx = db.transaction('patients', 'readonly');
            const patientStore = patientTx.objectStore('patients');
            const patientsReq = patientStore.getAll();

            patientsReq.onsuccess = async function () {
                const encryptedPatients = patientsReq.result || [];

                // Decrypt all patients in parallel
                const decryptedPatients = await Promise.all(
                    encryptedPatients.map(p => decryptPatientInfo(p))
                );

                const currentUserData = decryptedPatients.filter(d => d.NHS === patientId);
                const patient = currentUserData[0];
                const patientName = `${patient.Title} ${patient.First} ${patient.Last}` || 'Unknown Patient';
                patientNameDisplay.innerText = patientName;

                // Fetch medical records
                const tx = db.transaction('medicalRecord', 'readonly');
                const store = tx.objectStore('medicalRecord');
                const request = store.getAll();
                
                request.onsuccess = async function() {
                    const encryptedMedicalRecords = request.result || [];

                    // Decrypt all medical records in parallel
                    const decryptedMedicalRecords = await Promise.all(
                        encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                    );
                    console.log(decryptedMedicalRecords);

                    const medicalrecords = decryptedMedicalRecords.filter(med => med.patientId === patientId) || [];

                    tbody.innerHTML = '';

                    if (!medicalrecords || medicalrecords.length === 0) {
                        tbody.innerHTML = "<tr><td colspan='5'>No medical records found.</td></tr>";
                        return;
                    }

                    medicalrecords.forEach(med => {
                    const row = document.createElement('tr');

                    // Get doctor name
                    const currentUserData = decryptedDoctors.filter(d => d.id === med.doctorId) || [];

                    const doctor = currentUserData[0];

                    const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                    
                    if (user.linkedId === med.doctorId ) {
                        row.innerHTML = `
                                <td>${doctorFullName || 'Unknown'}</td>
                                <td>${med.diagnosis || '-'}</td>
                                <td>${med.treatment || '-'}</td>
                                <td>${med.date || '-'}</td>
                                <td>
                                <button class="btn-view-doctor" data-id="${med.recordId}">View</button>
                                </td>
                            `;
                    } else {
                        row.innerHTML = `
                                <td>${doctorFullName || 'Unknown'}</td>
                                <td>${med.diagnosis || '-'}</td>
                                <td>${med.treatment || '-'}</td>
                                <td>${med.date || '-'}</td>
                                <td>
                                <button class="btn-view-request" data-id="${med.recordId}">Request Access</button>
                                </td>
                            `;
                    }
                    

                    tbody.appendChild(row);

                    });
                };
                
                request.onerror = function() {
                    console.error('Failed to load medical records:', request.error);
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
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}

// Initiating view process
let recordToView = null

// Attach event listener to delete buttons (dynamic)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-view')) {
    e.preventDefault();
    recordToView = e.target.dataset.id;
    window.location.href = `view-medical-record.html?recordId=${recordToView}`;
  }
});

// Attach event listener to delete buttons (dynamic)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-view-doctor')) {
    e.preventDefault();
    recordToView = e.target.dataset.id;
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

    try {
        const db = await openClinicDB();

        const user = JSON.parse(localStorage.getItem('currentUser'));

        // Fetch doctor Name
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();

        doctorsReq.onsuccess = async function() {
            const encryptedDoctors = doctorsReq.result || [];

            // Decrypt all doctors in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            // Fetch medical records
            const tx = db.transaction('medicalRecord', 'readonly');
            const store = tx.objectStore('medicalRecord');
            const request = store.getAll();
            
            request.onsuccess = async function() {
                const encryptedMedicalRecords = request.result || [];

                // Decrypt all medical records in parallel
                const decryptedMedicalRecords = await Promise.all(
                    encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                );

                const medicalrecords = decryptedMedicalRecords.filter(med => med.recordId === recordId) || [];

                const medicalrecord = medicalrecords[0];

                // Get doctor full name
                const currentUserData = decryptedDoctors.filter(d => d.id === medicalrecord.doctorId) || [];
                const doctor = currentUserData[0];
                const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;

                // Populate Data
                recordDoctorName.innerText = doctorFullName;
                recordDate.innerText = medicalrecord.date;
                recordDiagnosis.innerText = medicalrecord.diagnosis;
                recordTreatment.innerText = medicalrecord.treatment;


                prescriptionsBody.innerHTML = '';

                const recordPrescriptions = medicalrecord.prescriptions || [];
            
                if (!recordPrescriptions || recordPrescriptions.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='5'>No prescriptions found.</td></tr>";
                    return;
                }

                // Fetch medicine name
                const medicineTx = db.transaction('medicines', 'readonly');
                const medicineStore = medicineTx.objectStore('medicines');
                const medReq = medicineStore.getAll();
                
                medReq.onsuccess = async function() {
                    const medicines = medReq.result || [];

                    recordPrescriptions.forEach(pre => {
                    const row = document.createElement('tr');

                    const medicineList = medicines.filter(m => m.id === pre.medicineId ) || [];
                    const medicine = medicineList[0];
                    
                    row.innerHTML = `
                            <td>${medicine.Drug || 'Unknown'}</td>
                            <td>${pre.dosage || '-'}</td>
                            <td>${pre.duration || '-'}</td>
                            <td>${pre.instructions || '-'}</td>
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
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }

}

async function viewMedicalRecordforDoctors(medicalrecordId) {
    const recordId = medicalrecordId;
    const recordDoctorName = document.getElementById("recordDoctorName");
    const recordDate = document.getElementById("recordDate");
    const recordDiagnosis = document.getElementById("recordDiagnosis");
    const recordTreatment = document.getElementById("recordTreatment");
    const prescriptionsBody = document.getElementById("prescriptionsBody");

    try {
        const db = await openClinicDB();

        const user = JSON.parse(localStorage.getItem('currentUser'));

        // Fetch doctor Name
        const doctorTx = db.transaction('doctors', 'readonly');
        const doctorStore = doctorTx.objectStore('doctors');
        const doctorsReq = doctorStore.getAll();

        doctorsReq.onsuccess = async function() {
            const encryptedDoctors = doctorsReq.result || [];

            // Decrypt all doctors in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            // Fetch medical records
            const tx = db.transaction('medicalRecord', 'readonly');
            const store = tx.objectStore('medicalRecord');
            const request = store.getAll();
            
            request.onsuccess = async function() {
                const encryptedMedicalRecords = request.result || [];

                // Decrypt all medical records in parallel
                const decryptedMedicalRecords = await Promise.all(
                    encryptedMedicalRecords.map(p => decryptMedicalRecord(p))
                );

                const medicalrecords = decryptedMedicalRecords.filter(med => med.recordId === recordId) || [];

                const medicalrecord = medicalrecords[0];

                // Get doctor full name
                const currentUserData = decryptedDoctors.filter(d => d.id === medicalrecord.doctorId) || [];
                const doctor = currentUserData[0];
                const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;

                console.log(doctorFullName);
                console.log(medicalrecord.date);

                // Populate Data
                recordDoctorName.innerText = doctorFullName;
                recordDate.innerText = medicalrecord.date;
                recordDiagnosis.innerText = medicalrecord.diagnosis;
                recordTreatment.innerText = medicalrecord.treatment;


                prescriptionsBody.innerHTML = '';

                const recordPrescriptions = medicalrecord.prescriptions || [];
            
                if (!recordPrescriptions || recordPrescriptions.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='5'>No prescriptions found.</td></tr>";
                    return;
                }

                // Fetch medicine name
                const medicineTx = db.transaction('medicines', 'readonly');
                const medicineStore = medicineTx.objectStore('medicines');
                const medReq = medicineStore.getAll();
                
                medReq.onsuccess = async function() {
                    const medicines = medReq.result || [];

                    recordPrescriptions.forEach(pre => {
                    const row = document.createElement('tr');

                    const medicineList = medicines.filter(m => m.id === pre.medicineId ) || [];
                    const medicine = medicineList[0];
                    
                    row.innerHTML = `
                            <td>${medicine.Drug || 'Unknown'}</td>
                            <td>${pre.dosage || '-'}</td>
                            <td>${pre.duration || '-'}</td>
                            <td>${pre.instructions || '-'}</td>
                        `;

                    prescriptionsBody.appendChild(row);

                    });
                };

                medReq.onerror = function() {
                    console.error('Failed to load medicine info:', request.error);
                };
            };
            
            request.onerror = function() {
                console.error('Failed to load medical records:', request.error);
            };

        };

        doctorsReq.onerror = function() {
            console.error('Failed to load doctors info:', request.error);
        };

    } catch (err) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }

}

// Load on page ready
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