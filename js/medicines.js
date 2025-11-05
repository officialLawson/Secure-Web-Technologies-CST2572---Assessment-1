// Load all medicines and populate the table
async function loadMedicines() {
    const tbody = document.getElementById('medicinesBody');
    tbody.innerHTML = ''; // Clear existing rows

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
                tbody.innerHTML = "<tr><td colspan='5'>No appointments found.</td></tr>";
                return;
            }

            // Populate Table
            medicines.forEach((med, index) => {
                const row = document.createElement('tr');

                row.innerHTML = `
                    <td>${med.id}</td>
                    <td>${med.Drug || 'Unknown'}</td>
                    <td class="actions">
                    <button class="btn-edit" data-id="${med.id}" data-role="${user.role.toLowerCase()}">Edit</button>
                    <button class="btn-delete" data-id="${med.id}">Delete</button>
                    </td>
                `;

                tbody.appendChild(row);
                });
        };

        medicinesReq.onerror = function() {
            console.error('Failed to load doctors:', medicinesReq.error);
            tbody.innerHTML = "<tr><td colspan='5'>Error loading doctors data.</td></tr>";
        };
    } catch (error) {
        console.error('Error opening DB:', err);
        tbody.innerHTML = "<tr><td colspan='5'>Error connecting to database.</td></tr>";
    }
}


async function addMedicine(drugName) {
  if (!drugName || !drugName.trim()) {
    alert("⚠️ Please enter a valid medicine name.");
    return;
  }

  const drug = drugName.trim();

  try {
    const db = await openClinicDB();
    const tx = db.transaction("medicines", "readwrite");
    const store = tx.objectStore("medicines");

    // ✅ 1. Get all medicines to check for duplicates and determine next ID
    const getAllReq = store.getAll();

    getAllReq.onsuccess = function () {
      const medicines = getAllReq.result || [];

      // 🚫 Check for duplicate (case-insensitive)
      const exists = medicines.some(
        (m) => m.Drug.toLowerCase() === drug.toLowerCase()
      );

      if (exists) {
        const error = document.getElementById("medicineName-form-error");
        error.innerHTML = `Medicine "${drug}" already exists.`;
        return;
      }

      // ✅ Find the next ID (increment from max)
      const nextId =
        medicines.length > 0
          ? Math.max(...medicines.map((m) => m.id || 0)) + 1
          : 1;

      // ✅ Proper structure: { id: 27, Drug: "Menthol" }
      const newMedicine = { id: nextId, Drug: drug };

      const addReq = store.add(newMedicine);

      const userRole = JSON.parse(localStorage.getItem('currentUser')).role.toLowerCase();

      addReq.onsuccess = () => {
        console.log(`✅ Added medicine: ${drug} (id: ${nextId})`);
        window.location.href = `medicines-${userRole}.html`; // Redirect after adding
      };

      addReq.onerror = (e) => {
        console.error("❌ Failed to add medicine:", e.target.error);
      };
    };

    getAllReq.onerror = (e) => {
      console.error("❌ Error fetching medicines:", e.target.error);
    };
  } catch (err) {
    console.error("⚠️ Database error:", err);
  }
}



// async function deleteMedicine(id) {
//   const db = await openClinicDB();
//   const transaction = db.transaction("medicines", "readwrite");
//   const store = transaction.objectStore("medicines");

//   const request = store.delete(id);

//   request.onsuccess = function () {
//     console.log("Medicine deleted successfully");
//     alert("Medicine deleted successfully!");
//     loadMedicines(); // Refresh the list
//   };

//   request.onerror = function (event) {
//     console.error("Error deleting medicine:", event.target.error);
//     alert("Error deleting medicine.");
//   };
// }



function handleAddMedicine() {
  const input = document.getElementById('medicineName');
  const name = input.value;
  addMedicine(name);
  input.value = ''; // clear after adding
}

// Edit Medicine
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-edit')) {
    e.preventDefault();
    const id = e.target.dataset.id;
    const role = e.target.dataset.role;
    if (id) {
      if (role === 'doctor') {
        window.location.href = `edit-medicine.html?id=${id}`;
      } else if (role === 'admin') {
        window.location.href = `edit-medicine-admin.html?id=${id}`;
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
  // ✅ Prevent form submission reload
  if (event) event.preventDefault();

   try {
      const db = await openClinicDB();

      const user = JSON.parse(localStorage.getItem('currentUser'));

      const transaction = db.transaction("medicines", "readwrite");
      const store = transaction.objectStore("medicines");
      const request = store.getAll();

      request.onsuccess = function() {
        const medicines = request.result || [];
        console.log(medicines);
        const medicine = medicines.find(m => m.id === parseInt(id));
        console.log(medicine);

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

        // Update and save
        medicine.Drug = newDrugName;

        const updateRequest = store.put(medicine);

        updateRequest.onsuccess = function () {
          console.log("Medicine updated successfully");
          if (user.role.toLowerCase() === 'admin') {
            window.location.href = "medicines-admin.html";
          } else if (user.role.toLowerCase() === 'doctor') {
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



// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMedicines();
});

// Store the medicine ID to delete
let medicineToDelete = null;

// Attach event listeners to delete buttons (dynamic)
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete')) {
    e.preventDefault();
    medicineToDelete = e.target.dataset.id;
    document.getElementById('deleteModal').classList.remove('hidden');
  }
});

// Handle "Yes, Delete"
document.getElementById('confirmDelete').addEventListener('click', async () => {
  if (medicineToDelete !== null) {
    try {
      const db = await openClinicDB();
      const tx = db.transaction('medicines', 'readwrite');
      const store = tx.objectStore('medicines');
      const request = store.delete(Number(medicineToDelete));

      request.onsuccess = () => {
        loadMedicines(); // Refresh the table
        document.getElementById('deleteModal').classList.add('hidden');
        medicineToDelete = null;
      };

      request.onerror = () => {
        console.error('Error deleting medicine.');
        medicineToDelete = null;
      };
    } catch (err) {
      console.error('Delete failed:', err);
      medicineToDelete = null;
    }
  }
});

// Handle "Cancel" or close
document.getElementById('cancelDelete').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden');
  medicineToDelete = null;
});

// Close modal if clicking outside
document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add('hidden');
    medicineToDelete = null;
  }
});