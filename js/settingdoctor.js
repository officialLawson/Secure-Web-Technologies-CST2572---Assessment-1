// settingdoctor.js – Ensure clean save (no extras)

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
            if (record) {
                record = await clinicDB.decryptDoctorInfo(record);
                // Extra cleanup here too
                const extras = ['Title', 'NHS', 'Specialization', 'StaffID', 'first_name', 'last_name', 'email', 'gender'];
                extras.forEach(key => delete record[key]);
            }

            if (!record) {
                showMsg('Doctor not found.', 'error');
                return;
            }

            originalData = { ...record };

            const fullNameStr = `Dr ${record.First || ''} ${record.Last || ''}`.trim();
            els.fullName.value = sanitize(fullNameStr);
            els.email.value = sanitize(record.Email || '');
            els.phone.value = sanitize(record.Telephone || '');
            els.address.value = sanitize(record.Address || '');

        } catch (err) {
            console.error(err);
            showMsg('Failed to load data.', 'error');
        }
    }

    function showMsg(text, type = 'success') {
        els.msgBox.innerHTML = sanitize(text);
        els.msgBox.className = `msg ${type}`;
        setTimeout(() => els.msgBox.innerHTML = '', 5000);
    }

    function enableEdit() {
        ['fullName','email','phone','address'].forEach(id => {
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
        ['fullName','email','phone','address'].forEach(id => {
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
        const fullNameStr = `Dr ${originalData.First || ''} ${originalData.Last || ''}`.trim();
        els.fullName.value = sanitize(fullNameStr);
        els.email.value = sanitize(originalData.Email || '');
        els.phone.value = sanitize(originalData.Telephone || '');
        els.address.value = sanitize(originalData.Address || '');
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
        const First = nameParts[0];
        const Last = nameParts.slice(1).join(' ');

        if (!email.includes('@') || !email.includes('.')) {
            showMsg('Valid email required.', 'error');
            return;
        }

        try {
            const updated = {
                id: originalData.id,
                First,
                Last,
                Email: email,
                Gender: originalData.Gender || '',
                Address: address,
                Telephone: phone
            };

            // Explicitly remove any patient extras before encrypt
            ['Title', 'NHS', 'DOB', 'Specialization', 'StaffID', 'first_name', 'last_name', 'email', 'gender'].forEach(key => delete updated[key]);

            const encrypted = await clinicDB.encryptDoctorInfo(updated);
            await clinicDB.updateItem('doctors', encrypted);

            // Reload fresh
            const fresh = await clinicDB.getItem('doctors', userId);
            originalData = await clinicDB.decryptDoctorInfo(fresh);

            disableEdit();
            showMsg('Updated successfully!', 'success');
        } catch (err) {
            console.error(err);
            showMsg('Save failed.', 'error');
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
            alert('Password update failed.');
        }
    });

    await loadUserData();
});