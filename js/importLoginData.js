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
      if (!raw || typeof raw !== "object") {
        skipped++;
        console.warn(`Skipped invalid record in ${storeName}:`, raw);
        continue;
      }

      const record = { ...raw };

      if (storeName === "users") {
        if (!record.linkedId) {
          if (record.username) record.linkedId = record.username;
          else if (crypto && crypto.randomUUID) record.linkedId = crypto.randomUUID();
          else record.linkedId = Date.now().toString() + Math.floor(Math.random()*1000);
        }
      }

      if (storeName === "admins") {
        if (!record.username) {
          skipped++;
          console.warn("Skipped admin record (missing username):", raw);
          continue;
        }
      }


      if (record.password) {
        const isEncrypted = typeof record.password === "object" &&
                            record.password !== null &&
                            Array.isArray(record.password.iv) &&
                            Array.isArray(record.password.data);

        if (!isEncrypted) {
          record.password = await encryptData(String(record.password));
        }
      } else {
        skipped++;
        console.warn(`Skipped ${storeName} record (no password):`, raw);
        continue;
      }

      await new Promise((resolve, reject) => {
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      console.log("Completed importLoginData");

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

async function importAllData() {
  const usersResp = await fetch(JSON_URLS.users);
  const usersJson = await usersResp.json();

  const adminsResp = await fetch(JSON_URLS.admins);
  const adminsJson = await adminsResp.json();

  await importLoginData(usersJson, "users");
  await importLoginData(adminsJson, "admins");

  await fetchAndImportAll();

  return "✅ All data imported.";
}


async function initImport() {
  try {
    await openClinicDB();

   const result = await importAllData();

    console.log(result);
  } catch (err) {
    console.error("initImport failed:", err);
  }
}


window.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("clinicDB_login_imported")) {
    initImport().then(() => localStorage.setItem("clinicDB_login_imported", "1")).catch(()=>{});
  } else {
    console.log("Login data already imported (localStorage flag).");
  }
});

