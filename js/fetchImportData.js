async function fetchAndImportAllFiltered(user) {
  const allData = await fetchAllJsons(JSON_URLS);
  const filtered = await filterDataForUser(allData, user);
  await importFetchedDataToDB(filtered);
}

async function fetchAndImportAll() {
  const allData = await fetchAllJsons(JSON_URLS);
  const filtered = await allDataForUser(allData);
  await importFetchedDataToDB(filtered);
}