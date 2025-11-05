async function getUserInfo() {
    const userFullName = document.getElementById("userFullName")
    const userRoleMain = document.getElementById("userRoleMain")
    const userEmail = document.getElementById("userEmail")
    const userAddressMain = document.getElementById("userAddressMain")
    const userFirstName = document.getElementById("userFirstName")
    const userLastName = document.getElementById("userLastName")
    const userTelephone = document.getElementById("userTelephone")
    const userRole = document.getElementById("userRole")
    const userDOB = document.getElementById("userDOB")
    const userId = document.getElementById("userId")
    const userAddress = document.getElementById("userAddress")
    const userGender = document.getElementById("userGender")
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        switch (user.role.toLowerCase()) {
            case 'doctor':
                // Fetch doctors first and build a lookup map
                const doctorTx = db.transaction('doctors', 'readonly');
                const doctorStore = doctorTx.objectStore('doctors');
                const doctorsReq = doctorStore.getAll();
                doctorsReq.onsuccess = async function() {
                    const encryptedDoctors = doctorsReq.result || [];
                    // Decrypt all patients in parallel
                    const decryptedDoctors = await Promise.all(
                        encryptedDoctors.map(p => decryptDoctorInfo(p))
                    );
                    const currentUserData = decryptedDoctors.filter(d => d.id === user.linkedId) || [];
                    const doctor = currentUserData[0];
                    const doctorFullName = `Dr ${doctor.first_name} ${doctor.last_name}`;
                    const doctorRole = (user.role.charAt(0).toUpperCase() + user.role.slice(1));
                    const doctorFirstName = doctor.first_name;
                    const doctorLastName = doctor.last_name;
                    const doctorEmail = doctor.email;
                    const doctorAddress = doctor.Address;
                    const doctorTelephone = doctor.Telephone;
                    const doctorGender = doctor.gender;
                    userFullName.innerText = sanitize(doctorFullName);
                    userEmail.innerText = sanitize(doctorEmail);
                    userAddressMain.innerText = sanitize(doctorAddress);
                    userAddress.innerText = sanitize(doctorAddress);
                    userGender.innerText = sanitize(doctorGender);
                    userFirstName.innerText = sanitize(doctorFirstName);
                    userLastName.innerText = sanitize(doctorLastName);
                    userTelephone.innerText = sanitize(doctorTelephone);
                    userRoleMain.innerText = sanitize(doctorRole);
                    userRole.innerText = sanitize(doctorRole);
                };
                doctorsReq.onerror = function() {
                    console.error('Failed to load doctors info:', request.error);
                };
                break;
            case 'patient':
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
                    // Now filter using decrypted fields
                    const currentUserData = decryptedPatients.filter(d => d.NHS === user.linkedId);
                    if (currentUserData.length === 0) {
                        console.warn("No matching patient found for linkedId:", user.linkedId);
                        return;
                    }
                    const patient = currentUserData[0];
                    const patientFullName = `${patient.Title} ${patient.First} ${patient.Last}`;
                    const patientFirstName = patient.First;
                    const patientLastName = patient.Last;
                    const patientDOB = patient.DOB;
                    const patientEmail = patient.Email;
                    const patientAddress = patient.Address;
                    const patientTelephone = patient.Telephone;
                    const patientNHS = patient.NHS;
                    const patientGender = patient.Gender;
                    const patientRole = (user.role.charAt(0).toUpperCase() + user.role.slice(1));
                    userFullName.innerText = sanitize(patientFullName);
                    userDOB.innerText = sanitize(patientDOB);
                    userEmail.innerText = sanitize(patientEmail);
                    userAddressMain.innerText = sanitize(patientAddress);
                    userAddress.innerText = sanitize(patientAddress);
                    userId.innerText = sanitize(patientNHS);
                    userGender.innerText = sanitize(patientGender);
                    userFirstName.innerText = sanitize(patientFirstName);
                    userLastName.innerText = sanitize(patientLastName);
                    userTelephone.innerText = sanitize(patientTelephone);
                    userRoleMain.innerText = sanitize(patientRole);
                    userRole.innerText = sanitize(patientRole);
                    };
                patientsReq.onerror = function(event) {
                    console.error('Failed to load patients info:', request.error);
                };
                break;
        }
    } catch (err) {
        console.error('Error opening DB:', err);
    }
}
// Delete User Option
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-account')) {
        e.preventDefault();
        document.getElementById('deleteModal').classList.remove('hidden');
    }
});
document.getElementById('confirmDelete').addEventListener('click', async () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    console.log(user);
    if (user.role.toLowerCase() === 'patient') {
        deletePatientCompletely(user.linkedId);
    } else if (user.role.toLowerCase() === 'doctor') {
        deleteDoctorCompletely(user.linkedId);
    }
});
// Handle "Cancel"
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden');
  userToDelete = null;
});
// Close modal if clicking outside
document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add('hidden');
    userToDelete = null;
  }
});
// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
    getUserInfo();
});