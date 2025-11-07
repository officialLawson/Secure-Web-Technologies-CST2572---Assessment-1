// sw.js - Service Worker for MedTrack PWA

const CACHE_NAME = 'my-app-v4';
const urlsToCache = [
  // --- HTML Pages ---
  'html/add-appointment.html',
  'html/add-doctor.html',
  'html/add-medical-record.html',
  'html/add-medicine-admin.html', 
  'html/add-medicine.html', 
  'html/add-patient.html',
  'html/appointments-admin.html', 
  'html/appointments-doctor.html', 
  'html/appointments-patient.html', 
  'html/dashboard-admin.html', 
  'html/dashboard-doctor.html', 
  'html/dashboard-patient.html', 
  'html/edit-appointment-doctor.html', 
  'html/edit-appointment-patient.html', 
  'html/edit-doctor.html', 
  'html/edit-medical-record.html', 
  'html/edit-medicine-admin.html',
  'html/edit-medicine.html', 
  'html/edit-patient.html', 
  'html/home.html', 
  'html/login.html', 
  'html/medical-records-doctor.html', 
  'html/medical-records-patient.html', 
  'html/medicines-admin.html', 
  'html/medicines-doctor.html', 
  'html/password.html', 
  'html/profile-view-doctor.html', 
  'html/profile-view-patient.html', 
  'html/settings-doctor.html', 
  'html/settings-patient.html', 
  'html/users-admin.html', 
  'html/users-doctor.html', 
  'html/view-medical-record-doctor.html', 
  'html/view-medical-record.html', 

  // --- CSS ---
  'css/dashboard.css', 
  'css/form.css', 
  'css/home.css', 
  'css/login.css', 
  'css/register.css', 
  'css/table.css', 

  // --- JavaScript ---
  'js/activityLogs.js', 
  'js/addMedicalRecords.js', 
  'js/appointments.js', 
  'js/appointmentsComplete.js', 
  'js/calendar.js', 
  'js/clinicDB.js', 
  'js/D-Lmode.js', 
  'js/dashboard.js', 
  'js/editmedicalrecords.js', 
  'js/exportData.js', 
  'js/fetchFunctions.js', 
  'js/fetchImportData.js', 
  'js/form.js', 
  'js/importLoginData.js', 
  'js/indexdb&JSON.js', 
  'js/login.js', 
  'js/medicalRecords.js', 
  'js/medicines.js', 
  'js/notification.js', 
  'js/password.js', 
  'js/profile.js', 
  'js/settings.js',
  'js/sidebar.js', 
  'js/users.js',

  // --- Images ---
  'images/192x192.png',
  'images/cardiology.jpg', 
  'images/doctor1.jpg', 
  'images/doctor2.jpg', 
  'images/doctor3.jpg', 
  'images/homeBG.jpg', 
  'images/LoginBG.jpg', 
  'images/logo.png', 
  'images/Orthopedic.jpg', 
  'images/pediatrics.jpg', 
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell...');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.warn('Caching failed:', err);
      })
  );
});

//for developing:
self.addEventListener('fetch', event => {
  // Always go to the network first for dev builds
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

//For final code
/*  self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go network-first for JS files
  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Default: cache-first for everything else
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request)
          .then((networkResponse) => {
            const responseClone = networkResponse.clone();
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/html/login.html');
            }
          });
      })
  );
});*/


self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
