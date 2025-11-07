/* ==================== NOTIFICATION SYSTEM ==================== */
const notifButton = document.getElementById('notifButton');
const notifPanel = document.getElementById('notificationPanel');
const clearNotifsBtn = document.getElementById('clearNotifsBtn');
const notificationsList = document.getElementById('notificationsList');
let notifications = [];
let clearedNotifications = [];
/* ---- Helpers ---- */
function parseTimeAgo(str) {
  const [num, unit] = str.split(' ');
  const n = parseInt(num);
  if (unit.includes('min')) return n;
  if (unit.includes('hour')) return n * 60;
  if (unit.includes('day')) return n * 60 * 24;
  return Infinity;
}
function sortNotifications() {
  notifications.sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    return timeB - timeA;
  });
}
async function generateUniqueNotificationId(store) {
  let id;
  let exists = true;
  while (exists) {
    id = "N" + Math.floor(100 + Math.random() * 900);
    exists = await new Promise((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  }
  return id;
}
/* ---- IndexedDB */
async function saveNotificationsToDB() {
  try {
    const db = await openClinicDB();
    const tx = db.transaction('notifications','readwrite');
    const store = tx.objectStore('notifications');
    await store.clear();
    notifications.forEach(n => store.add(n));
    await tx.done;
  } catch(e){ console.error(e); }
}
async function loadNotificationsFromDB() {
  try {
    const db = await openClinicDB();
    const tx = db.transaction('notifications','readonly');
    const store = tx.objectStore('notifications');
    const req = store.getAll();
    req.onsuccess = () => {
      notifications = req.result || [];
      sortNotifications();
      renderNotifications();
    };
  } catch(e){
    console.error(e);
    // ----- Fallback sample data
    notifications = [
      {id:1,title:"New Medical Record Added",message:"Dr. Etie Beardsworth added a record.",time:"2 mins ago",read:false,type:"record"},
      {id:2,title:"Appointment Confirmed",message:"Your appointment with Dr. Stafani Gives.",time:"1 hour ago",read:true,type:"appointment"},
      {id:3,title:"Access Requested",message:"Dr. Violante Rilton requested access.",time:"3 hours ago",read:false,type:"access"}
    ];
    renderNotifications();
  }
}
/* ---- Creating ---- */
async function createNotification(title, message) {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  try {
    const db = await openClinicDB();
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const notifId = await generateUniqueNotificationId(store);
    const notification = {
      notifId,
      title: sanitize(title),
      message: sanitize(message),
      date: new Date().toISOString().split('T')[0],
      recipientId: currentUser.linkedId,
      recipientRole: currentUser.role.toLowerCase(),
      read: false
    };
    store.add(notification);
    tx.oncomplete = () => {
      console.log("Notification saved.");
    };
    tx.onerror = (e) => {
      console.error("Failed to save notification:", e.target.error);
    };
  } catch (err) {
    console.error("DB error while saving notification:", err);
  }
}
async function createNotificationForUser(title, message, recipientId, recipientRole) {
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  try {
    const db = await openClinicDB();
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const notifId = await generateUniqueNotificationId(store);
    const notification = {
      notifId: notifId,
      title: sanitize(title),
      message: sanitize(message),
      date: new Date().toISOString().split('T')[0],
      recipientId: recipientId,
      recipientRole: recipientRole,
      read: false
    };
    store.add(notification);
    tx.oncomplete = () => {
      console.log("Notification saved.");
    };
    tx.onerror = (e) => {
      console.error("Failed to save notification:", e.target.error);
    };
  } catch (err) {
    console.error("DB error while saving notification:", err);
  }
}
/* ---- Rendering ---- */
function renderNotifications() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const sanitize = (dirty) => DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  notificationsList.innerHTML = '';
  if (!notifications.length) {
    notificationsList.innerHTML = sanitize(`<div class="empty-state"><p>No new notifications.</p></div>`);
    return;
  }

  const userNotification = notifications.filter(notif => notif.recipientId === user.linkedId ) || [];
  const userNotificationUnread = userNotification.filter(n => n.read === false);
  const userNotificationNumber = userNotificationUnread.length

  userNotificationUnread.forEach(n => {
    const item = document.createElement('div');
    item.className = `notification-item ${n.read?'':'unread'}`;
    item.dataset.id = sanitize(n.notifId);
    const safeTitle = sanitize(n.title);
    const safeMessage = sanitize(n.message);
    const safeTime = sanitize(n.date);
    item.innerHTML = `
      <div class="layout-set">
        <div><span class="icon">${getIcon(n.type)}</span></div>
        <span class="vertical-line-notif"></span>
        <div class="content">
          <div class="title">${safeTitle}</div>
          <div class="message">${safeMessage}</div>
          <div class="time">${safeTime}</div>
        </div>
      </div>
    `;
    if (safeTitle === 'Access Request Received') {
      function extractIdsFromMessage(message) {
        const recordMatch = message.match(/record (\w+)/);
        const requesterMatch = message.match(/\[requester:(\w+)\]/);

        
        if ((recordMatch?.[1]) && (requesterMatch?.[1])) {
          return {
            recordId: recordMatch?.[1] || null,
            requesterId: requesterMatch?.[1] || null
          };
        } else {
          return null;
        }
      }

      const meta = extractIdsFromMessage(safeMessage);
      if (meta) {
        const recordId = meta.recordId ;
        const requesterId = meta.requesterId ;
        item.innerHTML = `
          <div class="layout-set">
            <div><span class="icon">${getIcon(n.type)}</span></div>
            <span class="vertical-line-notif"></span>
            <div class="content">
              <div class="title">${safeTitle}</div>
              <div class="message">${safeMessage}</div>
              <div class="button-actions">
                <button class='btn-accept btn-accept-request' data-notifid="${item.dataset.id}" data-recordid="${recordId}" data-requesterid="${requesterId}">Accept</button>
                <button class='btn-decline'>Decline</button>
              </div>
              <div class="time">${safeTime}</div>
            </div>
          </div>
        `;
      } else {
        item.innerHTML = `
          <div class="layout-set">
            <div><span class="icon">${getIcon(n.type)}</span></div>
            <span class="vertical-line-notif"></span>
            <div class="content">
              <div class="title">${safeTitle}</div>
              <div class="message">${safeMessage}</div>
              <div class="time">${safeTime}</div>
            </div>
          </div>
        `;
      }

      
    }
    item.addEventListener('click', () => markAsRead(n.id));
    notificationsList.appendChild(item);
    updateBadgeByNumber(userNotificationNumber);
  });
}
/* ---- Icon helper ---- */
function getIcon(type){
  const svg = {
      record: `
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
        <path d="M14 8V2l6 6h-6z" opacity=".3"/>
      </svg>`,
    appointment: `
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
        <rect x="7" y="11" width="2" height="2"/>
        <rect x="11" y="11" width="2" height="2"/>
        <rect x="15" y="11" width="2" height="2"/>
        <rect x="7" y="15" width="2" height="2"/>
        <rect x="11" y="15" width="2" height="2"/>
        <rect x="15" y="15" width="2" height="2"/>
      </svg>`,
    access: `
      <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1C8.7 1 6 3.7 6 7v3H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4v3H8V7c0-2.2 1.8-4 4-4zm-5 9h10v8H7v-8z"/>
        <circle cx="12" cy="16" r="1"/>
      </svg>`
  };
  return svg[type] || svg.record;
}
/* ---- Mark as read ---- */
function markAsRead(id){
  const n = notifications.find(x=>x.id==id);
  if(n && !n.read){
    n.read = true;
    saveNotificationsToDB();
    renderNotifications();
  }
}

async function markNotifAsRead(id) {
  try {
    const db = await openClinicDB();
    const tx = db.transaction('notifications','readwrite');
    const store = tx.objectStore('notifications');
    const request = store.getAll();

    request.onsuccess = function() {
      const notifications = request.result || [];

      const notification = notifications.find(n => n.notifId === id) || [];

      notification.read = true;

      const updateReq = store.put(notification);

      updateReq.onsuccess = async function () {
        renderNotifications();
      };

      updateReq.onerror = function (e) {
        console.error("❌ Failed to update appointment:", e.target.error);
      };

    };

    request.onerror = function() {
      console.error('Failed to load notifications:', patientsReq.error);
    };
  } catch (err) {
    console.error("⚠️ Database error:", err);
  }
}

function updateBadgeByNumber(n){
  const unread = n;
  const badge = document.querySelector('.notif-badge');
  badge.textContent = unread>9?`${n}`:unread;
  badge.style.display = unread?'flex':'none';
}
/* ---- Clear all ---- */
function clearAll(){
  if(!confirm('Clear all notifications?')) return;
  clearedNotifications = [...notifications];
  notifications = [];
  saveNotificationsToDB();
  renderNotifications();
  showUndo();
}
function showUndo(){
  const btn = document.createElement('button');
  btn.textContent='Undo Clear';
  btn.className='btn-undo';
  btn.onclick=()=>{
    notifications = clearedNotifications;
    saveNotificationsToDB();
    renderNotifications();
    btn.remove();
  };
  notificationsList.appendChild(btn);
  setTimeout(()=>btn.remove(),5000);
}
clearNotifsBtn?.addEventListener('click',clearAll);
/* ---- Toggle dropdown ---- */
notifButton.addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = notifPanel.classList.contains('hidden');
  notifPanel.classList.toggle('hidden', !willOpen);
  notifButton.setAttribute('aria-expanded', willOpen);
});
/* ---- Close when clicking outside ---- */
document.addEventListener('click', e=>{
  if(!e.target.closest('#notifButton') && !e.target.closest('#notificationPanel')){
    notifPanel.classList.add('hidden');
    notifButton.setAttribute('aria-expanded','false');
  }
});
/* ---- Close with ESC ---- */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && !notifPanel.classList.contains('hidden')){
    notifPanel.classList.add('hidden');
    notifButton.setAttribute('aria-expanded','false');
  }
});

