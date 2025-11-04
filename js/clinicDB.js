/*clinicDB (IndexedDB)
 - encryption 
 - Fetches JSON from GitHub raw URLs 
 - Stores: admins, doctors, patients, medicines, users, appointments, medicalRecord, notifications
 - Exposes functions for import, register, admin-create-doctor, login, query, clear,etc*/

const DB_NAME = 'clinicDB';
const DB_VERSION = 1;
let db = null;

//  encryption 
// AES Encryption/Decryption using Web Crypto API 
const ENCRYPTION_KEY = 'myEncryptionKey'; // any length string, now auto-hashed
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/*
  Derives a 256-bit AES key using SHA-256 hashing.
  This ensures valid key length even if ENCRYPTION_KEY is short.
 */
async function getCryptoKey() {
  // Hash the string to 32 bytes (256 bits)
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(ENCRYPTION_KEY));
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/*
  Encrypts plain text using AES-GCM.
  Returns an object: { iv: [...], data: [...] }
 */
async function encryptData(plainText) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // unique IV for each encryption
  const key = await getCryptoKey();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText)
  );
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
}

/*
  Decrypts AES-GCM encrypted payloads created by encryptData().
  Expects an object: { iv: [...], data: [...] }
 */
async function decryptData(encryptedObj) {
  if (!encryptedObj || !encryptedObj.iv || !encryptedObj.data) return null;
  try {
    const key = await getCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(encryptedObj.iv) },
      key,
      new Uint8Array(encryptedObj.data)
    );
    return decoder.decode(decrypted);
  } catch (err) {
    console.warn("Decryption failed:", err);
    return null;
  }
}

//  Encryption Helpers for Patient & Doctor Info 

async function encryptPatientInfo(p) {
  const sensitive = {
    Address: p.Address,
    Email: p.Email,
    Telephone: p.Telephone,
    DOB: p.DOB
  };
  p.payload = await encryptData(JSON.stringify(sensitive));
  delete p.Address;
  delete p.Email;
  delete p.Telephone;
  delete p.DOB;
  return p;
}

async function decryptPatientInfo(p) {
  if (p.payload) {
    try {
      const decrypted = await decryptData(p.payload);
      Object.assign(p, JSON.parse(decrypted));
    } catch (err) {
      console.warn("Failed to decrypt patient info:", err);
    }
  }
  return p;
}

async function encryptDoctorInfo(d) {
  const sensitive = {
    Email: d.Email,
    Address: d.Address,
    Telephone: d.Telephone
  };
  d.payload = await encryptData(JSON.stringify(sensitive));
  delete d.Email;
  delete d.Address;
  delete d.Telephone;
  return d;
}

async function decryptDoctorInfo(d) {
  if (d.payload) {
    try {
      const decrypted = await decryptData(d.payload);
      Object.assign(d, JSON.parse(decrypted));
    } catch (err) {
      console.warn("Failed to decrypt doctor info:", err);
    }
  }
  return d;
}


//  raw URLs 
const JSON_URLS = {
  admins:  'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/admin.json',
  doctors: 'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/doctors.json',
  patients:'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/patients.json',
  medicines:'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/medicines.json',
  users:'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/users.json',
  medicalRecord: 'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/medicalrecord.json',
  appointment: 'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/appointment.json',
  notification:'https://raw.githubusercontent.com/officialLawson/Secure-Web-Technologies-CST2572---Assessment-1/refs/heads/new-branch/notif.json'
};

// Local caches (populated by fetch)
let admin_data = null;
let doctor_data = null;
let patient_data = null;
let medicine_data = null;
let users_data = null;
let medicalRecord_data = null;
let appointment_data = null;
let notification_data = null;

