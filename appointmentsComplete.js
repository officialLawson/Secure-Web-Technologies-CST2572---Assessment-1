(function () {
  // Exit early if not on a doctor/admin dashboard
  let currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem('currentUser') || null);
  } catch (e) {
    return;
  }
  if (!currentUser || !['doctor', 'admin'].includes(currentUser.role)) {
    return;
  }

  function initAfterAppointmentsLoaded() {

    if (typeof window.updateAppointmentStatus !== 'function') {
      console.warn('window.updateAppointmentStatus not available. Skipping appointment completion helper.');
      return;
    }

    let currentAppointmentId = null;

    // --- Modal helpers ---
    function showModal() {
      const m = document.getElementById('complete-modal');
      if (m) m.classList.remove('hidden'), m.setAttribute('aria-hidden', 'false');
    }
    function hideModal() {
      const m = document.getElementById('complete-modal');
      if (m) m.classList.add('hidden'), m.setAttribute('aria-hidden', 'true');
    }

    function updateModalContent() {
      const row = document.querySelector(`tr[data-id="${currentAppointmentId}"]`);
      if (row) {
        const patientName = row.querySelector('td:first-child')?.textContent || 'Unknown Patient';
        const dateTime = row.querySelector('td:nth-child(3)')?.textContent || 'Unknown Date/Time';
        const title = document.getElementById('complete-modal-title');
        const message = document.getElementById('complete-modal-message');
        if (title) title.textContent = `Mark ${patientName}'s Appointment as Completed?`;
        if (message) message.textContent = `Date/Time: ${dateTime}\nThis will mark the appointment as completed.`;
      }
    }

    // --- UI Updaters ---
    function uiMarkCompleted(row) {
      if (!row) return;
      row.dataset.status = 'Completed';
      const statusLabel = row.querySelector('.status-label, .status');
      if (statusLabel) statusLabel.textContent = 'Completed';
      const statusCell = row.querySelector('td:nth-child(4)');
      if (!statusLabel && statusCell) statusCell.textContent = 'Completed';

      // Completed button state
      const btn = row.querySelector('.complete-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Completed';
        btn.classList.add('request-sent');
        btn.setAttribute('aria-pressed', 'true');
      }

      // --- Handle Completed At timestamp ---
      let completedAtEl = row.querySelector('.completed-at');
      const timestamp = new Date().toLocaleString();

      if (completedAtEl) {
        completedAtEl.textContent = timestamp;
      } else {
        // If table doesn’t have a cell for it, add one at the end
        const td = document.createElement('td');
        td.className = 'completed-at';
        td.textContent = timestamp;
        row.appendChild(td);
      }
    }

    function uiMarkConfirmed(row) {
      if (!row) return;
      row.dataset.status = 'Confirmed';
      const statusLabel = row.querySelector('.status-label, .status');
      if (statusLabel) statusLabel.textContent = 'Confirmed';
      const statusCell = row.querySelector('td:nth-child(4)');
      if (!statusLabel && statusCell) statusCell.textContent = 'Confirmed';

      const btn = row.querySelector('.complete-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Mark Completed';
        btn.classList.remove('request-sent');
        btn.setAttribute('aria-pressed', 'false');
      }

      // Clear completed-at timestamp if reverting to confirmed
      const completedAtEl = row.querySelector('.completed-at');
      if (completedAtEl) completedAtEl.textContent = '';
    }

    // --- IndexedDB helpers ---
    async function persistMarkCompleted(id) {
      try {
        await window.updateAppointmentStatus(id, 'Completed');
        console.log(`Appointment ${id} marked as Completed in IndexedDB`);
      } catch (err) {
        console.error('persistMarkCompleted failed:', err);
      }
    }

    async function persistMarkConfirmed(id) {
      try {
        await window.updateAppointmentStatus(id, 'Confirmed');
        console.log(`Appointment ${id} reset to Confirmed in IndexedDB`);
      } catch (err) {
        console.error('persistMarkConfirmed failed:', err);
      }
    }

    function markCompletedById(id) {
      const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      uiMarkCompleted(row);
      persistMarkCompleted(id);
    }

    // --- Smart auto-update for appointment statuses ---
    async function checkAndAutoUpdateAppointments() {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const rows = document.querySelectorAll('tbody tr[data-id][data-date]');

      for (const row of rows) {
        const id = row.dataset.id;
        const dateStr = row.dataset.date;
        const status = (row.dataset.status || '').toLowerCase();
        if (!id || !dateStr) continue;

        const apptDate = new Date(dateStr);
        if (isNaN(apptDate)) continue;
        const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());

        // Case 1: Past but not completed → mark Completed
        if (apptDay < today && status !== 'completed') {
          console.log(`Auto-marking past appointment ${id} as Completed`);
          markCompletedById(id);
          continue;
        }

        // Case 2: Future but completed → revert to Confirmed
        if (apptDay > today && status === 'completed') {
          console.log(`Fixing future appointment ${id} from Completed → Confirmed`);
          uiMarkConfirmed(row);
          persistMarkConfirmed(id);
        }
      }
    }

    // --- Inject “Mark Completed” buttons ---
    function injectButtonsIntoRows() {
      const rows = document.querySelectorAll('tbody tr[data-id]');
      rows.forEach(row => {
        if (row.querySelector('.complete-btn')) return;
        const status = (row.dataset.status || '').toLowerCase();
        if (status === 'completed') return;

        const actionsCell = row.querySelector('td.actions, td:last-child') || row.querySelector('td:nth-last-child(1)');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-view complete-btn';
        btn.textContent = 'Mark Completed';
        btn.dataset.id = row.dataset.id;
        btn.setAttribute('aria-label', 'Mark appointment completed');
        if (actionsCell) actionsCell.appendChild(btn);
        else {
          const td = document.createElement('td');
          td.appendChild(btn);
          row.appendChild(td);
        }
      });
    }

    // --- Initialization ---
    try {
      injectButtonsIntoRows();
      checkAndAutoUpdateAppointments();
      setInterval(checkAndAutoUpdateAppointments, 60 * 1000);
    } catch (e) {
      console.error('Error initializing appointment completion helper:', e);
    }

    // Watch for dynamic row updates
    try {
      document.querySelectorAll('tbody').forEach(tbody => {
        const obs = new MutationObserver(() => {
          injectButtonsIntoRows();
          checkAndAutoUpdateAppointments();
        });
        obs.observe(tbody, { childList: true, subtree: true });
      });
    } catch (e) {
      /* ignore */
    }

    // Modal actions
    const cancelBtn = document.getElementById('cancel-complete');
    const confirmBtn = document.getElementById('confirm-complete');
    if (cancelBtn) cancelBtn.addEventListener('click', () => {
      currentAppointmentId = null;
      hideModal();
    });
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (currentAppointmentId) {
        markCompletedById(currentAppointmentId);
        currentAppointmentId = null;
      }
      hideModal();
    });

    // Button click handler
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.complete-btn');
      if (!btn) return;
      e.preventDefault();
      currentAppointmentId = btn.dataset.id;
      updateModalContent();
      showModal();
    });
  }

  // Trigger initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
    });
  } else {
    document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
  }

  // Expose helper for manual use
  window.__markAppointmentCompletedClient = function (id) {
    if (id && typeof window.updateAppointmentStatus === 'function') {
      const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
      if (row && row.dataset.status !== 'Completed') {
        uiMarkCompleted(row);
        persistMarkCompleted(id);
      }
    }
  };
})();
