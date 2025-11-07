
(function () {
  const sanitize = (dirty) =>
  DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  let currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem('currentUser') || null);
  } catch (e) {
    console.warn("Failed to parse currentUser:", e);
    return;
  }

  // Allow doctor, admin, and patient (patients: auto only)
  if (!currentUser || !['doctor', 'admin', 'patient'].includes(currentUser.role)) {
    return;
  }
  // --- Hide Mark Completed buttons for invalid conditions (doctor only) ---
  function hideInvalidMarkButtons() {
    if (!currentUser || currentUser.role.toLowerCase() !== "doctor") return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    document.querySelectorAll(".complete-btn").forEach(btn => {
      const row = btn.closest("tr[data-id][data-date]");
      if (!row) return;

      const status = (row.dataset.status || "").toLowerCase();
      const dateStr = row.dataset.date;
      const apptDate = new Date(dateStr);
      const apptDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());

      // Hide if appointment is Cancelled, Completed, or in the past
      if (["cancelled", "completed"].includes(status) || apptDay < today) {
        btn.style.display = "none";
      } else {
        btn.style.display = ""; // visible for active confirmed ones
      }
    });
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
        if (title) title.textContent = `Mark ${sanitize(patientName)}'s Appointment as Completed?`;
        if (message) message.textContent = `Date/Time: ${sanitize(dateTime)}\nThis will mark the appointment as completed.`;
      }
    }

    // --- UI helpers ---
    function uiMarkCompleted(row) {
      if (!row) return;
      row.dataset.status = 'Completed';
      const statusCell = row.querySelector('td:nth-child(4)');
      if (statusCell) statusCell.textContent = 'Completed';
      const btn = row.querySelector('.complete-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Completed';
        btn.classList.add('request-sent');
      }

      const timestamp = new Date().toLocaleString();
      let completedAtEl = row.querySelector('.completed-at');
      if (!completedAtEl) {
        completedAtEl = document.createElement('td');
        completedAtEl.className = 'completed-at';
        row.appendChild(completedAtEl);
      }
      completedAtEl.textContent = timestamp;
    }

    function uiMarkConfirmed(row) {
      if (!row) return;
      row.dataset.status = 'Confirmed';
      const statusCell = row.querySelector('td:nth-child(4)');
      if (statusCell) statusCell.textContent = 'Confirmed';
      const btn = row.querySelector('.complete-btn');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Mark Completed';
        btn.classList.remove('request-sent');
      }
      const completedAtEl = row.querySelector('.completed-at');
      if (completedAtEl) completedAtEl.textContent = '';
    }

    // --- IndexedDB helpers ---
    async function persistMarkCompleted(id) {
      try {
        await window.updateAppointmentStatus(id, 'Completed');
        console.log(`✅ Appointment ${id} marked as Completed in IndexedDB`);
      } catch (err) {
        console.error('persistMarkCompleted failed:', err);
      }
    }

    async function persistMarkConfirmed(id) {
      try {
        await window.updateAppointmentStatus(id, 'Confirmed');
        console.log(`♻️ Appointment ${id} reset to Confirmed`);
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

    // --- Auto-check every minute ---
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

        if (apptDay < today && status !== 'completed') {
          console.log(`Auto-marking past appointment ${id} as Completed`);
          markCompletedById(id);
        } else if (apptDay > today && status === 'completed') {
          console.log(`Reverting future appointment ${id} to Confirmed`);
          uiMarkConfirmed(row);
          persistMarkConfirmed(id);
        }
      }
    }

    // --- Inject “Mark Completed” buttons (for doctor/admin only) ---
    function injectButtonsIntoRows() {
      if (currentUser.role === 'patient') return; // patients get no manual button
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

    // --- Initialize ---
    try {
      injectButtonsIntoRows();
      checkAndAutoUpdateAppointments();
      hideInvalidMarkButtons();
      setInterval(checkAndAutoUpdateAppointments, 60 * 1000);
    } catch (e) {
      console.error('Error initializing appointment completion helper:', e);
    }

    // Watch for dynamic changes
    document.querySelectorAll('tbody').forEach(tbody => {
      const obs = new MutationObserver(() => {
        injectButtonsIntoRows();
        checkAndAutoUpdateAppointments();
        hideInvalidMarkButtons();
      });
      obs.observe(tbody, { childList: true, subtree: true });
    });

    // --- Modal logic (only used by doctor/admin) ---
    const cancelBtn = document.getElementById('cancel-complete');
    const confirmBtn = document.getElementById('confirm-complete');
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      if (currentAppointmentId) {
        markCompletedById(currentAppointmentId);
        currentAppointmentId = null;
      }
      hideModal();
    });

    document.addEventListener('click', (e) => {
      if (currentUser.role === 'patient') return; // skip for patients
      const btn = e.target.closest('.complete-btn');
      if (!btn) return;
      e.preventDefault();
      currentAppointmentId = btn.dataset.id;
      updateModalContent();
      showModal();
    });
  }

  // Initialize after appointments render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
    });
  } else {
    document.addEventListener('appointmentsRendered', initAfterAppointmentsLoaded, { once: true });
  }

  // expose manual trigger
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
