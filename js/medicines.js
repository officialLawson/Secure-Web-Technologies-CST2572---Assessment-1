// Load all medicines and populate the table
async function loadMedicines() {
    const tbody = document.getElementById('medicinesBody');
    tbody.innerHTML = ''; // Clear existing rows

    try {
        const db = await openClinicDB();

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
                    <a href="edit-medicine.html"><button class="btn-edit" data-id="${med.id}">Edit</button></a>
                    <button class="btn-delete" onclick="deleteMedicine(${med.id})">Delete</button>
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

async function editMedicine(id, newDrugName) {
  const db = await openClinicDB();
  const transaction = db.transaction("medicines", "readwrite");
  const store = transaction.objectStore("medicines");

  const request = store.get(id);

  request.onsuccess = async function () {
    const medicine = request.result;

    if (!medicine) {
      console.error("Medicine not found");
      alert("Medicine not found.");
      return;
    }

    // ✅ Check for duplicates (case-insensitive)
    const checkTx = db.transaction("medicines", "readonly");
    const checkStore = checkTx.objectStore("medicines");
    const all = await checkStore.getAll();
    const exists = all.some(
      (item) => item.Drug.toLowerCase() === newDrugName.toLowerCase() && item.id !== id
    );

    if (exists) {
      alert(`Medicine "${newDrugName}" already exists.`);
      return;
    }

    // Update and save
    medicine.Drug = newDrugName;

    const updateRequest = store.put(medicine);

    updateRequest.onsuccess = function () {
      console.log("Medicine updated successfully");
      window.location.href = "medicines-admin.html"; // Redirect after editing
    };

    updateRequest.onerror = function (event) {
      console.error("Error updating medicine:", event.target.error);
    };
  };

  request.onerror = function (event) {
    console.error("Error getting medicine:", event.target.error);
  };
}

async function deleteMedicine(id) {
  const db = await openClinicDB();
  const transaction = db.transaction("medicines", "readwrite");
  const store = transaction.objectStore("medicines");

  const request = store.delete(id);

  request.onsuccess = function () {
    console.log("Medicine deleted successfully");
    alert("Medicine deleted successfully!");
    loadMedicines(); // Refresh the list
  };

  request.onerror = function (event) {
    console.error("Error deleting medicine:", event.target.error);
    alert("Error deleting medicine.");
  };
}



function handleAddMedicine() {
  const input = document.getElementById('medicineName');
  const name = input.value;
  addMedicine(name);
  input.value = ''; // clear after adding
}

function handleEditMedicine(id) {
    const input = document.getElementById('medicineName');
    const name = input.value;
    editMedicine(id, name);
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadMedicines();
});