/* ---- Handle button ---- */
document.addEventListener("click", async (e) => {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (e.target.classList.contains("btn-accept-request")) {
    const notifId = e.target.dataset.notifid;
    console.log(notifId);
    const recordId = e.target.dataset.recordid;
    const requesterId = parseInt(e.target.dataset.requesterid);

    try {
      const db = await openClinicDB();
      const tx = db.transaction("medicalRecord", "readwrite");
      const store = tx.objectStore("medicalRecord");
      const getReq = store.get(recordId);

      getReq.onsuccess = async function () {
        const record = getReq.result;
        if (!record) {
          console.error("❌ Record not found.");
          return;
        }

        record.accessedBy = record.accessedBy || [];
        if (!record.accessedBy.includes(requesterId)) {
          record.accessedBy.push(requesterId);
        }
        const updateReq = store.put(record);
        updateReq.onsuccess = async function() {
          console.log("✅ Access granted and record updated.");
          await createNotificationForUser("Access Request Accepted", `The doctor has accepted your request to access medical record ${recordId}`, requesterId, "doctor");
          await logCurrentUserActivity("acceptAccess", recordId, `Doctor with ID ${parseInt(user.linkedId)} accepted access to medical record with ID ${recordId} from doctor with ID ${requesterId}`);
          await markNotifAsRead(notifId);
        };
        updateReq.onerror = (e) => {
          console.error("❌ Failed to update record:", e.target.error);
        };
      };
    } catch (err) {
      console.error("⚠️ Error accessing DB:", err);
    }
  }
});

loadNotificationsFromDB();