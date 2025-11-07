document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser || currentUser.role?.toLowerCase() !== 'doctor') {
        window.location.href = 'login.html';
        return;
    }

    const userId = currentUser.linkedId;

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

    const sanitize = (input) => DOMPurify.sanitize(String(input || '').trim(), { ALLOWED_TAGS: [] });

    async function loadUserData() {
        try {
            await clinicDB.openClinicDB();
            let record = await clinicDB.getItem('doctors', userId);
            
            if (!record) {
                showMsg('Doctor record not found.', 'error');
                return;
            }

            record = await clinicDB.decryptDoctorInfo(record);
            

            const firstName = record.first_name || record.First || record.firstName || '';
            const lastName = record.last_name || record.Last || record.lastName || '';
            const email = record.email || record.Email || '';
            const gender = record.gender || record.Gender || '';
            const address = record.Address || record.address || '';
            const telephone = record.Telephone || record.telephone || record.phone || '';

            if (!firstName || !lastName) {
                showMsg(`Doctor profile incomplete - Name data: First="${firstName}", Last="${lastName}"`, 'error');
                console.error('Available fields:', Object.keys(record));
                return;
            }

            originalData = {
                id: record.id,
                first_name: firstName,
                last_name: lastName,
                email: email,
                gender: gender,
                Address: address,
                Telephone: telephone
            };

            const fullNameStr = `Dr ${originalData.first_name} ${originalData.last_name}`.trim();
            els.fullName.value = sanitize(fullNameStr);
            els.email.value = sanitize(originalData.email);
            els.phone.value = sanitize(originalData.Telephone);
            els.address.value = sanitize(originalData.Address);

        } catch (err) {
            console.error('Load error:', err);
            showMsg('Failed to load profile data: ' + err.message, 'error');
        }
    }

    function showMsg(text, type = 'success') {
        els.msgBox.innerHTML = sanitize(text);
        els.msgBox.className = `msg ${type}`;
        setTimeout(() => els.msgBox.innerHTML = '', 5000);
    }

    function enableEdit() {
        ['fullName', 'email', 'phone', 'address'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.readOnly = false;
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
                el.classList.remove('edit-mode');
            }
        });
        els.editBtn.style.display = 'inline-block';
        els.saveBtn.style.display = 'none';
        els.cancelBtn.style.display = 'none';
    }

    els.editBtn.addEventListener('click', enableEdit);

    els.cancelBtn.addEventListener('click', () => {
        const fullNameStr = `Dr ${originalData.first_name} ${originalData.last_name}`.trim();
        els.fullName.value = sanitize(fullNameStr);
        els.email.value = sanitize(originalData.email);
        els.phone.value = sanitize(originalData.Telephone);
        els.address.value = sanitize(originalData.Address);
        disableEdit();
        showMsg('Changes cancelled.');
    });

    els.saveBtn.addEventListener('click', async () => {
        const name = sanitize(els.fullName.value);
        const email = sanitize(els.email.value);
        const phone = sanitize(els.phone.value);
        const address = sanitize(els.address.value);

        const nameParts = name.replace(/^Dr\s*/i, '').trim().split(/\s+/);
        if (nameParts.length < 2) {
            showMsg('Enter first and last name.', 'error');
            return;
        }
        const first_name = nameParts[0];
        const last_name = nameParts.slice(1).join(' ');

        if (!email.includes('@') || !email.includes('.')) {
            showMsg('Valid email required.', 'error');
            return;
        }
        try {
            const updated = {
                id: originalData.id,
                first_name: first_name,
                last_name: last_name,
                email: email,
                gender: originalData.gender,
                Address: address,
                Telephone: phone 
            };

            const encrypted = await clinicDB.encryptDoctorInfo(updated); 
            await clinicDB.updateItem('doctors', encrypted);

            const fresh = await clinicDB.getItem('doctors', userId);
            originalData = await clinicDB.decryptDoctorInfo(fresh);

            disableEdit();
            await logCurrentUserActivity("updateAccount", userId, `Doctor with ID ${userId} has updated their account details`);
            showMsg('Profile updated successfully!', 'success');
        } catch (err) {
            console.error('Save error:', err);
            showMsg('Save failed: ' + err.message, 'error');
        }
    });

    // Password change
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

    await loadUserData();
});