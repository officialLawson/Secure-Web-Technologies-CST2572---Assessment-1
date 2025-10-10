/*clinicDB (IndexedDB)
 - No encryption 
 - Fetches JSON from GitHub raw URLs (placeholders)
 - Stores: admins, doctors, patients, medicines, users, appointments, medicalRecords, notifications
 - Exposes functions for import, register, admin-create-doctor, login, query, clear*/

const DB_NAME = 'clinicDB';
const DB_VERSION = 1;
let db = null;

// Optional encryption placeholder (for future use)
const ENCRYPTION_KEY = 'myEncryptionKey'; 

// Placeholder raw URLs 
const JSON_URLS = {
  admins:  'https://raw.githubusercontent.com/YourUser/YourRepo/main/admin.json',
  doctors: 'https://raw.githubusercontent.com/YourUser/YourRepo/main/doctors.json',
  patients:'https://raw.githubusercontent.com/YourUser/YourRepo/main/patients.json',
  medicines:'https://raw.githubusercontent.com/YourUser/YourRepo/main/medicines.json'
};

// Local caches (populated by fetch)
let admin_data = null;
let doctor_data = null;
let patient_data = null;
let medicine_data = null;

//Open/Create db
function openClinicDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const dbx = e.target.result;

      // users store (login validation)
      if (!dbx.objectStoreNames.contains('users')) {
        const users = dbx.createObjectStore('users', { keyPath: 'userId', autoIncrement: true });
        users.createIndex('username', 'username', { unique: true });
        users.createIndex('email', 'email', { unique: true });
        users.createIndex('role', 'role', { unique: false });
        users.createIndex('linkedId', 'linkedId', { unique: false }); // e.g., patient NHS, doctor id, admin username
      }

      // admins 
      if (!dbx.objectStoreNames.contains('admins')) {
        const admins = dbx.createObjectStore('admins', { keyPath: 'username' });
        admins.createIndex('username', 'username', { unique: true });
        admins.createIndex('password','password',{unique: false})
      }

      // doctors
      if (!dbx.objectStoreNames.contains('doctors')) {
        const doctors = dbx.createObjectStore('doctors', { keyPath: 'id' });
        doctors.createIndex('first_name', 'first_name', { unique: false });
        doctors.createIndex('last_name', 'last_name', { unique: false });
        doctors.createIndex('email', 'email', { unique: false });
        doctors.createIndex('gender','gender',{unique: false});
        doctors.createIndex('address','address',{unique: false});
        doctors.createIndex('telephone','telephone',{unique: false});
      }

      // patients 
      // JSON contains numeric "id" and string "NHS" —  key =NHS for validation
      if (!dbx.objectStoreNames.contains('patients')) {
        const patients = dbx.createObjectStore('patients', { keyPath: 'NHS' });
        patients.createIndex('id', 'id', { unique: false });
        patients.createIndex('Title','title',{unique: false});
        patients.createIndex('First', 'First', { unique: false });
        patients.createIndex('Last', 'Last', { unique: false });
        patients.createIndex('DOB','DOB',{unique: false});
        patients.createIndex('Gender','Gender',{unique: false});
        patients.createIndex('Address','Address',{unique: false});
        patients.createIndex('Email', 'Email', { unique: false });
        patients.createIndex('Telephone','Telephone',{unique: false});
      }

      // medicines 
      if (!dbx.objectStoreNames.contains('medicines')) {
        const medicines = dbx.createObjectStore('medicines', { keyPath: 'id' });
        medicines.createIndex('drugs','drugs',{unique: false});
      }

      // appointments
      if (!dbx.objectStoreNames.contains('appointments')) {
        const appts = dbx.createObjectStore('appointments', { keyPath: 'appointmentId', autoIncrement: true });
        appts.createIndex('doctorId', 'doctorId', { unique: false });
        appts.createIndex('patientNHS', 'patientNHS', { unique: false });
        appts.createIndex("startIso", "startIso", { unique: false });
      }
      //medical records
      if (!dbx.objectStoreNames.contains('medicalRecords')) {
        const records = dbx.createObjectStore('medicalRecords', { keyPath: 'recordId', autoIncrement: true });
        records.createIndex('patientNHS', 'patientNHS', { unique: false });
        records.createIndex('doctorId', 'doctorId', { unique: false });
        records.createIndex("date", "date", { unique: false })
      }
      //notif
      if (!dbx.objectStoreNames.contains('notifications')) {
        const notifs = dbx.createObjectStore('notifications', { keyPath: 'notifId', autoIncrement: true });
        notifs.createIndex('userId', 'userId', { unique: false });
        notifs.createIndex("type", "type", { unique: false });
      }

      console.log('[onupgradeneeded] clinicDB stores created/updated');
    };

    req.onsuccess = (e) => {
      db = e.target.result;
      db.onversionchange = () => {
        db.close();
        alert('Database is outdated — reload the page.');
      };
      console.log('clinicDB opened successfully');
      resolve(db);
    };

    req.onerror = (e) => {
      console.error('Error opening clinicDB:', req.error);
      reject(req.error);
    };
  });
}

