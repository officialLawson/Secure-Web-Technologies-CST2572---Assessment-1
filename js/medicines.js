let allRenderedMedicines = [];

function renderMedicines(data) {
  const tbody = document.getElementById("medicinesBody");
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();

  tbody.innerHTML = "";

  if (!data.length) {
    tbody.innerHTML = "<tr><td colspan='3'>No matching medicines found.</td></tr>";
    return;
  }

  data.forEach(med => {
    const safeId = sanitize(med.id);
    const safeDrug = sanitize(med.drug);
    const safeRole = sanitize(med.role);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${safeId}</td>
      <td>${safeDrug}</td>
      <td class="actions">
        <button class="btn-edit" data-id="${safeId}" data-role="${safeRole}">Edit</button>
        <button class="btn-delete" data-id="${safeId}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const searchMedicinesInput = document.getElementById("searchMedicines");
  if (searchMedicinesInput) {
    searchMedicinesInput.addEventListener("input", function () {
      const query = this.value.toLowerCase().trim();

      if (query === "") {
        renderMedicines(allRenderedMedicines);
        return;
      }

      const filtered = allRenderedMedicines.filter(med =>
        String(med.id).toLowerCase().includes(query) ||
        (med.drug || "").toLowerCase().includes(query) ||
        (med.role || "").toLowerCase().includes(query)
      );

      renderMedicines(filtered);
    });
  }
});

// Load all medicines and populate the table
async function loadMedicines() {
    const tbody = document.getElementById('medicinesBody');
    if (tbody) tbody.innerHTML = '';
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        // Fetch medicines
        const medicineTx = db.transaction('medicines', 'readonly');
        const medicinesStore = medicineTx.objectStore('medicines');
        const medicinesReq = medicinesStore.getAll();
        medicinesReq.onsuccess = function() {
            const medicines = medicinesReq.result;
            if (!medicines || medicines.length === 0) {
                tbody.innerHTML = sanitize("<tr><td colspan='5'>No appointments found.</td></tr>");
                return;
            }
            
            if (tbody) tbody.innerHTML = '';
            allRenderedMedicines = [];

            medicines.forEach((med) => {
              const safeId = sanitize(med.id);
              const safeDrug = sanitize(med.Drug || 'Unknown');
              const safeRole = sanitize(user.role.toLowerCase());

              allRenderedMedicines.push({
                id: med.id,
                drug: med.Drug || 'Unknown',
                role: user.role.toLowerCase()
              });

              const row = document.createElement('tr');
              row.innerHTML = `
                <td>${safeId}</td>
                <td>${safeDrug}</td>
                <td class="actions">
                  <button class="btn-edit" data-id="${safeId}" data-role="${safeRole}">Edit</button>
                  <button class="btn-delete" data-id="${safeId}">Delete</button>
                </td>
              `;
              if (tbody) tbody.appendChild(row);
            });
        };
        medicinesReq.onerror = function() {
            console.error('Failed to load doctors:', medicinesReq.error);
            tbody.innerHTML = sanitize("<tr><td colspan='5'>Error loading doctors data.</td></tr>");
        };
    } catch (error) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = sanitize("<tr><td colspan='5'>Error connecting to database.</td></tr>");
    }
}
async function addMedicine(drugName) {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!drugName || !drugName.trim()) {
    alert("Please enter a valid medicine name.");
    return;
  }
  const drug = drugName.trim();
  try {
    const db = await openClinicDB();
    const tx = db.transaction("medicines", "readwrite");
    const store = tx.objectStore("medicines");
    // 1. Get all medicines to check for duplicates and determine next ID
    const getAllReq = store.getAll();
    getAllReq.onsuccess = function () {
      const medicines = getAllReq.result || [];
      // Check for duplicate
      const exists = medicines.some(
        (m) => m.Drug.toLowerCase() === drug.toLowerCase()
      );
      if (exists) {
        const error = document.getElementById("medicineName-form-error");
        error.innerHTML = `Medicine "${drug}" already exists.`;
        return;
      }
      // Find the next ID
      const nextId =
        medicines.length > 0
          ? Math.max(...medicines.map((m) => m.id || 0)) + 1
          : 1;
      const newMedicine = { id: nextId, Drug: drug };
      const addReq = store.add(newMedicine);
      const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();
      addReq.onsuccess = async function() {
        await logCurrentUserActivity("createMedicine", nextId, `User with ID ${user.linkedId} created a medicine`);
        console.log(`Added medicine: ${drug} (id: ${nextId})`);
        window.location.href = `medicines-${userRole}.html`;
      };
      addReq.onerror = (e) => {
        console.error("Failed to add medicine:", e.target.error);
      };
    };
    getAllReq.onerror = (e) => {
      console.error("Error fetching medicines:", e.target.error);
    };
  } catch (err) {
    console.error("Database error:", err);
  }
}

