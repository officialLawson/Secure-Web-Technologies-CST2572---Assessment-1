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
                            const gender = doctor.gender || 'N/A';
                            const email = doctor.email || 'N/A';

                            row.innerHTML = `
                            <tr>
                                <td>${doctorName}</td>
                                <td>${role.charAt(0).toUpperCase() + role.slice(1)}</td>
                                <td>${gender}</td>
                                <td>${email}</td>
                                <td class="actions">
                                    <a href="edit-user.html"><button class="btn-edit" data-id="${u.linkedId}" data-role="doctor">Edit</button></a>
                                    <button class="btn-delete" data-username="${u.username}" data-role="doctor" data-id="${u.linkedId}">Delete</button>
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
                                        <a href="edit-user.html"><button class="btn-edit" data-id="${u.linkedId}" data-role="patient">Edit</button></a>
                                        <button class="btn-delete" data-username="${u.username}" data-role="patient" data-id="${u.linkedId}">Delete</button>
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

async function addPatient(event, userTitle, userFirstName, userLastName, userNHS, userDOB, userGender, userEmail, userTelephone, userAddress) {
    // ✅ Prevent form submission reload
    if (event) event.preventDefault();

    if (!userTitle) {
        const inputError = document.getElementById("userTitle");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userTitle-form-error");
        error.innerText = `Please enter a title.`;
        return;
    } else {
        const inputError = document.getElementById("userTitle");
        inputError.style.borderColor = "";
        const error = document.getElementById("userTitle-form-error");
        error.innerHTML = ``;
    }
    if (!userFirstName) {
        const inputError = document.getElementById("userFirstName");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userFirstName-form-error");
        error.innerHTML = `Please enter a first name.`;
        return;
    } else {
        const inputError = document.getElementById("userFirstName");
        inputError.style.borderColor = "";
        const error = document.getElementById("userFirstName-form-error");
        error.innerHTML = ``;
    }
    if (!userLastName) {
        const inputError = document.getElementById("userLastName");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userLastName-form-error");
        error.innerHTML = `Please enter a last name.`;
        return;
    } else {
        const inputError = document.getElementById("userLastName");
        inputError.style.borderColor = "";
        const error = document.getElementById("userLastName-form-error"); 
        error.innerHTML = ``;
    }
    if (!userNHS) {
        const inputError = document.getElementById("userNHS");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userNHS-form-error");
        error.innerHTML = `Please select a date of birth.`;
        return;
    } else {
        const inputError = document.getElementById("userNHS");
        inputError.style.borderColor = "";
        const error = document.getElementById("userNHS-form-error");
        error.innerHTML = ``;
    }
    if (!userDOB) {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = `Please select a date of birth.`;
        return;
    } else {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = ``;
    }
    if (!userGender) {
        const inputError = document.getElementById("userGender");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userGender-form-error");
        error.innerHTML = `Please enter the gender.`;
        return;
    } else {
        const inputError = document.getElementById("userGender");
        inputError.style.borderColor = "";
        const error = document.getElementById("userGender-form-error");
        error.innerHTML = ``;
    }
    if (!userEmail) {
        const inputError = document.getElementById("userEmail");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userEmail-form-error");
        error.innerHTML = `Please enter an email address.`;
        return;
    } else {
        const inputError = document.getElementById("userEmail");
        inputError.style.borderColor = "";
        const error = document.getElementById("userEmail-form-error");
        error.innerHTML = ``;
    }
    if (!userTelephone) {
        const inputError = document.getElementById("userTelephone");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userTelephone-form-error");
        error.innerHTML = `Please enter a telephone.`;
        return;
    } else {
        const inputError = document.getElementById("userTelephone");
        inputError.style.borderColor = "";
        const error = document.getElementById("userTelephone-form-error");
        error.innerHTML = ``;
    }
    if (!userAddress) {
        const inputError = document.getElementById("userAddress");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userAddress-form-error");
        error.innerHTML = `Please enter an address`;
        return;
    } else {
        const inputError = document.getElementById("userAddress");
        inputError.style.borderColor = "";
        const error = document.getElementById("userAddress-form-error");
        error.innerHTML = ``;
    }

    // Age verification helper function
    // Function to check if age is above 16
    function isAbove16(dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 16;
    }

    if (!isAbove16(userDOB)) {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = `User must be above 16 years old.`;
        return;
    } else {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = ``;
    }

    try {
        const db = await openClinicDB();
        const tx = db.transaction('patients', 'readwrite');
        const store = tx.objectStore('patients');
        const request = store.getAll();

        request.onsuccess = function() {
            const patients = request.result || [];

            const existSame = patients.find(p => 
                p.NHS === userNHS &&
                p.DOB === userDOB &&
                p.First === userFirstName &&
                p.Last === userLastName 
            );

            if (existSame) {
                const error = document.getElementById("userNHS-form-error");
                error.innerHTML = `User with this NHS already exists.`;
                return;
            }

            const existSameEmail = patients.find(p => 
                p.Email === userEmail
            );

            if (existSameEmail) {
                const error = document.getElementById("userEmail-form-error");
                error.innerHTML = `User with this email already exists.`;
                return;
            }

            // Hepler function
            function generateNextId(db, storeName, callback) {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.openCursor();
                let maxId = 0;

                request.onsuccess = function (event) {
                    const cursor = event.target.result;
                    if (cursor) {
                        const record = cursor.value;
                        if (record.id && typeof record.id === 'number') {
                            maxId = Math.max(maxId, record.id);
                        }
                        cursor.continue();
                    } else {
                        // All records scanned, return next ID
                        callback(maxId + 1);
                    }
                };

                request.onerror = function () {
                    console.error('Error scanning records for ID generation');
                    callback(null);
                };
            }

            generateNextId(db, 'patients', async function (newId) {
                if (newId !== null) {
                    // Create the new patient object
                    const newPatient = {
                        id: newId,
                        Title: userTitle,
                        First: userFirstName, 
                        Last: userLastName, 
                        NHS: userNHS, 
                        DOB: userDOB, 
                        Gender: userGender, 
                        Email: userEmail, 
                        Telephone: userTelephone, 
                        Address: userAddress
                    };
                    const tx = db.transaction('patients', 'readwrite');
                    const store = tx.objectStore('patients');

                    const encryptedNewPatient = await encryptPatientInfo(newPatient);

                    const addReq = store.add(encryptedNewPatient);

                    addReq.onsuccess = () => {
                        // Helper function: generate username and password
                        function generateUsernameAndPassword(db, storeName, firstName, lastName, callback) {
                            const baseUsername = (firstName + lastName).toLowerCase().replace(/\s+/g, '');
                            const transaction = db.transaction([storeName], 'readonly');
                            const store = transaction.objectStore(storeName);
                            const request = store.openCursor();
                            const existingUsernames = [];

                            request.onsuccess = async function (event) {
                                const cursor = event.target.result;
                                if (cursor) {
                                    const user = cursor.value;
                                    if (user.username && user.username.startsWith(baseUsername)) {
                                        existingUsernames.push(user.username);
                                    }
                                    cursor.continue();
                                } else {
                                    // Generate unique username
                                    let username = baseUsername;
                                    let counter = 1;
                                    while (existingUsernames.includes(username)) {
                                        username = baseUsername + counter;
                                        counter++;
                                    }

                                    // Generate random password
                                    const password = await encryptPassword();
                                    callback({ username, password });
                                }
                            };

                            request.onerror = function () {
                                console.error('Error checking usernames');
                                callback(null);
                            };
                        }

                        function generateRandomPassword(length = 10) {
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                            let password = '';
                            for (let i = 0; i < length; i++) {
                                password += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            return password;
                        }

                        async function encryptPassword() {
                            const plainPassword = generateRandomPassword();
                            const encrypted = await encryptData(plainPassword);
                            return encrypted;
                        }

                        generateUsernameAndPassword(db, 'users', userFirstName, userLastName, function (creds) {
                            if (creds) {

                                const newPatientUser = {
                                    username: creds.username,
                                    password: creds.password,
                                    role: 'patient',
                                    linkedId: userNHS, 
                                };

                                const usersTx = db.transaction('users', 'readwrite');
                                const usersStore = usersTx.objectStore('users');
                                const usersReq = usersStore.add(newPatientUser);

                                usersReq.onsuccess = function() {
                                    console.log(`✅ Added patient.`);
                                    window.location.href = `users-admin.html`; // Redirect after adding
                                };
                                
                                usersReq.onerror = function() {
                                    console.error("❌ Failed to add user:", e.target.error);
                                };

                            }
                        });
                    };

                    addReq.onerror = (e) => {
                        console.error("❌ Failed to add patient:", e.target.error);
                    };
                }
            });
            

            

        };

        request.onerror = (e) => {
            console.error("❌ Error fetching patients:", e.target.error);
        };


    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

function handleAddPatient(event) {
  const userTitle = document.getElementById('userTitle').value;
  const userFirstName = document.getElementById('userFirstName').value;
  const userLastName = document.getElementById('userLastName').value;
  const userNHS = document.getElementById('userNHS').value;
  const userDOB = document.getElementById('userDOB').value;
  const userGender = document.getElementById('userGender').value;
  const userEmail = document.getElementById('userEmail').value;
  const userTelephone = document.getElementById('userTelephone').value;
  const userAddress = document.getElementById('userAddress').value;

  addPatient(event, userTitle, userFirstName, userLastName, userNHS, userDOB, userGender, userEmail, userTelephone, userAddress);

}

async function addDoctor(event, userFirstName, userLastName, userGender, userEmail, userTelephone, userAddress) {
    if (event) event.preventDefault();

    // 🔍 Field validation (same structure as patient)
    const fields = [
        { value: userFirstName, id: "userFirstName", message: "Please enter a first name." },
        { value: userLastName, id: "userLastName", message: "Please enter a last name." },
        { value: userGender, id: "userGender", message: "Please enter the gender." },
        { value: userEmail, id: "userEmail", message: "Please enter an email address." },
        { value: userTelephone, id: "userTelephone", message: "Please enter a telephone." },
        { value: userAddress, id: "userAddress", message: "Please enter an address." }
    ];

    for (const field of fields) {
        const input = document.getElementById(field.id);
        const error = document.getElementById(`${field.id}-form-error`);
        if (!field.value) {
            input.style.borderColor = "red";
            error.innerHTML = field.message;
            return;
        } else {
            input.style.borderColor = "";
            error.innerHTML = "";
        }
    }


    // 🧠 Main logic
    try {
        const db = await openClinicDB();
        const tx = db.transaction('doctors', 'readwrite');
        const store = tx.objectStore('doctors');
        const request = store.getAll();

        request.onsuccess = async function () {
            const encryptedDoctors = request.result || [];

            // Decrypt all doctors in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            const doctors = decryptedDoctors;

            console.log(doctors);

            const existSameEmail = doctors.find(d => d.email === userEmail);
            if (existSameEmail) {
                const error = document.getElementById("userEmail-form-error");
                error.innerHTML = `Doctor with this email already exists.`;
                return;
            }

            // 🔢 ID generator
            function generateNextId(db, storeName, callback) {
                const transaction = db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.openCursor();
                let maxId = 0;

                request.onsuccess = function (event) {
                    const cursor = event.target.result;
                    if (cursor) {
                        const record = cursor.value;
                        if (record.id && typeof record.id === 'number') {
                            maxId = Math.max(maxId, record.id);
                        }
                        cursor.continue();
                    } else {
                        callback(maxId + 1);
                    }
                };

                request.onerror = function () {
                    console.error('Error scanning records for ID generation');
                    callback(null);
                };
            }

            generateNextId(db, 'doctors', async function (newId) {
                if (newId !== null) {
                    const newDoctor = {
                        id: newId,
                        first_name: userFirstName,
                        last_name: userLastName,
                        gender: userGender, 
                        email: userEmail,
                        Telephone: userTelephone,
                        Address: userAddress
                    };

                    const tx = db.transaction('doctors', 'readwrite');
                    const store = tx.objectStore('doctors');

                    const encryptedNewDoctor= await encryptDoctorInfo(newDoctor);

                    const addReq = store.add(encryptedNewDoctor);

                    addReq.onsuccess = () => {
                        // 👤 Username + encrypted password
                        function generateUsernameAndPassword(db, storeName, firstName, lastName, callback) {
                            const baseUsername = (firstName + lastName).toLowerCase().replace(/\s+/g, '');
                            const transaction = db.transaction([storeName], 'readonly');
                            const store = transaction.objectStore(storeName);
                            const request = store.openCursor();
                            const existingUsernames = [];

                            request.onsuccess = async function (event) {
                                const cursor = event.target.result;
                                if (cursor) {
                                    const user = cursor.value;
                                    if (user.username && user.username.startsWith(baseUsername)) {
                                        existingUsernames.push(user.username);
                                    }
                                    cursor.continue();
                                } else {
                                    let username = baseUsername;
                                    let counter = 1;
                                    while (existingUsernames.includes(username)) {
                                        username = baseUsername + counter;
                                        counter++;
                                    }

                                    const password = await encryptPassword();
                                    callback({ username, password });
                                }
                            };

                            request.onerror = function () {
                                console.error('Error checking usernames');
                                callback(null);
                            };
                        }

                        function generateRandomPassword(length = 10) {
                            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                            let password = '';
                            for (let i = 0; i < length; i++) {
                                password += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            return password;
                        }

                        async function encryptPassword() {
                            const plainPassword = generateRandomPassword();
                            const encrypted = await encryptData(plainPassword);
                            return encrypted;
                        }

                        generateUsernameAndPassword(db, 'users', userFirstName, userLastName, function (creds) {
                            if (creds) {
                                const newDoctorUser = {
                                    username: creds.username,
                                    password: creds.password,
                                    role: 'doctor',
                                    linkedId: newId
                                };

                                const usersTx = db.transaction('users', 'readwrite');
                                const usersStore = usersTx.objectStore('users');
                                const usersReq = usersStore.add(newDoctorUser);

                                usersReq.onsuccess = function () {
                                    console.log(`✅ Added doctor.`);
                                    window.location.href = `users-admin.html`;
                                };

                                usersReq.onerror = function (e) {
                                    console.error("❌ Failed to add user:", e.target.error);
                                };
                            }
                        });
                    };

                    addReq.onerror = (e) => {
                        console.error("❌ Failed to add doctor:", e.target.error);
                    };
                }
            });
        };

        request.onerror = (e) => {
            console.error("❌ Error fetching doctors:", e.target.error);
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

function handleAddDoctor(event) {
    const userFirstName = document.getElementById('userFirstName').value;
    const userLastName = document.getElementById('userLastName').value;
    const userGender = document.getElementById('userGender').value;
    const userEmail = document.getElementById('userEmail').value;
    const userTelephone = document.getElementById('userTelephone').value;
    const userAddress = document.getElementById('userAddress').value;

    addDoctor(event,  userFirstName, userLastName, userGender, userEmail, userTelephone, userAddress);
}

// Patient Editing Functions
async function loadPatientForEdit(patientId) {
    try {
        const db = await openClinicDB();
        const tx = db.transaction('patients', 'readonly');
        const store = tx.objectStore('patients');
        const request = store.getAll();

        request.onsuccess = async function () {
            const encryptedPatients = request.result || [];

            // Decrypt all patients in parallel
            const decryptedPatients = await Promise.all(
                encryptedPatients.map(p => decryptPatientInfo(p))
            );

            const patientFiltered = decryptedPatients.filter(p => p.NHS === patientId) || [];

            const patient = patientFiltered[0];

            if (!patient) {
                console.error("❌ Patient not found.");
                return;
            }

            function convertDOBFormat(dobStr) {
                // Split the input string by "/"
                const [day, month, year] = dobStr.split("/");

                // Return the formatted string
                return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            }


            // Fill form fields
            document.getElementById('userTitle').value = patient.Title || '';
            document.getElementById('userFirstName').value = patient.First || '';
            document.getElementById('userLastName').value = patient.Last || '';
            document.getElementById('userNHS').value = patient.NHS || '';
            document.getElementById('userDOB').value = convertDOBFormat(patient.DOB) || '';
            console.log(convertDOBFormat(patient.DOB));
            document.getElementById('userGender').value = patient.Gender || '';
            document.getElementById('userEmail').value = patient.Email || '';
            document.getElementById('userTelephone').value = patient.Telephone || '';
            document.getElementById('userAddress').value = patient.Address || '';
        };

        request.onerror = function (e) {
            console.error("❌ Error loading patient:", e.target.error);
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

async function editPatient(patientId, updatedData) {
    if (!userTitle) {
        const inputError = document.getElementById("userTitle");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userTitle-form-error");
        error.innerText = `Please enter a title.`;
        return;
    } else {
        const inputError = document.getElementById("userTitle");
        inputError.style.borderColor = "";
        const error = document.getElementById("userTitle-form-error");
        error.innerHTML = ``;
    }
    if (!userFirstName) {
        const inputError = document.getElementById("userFirstName");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userFirstName-form-error");
        error.innerHTML = `Please enter a first name.`;
        return;
    } else {
        const inputError = document.getElementById("userFirstName");
        inputError.style.borderColor = "";
        const error = document.getElementById("userFirstName-form-error");
        error.innerHTML = ``;
    }
    if (!userLastName) {
        const inputError = document.getElementById("userLastName");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userLastName-form-error");
        error.innerHTML = `Please enter a last name.`;
        return;
    } else {
        const inputError = document.getElementById("userLastName");
        inputError.style.borderColor = "";
        const error = document.getElementById("userLastName-form-error"); 
        error.innerHTML = ``;
    }
    if (!userNHS) {
        const inputError = document.getElementById("userNHS");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userNHS-form-error");
        error.innerHTML = `Please select a date of birth.`;
        return;
    } else {
        const inputError = document.getElementById("userNHS");
        inputError.style.borderColor = "";
        const error = document.getElementById("userNHS-form-error");
        error.innerHTML = ``;
    }
    if (!userDOB) {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = `Please select a date of birth.`;
        return;
    } else {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = ``;
    }
    if (!userGender) {
        const inputError = document.getElementById("userGender");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userGender-form-error");
        error.innerHTML = `Please enter the gender.`;
        return;
    } else {
        const inputError = document.getElementById("userGender");
        inputError.style.borderColor = "";
        const error = document.getElementById("userGender-form-error");
        error.innerHTML = ``;
    }
    if (!userEmail) {
        const inputError = document.getElementById("userEmail");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userEmail-form-error");
        error.innerHTML = `Please enter an email address.`;
        return;
    } else {
        const inputError = document.getElementById("userEmail");
        inputError.style.borderColor = "";
        const error = document.getElementById("userEmail-form-error");
        error.innerHTML = ``;
    }
    if (!userTelephone) {
        const inputError = document.getElementById("userTelephone");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userTelephone-form-error");
        error.innerHTML = `Please enter a telephone.`;
        return;
    } else {
        const inputError = document.getElementById("userTelephone");
        inputError.style.borderColor = "";
        const error = document.getElementById("userTelephone-form-error");
        error.innerHTML = ``;
    }
    if (!userAddress) {
        const inputError = document.getElementById("userAddress");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userAddress-form-error");
        error.innerHTML = `Please enter an address`;
        return;
    } else {
        const inputError = document.getElementById("userAddress");
        inputError.style.borderColor = "";
        const error = document.getElementById("userAddress-form-error");
        error.innerHTML = ``;
    }

    // Age verification helper function
    // Function to check if age is above 16
    function isAbove16(dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 16;
    }

    if (!isAbove16(updatedData.DOB)) {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "red";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = `User must be above 16 years old.`;
        return;
    } else {
        const inputError = document.getElementById("userDOB");
        inputError.style.borderColor = "";
        const error = document.getElementById("userDOB-form-error");
        error.innerHTML = ``;
    }
    
    try {
        const db = await openClinicDB();
        const tx = db.transaction('patients', 'readwrite');
        const store = tx.objectStore('patients');
        const getReq = store.get(patientId);

        getReq.onsuccess = async function () {
            const existingPatient = getReq.result;
            if (!existingPatient) {
                console.error("❌ Patient not found.");
                return;
            }

            const updatedPatient = {
                ...existingPatient,
                ...updatedData
            };

            const encryptedEditedPatient = await encryptPatientInfo(updatedPatient);

            const updateReq = store.put(encryptedEditedPatient);

            updateReq.onsuccess = function () {
                console.log("✅ Patient updated successfully.");
                window.location.href = 'users-admin.html';
            };

            updateReq.onerror = function (e) {
                console.error("❌ Failed to update patient:", e.target.error);
            };
        };

        getReq.onerror = function (e) {
            console.error("❌ Error fetching patient:", e.target.error);
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

// Doctors Editing Functions
async function loadDoctorForEdit(doctorId) {
    try {
        const db = await openClinicDB();
        const tx = db.transaction('doctors', 'readonly');
        const store = tx.objectStore('doctors');
        const request = store.getAll();

        request.onsuccess = async function () {
            const encryptedDoctors = request.result || [];

            // Decrypt all doctors in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            const doctorFiltered = decryptedDoctors.filter(d => d.id === parseInt(doctorId)) || [];

            const doctor = doctorFiltered[0];
            
            if (!doctor) {
                console.error("❌ Doctor not found.");
                return;
            }

            // Fill form fields
            document.getElementById('userFirstName').value = doctor.first_name || '';
            document.getElementById('userLastName').value = doctor.last_name || '';
            document.getElementById('userGender').value = doctor.gender || '';
            document.getElementById('userEmail').value = doctor.email || '';
            document.getElementById('userTelephone').value = doctor.Telephone || '';
            document.getElementById('userAddress').value = doctor.Address || '';
        };

        request.onerror = function (e) {
            console.error("❌ Error loading doctor:", e.target.error);
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

async function editDoctor(doctorId, updatedData) {
    // 🔍 Field validation (same structure as patient)
    const fields = [
        { value: userFirstName, id: "userFirstName", message: "Please enter a first name." },
        { value: userLastName, id: "userLastName", message: "Please enter a last name." },
        { value: userGender, id: "userGender", message: "Please enter the gender." },
        { value: userEmail, id: "userEmail", message: "Please enter an email address." },
        { value: userTelephone, id: "userTelephone", message: "Please enter a telephone." },
        { value: userAddress, id: "userAddress", message: "Please enter an address." }
    ];

    for (const field of fields) {
        const input = document.getElementById(field.id);
        const error = document.getElementById(`${field.id}-form-error`);
        if (!field.value) {
            input.style.borderColor = "red";
            error.innerHTML = field.message;
            return;
        } else {
            input.style.borderColor = "";
            error.innerHTML = "";
        }
    }


    try {
        const db = await openClinicDB();
        const tx = db.transaction('doctors', 'readwrite');
        const store = tx.objectStore('doctors');
        const getReq = store.getAll();

        getReq.onsuccess = async function () {

            const encryptedDoctors = getReq.result || [];

            // Decrypt all patients in parallel
            const decryptedDoctors = await Promise.all(
                encryptedDoctors.map(p => decryptDoctorInfo(p))
            );

            const doctorFiltered = decryptedDoctors.filter(d => d.id === parseInt(doctorId)) || [];

            const existingDoctor = doctorFiltered[0];

            const existSameEmail = decryptedDoctors.find(d => d.Email === userEmail);
            if (existSameEmail) {
                const error = document.getElementById("userEmail-form-error");
                error.innerHTML = `Doctor with this email already exists.`;
                return;
            }

            if (!existingDoctor) {
                console.error("❌ Doctor not found.");
                return;
            }

            const updatedDoctor = {
                ...existingDoctor,
                ...updatedData
            };

            const encryptedEditedDoctor = await encryptPatientInfo(updatedDoctor);

            const updateReq = store.put(encryptedEditedDoctor);

            updateReq.onsuccess = function () {
                console.log("✅ Doctor updated successfully.");
                window.location.href = 'users-admin.html';
            };

            updateReq.onerror = function (e) {
                console.error("❌ Failed to update doctor:", e.target.error);
            };
        };

        getReq.onerror = function (e) {
            console.error("❌ Error fetching doctor:", e.target.error);
        };
    } catch (err) {
        console.error("⚠️ Database error:", err);
    }
}

function handleEditUser(event) {
    if (event) event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const role = params.get('role');

    if (!userId || !role) {
        console.error("❌ Missing userId or role in URL.");
        return;
    }


    // Add unique identifier field
    if (role === 'patient') {
        // Collect updated form data
        const updatedData = {
            Title: document.getElementById('userTitle').value,
            First: document.getElementById('userFirstName').value,
            Last: document.getElementById('userLastName').value,
            DOB: document.getElementById('userDOB').value,
            Gender: document.getElementById('userGender').value,
            Email: document.getElementById('userEmail').value,
            Telephone: document.getElementById('userTelephone').value,
            Address: document.getElementById('userAddress').value
        };
        updatedData.NHS = document.getElementById('userNHS').value;
        editPatient(userId, updatedData);
    } else if (role === 'doctor') {
        // Collect updated form data
        const updatedData = {
            first_name: document.getElementById('userFirstName').value,
            last_name: document.getElementById('userLastName').value,
            gender: document.getElementById('userGender').value,
            email: document.getElementById('userEmail').value,
            Telephone: document.getElementById('userTelephone').value,
            Address: document.getElementById('userAddress').value
        };
        editDoctor(userId, updatedData);
    } else {
        console.error("❌ Unknown role:", role);
    }
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-edit')) {
    e.preventDefault();
    const userId = e.target.dataset.id;
    const userRole = e.target.dataset.role; 
    if (userRole === 'doctor') {
        window.location.href = `edit-doctor.html?role=${userRole}&userId=${userId}`;
    } else if (userRole === 'patient') {
        window.location.href = `edit-patient.html?role=${userRole}&userId=${userId}`;
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    const userId = params.get('userId');

    if (userId && role) {
        if (role === 'doctor') {
            loadDoctorForEdit(userId);
        } else if (role === 'patient') {
            loadPatientForEdit(userId);
        }
    }

});

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
let userToDeleteId = null;
let userToDeleteRole = null;

// Attach event listener to delete buttons (dynamic)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    e.preventDefault();
    userToDelete = e.target.dataset.username;
    userToDeleteId = e.target.dataset.id;
    userToDeleteRole = e.target.dataset.role;
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

      request.onsuccess = async function() {

        if (userToDeleteRole !== null ) {

            if (userToDeleteRole === 'patient') {
                await deleteLinkedRecords("medicalRecord", "patientId", userToDeleteId);
                await deleteLinkedRecords("appointments", "patientId", userToDeleteId);
                await deleteLinkedRecords("notifications", "recipientId", userToDeleteId);
                await deleteItem("patients", userToDeleteId);

                fetchAllUserData();
                document.getElementById('deleteModal').classList.add('hidden');
                userToDelete = null;
            } else if (userToDeleteRole === 'doctor') {
                await deleteLinkedRecords("appointments", "doctorId", parseInt(userToDeleteId));
                await deleteLinkedRecords("notifications", "recipientId", parseInt(userToDeleteId));
                await deleteItem("doctors", parseInt(userToDeleteId));

                fetchAllUserData();
                document.getElementById('deleteModal').classList.add('hidden');
                userToDelete = null;
            }
        }

      };

      request.onerror = function() {
        alert('Error deleting user.');
        userToDelete = null;
      };
    } catch (err) {
      console.error('DB error:', err);
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