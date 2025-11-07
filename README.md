# Clinic Management System

This is a browser-based clinic management system built with HTML, CSS, and JavaScript. It supports role-based access for doctors, patients, and admins, and uses IndexedDB for local data storage.

## 🚀 Features

- Role-based login (Doctor, Patient, Admin)
- Dynamic dashboards per role
- Medicine management with delete confirmation modal
- NHS number validation and registration
- Local session handling via `localStorage`
- IndexedDB for persistent client-side data
- Responsive UI with form switching and field validation

## 🛠 Setup Instructions

1. Clone or download the project files.
2. Open `html/home.html` using live server in VS code to start.
3. Make sure JavaScript is enabled.
4. All data is stored locally in the browser via IndexedDB.
5. This website works on a single webpage.

## 📁 Folder Structure
project-root/ 
├── html/   
├── js/ 
├── css/  
├── image/

## 🔐 Authentication

- User session is stored in `localStorage` under `currentUser`
- Redirects are handled via `auth-guard.js` based on role and login status

## 📦 Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- IndexedDB (via `openClinicDB()`)

Progressive Web App (PWA) & Service Worker Implementation (Planned)

Although not yet activated in the live version, our project includes Progressive Web App (PWA) support files to enable offline access and app-like functionality.

🔹 Files Involved

manifest.json – defines how the app appears and behaves when installed on a device.

Sets app name, theme color, start URL, icons, and orientation.

Example:

"start_url": "/html/login.html",
"display": "standalone",
"theme_color": "#1e40af"


sw.js (Service Worker) – handles caching and offline features.

Caches essential HTML, CSS, JS, and images for offline use (lines 3–90).

Contains install, fetch, and activate event listeners for cache control (lines 93–150).

In development, it uses a network-first strategy to ensure updated content, while the commented production block switches to a cache-first approach for offline performance.

⚙ How It Would Work (If Implemented)

Add this to the root HTML (e.g., home.html):

<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registered.'));
  }
</script>


The manifest.json would be linked in <head>:

<link rel="manifest" href="/manifest.json">


Once added, users could install the app and use it offline with cached data and assets.

🧠 Summary

This setup would allow:

Faster load times through caching.

Limited offline access to dashboards and appointments.

An installable app experience on mobile and desktop.

⚠ Disclaimer

Although the manifest.json and sw.js files were fully developed and tested in isolation, the PWA features were not implemented in the deployed version of our website. The integration steps were left out intentionally to maintain stability and focus on the core web-based functionalities during development.

## 📌 Notes

- This project is designed for local use and prototyping.
- No backend or server is required.
- All data is stored in the browser and will be lost if cleared.

## 📧 Group Members - Student No.

1. M01029432
2. M01036587
3. M01014970
4. M01017315
5. M01012620