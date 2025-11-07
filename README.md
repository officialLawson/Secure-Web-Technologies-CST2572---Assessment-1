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

## 📁 Folder Structure
project-root/ 
├── html/    
    ├── login.html │   
    ├── dashboard-doctor.html │   
    ├── dashboard-patient.html │   
    ├── dashboard-admin.html │   
    |── forget-password.html 
   
├── js/ 
    ├── auth-guard.js │   
    ├── indexeddb.js │   
    ├── dashboard.js │   
    |── form-switcher.js 

├── css/  
    └── styles.css



## 🔐 Authentication

- User session is stored in `localStorage` under `currentUser`
- Redirects are handled via `auth-guard.js` based on role and login status

## 📦 Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- IndexedDB (via `openClinicDB()`)

## 📌 Notes

- This project is designed for local use and prototyping.
- No backend or server is required.
- All data is stored in the browser and will be lost if cleared.

## 📧 Group Members

1. Hassan Fazal Datoo (M01029432)
2. Darenn Selvinen Ramsamy (M01036587)
3. Zariyat Bibi Maudarbux (M01014970)
4. Archy Lawson Ifeanyi (M01017315)
5. Malaika Usman (M01012620)