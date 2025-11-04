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
async function fetchJson(url) {
  url = url.trim();
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`❌ Bad response from: "${url}" → ${resp.status} ${resp.statusText}`);
    throw new Error(`Fetch failed: ${resp.status}`);
  }
  return resp.json();
}