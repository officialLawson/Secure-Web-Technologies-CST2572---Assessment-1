// settingsdoctor.js – Settings for Doctor – XSS-PROTECTED with DOMPurify

document.addEventListener('DOMContentLoaded', async () => {
    /* ==================== 1. AUTH & ROLE CHECK ==================== */
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser || !currentUser.role || !currentUser.linkedId) {
        alert('Access denied. Redirecting to login...');
        window.location.href = '../html/login.html';
        return;
    }

    const role = currentUser.role.toLowerCase();
    const isDoctor = role === 'doctor';

    if (!isDoctor) {
        window.location.href = '../html/login.html';
        return;
    }

    const currentPage = location.pathname.split('/').pop();
    if (currentPage !== 'settings-doctor.html') {
        window.location.href = 'settings-doctor.html';
        return;
    }

    const userId = currentUser.linkedId;

    /* ==================== 2. DOM ELEMENTS ==================== */
    const els = {
        fullName: document.getElementById('fullName'),
        email: document.getElementById('email'),
        phone: document.getElementById('phone'),
        address: document.getElementById('address'),
        editBtn: document.getElementById('editBtn'),
        saveBtn: document.getElementById('saveBtn'),
        cancelBtn: document.getElementById('cancelBtn'),
        msgBox: document.getElementById('msgBox')
    };

    let originalData = {};

    /* ==================== 3. SANITIZE INPUT (DOMPurify) ==================== */
    const sanitize = (input) => DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] }); // Text only

    /* ==================== 4. LOAD USER DATA (SAFE) ==================== */
    async function loadUserData() {
        try {
            await clinicDB.openClinicDB();

            let record = await clinicDB.getItem('doctors', userId);
            if (record) {
                record = await clinicDB.decryptDoctorInfo(record); // Added decryption
                record.First = record.first_name || record.First || '';
                record.Last = record.last_name || record.Last || '';
                record.Email = record.email || record.Email || '';
                record.Telephone = record.Telephone || record.Phone || '';
                record.Address = record.Address || '';
            }

            if (!record) {
                showMsg(`No doctor record found.`, 'error');
                return;
            }

            originalData = { ...record };

            // Sanitize before inserting into DOM
            const fullNameStr = `Dr ${record.First || ''} ${record.Last || ''}`.trim();
            const safeFullName = sanitize(fullNameStr);
            const safeEmail    = sanitize(record.Email || '');
            const safePhone    = sanitize(record.Telephone || record.Phone || '');
            const safeAddress  = sanitize(record.Address || '');

            els.fullName.value = safeFullName;
            els.email.value    = safeEmail;
            els.phone.value    = safePhone;
            els.address.value  = safeAddress;

        } catch (err) {
            console.error('Failed to load user data:', err);
            showMsg('Failed to load your information.', 'error');
        }
    }

    /* ==================== 5. UI HELPERS ==================== */
    function enableEdit() {
        document.querySelectorAll('#accountForm input').forEach(input => {
            input.readOnly = false;
            input.classList.remove('readonly');
            input.classList.add('edit-mode');
        });
        els.editBtn.style.display = 'none';
        els.saveBtn.style.display = 'inline-block';
        els.cancelBtn.style.display = 'inline-block';
    }

    function disableEdit() {
        document.querySelectorAll('#accountForm input').forEach(input => {
            if (input) {
            input.readOnly = true;
            input.classList.add('readonly');
            input.classList.remove('edit-mode');
            }
        });
        els.editBtn.style.display = 'inline-block';
        els.saveBtn.style.display = 'none';
        els.cancelBtn.style.display = 'none';
    }

    function showMsg(text, type = 'success') {
        // Sanitize message before display
        const safeText = DOMPurify.sanitize(text, { ALLOWED_TAGS: ['strong', 'em'] });
        els.msgBox.innerHTML = safeText;
        els.msgBox.className = `msg ${type}`;
        setTimeout(() => els.msgBox.innerHTML = '', 5000);
    }

    /* ==================== 6. EDIT / SAVE / CANCEL ==================== */
    els.editBtn.addEventListener('click', enableEdit);

    els.cancelBtn.addEventListener('click', () => {
        const safeFullName = sanitize(`${originalData.First || ''} ${originalData.Last || ''}`);
        const safeEmail    = sanitize(originalData.Email || '');
        const safePhone    = sanitize(originalData.Telephone || originalData.Phone || '');
        const safeAddress  = sanitize(originalData.Address || '');

        els.fullName.value = safeFullName;
        els.email.value    = safeEmail;
        els.phone.value    = safePhone;
        els.address.value  = safeAddress;

        disableEdit();
        showMsg('Changes cancelled.');
    });

    els.saveBtn.addEventListener('click', async () => {
        // Sanitize all inputs
        const rawName = els.fullName.value;
        const rawEmail = els.email.value;
        const rawPhone = els.phone.value;
        const rawAddress = els.address.value;

        const name = sanitize(rawName);
        const email = sanitize(rawEmail);
        const phone = sanitize(rawPhone);
        const address = sanitize(rawAddress);

        const nameParts = name.split(/\s+/).filter(Boolean);
        if (nameParts.length < 2) {
            showMsg('Please enter both first and last name.', 'error');
            return;
        }
        const [first, ...lastParts] = nameParts;
        const last = lastParts.join(' ');

        if (!email.includes('@') || !email.includes('.')) {
            showMsg('Please enter a valid email address.', 'error');
            return;
        }
        if (!/^\+?[\d\s\-]{10,}$/.test(phone)) {
            showMsg('Please enter a valid phone number.', 'error');
            return;
        }

        try {
            // PRESERVE ALL NON-SENSITIVE FIELDS (never encrypted)
            const preserved = {
                id: originalData.id,
                Gender: originalData.Gender || '',
                StaffID: userId,
            };

            // BUILD FINAL UPDATED RECORD - with correct field casing for doctors
            const updated = {
                ...preserved,
                First: first, 
                Last: last,
                Email: email,
                Telephone: phone,
                Address: address,
                first_name: first,
                last_name: last,
                email: email,
                Specialization: originalData.Specialization || '',
                StaffID: userId
            };

            // Encrypt & save
            const encrypted = await clinicDB.encryptDoctorInfo(updated);
            await clinicDB.updateItem('doctors', encrypted);

            // Update originalData so Cancel works + future edits preserve everything
            originalData = { ...originalData, ...updated };

            disableEdit();
            showMsg('Account updated successfully!', 'success');
        } catch (err) {
            console.error('Save failed:', err);
            showMsg('Failed to save changes. Please try again.', 'error');
        }
    });

    /* ==================== 7. PASSWORD CHANGE  ==================== */
    document.getElementById('updatePasswordBtn').addEventListener('click', async () => {
        const current = document.getElementById('currentPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;

        if (!current || !newPass || newPass !== confirm) {
            const error = document.getElementById('password-change-form-error');
            error.innerText = sanitize('Please fill all fields and ensure passwords match.');
            return;
        }

        if (newPass.length < 6) {
            const error = document.getElementById('password-change-form-error');
            error.innerText = sanitize('New password must be at least 6 characters.');
            return;
        }

        const loginCheck = await clinicDB.login(currentUser.username, current);
        if (!loginCheck.success) {
            const error = document.getElementById('password-change-form-error');
            error.innerText = sanitize('Current password is incorrect.');
            return;
        }

        try {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            const encryptedNew = await clinicDB.encryptData(newPass);
            const userRecord = await clinicDB.getItem('users', currentUser.username);
            userRecord.password = encryptedNew;
            await clinicDB.updateItem('users', userRecord);
            await logCurrentUserActivity('Password Change', user.linkedId, `User with ID ${user.linkedId} has changed their password`)
            const error = document.getElementById('password-change-form-success');
            error.innerText = sanitize('Password updated successfully!');
            document.getElementById('currentPassword').value =
            document.getElementById('newPassword').value =
            document.getElementById('confirmPassword').value = '';
        } catch (err) {
            console.error('Password update failed:', err);
            alert('Failed to update password.');
        }
    });

    /* ==================== 8. INITIALIZE ==================== */
    await loadUserData();
});