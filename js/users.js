async function fetchAllUserData() {
    const tbody = document.getElementById('usersBody');
    if (!tbody) return console.warn('Table body #usersBody not found.');
    tbody.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>';

    try {
        const db = await openClinicDB();

        const [doctors, patients, users] = await Promise.all([
            new Promise((res, rej) => {
                const req = db.transaction('doctors', 'readonly').objectStore('doctors').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            }),
            new Promise((res, rej) => {
                const req = db.transaction('patients', 'readonly').objectStore('patients').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            }),
            new Promise((res, rej) => {
                const req = db.transaction('users', 'readonly').objectStore('users').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            }),
        ]);

        const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim()]));
        const patientMap = Object.fromEntries(patients.map(p => [p.NHS, p.name || ` ${p.Title || ''} ${p.First || ''} ${p.Last || ''}`.trim()]));

        tbody.innerHTML = '';

        if (!users.length) {
            tbody.innerHTML = "<tr><td colspan='5'>No users found.</td></tr>";
            return;
        }

        users.forEach(u => {
            const row = document.createElement('tr');
            const role = (u.role || '').toLowerCase();

            if (role === 'doctor') {
                const doctorName = doctorMap[u.linkedId] || 'Unknown Doctor';
                row.innerHTML = `
                <tr>
                    <td>${doctorName}</td>
                    <td>${role.charAt(0).toUpperCase() + role.slice(1)}</td>
                    <td class="actions">
                        <a href="edit-user.html"><button class="btn-edit" data-id="${u.linkedId}">Edit</button></a>
                        <button class="btn-delete" data-id="${u.username}">Delete</button>
                    </td>
                </tr>
                `;
            } else if (role === 'patient') {
                const patientName = patientMap[u.linkedId] || 'Unknown Patient';
                row.innerHTML = `
                <tr>
                    <td>${patientName}</td>
                    <td>${role.charAt(0).toUpperCase() + role.slice(1)}</td>
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

    } catch (error) {
        console.error('Error opening DB:', error);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}


async function fetchAllPatientData() {
    const tbody = document.getElementById('patientsBody');
    if (!tbody) return console.warn('Table body #patientsBody not found.');
    tbody.innerHTML = '<tr><td colspan="5">Loading patients...</td></tr>';

    // helper: parse many date formats robustly
    function parseDate(value) {
        if (!value) return null;
        // If already a Date object
        if (value instanceof Date && !isNaN(value)) return value;
        // If number (timestamp)
        if (typeof value === 'number' && isFinite(value)) return new Date(value);
        // If string: try ISO first
        if (typeof value === 'string') {
            // Trim
            const s = value.trim();
            // Common ISO or yyyy-mm-dd
            const iso = Date.parse(s);
            if (!isNaN(iso)) return new Date(iso);

            // Try dd/mm/yyyy or dd-mm-yyyy
            const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dmy) {
                const day = parseInt(dmy[1], 10);
                const month = parseInt(dmy[2], 10) - 1;
                let year = parseInt(dmy[3], 10);
                if (year < 100) year += 1900; // rare case
                return new Date(year, month, day);
            }
        }
        // fallback
        return null;
    }

    // helper: nice date string
    function formatDate(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return 'N/A';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`; // ISO-ish display
    }

    try {
        const db = await openClinicDB();

        const [patients, users] = await Promise.all([
            new Promise((res, rej) => {
                const req = db.transaction('patients', 'readonly').objectStore('patients').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            }),
            new Promise((res, rej) => {
                const req = db.transaction('users', 'readonly').objectStore('users').getAll();
                req.onsuccess = () => res(req.result || []);
                req.onerror = () => rej(req.error);
            }),
        ]);


        tbody.innerHTML = '';

        const patientUsers = users.filter(u => (u.role || '').toLowerCase() === 'patient');

        if (!patientUsers.length) {
            tbody.innerHTML = "<tr><td colspan='5'>No patients found.</td></tr>";
            return;
        }

        patientUsers.forEach(u => {
            const row = document.createElement('tr');
            const patient = patients.find(p => p.NHS === u.linkedId);
            const name = patient 
                ? `${patient.Title || ''} ${patient.First || ''} ${patient.Last || ''}`.trim() 
                : 'Unknown Patient';
            const gender = patient?.Gender || 'N/A';
            const dob = patient?.DOB || 'N/A'; // Assuming your field is called "DOB"
            const email = patient?.Email || 'N/A';

            
            row.innerHTML = `
            <tr>
                <td>${name}</td>
                <td>${gender}</td>
                <td>${dob}</td>
                <td>${email}</td>
            </tr>
            `;
            tbody.appendChild(row);
        });

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