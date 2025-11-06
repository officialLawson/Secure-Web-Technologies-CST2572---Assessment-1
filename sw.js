// sw.js - Service Worker for MedTrack PWA

const CACHE_NAME = 'medtrack-v1';
const urlsToCache = [
  // --- HTML Pages ---
  '/html/dashboard-patient.html',
  '/html/medical-records-patient.html',
  '/html/view-medical-record.html',
  '/html/appointments-patient.html',
  '/html/profile-view-patient.html',
  '/html/login.html',
  '/html/register.html',

  // --- CSS ---
  '/css/dashboard.css',
  '/css/table.css',
  '/css/form.css',

  // --- JavaScript ---
  '/js/clinicDB.js',
  '/js/medicalRecords.js',
  '/js/sidebar.js',
  '/js/D-Lmode.js',
  '/js/notification.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js',

  // --- Images ---
  '/images/logo.png',
  '/images/logo-192.png',
  '/images/logo-512.png',
  '/images/cardiology.jpg',
  '/images/doctor1.jpg',
  '/images/doctor2.jpg',
  '/images/doctor3.jpg',
  '/images/homeBG.jpg',
  '/images/LoginBG.jpg',
  '/images/Orthopedic.jpg',
  '/images/pediatrics.jpg'
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Network-first: Try network, then fallback to cache
        return fetch(event.request)
          .then((networkResponse) => {
            // Clone the response because we can only consume it once
            const responseClone = networkResponse.clone();

            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }

            return networkResponse;
          })
          .catch(() => {
            // Fallback for critical pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/html/dashboard-patient.html');
            }
          });
      })
  );
});

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