//  CRUD helpers
function addItem(storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(item);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = () => reject(req.error);
  });
}
//update item
function updateItem( storeName, item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getItem(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllItems(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const idx = store.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteItem(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Fetch JSONs (from GitHub raw) 
async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch failed for ${url}: ${resp.status}`);
  return resp.json();
}

/* Fetch all JSON files and cache locally (admin_data, doctor_data, patient_data, medicine_data) */
async function fetchAllJsons(urls = JSON_URLS) {
  // parallel fetch
  const [admins, doctors, patients, medicines] = await Promise.all([
    fetchJson(urls.admins).catch(err => { console.error('admins fetch error', err); return []; }),
    fetchJson(urls.doctors).catch(err => { console.error('doctors fetch error', err); return []; }),
    fetchJson(urls.patients).catch(err => { console.error('patients fetch error', err); return []; }),
    fetchJson(urls.medicines).catch(err => { console.error('medicines fetch error', err); return []; })
  ]);

  admin_data = admins;
  doctor_data = doctors;
  patient_data = patients;
  medicine_data = medicines;

  console.log('All JSONs fetched (cached locally)');
  return { admins, doctors, patients, medicines };
}

//Import fetched JSON into IndexedDB 
async function importFetchedDataToDB() {
  if (!db) throw new Error('DB not opened. Call openClinicDB() first.');

  const results = { admins:0, doctors:0, patients:0, medicines:0 };

  // admins: expects array of { username, password, ... }
  if (Array.isArray(admin_data)) {
    for (const a of admin_data) {
      try {
        if (!a.username) continue;
        // store as-is; keyPath is username in admins store
        await addItem('admins', a);
        results.admins++;
      } catch (err) {
        console.warn('Skipping admin (exists?):', a.username, err);
      }
    }
  }

  // doctors: expects array with id, first_name, last_name, email, Address, Telephone
  if (Array.isArray(doctor_data)) {
    for (const d of doctor_data) {
      try {
        if (d.id === undefined || d.id === null) continue;
        await addItem('doctors', d);
        results.doctors++;
      } catch (err) {
        console.warn('Skipping doctor (exists?):', d.id, err);
      }
    }
  }

  // patients: expects array with id and NHS (we key on NHS)
  if (Array.isArray(patient_data)) {
    for (const p of patient_data) {
      try {
        if (!p.NHS) continue;
        await addItem('patients', p); // key is p.NHS
        results.patients++;
      } catch (err) {
        console.warn('Skipping patient (exists?):', p.NHS, err);
      }
    }
  }

  // medicines: expects array with id and Drug
  if (Array.isArray(medicine_data)) {
    for (const m of medicine_data) {
      try {
        if (m.id === undefined || m.id === null) continue;
        await addItem('medicines', m);
        results.medicines++;
      } catch (err) {
        console.warn('Skipping medicine (exists?):', m.id, err);
      }
    }
  }

  console.log('Import completed', results);
  return results;
}

//Convenience: fetch all JSONs then import them into DB 
async function fetchAndImportAll(urls = JSON_URLS) {
  if (!db) throw new Error('DB not opened');
  await fetchAllJsons(urls);
  return importFetchedDataToDB();
}











//Registration / Creation / Login 

/*registerPatientAccount(email, password, patientNHS)
  - validates that patientNHS exists in patients store
  - ensures email is unique in users store
  - creates a user with role 'patient' and linkedId = patientNHS*/

async function registerPatientAccount(email, password, patientNHS) {
  if (!db) throw new Error('DB not opened');
  if (!email || !password || !patientNHS) throw new Error('email, password and patientNHS are required');

  // validate patient exists
  const p = await getItem('patients', patientNHS);
  if (!p) throw new Error(`No patient record found for NHS: ${patientNHS}`);

  // ensure email unique in users
  try {
    const tx = db.transaction('users', 'readonly');
    const idx = tx.objectStore('users').index('email');
    const existing = await new Promise((res, rej) => {
      const r = idx.get(email);
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej(r.error);
    });
    if (existing) throw new Error('Email already in use');
  } catch (err) {
    if (err.message === 'Email already in use') throw err;
    // otherwise, ok to proceed
  }

  const user = {
    username: null, // patients authenticating by email
    email,
    password, // plain text for assignment demo (Option B)
    role: 'patient',
    linkedId: patientNHS,
    createdAt: new Date().toISOString()
  };

  const userId = await addItem('users', user);
  console.log('Patient user registered with userId:', userId);
  return { userId, user };
}

/**
 * createDoctorAccountByAdmin(adminUsername, doctorId, usernameForDoctor, password)
 * - adminUsername must exist in admins store
 * - doctorId must exist in doctors store
 * - usernameForDoctor must be unique in users store
 * - creates a user with role 'doctor' and linkedId = doctorId
 */
async function createDoctorAccountByAdmin(adminUsername, doctorId, usernameForDoctor, password) {
  if (!db) throw new Error('DB not opened');
  if (!adminUsername || !doctorId || !usernameForDoctor || !password) throw new Error('missing arguments');

  // verify admin exists
  const admin = await getItem('admins', adminUsername);
  if (!admin) throw new Error('Admin not found or not authorized');

  // verify doctor exists
  const doc = await getItem('doctors', doctorId);
  if (!doc) throw new Error('Doctor record not found');

  // ensure username unique
  try {
    const tx = db.transaction('users', 'readonly');
    const idx = tx.objectStore('users').index('username');
    const existing = await new Promise((res, rej) => {
      const r = idx.get(usernameForDoctor);
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej(r.error);
    });
    if (existing) throw new Error('Username already exists');
  } catch (err) {
    if (err.message === 'Username already exists') throw err;
  }

  const user = {
    username: usernameForDoctor,
    email: doc.email || null,
    password, // plain text for demo
    role: 'doctor',
    linkedId: doctorId,
    createdAt: new Date().toISOString()
  };

  const userId = await addItem('users', user);
  console.log('Doctor user created by admin, userId:', userId);
  return { userId, user };
}

/* login(identifier, password)
 - identifier: username (for admin/doctor) or email (for patient)
 - password: plain text
  - returns { success, message, userRecord, redirect } (redirect is a sample path)*/

async function login(identifier, password) {
  if (!db) throw new Error('DB not opened');
  if (!identifier || !password) return { success:false, message:'identifier and password required' };

  // try username lookup first
  let found = null;
  try {
    const tx = db.transaction('users', 'readonly');
    const idx = tx.objectStore('users').index('username');
    found = await new Promise((res) => {
      const r = idx.get(identifier);
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => res(null);
    });
  } catch (err) {
    found = null;
  }

  // if not found by username, try email
  if (!found) {
    try {
      const tx2 = db.transaction('users', 'readonly');
      const idx2 = tx2.objectStore('users').index('email');
      found = await new Promise((res) => {
        const r = idx2.get(identifier);
        r.onsuccess = e => res(e.target.result);
        r.onerror = () => res(null);
      });
    } catch (err) {
      found = null;
    }
  }

  if (!found) return { success:false, message:'User not found' };

  if (found.password !== password) return { success:false, message:'Invalid password' };

  // sample redirect paths - caller should handle actual navigation
  const redirect = found.role === 'admin' ? '/admin.html' :
                   found.role === 'doctor' ? '/doctor.html' :
                   found.role === 'patient' ? '/patient.html' : '/';

  console.log('Login success for userId', found.userId, 'role', found.role);
  return { success:true, message:'Login success', userRecord:found, redirect };
}

//Clear / Query / Show Helpers 

// clearData(storeNames) - clears listed stores; if omitted clears admins/doctors/patients/medicines
 
async function clearData(storeNames = ['admins','doctors','patients','medicines']) {
  if (!db) throw new Error('DB not opened');
  const results = {};
  for (const s of storeNames) {
    try {
      await new Promise((res, rej) => {
        const tx = db.transaction(s, 'readwrite');
        const store = tx.objectStore(s);
        const r = store.clear();
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
      results[s] = 'cleared';
    } catch (err) {
      results[s] = `error: ${err.message || err}`;
    }
  }
  console.log('clearData results:', results);
  return results;
}

// Log everything in a store to console 
async function queryAllAndLog(storeName) {
  const items = await getAllItems(storeName);
  console.log(`All items in ${storeName}:`, items);
  return items;
}

// Show first N in a store (optionally into containerId) 
async function showFirstN(storeName, n = 10, containerId = null) {
  const all = await getAllItems(storeName);
  const sample = all.slice(0, n);
  if (containerId) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = `<pre>${JSON.stringify(sample, null, 2)}</pre>`;
    else console.warn('container not found:', containerId);
  } else {
    console.log(`${storeName} sample:`, sample);
  }
  return sample;
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
    console.log('clinicDB closed');
  }
}

/*  Example quick-run  

(async () => {
  await openClinicDB();
  await fetchAndImportAll(); // uses JSON_URLS placeholders
  await showFirstN('patients', 5); // logs first 5 patients
  // registerPatientAccount('p@example.com','pass123','6538586104').then(console.log).catch(console.error);
  // createDoctorAccountByAdmin('sheilah', 1, 'dr_violante', 'docpass').then(console.log).catch(console.error);
})();

*/

// Expose for global access from UI /
window.clinicDB = {
  openClinicDB,
  fetchAllJsons,
  importFetchedDataToDB,
  fetchAndImportAll,
  registerPatientAccount,
  createDoctorAccountByAdmin,
  login,
  clearData,
  queryAllAndLog,
  showFirstN,
  closeDB,
  // caches for debugging
  _caches: () => ({ admin_data, doctor_data, patient_data, medicine_data }),
  JSON_URLS
};
