function fetchDoctors(db) {
  const transaction = db.transaction(["doctors"], "readonly");
  const store = transaction.objectStore("doctors");
  const request = store.getAll();

  request.onsuccess = function(event) {
    const doctors = event.target.result;
    return doctors
  };

  request.onerror = function(event) {
    console.error("Failed to fetch doctors:", event.target.errorCode);
    return none
  };
}