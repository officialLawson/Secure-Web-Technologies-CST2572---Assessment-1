(() => {
  'use strict';

  const closeAll = () => {
    document.querySelectorAll('.custom-select__options, .custom-date__calendar, .custom-time__picker')
      .forEach(el => {
        if (el.parentNode) el.remove();
      });
  };

  document.addEventListener('click', e => {
    if (!e.target.closest('#doctorSelect, #datePicker, #timePicker, #reasonSelect')) {
      closeAll();
    }
  });

  // Helper: toggle placeholder class
  const updatePlaceholderState = (container, trigger, value) => {
    if (value) {
      trigger.classList.remove('placeholder');
    } else {
      trigger.classList.add('placeholder');
    }
  };

  // -----------------------------------------------------------------
  // 1. DOCTOR – FIXED: Fetch from IndexedDB and decrypt
  // -----------------------------------------------------------------
  const docTrigger = document.querySelector('#doctorSelect .custom-select__trigger');
  const docText = docTrigger?.querySelector('.trigger-text');
  const docContainer = document.getElementById('doctorSelect');
  const docHidden = document.getElementById('doctorName');

  if (docTrigger && docContainer && docHidden) {
    updatePlaceholderState(docContainer, docTrigger, docHidden.value);

    docTrigger.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAll();

      // Show loading state
      const opts = document.createElement('div');
      opts.className = 'custom-select__options';
      opts.innerHTML = '<div class="list-item" style="text-align:center; color:var(--text-muted);">Loading doctors...</div>';
      docContainer.appendChild(opts);
      docTrigger.setAttribute('aria-expanded', 'true');

      try {
        // Open DB and fetch all doctors
        const db = await openClinicDB();
        const tx = db.transaction('doctors', 'readonly');
        const store = tx.objectStore('doctors');
        const doctors = await new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        // Clear loading message
        opts.innerHTML = '';

        if (!doctors || doctors.length === 0) {
          opts.innerHTML = '<div class="list-item" style="text-align:center; color:var(--text-muted);">No doctors available</div>';
          return;
        }

        // Add each doctor to dropdown
        for (const d of doctors) {
          // Decrypt doctor info to get name
          let firstName = d.First || d.first_name || 'Unknown';
          let lastName = d.Last || d.last_name || '';
          if (d.payload) {
            try {
              const decrypted = await decryptData(d.payload);
              const sensitive = JSON.parse(decrypted);
              // Note: In your encryptDoctorInfo, you only encrypt Email, Address, Telephone
              // So First/Last remain in plain text — no need to decrypt for name
            } catch (err) {
              console.warn('Failed to decrypt doctor payload (name may be incomplete)', err);
            }
          }
          const fullName = `${firstName} ${lastName}`.trim() || `Doctor ${d.id}`;

          const div = document.createElement('div');
          div.className = 'list-item';
          div.textContent = fullName;
          div.dataset.value = d.id;
          div.tabIndex = 0;
          div.addEventListener('click', () => {
            docText.textContent = fullName;
            docHidden.value = d.id;
            updatePlaceholderState(docContainer, docTrigger, d.id);
            closeAll();
            docTrigger.setAttribute('aria-expanded', 'false');
            docTrigger.focus();
          });
          div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              div.click();
            }
          });
          opts.appendChild(div);
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
        opts.innerHTML = '<div class="list-item" style="text-align:center; color:var(--text-negative);">Error loading doctors</div>';
      }
    });
  }

  // -----------------------------------------------------------------
  // 2. REASON
  // -----------------------------------------------------------------
  const reasonTrigger = document.querySelector('#reasonSelect .custom-select__trigger');
  const reasonText = reasonTrigger?.querySelector('.trigger-text');
  const reasonContainer = document.getElementById('reasonSelect');
  const reasonHidden = document.getElementById('appointmentReason');

  if (reasonTrigger && reasonContainer && reasonHidden) {
    updatePlaceholderState(reasonContainer, reasonTrigger, reasonHidden.value);

    reasonTrigger.addEventListener('click', e => {
      e.stopPropagation();
      closeAll();
      const opts = document.createElement('div');
      opts.className = 'custom-select__options';
      reasonContainer.appendChild(opts);
      reasonTrigger.setAttribute('aria-expanded', 'true');

      const reasons = [
        {value: 'Consultation', text: 'Consultation'},
        {value: 'Routine check-up', text: 'Routine check-up'},
        {value: 'Follow-up', text: 'Follow-up'},
        {value: 'Treatment review', text: 'Treatment review'}
      ];
      reasons.forEach(r => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.textContent = r.text;
        div.dataset.value = r.value;
        div.tabIndex = 0;
        div.addEventListener('click', () => {
          reasonText.textContent = r.text;
          reasonHidden.value = r.value;
          updatePlaceholderState(reasonContainer, reasonTrigger, r.value);
          closeAll();
          reasonTrigger.setAttribute('aria-expanded', 'false');
          reasonTrigger.focus();
        });
        div.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            div.click();
          }
        });
        opts.appendChild(div);
      });
    });
  }

  // -----------------------------------------------------------------
  // 3. DATE
  // -----------------------------------------------------------------
  const dateInp = document.getElementById('appointmentDate');
  const dateContainer = document.getElementById('datePicker');
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  const renderCalendar = (y, m) => {
    const existing = dateContainer.querySelector('.custom-date__calendar');
    if (existing) existing.remove();

    const cal = document.createElement('div');
    cal.className = 'custom-date__calendar';

    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    cal.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-btn prev" aria-label="Previous month">Previous</button>
        <span class="cal-title">${new Date(y, m).toLocaleString('default', {month:'long', year:'numeric'})}</span>
        <button type="button" class="cal-btn next" aria-label="Next month">Next</button>
      </div>
      <div class="cal-weekdays">
        ${['S','M','T','W','T','F','S'].map(d => `<div role="columnheader" aria-label="${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d === 'S' ? (cal.querySelector('.cal-weekdays div')?.textContent === 'S' && !cal.querySelector('.cal-weekdays div:nth-child(2)')?.textContent ? 0 : 6) : ['S','M','T','W','T','F','S'].indexOf(d)]}">${d}</div>`).join('')}
      </div>
      <div class="cal-grid" role="grid"></div>
    `;

    const grid = cal.querySelector('.cal-grid');
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.setAttribute('role', 'gridcell');
      grid.appendChild(empty);
    }
    for (let d = 1; d <= lastDate; d++) {
      const cell = document.createElement('div');
      const dateObj = new Date(y, m, d);
      const isPast = dateObj < today;
      cell.textContent = d;
      cell.className = 'cal-day';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '-1');
      if (isPast) {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.classList.add('selectable');
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click', () => {
          const formattedValue = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          dateInp.value = formattedValue;

          const displayDiv = dateContainer.querySelector('.custom-date__input');
          if (displayDiv) {
            const displayDate = new Date(y, m, d);
            displayDiv.textContent = displayDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            displayDiv.classList.remove('placeholder');
          }

          cal.remove();
          const displayDivFinal = dateContainer.querySelector('.custom-date__input');
          if (displayDivFinal) displayDivFinal.focus();
        });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cell.click();
          }
        });
      }
      grid.appendChild(cell);
    }

    cal.querySelector('.prev').addEventListener('click', e => {
      e.stopPropagation();
      calMonth = m === 0 ? 11 : m - 1;
      calYear = m === 0 ? y - 1 : y;
      renderCalendar(calYear, calMonth);
    });
    cal.querySelector('.next').addEventListener('click', e => {
      e.stopPropagation();
      calMonth = m === 11 ? 0 : m + 1;
      calYear = m === 11 ? y + 1 : y;
      renderCalendar(calYear, calMonth);
    });

    dateContainer.appendChild(cal);
  };

  if (dateInp && dateContainer) {
    const displayDiv = dateContainer.querySelector('.custom-date__input');
    if (dateInp.value && displayDiv) {
      const [year, month, day] = dateInp.value.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (!isNaN(dateObj.getTime())) {
        displayDiv.textContent = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        displayDiv.classList.remove('placeholder');
      }
    }

    // Click on visible date box opens calendar
    if (displayDiv) {
      displayDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        renderCalendar(calYear, calMonth);
      });
    }
  }

  // -----------------------------------------------------------------
  // 4. TIME
  // -----------------------------------------------------------------
  const timeInp = document.getElementById('appointmentTime');
  const timeContainer = document.getElementById('timePicker');
  const timeTrigger = timeContainer.querySelector('.custom-time__input');

  if (timeInp && timeContainer && timeTrigger) {
    updatePlaceholderState(timeContainer, timeTrigger, timeInp.value);

    let selectedHour = 7;
    let selectedMinute = 0;
    let selectedPeriod = 'AM';

    const parseTime = (timeStr) => {
      if (!timeStr) return;
      const [h, m] = timeStr.split(':').map(Number);
      if (h >= 12) {
        selectedHour = h === 12 ? 12 : h - 12;
        selectedPeriod = 'PM';
      } else {
        selectedHour = h === 0 ? 12 : h;
        selectedPeriod = 'AM';
      }
      selectedMinute = m;
    };

    if (timeInp.value) {
      parseTime(timeInp.value);
    }

    const renderTimePicker = () => {
      const existing = timeContainer.querySelector('.custom-time__picker');
      if (existing) existing.remove();

      const picker = document.createElement('div');
      picker.className = 'custom-time__picker';
      
      picker.innerHTML = `
        <div class="time-picker-header">Enter time</div>
        <div class="time-picker-display">
          <div class="time-section">
            <div class="time-value hour-value" tabindex="0">${String(selectedHour).padStart(2, '0')}</div>
            <div class="time-label">Hour</div>
          </div>
          <div class="time-separator">:</div>
          <div class="time-section">
            <div class="time-value minute-value" tabindex="0">${String(selectedMinute).padStart(2, '0')}</div>
            <div class="time-label">Minute</div>
          </div>
          <div class="time-period">
            <button type="button" class="period-btn ${selectedPeriod === 'AM' ? 'active' : ''}" data-period="AM" aria-pressed="${selectedPeriod === 'AM'}">AM</button>
            <button type="button" class="period-btn ${selectedPeriod === 'PM' ? 'active' : ''}" data-period="PM" aria-pressed="${selectedPeriod === 'PM'}">PM</button>
          </div>
        </div>
        <div class="time-picker-actions">
          <button type="button" class="time-action-btn cancel-btn">Cancel</button>
          <button type="button" class="time-action-btn ok-btn">OK</button>
        </div>
      `;

      const hourValue = picker.querySelector('.hour-value');
      const minuteValue = picker.querySelector('.minute-value');
      const periodBtns = picker.querySelectorAll('.period-btn');

      hourValue.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedHour = selectedHour >= 12 ? 1 : selectedHour + 1;
        hourValue.textContent = String(selectedHour).padStart(2, '0');
      });
      hourValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          hourValue.click();
        }
      });

      minuteValue.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedMinute = (selectedMinute + 15) % 60;
        minuteValue.textContent = String(selectedMinute).padStart(2, '0');
      });
      minuteValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          minuteValue.click();
        }
      });

      periodBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          periodBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          selectedPeriod = btn.dataset.period;
        });
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            btn.click();
          }
        });
      });

      picker.querySelector('.cancel-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        picker.remove();
        timeTrigger.focus();
      });

      picker.querySelector('.ok-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        let hour24 = selectedHour;
        if (selectedPeriod === 'PM' && selectedHour !== 12) hour24 += 12;
        if (selectedPeriod === 'AM' && selectedHour === 12) hour24 = 0;
        const formattedTime = `${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
        timeInp.value = formattedTime;
        timeTrigger.textContent = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')} ${selectedPeriod}`;
        updatePlaceholderState(timeContainer, timeTrigger, formattedTime);
        picker.remove();
        timeTrigger.focus();
      });

      timeContainer.appendChild(picker);
      picker.querySelector('.hour-value').focus();
    };

    timeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      renderTimePicker();
    });
  }

  // -----------------------------------------------------------------
  // 5. FORM VALIDATION & SUBMIT
  // -----------------------------------------------------------------
  window.handleAddAppointment = function (e) {
    e.preventDefault();
    closeAll();

    // Reset errors
    document.querySelectorAll('.error-message').forEach(el => {
      el.classList.remove('show');
    });

    const doctorId = docHidden?.value;
    const date = dateInp?.value;
    const time = timeInp?.value;
    const reason = reasonHidden?.value;

    let hasError = false;

    if (!doctorId) {
      document.getElementById('doctorName-form-error').classList.add('show');
      hasError = true;
    }
    if (!date) {
      document.getElementById('appointmentDate-form-error').classList.add('show');
      hasError = true;
    }
    if (!time) {
      document.getElementById('appointmentTime-form-error').classList.add('show');
      hasError = true;
    }
    if (!reason) {
      document.getElementById('appointmentReason-form-error').classList.add('show');
      hasError = true;
    }

    if (hasError) {
      // Focus first error
      const firstError = document.querySelector('.error-message.show');
      if (firstError) {
        const fieldId = firstError.id.replace('-form-error', '');
        const trigger = document.querySelector(`[for="${fieldId}"]`)?.parentElement?.querySelector('.custom-select__trigger, .custom-date__input, .custom-time__input');
        trigger?.focus();
      }
      return;
    }

    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    const user = JSON.parse(localStorage.getItem('currentUser'));
    const apptId = `appt_${Date.now()}`;
    openClinicDB().then(db => {
      const tx = db.transaction('appointments', 'readwrite');
      tx.objectStore('appointments').add({
        appointmentId: apptId,
        doctorId,
        patientId: user.linkedId,
        reason,
        date,
        time,
        status: 'Pending'
      });
      return tx.done;
    }).then(() => {
      alert('Appointment added!');
      window.location.href = `appointments-${user.role.toLowerCase()}.html`;
    }).catch(err => {
      console.error(err);
      alert('Failed to save appointment.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Appointment';
    });
  };

})();