//Open/Create db
function openClinicDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // users store (login validation)
      if (!db.objectStoreNames.contains('users')) {
        const users = db.createObjectStore('users', { keyPath: 'username' });
        users.createIndex('username', 'username', { unique: true });
        users.createIndex('password', 'password', { unique: false });
        users.createIndex('role', 'role', { unique: false });
      }

      // admins 
      if (!db.objectStoreNames.contains('admins')) {
        const admins = db.createObjectStore('admins', { keyPath: 'username' });
        admins.createIndex('username', 'username', { unique: true });
        admins.createIndex('password','password',{unique: false})
      }

      // doctors
      if (!db.objectStoreNames.contains('doctors')) {
        const doctors = db.createObjectStore('doctors', { keyPath: 'id' });
        doctors.createIndex('first_name', 'first_name', { unique: false });
        doctors.createIndex('last_name', 'last_name', { unique: false });
        doctors.createIndex('email', 'email', { unique: false });
        doctors.createIndex('gender','gender',{unique: false});
        doctors.createIndex('Address','Address',{unique: false});
        doctors.createIndex('Telephone','Telephone',{unique: false});
      }

      // patients 
      // JSON contains numeric "id" and string "NHS" —  key =NHS for validation
      if (!db.objectStoreNames.contains('patients')) {
        const patients = db.createObjectStore('patients', { keyPath: 'NHS' });
        patients.createIndex('id', 'id', { unique: false });
        patients.createIndex('title','title',{unique: false});
        patients.createIndex('First', 'First', { unique: false });
        patients.createIndex('Last', 'Last', { unique: false });
        patients.createIndex('DOB','DOB',{unique: false});
        patients.createIndex('Gender','Gender',{unique: false});
        patients.createIndex('Address','Address',{unique: false});
        patients.createIndex('Email', 'Email', { unique: false });
        patients.createIndex('Telephone','Telephone',{unique: false});
      }
 
      // medicines 
      if (!db.objectStoreNames.contains('medicines')) {
        const medicines = db.createObjectStore("medicines", { keyPath: "id", autoIncrement: true });
        medicines.createIndex('drugs','drugs',{unique: false});
      }

      // appointments
      if (!db.objectStoreNames.contains('appointments')) {
        const appts = db.createObjectStore('appointments', { keyPath: 'appointmentId'});
        appts.createIndex('patientId', 'patientId', { unique: false });
        appts.createIndex('doctorId', 'doctorId', { unique: false });
        appts.createIndex('date','date' ,{ unique: false });
        appts.createIndex('time','time', { unique: false });
        appts.createIndex('reason','reason', { unique: false });
        appts.createIndex('status','status',{unique:false})
      }
      //medical records
      if (!db.objectStoreNames.contains('medicalRecord')) {
        const records = db.createObjectStore('medicalRecord', { keyPath: 'recordId' });
        records.createIndex('patientId', 'patientId', { unique: false });
        records.createIndex('doctorId', 'doctorId', { unique: false });
        records.createIndex("diagnosis","diagnosis",{ unique: false });
        records.createIndex("treatment","treatment",{ unique: false });
        records.createIndex("dateTime", "dateTime", { unique: false })
      }
      //notif
      if (!db.objectStoreNames.contains('notifications')) {
        const notifs = db.createObjectStore('notifications', { keyPath: 'notifId'});
        notifs.createIndex('recipientRole', 'recipientRole', { unique: false });
        notifs.createIndex('recipientId', 'recipientId', { unique: false });
        notifs.createIndex('message', 'message', { unique: false });
        notifs.createIndex('date', 'date', { unique: false });
        notifs.createIndex('read', 'read', { unique: false });
        
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

async function getItem(storeName, key) {
  if (!db) throw new Error("DB not opened");
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = async (e) => {
      let result = e.target.result;
      if (!result) return resolve(null);

      // Auto-decrypt for patients and doctors
      if (storeName === "patients") result = await decryptPatientInfo(result);
      else if (storeName === "doctors") result = await decryptDoctorInfo(result);

      resolve(result);
    };
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

//read patient medical records by id
// Get records by patientId and decrypt payload 
function getRecordsByPatientId(patientId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('medicalRecord', 'readonly');
    const store = tx.objectStore('medicalRecord');
    const index = store.index('patientId');
    const request = index.getAll(patientId);

    request.onsuccess = async () => {
      try {
        const raw = request.result || [];
        // decrypt payloads in parallel
        const decrypted = await Promise.all(raw.map(async (r) => {
          if (r.payload) {
            const plain = await decryptData(r.payload);
            if (plain) {
              try {
                const sensitive = JSON.parse(plain);
                return {
                  recordId: r.recordId,
                  patientId: r.patientId,
                  doctorId: r.doctorId,
                  dateTime: r.dateTime,
                  diagnosis: sensitive.diagnosis,
                  treatment: sensitive.treatment,
                  notes: sensitive.notes
                };
              } catch (e) {
                // if JSON parse fails, just return raw payload as text
                return {
                  recordId: r.recordId,
                  patientId: r.patientId,
                  doctorId: r.doctorId,
                  dateTime: r.dateTime,
                  diagnosis: plain,
                  treatment: "",
                  notes: ""
                };
              }
            }
          }
          // if no payload, return the object as-is (backwards compatibility)
          return r;
        }));
        resolve(decrypted);
      } catch (err) {
        reject(err);
      }
    };

    request.onerror = (e) => reject(e);
  });
}

