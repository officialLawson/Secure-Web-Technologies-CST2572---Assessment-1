
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
    if (typeof window.updateAppointmentStatus !== 'function') {
      console.warn('window.updateAppointmentStatus not available. Skipping appointment completion helper.');
      return;
    }

    let currentAppointmentId = null;

    function hideModal() {
      const m = document.getElementById('complete-modal');
      if (m) m.classList.add('hidden'), m.setAttribute('aria-hidden', 'true');
    }
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.complete-btn');
      if (!btn) return;
      e.preventDefault();
      const id = btn.dataset.id;
      if (!id) return;
      currentAppointmentId = id;
      updateModalContent();
      showModal();
    });
    function showModal() {
      const m = document.getElementById('complete-modal');
      if (m) m.classList.remove('hidden'), m.setAttribute('aria-hidden', 'false');
    }

    function uiMarkCompleted(row) {
      if (!row) return;
      row.dataset.status = 'Completed';
      const statusLabel = row.querySelector('.status-label, .status');
      if (statusLabel) statusLabel.textContent = 'Completed';
      const statusCell = row.querySelector('td:nth-child(4)');
      if (!statusLabel && statusCell) statusCell.textContent = 'Completed';
      const btn = row.querySelector('.complete-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Completed';
        btn.classList.add('request-sent');
        btn.setAttribute('aria-pressed', 'true');
      }
      const completedAtEl = row.querySelector('.completed-at');
      if (completedAtEl) completedAtEl.textContent = new Date().toLocaleString();
    }

    async function persistMarkCompleted(id) {
      try {
        await window.updateAppointmentStatus(id, 'Completed');
        console.log(`Appointment ${id} marked as Completed in IndexedDB`);
      } catch (err) {
        console.error('persistMarkCompleted failed:', err);
      }
    }

    function markCompletedById(id) {
      const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      uiMarkCompleted(row);
      persistMarkCompleted(id);
    }

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
        if (actionsCell) {
          actionsCell.appendChild(btn);
        } else {
          const td = document.createElement('td');
          td.appendChild(btn);
          row.appendChild(td);
        }
      });
    }

    function autoCompletePastAppointments() {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const rows = document.querySelectorAll('tbody tr[data-id][data-date]');
      rows.forEach(row => {
        const id = row.dataset.id;
        const dateStr = row.dataset.date;
        const status = (row.dataset.status || '').toLowerCase();
        if (!id || !dateStr || status === 'completed') return;

        const apptDate = new Date(dateStr);
        if (isNaN(apptDate)) return;
        const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
        if (apptDay < today) {
          markCompletedById(id);
        }
      });
    }

    // Bind modal and button events
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.complete-btn');
      if (!btn) return;
      e.preventDefault();
      const id = btn.dataset.id;
      if (!id) return;
      currentAppointmentId = id;
      showModal();
    });

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

    // Inject buttons and auto-complete
    try {
      injectButtonsIntoRows();
      autoCompletePastAppointments();
      setInterval(autoCompletePastAppointments, 60 * 1000);
    } catch (e) {
      console.error('Error in appointment completion helper:', e);
    }

    // Observe dynamic rows
    try {
      document.querySelectorAll('tbody').forEach(tbody => {
        const obs = new MutationObserver(() => injectButtonsIntoRows());
        obs.observe(tbody, { childList: true, subtree: true });
      });
    } catch (e) {
    }
  }

  // Trigger initialization only after appointments are rendered
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
    });
  } else {
    document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
  }

  window.__markAppointmentCompletedClient = function (id) {
    if (id && typeof window.updateAppointmentStatus === 'function') {
      const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
      if (row && row.dataset.status !== 'Completed') {
        row.dataset.status = 'Completed';
        uiMarkCompleted(row);
        persistMarkCompleted(id);
      }
    }
  };
})();
