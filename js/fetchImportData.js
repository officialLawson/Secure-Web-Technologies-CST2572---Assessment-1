async function fetchAndImportAllFiltered(user) {
  const allData = await fetchAllJsons(JSON_URLS);
  const filtered = await filterDataForUser(allData, user);
  await importFetchedDataToDB(filtered);
}