/* Minimal client-side appointment complete helper.
   - Injects "Mark Completed" buttons into appointment table rows on doctor pages.
   - Shows confirm modal already styled by existing CSS classes.
   - Updates the DOM (status label, disables button) and attempts to persist by calling existing global functions if present
     (window.updateAppointmentStatus or window.markAppointmentComplete), otherwise falls back to window.appointments or localStorage.
   - Auto-completes past appointments on load and every minute.
*/
(function () {
  let currentAppointmentId = null;

  function hideModal() {
    const m = document.getElementById('complete-modal');
    if (m) m.classList.add('hidden'), m.setAttribute('aria-hidden', 'true');
  }
  function showModal() {
    const m = document.getElementById('complete-modal');
    if (m) m.classList.remove('hidden'), m.setAttribute('aria-hidden', 'false');
  }

  function uiMarkCompleted(row) {
    if (!row) return;
    row.dataset.status = 'Completed';
    // Update status label element if present
    const statusLabel = row.querySelector('.status-label, .status');
    if (statusLabel) statusLabel.textContent = 'Completed';
    // Update any status cell text if there is no label
    const statusCell = row.querySelector('td:nth-child(4)');
    if (!statusLabel && statusCell) {
      statusCell.textContent = 'Completed';
    }
    // Disable the complete button if present
    const btn = row.querySelector('.complete-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Completed';
      btn.classList.add('request-sent');
      btn.setAttribute('aria-pressed', 'true');
    }
    // Optional: fill .completed-at if present
    const completedAtEl = row.querySelector('.completed-at');
    if (completedAtEl) completedAtEl.textContent = new Date().toLocaleString();
  }

  async function persistMarkCompleted(id) {
    try {
      if (window.updateAppointmentStatus && typeof window.updateAppointmentStatus === 'function') {
        await window.updateAppointmentStatus(id, 'completed');
        return;
      }
      if (window.markAppointmentComplete && typeof window.markAppointmentComplete === 'function') {
        await window.markAppointmentComplete(id);
        return;
      }
      if (Array.isArray(window.appointments)) {
        const i = window.appointments.findIndex(a => String(a.id) === String(id));
        if (i > -1) {
          window.appointments[i].status = 'Completed';
          window.appointments[i].completedAt = new Date().toISOString();
          return;
        }
      }
      const key = 'appointments';
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const idx = arr.findIndex(a => String(a.id) === String(id));
            if (idx > -1) {
              arr[idx].status = 'Completed';
              arr[idx].completedAt = new Date().toISOString();
              localStorage.setItem(key, JSON.stringify(arr));
              return;
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      // If nothing matched, succeed silently (UI already updated).
    } catch (err) {
      console.error('persistMarkCompleted error', err);
    }
  }

  function markCompletedById(id) {
    const selector = `tr[data-id="${id}"]`;
    const row = document.querySelector(selector);
    if (!row) return;
    uiMarkCompleted(row);
    // persist in background
    persistMarkCompleted(id);
  }

  function injectButtonsIntoRows() {
    // For each table row that looks like an appointment, insert a Mark Completed button if role is doctor/admin and not already present
    const user = (() => {
      try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch (e) { return {}; }
    })();
    const role = (user.role || '').toLowerCase();
    if (role !== 'doctor' && role !== 'admin') return; // only for doctor/admin pages

    const rows = document.querySelectorAll('tbody tr[data-id]');
    rows.forEach(row => {
      // skip if already has a complete button or already completed
      if (row.querySelector('.complete-btn')) return;
      const status = (row.dataset.status || (row.querySelector('.status-label') && row.querySelector('.status-label').textContent) || '').toLowerCase();
      if (status === 'Completed') return;

      const actionsCell = row.querySelector('td.actions, td:last-child') || row.querySelector('td:nth-last-child(1)');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-view complete-btn';
      btn.textContent = 'Mark Completed';
      btn.setAttribute('data-id', row.dataset.id);
      btn.setAttribute('aria-label', 'Mark appointment completed');
      // insert at end of actions cell if found, otherwise append to row
      if (actionsCell) {
        actionsCell.appendChild(btn);
      } else {
        row.appendChild(document.createElement('td')).appendChild(btn);
      }
    });
  }

  function autoCompletePastAppointments() {
    const now = new Date();
    const rows = document.querySelectorAll('tbody tr[data-id][data-date]');
    rows.forEach(row => {
      const id = row.dataset.id;
      const dateStr = row.dataset.date;
      const status = (row.dataset.status || (row.querySelector('.status-label') && row.querySelector('.status-label').textContent) || '').toLowerCase();
      if (!id || !dateStr) return;
      const apptDate = new Date(dateStr);
      if (isNaN(apptDate)) return;
      if (apptDate < now && status !== 'Completed') {
        markCompletedById(id);
      }
    });
  }

  // Delegate click to open modal when any injected .complete-btn is clicked
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.complete-btn');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.id || btn.getAttribute('data-id');
    if (!id) return;
    currentAppointmentId = id;
    showModal();
  });

  // On DOM ready: inject buttons, bind modal controls, run auto-complete and set interval
  document.addEventListener('DOMContentLoaded', function () {
    // try to inject after initial rendering
    try { injectButtonsIntoRows(); } catch (e) { console.error(e); }

    // If the app renders rows asynchronously, observe table body and inject when new rows appear
    try {
      const tbodyList = document.querySelectorAll('tbody');
      tbodyList.forEach(tbody => {
        const obs = new MutationObserver(() => {
          try { injectButtonsIntoRows(); } catch (err) {}
        });
        obs.observe(tbody, { childList: true, subtree: true });
      });
    } catch (e) { /* ignore */ }

    const cancelBtn = document.getElementById('cancel-complete');
    const confirmBtn = document.getElementById('confirm-complete');
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      currentAppointmentId = null;
      hideModal();
    });
    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      if (!currentAppointmentId) return hideModal();
      markCompletedById(currentAppointmentId);
      currentAppointmentId = null;
      hideModal();
    });

    // run auto-complete on load and every minute
    try { autoCompletePastAppointments(); } catch (e) { console.error(e); }
    try { setInterval(autoCompletePastAppointments, 60 * 1000); } catch (e) { /* ignore */ }
  });

  // Expose helper
  window.__markAppointmentCompletedClient = function (id) {
    if (!id) return;
    markCompletedById(id);
  };
})();