function handleAddMedicine() {
  const input = document.getElementById('medicineName');
  const name = input.value;
  addMedicine(name);
  input.value = '';
}
// Edit Medicine
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-edit')) {
    e.preventDefault();
    const safeId = DOMPurify.sanitize(e.target.dataset.id);
    const safeRole = DOMPurify.sanitize(e.target.dataset.role);
    if (safeId) {
      if (safeRole === 'doctor') {
        window.location.href = `edit-medicine.html?id=${safeId}`;
      } else if (safeRole === 'admin') {
        window.location.href = `edit-medicine-admin.html?id=${safeId}`;
      }
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      displayEditMedicine(id);
    }
});
async function displayEditMedicine(id) {
    const input = document.getElementById('medicineName');
    try {
      const db = await openClinicDB();
      const transaction = db.transaction("medicines", "readwrite");
      const store = transaction.objectStore("medicines");
      const request = store.getAll();
      request.onsuccess = function() {
        const medicines = request.result || [];
        const medicine = medicines.find(m => m.id === parseInt(id));
        if (!medicine) {
          console.warn("Medicine not found!");
        }
        input.value = medicine.Drug;
      };
      request.onerror = function() {
        alert('Error finding medicines.');
      };
    } catch (err) {
      console.error('DB error:', err);
    }
}
async function editMedicine(event, id, newDrugName) {
  if (event) event.preventDefault();
   try {
      const db = await openClinicDB();
      const user = JSON.parse(localStorage.getItem('currentUser'));
      const transaction = db.transaction("medicines", "readwrite");
      const store = transaction.objectStore("medicines");
      const request = store.getAll();
      request.onsuccess = function() {
        const medicines = request.result || [];
        const medicine = medicines.find(m => m.id === parseInt(id));
        if (!medicine) {
          console.error("Medicine not found");
          alert("Medicine not found.");
          return;
        }
        const newDrugNameLower = newDrugName.toLowerCase();
        const exists = medicines.find(m => m.Drug.toLowerCase() === newDrugNameLower);
        if (exists) {
          alert(`Medicine "${newDrugName}" already exists.`);
          return;
        }
        medicine.Drug = newDrugName;
        const updateRequest = store.put(medicine);
        updateRequest.onsuccess = async function () {
          console.log("Medicine updated successfully");
          if (user.role.toLowerCase() === 'admin') {
            await logCurrentUserActivity("editMedicine", medicine.id, `User with ID ${user.linkedId} edited a medicine`);
            window.location.href = "medicines-admin.html";
          } else if (user.role.toLowerCase() === 'doctor') {
            await logCurrentUserActivity("editMedicine", medicine.id, `User with ID ${user.linkedId} edited a medicine`);
            window.location.href = "medicines-doctor.html";
          }
        };
        updateRequest.onerror = function (event) {
          console.error("Error updating medicine:", event.target.error);
        };
      };
      request.onerror = function (event) {
        console.error("Error getting medicine:", event.target.error);
      };
    } catch (err) {
      console.error('Delete failed:', err);
    }
}
function handleEditMedicine(event) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const medicineName = document.getElementById('medicineName').value;
  editMedicine(event, id, medicineName);
}
document.addEventListener('DOMContentLoaded', () => {
    loadMedicines();
});
let medicineToDelete = null;
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    e.preventDefault();
    const safeId = DOMPurify.sanitize(e.target.dataset.id);
    medicineToDelete = safeId;
    document.getElementById('deleteModal').classList.remove('hidden');
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const deleteModal = document.getElementById("deleteModal");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      const user = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (!user || !user.linkedId) {
        console.error("No valid user found.");
        return;
      }

      if (typeof medicineToDelete !== "undefined" && medicineToDelete !== null) {
        try {
          const db = await openClinicDB();
          const tx = db.transaction("medicines", "readwrite");
          const store = tx.objectStore("medicines");
          const request = store.delete(Number(medicineToDelete));

          request.onsuccess = async () => {
            await logCurrentUserActivity(
              "deleteMedicine",
              Number(medicineToDelete),
              `User with ID ${user.linkedId} deleted a medicine`
            );
            if (typeof loadMedicines === "function") loadMedicines();
            if (deleteModal) deleteModal.classList.add("hidden");
            medicineToDelete = null;
          };

          request.onerror = () => {
            console.error("Error deleting medicine.");
            medicineToDelete = null;
          };
        } catch (err) {
          console.error("Delete failed:", err);
          medicineToDelete = null;
        }
      }
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      if (deleteModal) deleteModal.classList.add("hidden");
      medicineToDelete = null;
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        deleteModal.classList.add("hidden");
        medicineToDelete = null;
      }
    });
  }
});