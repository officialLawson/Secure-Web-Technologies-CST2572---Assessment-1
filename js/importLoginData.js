// importLoginData.js
// Load AFTER IndexedDB.js (which defines openClinicDB, db, encryptData, etc.)

async function importLoginData(dataArray, storeName) {
  if (!Array.isArray(dataArray)) {
    console.warn(`importLoginData: expected array for ${storeName}, got`, dataArray);
    return { imported: 0, skipped: 0 };
  }

  if (!db) await openClinicDB();

  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  let imported = 0;
  let skipped = 0;

  for (const raw of dataArray) {
    try {
      // basic validation
      if (!raw || typeof raw !== "object") {
        skipped++;
        console.warn(`Skipped invalid record in ${storeName}:`, raw);
        continue;
      }

      const record = { ...raw }; // copy so we don't mutate original

      // Ensure required keyPath exists for 'users' store (your DB uses linkedId)
      if (storeName === "users") {
        // if linkedId missing, use username if present, otherwise create a uuid
        if (!record.linkedId) {
          if (record.username) record.linkedId = record.username;
          else if (crypto && crypto.randomUUID) record.linkedId = crypto.randomUUID();
          else record.linkedId = Date.now().toString() + Math.floor(Math.random()*1000);
        }
      }

      // Ensure admin records have username (admins keyPath = username)
      if (storeName === "admins") {
        if (!record.username) {
          skipped++;
          console.warn("Skipped admin record (missing username):", raw);
          continue;
        }
      }

      // Encrypt password if present and not already encrypted-like
      if (record.password) {
        // If password looks like an encrypted object (has iv & data), skip encryption
        const isEncrypted = typeof record.password === "object" &&
                            record.password !== null &&
                            Array.isArray(record.password.iv) &&
                            Array.isArray(record.password.data);

        if (!isEncrypted) {
          record.password = await encryptData(String(record.password));
        }
      } else {
        // no password present -> skip (or optionally create a random one)
        skipped++;
        console.warn(`Skipped ${storeName} record (no password):`, raw);
        continue;
      }

      // Write to store (use put so re-run doesn't throw for duplicates)
      await new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      imported++;
      console.log(`Imported into ${storeName}:`, record.username || record.linkedId || "(no id)");
    } catch (err) {
      skipped++;
      console.warn(`Skipped ${storeName} record due to error:`, err, raw);
    }
  }

  // ensure transaction completes
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
  });

  console.log(`importLoginData ${storeName} done — imported: ${imported}, skipped: ${skipped}`);
  return { imported, skipped };
}

// Top-level init: open DB, fetch JSONs, import users+admins
async function initImport() {
  try {
    await openClinicDB();

    // fetch login JSONs (use your URLs)
    const usersResp = await fetch(JSON_URLS.users);
    const usersJson = await usersResp.json();

    const adminsResp = await fetch(JSON_URLS.admins);
    const adminsJson = await adminsResp.json();

    // import each
    const r1 = await importLoginData(usersJson, "users");
    const r2 = await importLoginData(adminsJson, "admins");

    console.log("✅ All login data imported.", { usersImported: r1, adminsImported: r2 });
  } catch (err) {
    console.error("initImport failed:", err);
  }
}

// Run automatically when script loads (if you want automatic import)
window.addEventListener("DOMContentLoaded", () => {
  // optionally guard with a flag in localStorage to avoid re-import on every page load:
  if (!localStorage.getItem("clinicDB_login_imported")) {
    initImport().then(() => localStorage.setItem("clinicDB_login_imported", "1")).catch(()=>{});
  } else {
    console.log("Login data already imported (localStorage flag).");
  }
});


// Example usage:
// importLoginData([{ username: "doctor1", password: "pass123", role: "doctor" }]);