//see all appointments or patients they’re handling (for doctor)
function getAppointmentsByDoctorId(doctorId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('appointments', 'readonly');
    const store = tx.objectStore('appointments');
    const index = store.index('doctorId');
    const request = index.getAll(doctorId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

//Read notifications by role or recipient
function getNotifications(roleOrId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readonly');
    const store = tx.objectStore('notifications');

    // Try by role first
    const roleIndex = store.index('recipientRole');
    const reqRole = roleIndex.getAll(roleOrId);

    reqRole.onsuccess = () => {
      if (reqRole.result.length > 0) return resolve(reqRole.result);

      // Otherwise, try by specific ID
      const idIndex = store.index('recipientId');
      const reqId = idIndex.getAll(roleOrId);

      reqId.onsuccess = () => resolve(reqId.result);
      reqId.onerror = reject;
    };
    reqRole.onerror = reject;
  });
}

// Deleting all the linked records
async function deleteLinkedRecords(tableName, indexName, linkedId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tableName, "readwrite");
    const store = tx.objectStore(tableName);

    // Check if the index exists
    if (!store.indexNames.contains(indexName)) {
      return reject(new Error(`Index "${indexName}" not found in "${tableName}"`));
    }

    const index = store.index(indexName);
    const request = index.getAllKeys(linkedId);

    request.onsuccess = () => {
      const keys = request.result;

      if (!keys.length) {
        return resolve(`No records found in "${tableName}" for ${indexName} = ${linkedId}`);
      }

      let deletedCount = 0;

      keys.forEach(key => {
        const deleteReq = store.delete(key);
        deleteReq.onsuccess = () => {
          deletedCount++;
          if (deletedCount === keys.length) {
            resolve(`✅ Deleted ${deletedCount} record(s) from "${tableName}"`);
          }
        };
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    };

    request.onerror = () => reject(request.error);
  });
}


// Deleting Patient and all records
async function deletePatientCompletely(patientId) {
  const results = [];

  results.push(await deleteLinkedRecords("medicalRecord", "patientId", patientId));
  results.push(await deleteLinkedRecords("appointments", "patientId", patientId));
  results.push(await deleteLinkedRecords("notifications", "recipientId", patientId));
  results.push(await deleteLinkedRecords("users", "linkedId", patientId));
  results.push(await deleteLinkedRecords("patients", "NHS", patientId));

}


//Doctor Dashboard Loader
async function loadDoctorDashboard(doctorId) {
  try {
    // Fetch all data in parallel
    const [appointments, notifications] = await Promise.all([
      getAppointmentsByDoctorId(doctorId),
      getNotifications(doctorId)
    ]);

    console.log(`Appointments for Doctor ${doctorId}:`, appointments);
    console.log(`Notifications for Doctor ${doctorId}:`, notifications);

    // Optionally, return them as a single object
    return { appointments, notifications };

  } catch (err) {
    console.error("Error loading doctor dashboard:", err);
  }
}

//Patient Dashboard Loader
async function loadPatientDashboard(patientId) {
  try {
    const [records, appointments, notifications] = await Promise.all([
      getRecordsByPatientId(patientId),
      getAppointmentsByPatientId(patientId),
      getNotifications(patientId)
    ]);

    console.log(`Medical Records for Patient ${patientId}:`, records);
    console.log(`Appointments for Patient ${patientId}:`, appointments);
    console.log(`Notifications for Patient ${patientId}:`, notifications);

    return { records, appointments, notifications };

  } catch (err) {
    console.error("Error loading patient dashboard:", err);
  }
}