// -----------------------------------------------------------------
  // 6. DATE OF BIRTH
  // -----------------------------------------------------------------
  const dateInp = document.getElementById('userDOB');
  const dateContainer = document.getElementById('datePicker');
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  if (dateInp) {
    console.log("date exists");
  }

  const renderCalendar = (y, m) => {
    const existing = dateContainer.querySelector('.custom-date__calendar');
    if (existing) existing.remove();

    const cal = document.createElement('div');
    cal.className = 'custom-date__calendar';

    const firstDay = new Date(y, m, 1).getDay();
    const lastDate = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    cal.innerHTML = `
      <div class="cal-header">
        <button type="button" class="cal-btn prev" aria-label="Previous month">Previous</button>
        <span class="cal-title">${new Date(y, m).toLocaleString('default', {month:'long', year:'numeric'})}</span>
        <button type="button" class="cal-btn next" aria-label="Next month">Next</button>
      </div>
      <div class="cal-weekdays">
        ${['S','M','T','W','T','F','S'].map(d => `<div role="columnheader" aria-label="${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d === 'S' ? (cal.querySelector('.cal-weekdays div')?.textContent === 'S' && !cal.querySelector('.cal-weekdays div:nth-child(2)')?.textContent ? 0 : 6) : ['S','M','T','W','T','F','S'].indexOf(d)]}">${d}</div>`).join('')}
      </div>
      <div class="cal-grid" role="grid"></div>
    `;

    const grid = cal.querySelector('.cal-grid');
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.setAttribute('role', 'gridcell');
      grid.appendChild(empty);
    }
    for (let d = 1; d <= lastDate; d++) {
      const cell = document.createElement('div');
      const dateObj = new Date(y, m, d);
      const isPast = dateObj < today;
      cell.textContent = d;
      cell.className = 'cal-day';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('tabindex', '-1');
      if (isPast) {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.classList.add('selectable');
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click', () => {
          const formattedValue = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          dateInp.value = formattedValue;

          const displayDiv = dateContainer.querySelector('.custom-date__input');
          if (displayDiv) {
            const displayDate = new Date(y, m, d);
            displayDiv.textContent = displayDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            displayDiv.classList.remove('placeholder');
          }

          cal.remove();
          const displayDivFinal = dateContainer.querySelector('.custom-date__input');
          if (displayDivFinal) displayDivFinal.focus();
        });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cell.click();
          }
        });
      }
      grid.appendChild(cell);
    }

    cal.querySelector('.prev').addEventListener('click', e => {
      e.stopPropagation();
      calMonth = m === 0 ? 11 : m - 1;
      calYear = m === 0 ? y - 1 : y;
      renderCalendar(calYear, calMonth);
    });
    cal.querySelector('.next').addEventListener('click', e => {
      e.stopPropagation();
      calMonth = m === 11 ? 0 : m + 1;
      calYear = m === 11 ? y + 1 : y;
      renderCalendar(calYear, calMonth);
    });

    dateContainer.appendChild(cal);
  };

  if (dateInp && dateContainer) {
    const displayDiv = dateContainer.querySelector('.custom-date__input');
    if (dateInp.value && displayDiv) {
      const [year, month, day] = dateInp.value.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (!isNaN(dateObj.getTime())) {
        displayDiv.textContent = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        displayDiv.classList.remove('placeholder');
      }
    }

    // Click on visible date box opens calendar
    if (displayDiv) {
      displayDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
        renderCalendar(calYear, calMonth);
      });
    }
  }