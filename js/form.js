document.addEventListener("DOMContentLoaded", () => {
  'use strict';

  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

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

  const updatePlaceholderState = (container, trigger, value) => {
    if (value) {
      trigger.classList.remove('placeholder');
    } else {
      trigger.classList.add('placeholder');
    }
  };

  // -----------------------------------------------------------------
  // 1. DOCTOR
  // -----------------------------------------------------------------
  const docTrigger = document.querySelector('#doctorSelect .custom-select__trigger');
  const docText = docTrigger?.querySelector('.trigger-text');
  const docContainer = document.getElementById('doctorSelect');
  const docHidden = document.getElementById('doctorName');

  if (docTrigger && docText && docContainer && docHidden) {
    updatePlaceholderState(docContainer, docTrigger, docHidden.value);

    docTrigger.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeAll();

      const opts = document.createElement('div');
      opts.className = 'custom-select__options';
      opts.innerHTML = '<div class="list-item" style="text-align:center; color:var(--text-muted);">Loading doctors...</div>';
      docContainer.appendChild(opts);
      docTrigger.setAttribute('aria-expanded', 'true');

      try {
        const db = await openClinicDB();
        const tx = db.transaction('doctors', 'readonly');
        const store = tx.objectStore('doctors');
        const doctors = await new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        opts.innerHTML = '';

        if (!doctors.length) {
          opts.innerHTML = '<div class="list-item" style="text-align:center; color:var(--text-muted);">No doctors available</div>';
          return;
        }

        for (const d of doctors) {
          const firstName = d.First || d.first_name || 'Unknown';
          const lastName = d.Last || d.last_name || '';
          const fullName = `${firstName} ${lastName}`.trim() || `Doctor ${d.id}`;
          const safeName = sanitize(fullName);

          const div = document.createElement('div');
          div.className = 'list-item';
          div.textContent = safeName;
          div.dataset.value = d.id;
          div.tabIndex = 0;
          div.addEventListener('click', () => {
            docText.textContent = safeName;
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

  if (reasonTrigger && reasonText && reasonContainer && reasonHidden) {
    updatePlaceholderState(reasonContainer, reasonTrigger, reasonHidden.value);

    reasonTrigger.addEventListener('click', e => {
      e.stopPropagation();
      closeAll();

      const opts = document.createElement('div');
      opts.className = 'custom-select__options';
      reasonContainer.appendChild(opts);
      reasonTrigger.setAttribute('aria-expanded', 'true');

      const reasons = [
        { value: 'Consultation', text: 'Consultation' },
        { value: 'Routine check-up', text: 'Routine check-up' },
        { value: 'Follow-up', text: 'Follow-up' },
        { value: 'Treatment review', text: 'Treatment review' }
      ];

      reasons.forEach(r => {
        const safeText = sanitize(r.text);
        const div = document.createElement('div');
        div.className = 'list-item';
        div.textContent = safeText;
        div.dataset.value = r.value;
        div.tabIndex = 0;
        div.addEventListener('click', () => {
          reasonText.textContent = safeText;
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

  if (dateInp && dateContainer) {
    const renderCalendar = (y, m) => {
      const existing = dateContainer.querySelector('.custom-date__calendar');
      if (existing) existing.remove();

      const cal = document.createElement('div');
      cal.className = 'custom-date__calendar';

      const firstDay = new Date(y, m, 1).getDay();
      const lastDate = new Date(y, m + 1, 0).getDate();
      const today = new Date(); today.setHours(0, 0, 0, 0);

      const safeMonthYear = sanitize(new Date(y, m).toLocaleString('default', { month: 'long', year: 'numeric' }));
      cal.innerHTML = `
        <div class="cal-header">
          <button type="button" class="cal-btn prev" aria-label="Previous month">Previous</button>
          <span class="cal-title">${safeMonthYear}</span>
          <button type="button" class="cal-btn next" aria-label="Next month">Next</button>
        </div>
        <div class="cal-weekdays">
          ${['S','M','T','W','T','F','S'].map(d => `<div role="columnheader" aria-label="${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][['S','M','T','W','T','F','S'].indexOf(d)]}">${sanitize(d)}</div>`).join('')}
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
        cell.textContent = sanitize(d);
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
            const formattedValue = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            dateInp.value = formattedValue;

            const displayDiv = dateContainer.querySelector('.custom-date__input');
            if (displayDiv) {
              const displayDate = new Date(y, m, d);
              const safeDisplay = sanitize(displayDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              }));
              displayDiv.textContent = safeDisplay;
              displayDiv.classList.remove('placeholder');
              displayDiv.focus();
            }

            cal.remove();
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

    const displayDiv = dateContainer.querySelector('.custom-date__input');
    if (dateInp.value && displayDiv) {
      const [year, month, day] = dateInp.value.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (!isNaN(dateObj.getTime())) {
        const safeDisplay = sanitize(dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }));
        displayDiv.textContent = safeDisplay;
        displayDiv.classList.remove('placeholder');
      }
    }

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
  const timeTrigger = timeContainer?.querySelector('.custom-time__input');

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

      const safeHour = sanitize(String(selectedHour).padStart(2, '0'));
      const safeMinute = sanitize(String(selectedMinute).padStart(2, '0'));
      picker.innerHTML = `
        <div class="time-picker-header">Enter time</div>
        <div class="time-picker-display">
          <div class="time-section">
            <div class="time-value hour-value" tabindex="0">${safeHour}</div>
            <div class="time-label">Hour</div>
          </div>
          <div class="time-separator">:</div>
          <div class="time-section">
            <div class="time-value minute-value" tabindex="0">${safeMinute}</div>
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

      hourValue.addEventListener('click', () => {
        selectedHour = selectedHour >= 12 ? 1 : selectedHour + 1;
        hourValue.textContent = sanitize(String(selectedHour).padStart(2, '0'));
      });
      hourValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          hourValue.click();
        }
      });

      minuteValue.addEventListener('click', () => {
        selectedMinute = (selectedMinute + 15) % 60;
        minuteValue.textContent = sanitize(String(selectedMinute).padStart(2, '0'));
      });
      minuteValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          minuteValue.click();
        }
      });

      periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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

      picker.querySelector('.cancel-btn').addEventListener('click', () => {
        picker.remove();
        timeTrigger.focus();
      });

      picker.querySelector('.ok-btn').addEventListener('click', () => {
        let hour24 = selectedHour;
        if (selectedPeriod === 'PM' && selectedHour !== 12) hour24 += 12;
        if (selectedPeriod === 'AM' && selectedHour === 12) hour24 = 0;
        const formattedTime = `${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
        timeInp.value = formattedTime;
        const safeDisplay = sanitize(`${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')} ${selectedPeriod}`);
        timeTrigger.textContent = safeDisplay;
        updatePlaceholderState(timeContainer, timeTrigger, formattedTime);
        picker.remove();
        timeTrigger.focus();
      });

      timeContainer.appendChild(picker);
      hourValue.focus();
    };

    timeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAll();
      renderTimePicker();
    });
  }

});