// Helper for appointments by patient (similar to doctor one)
function getAppointmentsByPatientId(patientId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('appointments', 'readonly');
    const store = tx.objectStore('appointments');
    const index = store.index('patientId');
    const request = index.getAll(patientId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}

//admin Dashboard Loader
async function loadAdminDashboard() {
  try {
    const [doctors, patients, appointments, records, notifications] = await Promise.all([
      getAllItems('doctors'),
      getAllItems('patients'),
      getAllItems('appointments'),
      getAllItems('medicalRecord'),
      getNotifications("admin")
    ]);

    console.log("Doctors:", doctors);
    console.log("Patients:", patients);
    console.log("Appointments:", appointments);
    console.log("Medical Records:", records);
    console.log("Admin Notifications:", notifications);

    return { doctors, patients, appointments, records, notifications };
  } catch (err) {
    console.error("Error loading admin dashboard:", err);
  }
}

// ---------- Add encrypted medical record helper ----------
async function addMedicalRecord(record) {
  // record must include: recordId, patientId, doctorId, date, diagnosis, treatment (diagnosis/treatment will be encrypted)
  if (!db) throw new Error("DB not opened");
  if (!record || !record.recordId) throw new Error("record.recordId required");

  // Build the stored object: keep indexes (recordId, patientId, doctorId, date) in plain text
  const { recordId, patientId, doctorId, dateTime, prescriptions } = record;
  const sensitive = {
    diagnosis: record.diagnosis || "",
    treatment: record.treatment || "",
  };

  const encryptedPayload = await encryptData(JSON.stringify(sensitive));

  const stored = {
    recordId,
    patientId,
    doctorId,
    dateTime,
    prescriptions,
    payload: encryptedPayload
  };

  return addItem('medicalRecord', stored);
}

// ---------- Decrypt medical record ---------------
async function decryptMedicalRecord(d) {
  if (d.payload) {
    try {
      const decrypted = await decryptData(d.payload);
      Object.assign(d, JSON.parse(decrypted));
    } catch (err) {
      console.warn("Failed to decrypt medical record:", err);
    }
  }
  return d;
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
  const [admins, doctors, patients, medicines,users,medicalRecord,appointment,notification] = await Promise.all([
    fetchJson(urls.admins).catch(err => { console.error('admins fetch error', err); return []; }),
    fetchJson(urls.doctors).catch(err => { console.error('doctors fetch error', err); return []; }),
    fetchJson(urls.patients).catch(err => { console.error('patients fetch error', err); return []; }),
    fetchJson(urls.medicines).catch(err => { console.error('medicines fetch error', err); return []; }),
    fetchJson(urls.users).catch(err => {console.error('users fetch error',err); return[];}),
    fetchJson(urls.medicalRecord).catch(err => {console.error('medical Record fetch error',err); return[]}),
    fetchJson(urls.appointment).catch(err => {console.error('appointment fetch error',err); return []}),
    fetchJson(urls .notification).catch(err => {console.error('notif fetch error', err); return[]}),

  ]);

  admin_data = admins;
  doctor_data = doctors;
  patient_data = patients;
  medicine_data = medicines;
  users_data = users;
  medicalRecord_data=medicalRecord;
  appointment_data=appointment;
  notification_data=notification;

  console.log('All JSONs fetched (cached locally):');
  return {
    admins,
    doctors,
    patients,
    medicines,
    users,
    medicalRecord,
    appointment,
    notification
  };

}

/* =============================
   🧠 Filter Data by User Role
   ============================= */
async function filterDataForUser(allData, user) {
  // Ensure all tables exist
  const {
    patients = [],
    doctors = [],
    admins = [],
    medicines = [],
    users = [],
    medicalRecord = [],
    appointment = [],
    notification = []
  } = allData || {};


  const role = user.role?.toLowerCase();


  // Initialize filtered object
  const filtered = {};

  switch (role) {
    case 'admin':
      // Admins see everything
      filtered.admins = admins;
      filtered.doctors = doctors;
      filtered.patients = patients;
      filtered.medicines = medicines;
      filtered.users = users;
      filtered.medicalRecord = medicalRecord;
      filtered.appointment = appointment;
      filtered.notification = notification.filter(
        n => n.recipientRole === 'admin' && n.recipientId === user.username
      );
      break;

    case 'doctor':
      filtered.doctors = doctors;
      filtered.patients = patients; // all patients visible
      filtered.medicalRecord = medicalRecord;
      filtered.appointment = appointment.filter(a => a.doctorId === user.linkedId);
      filtered.medicines = medicines; // all medicines visible
      filtered.notification = notification.filter(
        n => n.recipientRole === 'doctor' && n.recipientId === user.linkedId
      );
      filtered.users = users; // optional, depending on your logic
      filtered.admins = admins; // optional
      break;

    case 'patient':
      filtered.patients = patients.filter(p => p.NHS === user.linkedId);
      filtered.medicalRecord = medicalRecord.filter(
        r => r.patientId === user.linkedId
      );
      filtered.appointment = appointment.filter(
        a => a.patientId === user.linkedId
      );
      filtered.notification = notification.filter(
        n => n.recipientRole === 'patient' && n.recipientId === user.linkedId
      );
      filtered.medicines = medicines; // all medicines visible
      filtered.doctors = doctors; // all doctors visible
      // Hide other tables
      filtered.admins = [];
      filtered.users = [];
      break;

    default:
      console.warn('Unknown role, importing nothing.');
      return {};
  }

  
  return filtered;
}

/* =============================
   🧠 Set All Data
   ============================= */
async function allDataForUser(allData) {

  try{
    // Ensure all tables exist
    const {
      patients = [],
      doctors = [],
      admins = [],
      medicines = [],
      users = [],
      medicalRecord = [],
      appointment = [],
      notification = []
    } = allData || {};

    // Initialize filtered object
    const filtered = {};

    
    filtered.admins = admins;
    filtered.doctors = doctors;
    filtered.patients = patients;
    filtered.medicines = medicines;
    filtered.users = users;
    filtered.medicalRecord = medicalRecord;
    filtered.appointment = appointment;
    filtered.notification = notification;

    return filtered;
  } catch (err) {
    console.log(err);
  }
}

// Import filtered data into IndexedDB
async function importFetchedDataToDB(filteredData) {
  if (!db) throw new Error('DB not opened. Call openClinicDB() first.');

  const results = {
    admins: 0,
    doctors: 0,
    patients: 0,
    medicines: 0,
    users: 0,
    medicalRecord: 0,
    appointment: 0,
    notification: 0
  };

  const {
    admins = [],
    doctors = [],
    patients = [],
    medicines = [],
    users = [],
    medicalRecord = [],
    appointment = [],
    notification = []
  } = filteredData || {};

  // Doctors
  for (const d of doctors) {
    try {
      if (!d.id) continue;
      const encryptedDoctor = await encryptDoctorInfo(d);
      await addItem('doctors', encryptedDoctor);
      results.doctors++;
    } catch (err) {
      console.warn('Skipping doctor (exists?):', d.id, err);
    }
  }

  // Patients
  for (const p of patients) {
    try {
      if (!p.NHS) continue;
      const encryptedPatient = await encryptPatientInfo(p);
      await addItem('patients', encryptedPatient);
      results.patients++;
    } catch (err) {
      console.warn('Skipping patient (exists?):', p.NHS, err);
    }
  }

  // Medical records
  for (const r of medicalRecord) {
    try {
      if (!r.recordId) continue;
      const toAdd = {
        recordId: r.recordId,
        patientId: r.patientId || r.NHS || null,
        doctorId: r.doctorId || null,
        dateTime: r.dateTime || r.DateTime || null,
        diagnosis: r.diagnosis || r.Diagnosis || "",
        treatment: r.treatment || r.Treatment || "",
        prescriptions: r.prescriptions || []
      };
      await addMedicalRecord(toAdd);
      results.medicalRecord++;
    } catch (err) {
      console.warn('Skipping medical record (exists?):', r.recordId, err);
    }
  }

  // Appointments
  for (const a of appointment) {
    try {
      if (!a.appointmentId) continue;
      await addItem('appointments', a);
      results.appointment++;
    } catch (err) {
      console.warn('Skipping appointment (exists?):', a.appointmentId);
    }
  }

  // Notifications
  for (const n of notification) {
    try {
      if (!n.notifId) continue;
      await addItem('notifications', n);
      results.notification++;
    } catch (err) {
      console.warn('Skipping notification (exists?):', n.notifId, err);
    }
  }

  // Medicines
  for (const m of medicines) {
    try {
      if (m.id === undefined || m.id === null) continue;
      await addItem('medicines', m);
      results.medicines++;
    } catch (err) {
      console.warn('Skipping medicine (exists?):', m.id, err);
    }
  }

  return results;
}


//Registration / Creation / Login with encryption-cryptography


// Encrypt passwords before storing
async function registerPatientAccount(username, password, patientNHS) {
  if (!db) throw new Error('DB not opened');
  if (!username || !password || !patientNHS)
    throw new Error('username, password, and patientNHS are required');

  const p = await getItem('patients', patientNHS);
  if (!p) throw new Error(`No patient record found for NHS: ${patientNHS}`);

  const tx = db.transaction('users', 'readonly');
  const idx = tx.objectStore('users').index('username');
  const existing = await new Promise((res, rej) => {
    const r = idx.get(username);
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => rej(r.error);
  });
  if (existing) throw new Error('Username already exists');

  const encryptedPass = await encryptData(password);

  const user = {
    username,
    password: encryptedPass,
    role: 'patient',
    linkedId: patientNHS,
    createdAt: new Date().toISOString()
  };

  await addItem('users', user);
  console.log('✅ Encrypted patient account created');
  return { user };
}

async function createDoctorAccountByAdmin(adminUsername, doctorId, usernameForDoctor, password) {
  if (!db) throw new Error('DB not opened');
  const admin = await getItem('admins', adminUsername);
  if (!admin) throw new Error('Admin not found');
  const doc = await getItem('doctors', doctorId);
  if (!doc) throw new Error('Doctor record not found');

  const tx = db.transaction('users', 'readonly');
  const idx = tx.objectStore('users').index('username');
  const existing = await new Promise((res, rej) => {
    const r = idx.get(usernameForDoctor);
    r.onsuccess = e => res(e.target.result);
    r.onerror = () => rej(r.error);
  });
  if (existing) throw new Error('Username already exists');

  const encryptedPass = await encryptData(password);

  const user = {
    username: usernameForDoctor,
    password: encryptedPass,
    role: 'doctor',
    linkedId: doctorId,
    createdAt: new Date().toISOString()
  };

  await addItem('users', user);
  console.log('✅ Encrypted doctor account created');
  return { user };
}


// login
async function login(username, password) {
  if (!db) throw new Error('DB not opened');
  if (!username || !password)
    return { success: false, message: 'Please enter both username and password.' };

  const tx = db.transaction('users', 'readonly');
  const store = tx.objectStore('users');
  const index = store.index('username');

  const user = await new Promise((resolve, reject) => {
    const req = index.get(username);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });

  if (!user) return { success: false, message: 'User not found.' };

  let storedPass = user.password;
  if (storedPass && storedPass.iv && storedPass.data) {
    storedPass = await decryptData(storedPass);
  }

  if (storedPass !== password)
    return { success: false, message: 'Invalid password.' };

  console.log(`🔐 Secure login success as ${user.role}`);
  return { success: true, userRecord: user, role: user.role, message: 'Login successful!' };
}




//Clear / Query / Show Helpers 

// clearData(storeNames) - clears listed stores; if omitted clears medical/doctors/patients/medicines

async function clearData(storeNames = ['medicalRecord','doctors','patients','medicines','appointments','notifications']) {
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
  await showFirstN('patients', 5); // logs first 5 patients
  // registerPatientAccount('p@example.com','pass123','6538586104').then(console.log).catch(console.error);
  // createDoctorAccountByAdmin('sheilah', 1, 'dr_violante', 'docpass').then(console.log).catch(console.error);
})();

*/

// Expose for global access from UI /
window.clinicDB = {
  openClinicDB,
  fetchAllJsons,
  filterDataForUser,
  allDataForUser,
  importFetchedDataToDB,
  registerPatientAccount,
  createDoctorAccountByAdmin,
  login,
  clearData,
  queryAllAndLog,
  showFirstN,
  getItem,            
  getAllItems,        
  addItem,           
  updateItem,         
  deleteItem, 
  getRecordsByPatientId,
  getAppointmentsByPatientId,
  getAppointmentsByDoctorId,
  getNotifications,
  loadDoctorDashboard,
  loadPatientDashboard,
  loadAdminDashboard,
  addMedicalRecord,
  encryptData,
  decryptData,
  closeDB,
  // caches for debugging
  _caches: () => ({ admin_data, doctor_data, patient_data, medicine_data }),
  JSON_URLS
};