async function fetchAllUserData() {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return console.warn('Table body #usersBody not found.');
    tbody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';

    try {
        const db = await openClinicDB();

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

                // Fetch userss first and build a lookup map
                const userTx = db.transaction('users', 'readonly');
                const userStore = userTx.objectStore('users');
                const usersReq = userStore.getAll();

                usersReq.onsuccess = async function () {
                    const users = usersReq.result || [];

                    tbody.innerHTML = '';

                    if (!users.length) {
                        tbody.innerHTML = "<tr><td colspan='5'>No users found.</td></tr>";
                        return;
                    }

                    users.forEach(u => {
                        const row = document.createElement('tr');
                        const role = (u.role || '').toLowerCase();

                        if (role === 'doctor') {
                            const currentUserData = decryptedDoctors.filter(d => d.id === u.linkedId) || [];
                            const doctor = currentUserData[0];
                            const doctorName = `Dr ${doctor.first_name} ${doctor.last_name}` || 'Unknown Doctor';
                            const gender = doctor.Gender || 'N/A';
                            const email = doctor.Email || 'N/A';

                            row.innerHTML = `
                            <tr>
                                <td>${doctorName}</td>
                                <td>${role.charAt(0).toUpperCase() + role.slice(1)}</td>
                                <td>${gender}</td>
                                <td>${email}</td>
                                <td class="actions">
                                    <a href="edit-user.html"><button class="btn-edit" data-id="${u.linkedId}">Edit</button></a>
                                    <button class="btn-delete" data-id="${u.username}">Delete</button>
                                </td>
                            </tr>
                            `;
                        } else if (role === 'patient') {
                            const currentUserData = decryptedPatients.filter(d => d.NHS === u.linkedId);
                            const patient = currentUserData[0];
                            const patientName = `${patient.Title} ${patient.First} ${patient.Last}` || 'Unknown Patient';
                            const gender = patient.Gender || 'N/A';
                            const email = patient.Email || 'N/A';

                            row.innerHTML = `
                                <tr>
                                    <td>${patientName}</td>
                                    <td>${role.charAt(0).toUpperCase() + role.slice(1)}</td>
                                    <td>${gender}</td>
                                    <td>${email}</td>
                                    <td class="actions">
                                        <a href="edit-user.html"><button class="btn-edit" data-id="${u.linkedId}">Edit</button></a>
                                        <button class="btn-delete" data-id="${u.username}">Delete</button>
                                    </td>
                                </tr>
                            `;
                        } else {
                            // Skip unknown roles but log
                            console.warn(`Unknown user role: ${u.role}`);
                            return;
                        }

                        tbody.appendChild(row);
                    });
                };
                
                usersReq.onerror = function() {
                    console.error('Failed to load users info:', usersReq.error);
                };
            };

            patientsReq.onerror = function() {
                console.error('Failed to load patients info:', patientsReq.error);
            };
        };

        doctorsReq.onerror = function() {
            console.error('Failed to load doctors info:', doctorsReq.error);
        };

    } catch (error) {
        console.error('Error opening DB:', error);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}


async function fetchAllPatientData() {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return console.warn('Table body #patientsBody not found.');
    tbody.innerHTML = '<tr><td colspan="5">Loading patients...</td></tr>';

    try {
        const db = await openClinicDB();

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

            // Fetch userss first and build a lookup map
            const userTx = db.transaction('users', 'readonly');
            const userStore = userTx.objectStore('users');
            const usersReq = userStore.getAll();

            usersReq.onsuccess = async function () {
                const users = usersReq.result || [];

                tbody.innerHTML = '';

                const patientUsers = users.filter(u => (u.role || '').toLowerCase() === 'patient');

                if (!patientUsers.length) {
                    tbody.innerHTML = "<tr><td colspan='5'>No patients found.</td></tr>";
                    return;
                }

                patientUsers.forEach(u => {
                    const row = document.createElement('tr');
                    const currentUserData = decryptedPatients.filter(d => d.NHS === u.linkedId) || [];
                    const patient = currentUserData[0];
                    const patientName = `${patient.Title} ${patient.First} ${patient.Last}` || 'Unknown Patient';
                    const gender = patient.Gender || 'N/A';
                    const dob = patient.DOB || 'N/A'; // Assuming your field is called "DOB"
                    const email = patient.Email || 'N/A';
                    
                    row.innerHTML = `
                        <td>${patientName}</td>
                        <td>${gender}</td>
                        <td>${dob}</td>
                        <td>${email}</td>
                    `;

                    // Add a click event to make the row behave like a link
                    row.style.cursor = 'pointer';
                    row.addEventListener('click', () => {
                        window.location.href = `medical-records-doctor.html?patientId=${u.linkedId}`; // Adjust URL as needed
                    });


                    tbody.appendChild(row);
                });

            };
                
            usersReq.onerror = function() {
                console.error('Failed to load users info:', request.error);
            };
        };

        patientsReq.onerror = function() {
            console.error('Failed to load patients info:', request.error);
        };

    } catch (error) {
        console.error('Error opening DB:', error);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const role = (user?.role || '').toLowerCase();

    if (role === 'admin') {
        fetchAllUserData();
    } else if (role === 'doctor') {
        fetchAllPatientData();
    } else {
        console.warn('No valid role detected or role not authorized to view tables.');
    }
});

// Store the user ID to delete
let userToDelete = null;

// Attach event listener to delete buttons (dynamic)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    e.preventDefault();
    userToDelete = e.target.dataset.id;
    document.getElementById('deleteModal').classList.remove('hidden');
  }
});

document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (userToDelete !== null) {

    try {
      const db = await openClinicDB();
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.delete(userToDelete); 

      request.onsuccess = () => {
        fetchAllUserData();
        document.getElementById('deleteModal').classList.add('hidden');
        userToDelete = null;
      };

      request.onerror = () => {
        alert('Error deleting user.');
        userToDelete = null;
      };
    } catch (err) {
      console.error('DB error:', err);
      alert('Database error.');
      userToDelete = null;
    }
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