let allRenderedMedicines = [];

/* ==================== 1. RENDER MEDICINES TO TABLE ==================== */
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

/* ==================== 2. LIVE SEARCH FILTERING ==================== */
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

/* ==================== 3. LOAD ALL MEDICINES FROM DB ==================== */
async function loadMedicines() {
    const tbody = document.getElementById('medicinesBody');
    if (tbody) tbody.innerHTML = '';
    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const medicineTx = db.transaction('medicines', 'readonly');
        const medicinesStore = medicineTx.objectStore('medicines');
        const medicinesReq = medicinesStore.getAll();

        medicinesReq.onsuccess = function () {
            const medicines = medicinesReq.result || [];
            if (!medicines.length) {
                tbody.innerHTML = sanitize("<tr><td colspan='3'>No medicines found.</td></tr>");
                return;
            }

            allRenderedMedicines = [];
            if (tbody) tbody.innerHTML = '';

            medicines.forEach(med => {
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

        medicinesReq.onerror = function () {
            console.error('Failed to load medicines:', medicinesReq.error);
            tbody.innerHTML = sanitize("<tr><td colspan='3'>Error loading data.</td></tr>");
        };
    } catch (error) {
        console.error('Error opening DB:', error);
        tbody.innerHTML = sanitize("<tr><td colspan='3'>Error connecting to database.</td></tr>");
    }
}

/* ==================== 4. ADD NEW MEDICINE ==================== */
async function addMedicine(drugName) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!drugName || !drugName.trim()) {
        const error = document.getElementById("medicineName-form-error");
        error.innerHTML = "Please enter a valid medicine name.";
        return;
    }

    const drug = drugName.trim();
    try {
        const db = await openClinicDB();
        const tx = db.transaction("medicines", "readwrite");
        const store = tx.objectStore("medicines");
        const getAllReq = store.getAll();

        getAllReq.onsuccess = function () {
            const medicines = getAllReq.result || [];
            const exists = medicines.some(m => m.Drug.toLowerCase() === drug.toLowerCase());
            if (exists) {
                const error = document.getElementById("medicineName-form-error");
                error.innerHTML = `Medicine "${drug}" already exists.`;
                return;
            }

            const nextId = medicines.length > 0 ? Math.max(...medicines.map(m => m.id || 0)) + 1 : 1;
            const newMedicine = { id: nextId, Drug: drug };
            const addReq = store.add(newMedicine);

            addReq.onsuccess = async function () {
                await logCurrentUserActivity("createMedicine", nextId, `User with ID ${user.linkedId} created a medicine`);
                console.log(`Added medicine: ${drug} (id: ${nextId})`);
                window.location.href = `medicines-${user.role.toLowerCase()}.html`;
            };

            addReq.onerror = (e) => console.error("Failed to add medicine:", e.target.error);
        };

        getAllReq.onerror = (e) => console.error("Error fetching medicines:", e.target.error);
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

/* ==================== 5. EDIT BUTTON NAVIGATION ==================== */
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

/* ==================== 6. LOAD MEDICINE INTO EDIT FORM ==================== */
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
        const tx = db.transaction("medicines", "readonly");
        const store = tx.objectStore("medicines");
        const req = store.getAll();

        req.onsuccess = function () {
            const medicines = req.result || [];
            const medicine = medicines.find(m => m.id === parseInt(id));
            if (medicine) {
                input.value = medicine.Drug;
            } else {
                console.warn("Medicine not found!");
            }
        };

        req.onerror = () => alert('Error finding medicines.');
    } catch (err) {
        console.error('DB error:', err);
    }
}

/* ==================== 7. UPDATE MEDICINE ==================== */
async function editMedicine(event, id, newDrugName) {
    if (event) event.preventDefault();

    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const tx = db.transaction("medicines", "readwrite");
        const store = tx.objectStore("medicines");
        const req = store.getAll();

        req.onsuccess = function () {
            const medicines = req.result || [];
            const medicine = medicines.find(m => m.id === parseInt(id));
            if (!medicine) {
                const error = document.getElementById("medicineName-form-error");
                error.innerHTML = "Medicine not found.";
                return;
            }

            if (!newDrugName || typeof newDrugName !== 'string') {
                const error = document.getElementById("medicineName-form-error");
                error.textContent = 'Invalid drug name';
                return;
            }

            const newName = newDrugName.trim();
            const currentName = medicine.Drug.trim();
            const newLower = newName.toLowerCase();
            const currentLower = currentName.toLowerCase();

            if (newLower !== currentLower) {
                const exists = medicines.find(m => m.id !== id && m.Drug.trim().toLowerCase() === newLower);
                if (exists) {
                    const error = document.getElementById("medicineName-form-error");
                    error.textContent = `Medicine "${newName}" already exists.`;
                    return;
                }
            }

            medicine.Drug = newName;
            const updateReq = store.put(medicine);

            updateReq.onsuccess = async function () {
                console.log("Medicine updated successfully");
                await logCurrentUserActivity("editMedicine", medicine.id, `User with ID ${user.linkedId} edited a medicine`);
                window.location.href = `medicines-${user.role.toLowerCase()}.html`;
            };

            updateReq.onerror = (e) => console.error("Error updating medicine:", e.target.error);
        };

        req.onerror = (e) => console.error("Error getting medicine:", e.target.error);
    } catch (err) {
        console.error('Update failed:', err);
    }
}

function handleEditMedicine(event) {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const medicineName = document.getElementById('medicineName').value;
    editMedicine(event, id, medicineName);
}

let medicineToDelete = null;

/* ==================== 8. OPEN DELETE MODAL ==================== */
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete')) {
        e.preventDefault();
        const safeId = DOMPurify.sanitize(e.target.dataset.id);
        medicineToDelete = safeId;
        document.getElementById('deleteModal').classList.remove('hidden');
    }
});

/* ====================9. DELETE CONFIRMATION HANDLER ==================== */
document.addEventListener("DOMContentLoaded", () => {
    const confirmDeleteBtn = document.getElementById("confirmDelete");
    const cancelDeleteBtn = document.getElementById("cancelDelete");
    const deleteModal = document.getElementById("deleteModal");

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            const user = JSON.parse(localStorage.getItem("currentUser") || "null");
            if (!user) return console.error("No valid user found.");

            if (medicineToDelete !== null) {
                try {
                    const db = await openClinicDB();
                    const tx = db.transaction("medicines", "readwrite");
                    const store = tx.objectStore("medicines");
                    const req = store.delete(Number(medicineToDelete));

                    req.onsuccess = async () => {
                        await logCurrentUserActivity(
                            "deleteMedicine",
                            Number(medicineToDelete),
                            `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} with ID ${user.linkedId} deleted a medicine`
                        );
                        loadMedicines();
                        if (deleteModal) deleteModal.classList.add("hidden");
                        medicineToDelete = null;
                    };

                    req.onerror = () => {
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


document.addEventListener('DOMContentLoaded', () => {
    loadMedicines();
});