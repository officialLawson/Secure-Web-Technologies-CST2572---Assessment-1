// importAllData.js
// Requires: IndexedDB.js (which defines openClinicDB, fetchAllJsons, importFetchedDataToDB)

import { openClinicDB, fetchAllJsons, importFetchedDataToDB } from './indexedDB.js';

/* =============================
   🧠 Filter Data by User Role
   ============================= */
function filterDataForUser(allData, user) {
  const filtered = {};

  // Basic info
  const userId = user.id || user.linkedId;
  const role = user.role?.toLowerCase();

  // Clone so we don’t mutate original
  for (const [key, arr] of Object.entries(allData)) {
    if (!Array.isArray(arr)) continue;

    switch (role) {
      case 'doctor':
        filtered[key] = arr.filter(item =>
          item.doctorId === userId ||
          item.assignedDoctor === userId ||
          item.createdBy === userId
        );
        break;

      case 'patient':
        filtered[key] = arr.filter(item =>
          item.createdBy === userId ||
          item.checkedInBy === userId
        );
        break;

      case 'admin':
        // Admins import all data
        filtered[key] = arr;
        break;

      default:
        // Default: only self-related records (patients, etc.)
        filtered[key] = arr.filter(item =>
          item.userId === userId ||
          item.ownerId === userId
        );
    }
  }

  console.log(`📊 Filtered data for ${role} (${userId})`, filtered);
  return filtered;
}

/* =============================
   ⚙️ Import All Data
   ============================= */
async function importAllData(forceRefresh = false) {
  try {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
      console.warn('⚠️ No logged-in user found in localStorage.');
      return;
    }

    // Prevent re-importing for same user unless forced
    const importFlagKey = `clinicDB_imported_${currentUser.username || currentUser.id}`;
    if (!forceRefresh && localStorage.getItem(importFlagKey)) {
      console.log(`✅ Data already imported for ${currentUser.username}. Skipping re-import.`);
      return;
    }

    console.log('🚀 Opening database...');
    const db = await openClinicDB();

    console.log('📥 Fetching all JSON data...');
    const allData = await fetchAllJsons();

    console.log(`🔍 Filtering data for role: ${currentUser.role} (ID: ${currentUser.id || currentUser.linkedId})`);
    const filteredData = filterDataForUser(allData, currentUser);

    console.log('📦 Importing filtered data to IndexedDB...');
    const importResult = await importFetchedDataToDB(filteredData);

    console.log('✅ Import complete:', importResult);

    // Mark import done for this user
    localStorage.setItem(importFlagKey, '1');
  } catch (err) {
    console.error('❌ Error importing all data:', err);
  }
}

/* =============================
   🚀 Auto-run after login
   ============================= */
window.addEventListener('DOMContentLoaded', () => {
  importAllData().catch(console.error);
});
