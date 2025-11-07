async function getUserInfo() {
    // === SAFE ELEMENT GETTERS ===
    const els = {
        userFullName: document.getElementById("userFullName"),
        userRoleMain: document.getElementById("userRoleMain"),
        userEmail: document.getElementById("userEmail"),
        userAddressMain: document.getElementById("userAddressMain"),
        userFirstName: document.getElementById("userFirstName"),
        userLastName: document.getElementById("userLastName"),
        userTelephone: document.getElementById("userTelephone"),
        userRole: document.getElementById("userRole"),
        userDOB: document.getElementById("userDOB"),
        userId: document.getElementById("userId"),
        userAddress: document.getElementById("userAddress"),
        userGender: document.getElementById("userGender")
    };

    const sanitize = (dirty) => DOMPurify.sanitize(String(dirty || ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    // === HELPER: Only set text if element exists ===
    const setText = (el, text) => {
        if (el) el.innerText = sanitize(text);
    };

    try {
        const db = await openClinicDB();
        const user = JSON.parse(localStorage.getItem('currentUser'));
        switch (user.role.toLowerCase()) {
            case 'doctor':
                // Fetch doctors first and build a lookup map
                const doctorTx = db.transaction('doctors', 'readonly');
                const doctorStore = doctorTx.objectStore('doctors');
                const doctorsReq = doctorStore.getAll();
                doctorsReq.onsuccess = async function() {
                    const encryptedDoctors = doctorsReq.result || [];
                    // Decrypt all doctors in parallel
                    const decryptedDoctors = await Promise.all(
                        encryptedDoctors.map(p => decryptDoctorInfo(p))
                    );
                    const currentUserData = decryptedDoctors.filter(d => d.id === user.linkedId) || [];
                    const doctor = currentUserData[0];

                    // Normalize field names
                    doctor.First = doctor.first_name || doctor.First || '';
                    doctor.Last = doctor.last_name || doctor.Last || '';
                    doctor.Email = doctor.email || doctor.Email || '';
                    doctor.Gender = doctor.gender || doctor.Gender || '';

                    const doctorFullName = `Dr ${doctor.First} ${doctor.Last}`;
                    const doctorRole = (user.role.charAt(0).toUpperCase() + user.role.slice(1));
                    const doctorFirstName = doctor.First;
                    const doctorLastName = doctor.Last;
                    const doctorEmail = doctor.Email;
                    const doctorAddress = doctor.Address;
                    const doctorTelephone = doctor.Telephone;
                    const doctorGender = doctor.gender || doctor.Gender || 'Not specified';

                    setText(els.userFullName, doctorFullName);
                    setText(els.userEmail, doctorEmail);
                    setText(els.userAddressMain, doctorAddress);
                    setText(els.userAddress, doctorAddress);
                    setText(els.userFirstName, doctorFirstName);
                    setText(els.userLastName, doctorLastName);
                    setText(els.userTelephone, doctorTelephone);
                    setText(els.userGender, doctorGender);
                    setText(els.userRoleMain, doctorRole);
                    setText(els.userRole, doctorRole);
                    setText(els.userId, `Staff ID: ${doctor.StaffID || doctor.id || ''}`);
                };
                doctorsReq.onerror = function() {
                    console.error('Failed to load doctors info:', doctorsReq.error);
                };
                break;
            case 'patient':
                // Fetch patients first and build a lookup map
                const patientTx = db.transaction('patients', 'readonly');
                const patientStore = patientTx.objectStore('patients');
                const patientsReq = patientStore.getAll();
                patientsReq.onsuccess = async function () {
                    const encryptedPatients = patientsReq.result || [];
                    // Decrypt all patients in parallel
                    const decryptedPatients = await Promise.all(
                        encryptedPatients.map(p => decryptPatientInfo(p))
                    );
                    // Now filter using decrypted fields
                    const currentUserData = decryptedPatients.filter(d => d.NHS === user.linkedId);
                    if (currentUserData.length === 0) {
                        console.warn("No matching patient found for linkedId:", user.linkedId);
                        return;
                    }
                    const patient = currentUserData[0];
                    const patientFullName = `${patient.Title} ${patient.First} ${patient.Last}`;
                    const patientFirstName = patient.First;
                    const patientLastName = patient.Last;
                    const patientDOB = patient.DOB;
                    const patientEmail = patient.Email;
                    const patientAddress = patient.Address;
                    const patientTelephone = patient.Telephone;
                    const patientNHS = patient.NHS;
                    const patientGender = patient.Gender;
                    const patientRole = (user.role.charAt(0).toUpperCase() + user.role.slice(1));

                    setText(els.userFullName, patientFullName);
                    setText(els.userDOB, patientDOB);
                    setText(els.userEmail, patientEmail);
                    setText(els.userAddressMain, patientAddress);
                    setText(els.userAddress, patientAddress);
                    setText(els.userId, patientNHS);
                    setText(els.userGender, patientGender);
                    setText(els.userFirstName, patientFirstName);
                    setText(els.userLastName, patientLastName);
                    setText(els.userTelephone, patientTelephone);
                    setText(els.userRoleMain, patientRole);
                    setText(els.userRole, patientRole);
                    };
                patientsReq.onerror = function(event) {
                    console.error('Failed to load patients info:', patientsReq.error);
                };
                break;
        }
    } catch (err) {
        console.error('Error opening DB:', err);
    }
}
// Delete User Option
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete-account')) {
        e.preventDefault();
        document.getElementById('deleteModal').classList.remove('hidden');
    }
});
document.addEventListener("DOMContentLoaded", () => {
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const deleteModal = document.getElementById("deleteModal");

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      const user = JSON.parse(localStorage.getItem("currentUser"));
      if (!user || !user.role || !user.linkedId) return;

      const notifyAdmins = async (message) => {
        try {
          const db = await openClinicDB();
          const tx = db.transaction("admins", "readwrite");
          const store = tx.objectStore("admins");
          const request = store.getAll();

          request.onsuccess = async function () {
            const admins = request.result || [];
            admins.forEach(adm => {
              createNotificationForUser(
                "Account Deleted",
                message,
                adm.username,
                "admin"
              );
            });
          };

          request.onerror = function (e) {
            console.error("Failed to load admin info:", e.target.error);
          };
        } catch (err) {
          console.warn("DB error:", err);
        }
      };

      if (user.role.toLowerCase() === "patient") {
        deletePatientCompletely(user.linkedId);
        await notifyAdmins(`Patient with NHS ${user.linkedId} has deleted their account and linked data`);
      } else if (user.role.toLowerCase() === "doctor") {
        deleteDoctorCompletely(user.linkedId);
        await notifyAdmins(`Doctor with ID ${user.linkedId} has deleted their account and linked data`);
      }
    });
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      if (deleteModal) deleteModal.classList.add("hidden");
      userToDelete = null;
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) {
        deleteModal.classList.add("hidden");
        userToDelete = null;
      }
    });
  }
});
// Load on page ready
document.addEventListener('DOMContentLoaded', () => {
    getUserInfo();
});