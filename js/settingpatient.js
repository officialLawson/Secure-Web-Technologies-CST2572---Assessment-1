// settingpatient.js – Fixed for proper data handling and persistence

document.addEventListener('DOMContentLoaded', async () => {
    /* ==================== 1. AUTH & ROLE CHECK ==================== */
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser || !currentUser.role || !currentUser.linkedId) {
        window.location.href = '../html/login.html';
        return;
    }
    const role = currentUser.role.toLowerCase();
    if (role !== 'patient') {
        window.location.href = `dashboard-${role}.html`;
        return;
    }

    const userId = String(currentUser.username);

    /* ==================== 2. DOM ELEMENTS ==================== */
    const els = {
        fullName: document.getElementById('fullName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        address: document.getElementById('address'),
        dob: document.getElementById('dob'),
        editBtn: document.getElementById('editBtn'),
        saveBtn: document.getElementById('saveBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        msgBox: document.getElementById('msgBox')
    };

    let originalData = {};

    /* ==================== 3. SANITIZE INPUT ==================== */
    const sanitize = (input) => DOMPurify.sanitize(String(input || '').trim(), { ALLOWED_TAGS: [] });

    /* ==================== 4. LOAD USER DATA ==================== */
    async function loadUserData() {
        try {
            await clinicDB.openClinicDB();

            let record = await clinicDB.getItem('patients', userId);
            if (!record) {
                // Try as number just in case
                const fallbackRecord = await clinicDB.getItem('patients', Number(userId));
                if (fallbackRecord) {
                    record = fallbackRecord;
                    console.warn('Fetched patient using numeric NHS — data inconsistency detected.');
                }
            }
            if (record) {
                record = await clinicDB.decryptPatientInfo(record);
            }

            if (!record || !record.First || !record.Last) {
                showMsg('Patient record not found or incomplete.', 'error');
                return;
            }

            // Store full original record for cancel/save
            originalData = { ...record };

            // Display name WITHOUT Title (Title is read-only and not editable)
            const fullNameStr = `${record.First} ${record.Last}`.trim();
            els.fullName.value = sanitize(fullNameStr);
            els.email.value = sanitize(record.Email || '');
            els.phone.value = sanitize(record.Telephone || '');
            els.address.value = sanitize(record.Address || '');
            if (els.dob) els.dob.value = sanitize(record.DOB || '');

        } catch (err) {
            console.error('Failed to load patient data:', err);
            showMsg('Failed to load your information.', 'error');
        }
    }

    /* ==================== 5. UI HELPERS ==================== */
    function enableEdit() {
        ['fullName', 'email', 'phone', 'address'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.readOnly = false;
                el.classList.remove('readonly');
                el.classList.add('edit-mode');
            }
        });
        els.editBtn.style.display = 'none';
        els.saveBtn.style.display = 'inline-block';
        els.cancelBtn.style.display = 'inline-block';
        
    }

    function disableEdit() {
        ['fullName', 'email', 'phone', 'address'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.readOnly = true;
                el.classList.add('readonly');
                el.classList.remove('edit-mode');
            }
        });
        els.editBtn.style.display = 'inline-block';
        els.saveBtn.style.display = 'none';
        els.cancelBtn.style.display = 'none';
    }

    function showMsg(text, type = 'success') {
        const safeText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
        els.msgBox.innerHTML = safeText;
        els.msgBox.className = `msg ${type}`;
        setTimeout(() => els.msgBox.innerHTML = '', 5000);
    }

    /* ==================== 6. EDIT / SAVE / CANCEL ==================== */
    els.editBtn.addEventListener('click', enableEdit);

    els.cancelBtn.addEventListener('click', () => {
        const fullNameStr = `${originalData.First} ${originalData.Last}`.trim();
        els.fullName.value = sanitize(fullNameStr);
        els.email.value = sanitize(originalData.Email || '');
        els.phone.value = sanitize(originalData.Telephone || '');
        els.address.value = sanitize(originalData.Address || '');
        if (els.dob) els.dob.value = sanitize(originalData.DOB || '');

        disableEdit();
        showMsg('Changes cancelled.');
    });

    els.saveBtn.addEventListener('click', async () => {
        const name = sanitize(els.fullName.value);
        const email = sanitize(els.email.value);
        const phone = sanitize(els.phone.value);
        const address = sanitize(els.address.value);
        const dob = els.dob ? sanitize(els.dob.value) : '';

        // Parse First and Last name (Title is preserved from originalData)
        const nameParts = name.split(/\s+/).filter(Boolean);
        if (nameParts.length < 2) {
            showMsg('Please enter both first and last name.', 'error');
            return;
        }
        const First = nameParts[0];
        const Last = nameParts.slice(1).join(' ');

        if (!email.includes('@') || !email.includes('.')) {
            showMsg('Please enter a valid email address.', 'error');
            return;
        }

        if (!/^\+?[\d\s\-]{10,}$/.test(phone)) {
            showMsg('Please enter a valid phone number.', 'error');
            return;
        }

        if (!dob) {
            showMsg('Please enter your date of birth.', 'error');
            return;
        }

        try {
            // Build updated record using exact field names from patients.json
            const updated = {
                id: originalData.id,
                NHS: String(userId),
                Title: originalData.Title || '',
                First: First,
                Last: Last,
                Gender: originalData.Gender || '',
                Email: email,
                Telephone: phone,
                Address: address,
                DOB: dob
            };

            if (!updated.NHS || typeof updated.NHS !== 'string') {
                showMsg('Critical error: NHS number is missing or invalid.', 'error');
                return;
            }

            // Encrypt sensitive fields and save
            const encrypted = await clinicDB.encryptPatientInfo(updated);
            encrypted.NHS = String(userId);
            await clinicDB.updateItem('patients', encrypted);


            const fresh = await clinicDB.getItem('patients', userId);
            if (!fresh) {
                showMsg('Save failed: Record not found after update.', 'error');
                return;
            }

            // Update originalData for future edits/cancel
            originalData = { ...originalData, ...updated };

            disableEdit();
            await logCurrentUserActivity("updateAccount", userId, `Patient with NHS ${userId} has updated their account details`);
            showMsg('Profile updated successfully!', 'success');

        } catch (err) {
            console.error('Save failed:', err);
            showMsg('Failed to save changes. Please try again.', 'error');
        }
    });

    /* ==================== 7. PASSWORD CHANGE ==================== */
    document.getElementById('updatePasswordBtn')?.addEventListener('click', async () => {
        const current = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (!current || !newPass || newPass !== confirm || newPass.length < 6) {
            document.getElementById('password-change-form-error').innerText = sanitize('Check passwords.');
            return;
        }

        const loginCheck = await clinicDB.login(currentUser.username, current);
        if (!loginCheck.success) {
            document.getElementById('password-change-form-error').innerText = sanitize('Wrong current password.');
            return;
        }

        try {
            const encryptedNew = await clinicDB.encryptData(newPass);
            const userRec = await clinicDB.getItem('users', currentUser.username);
            userRec.password = encryptedNew;
            await clinicDB.updateItem('users', userRec);
            document.getElementById('password-change-form-success').innerText = sanitize('Password changed!');
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } catch (err) {
            console.error('Password update error:', err);
            showMsg('Password update failed.', 'error');
        }
    });
    
    /* ==================== 8. INITIALIZE ==================== */
    await loadUserData();
});