    // Show user role from login
    const role = localStorage.getItem("currentUser");
    if (!role) {
        window.location.href = "../html/login.html"; // redirect if not logged in
    } else {
        const user = JSON.parse(role);
    }
    
    // Mobile sidebar slide-in/out
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');

    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active'); // for small screens only (CSS handles transform)
    });

    // Collapse/expand for desktop
    const collapseToggle = document.getElementById('collapse-toggle');
    const mainContent = document.getElementById('mainContent');

    collapseToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        sidebar.style.transition = 'width 0.5s ease';
        mainContent.style.transition = 'margin-left 0.5s ease';

        // optional: move focus back to collapse button for accessibility
        collapseToggle.focus();
    });

    // Close mobile sidebar when clicking outside (nice UX)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target) && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        }
    });

    // ensure layout responds on resize (adjust main margin)
    const adjustMainMargin = () => {
        if (sidebar.classList.contains('collapsed')) {
            mainContent.style.marginLeft = '80px';
        } else if (window.innerWidth <= 768) {
            mainContent.style.marginLeft = '0';
        } else {
            mainContent.style.marginLeft = '250px';
        }
    };

    // Run on load and whenever class toggles
    new MutationObserver(adjustMainMargin).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', adjustMainMargin);
    adjustMainMargin();


    // Sign out function
    async function signOut() {
    try {
        if (!confirm("Are you sure you want to sign out?")) return;

        // Ensure DB connection exists
        if (!window.db) {
        console.log("🔄 Opening DB before clearing...");
        await openClinicDB();
        }

        // Now clear data except 'admins' and 'users'
        await clearData([
        'medicalRecord',
        'doctors',
        'patients',
        'medicines',
        'appointments',
        'notifications'
        ]);

        // 🔄 Optional: refresh DevTools IndexedDB view
        db.close();
        db = null;
        await openClinicDB();

        console.log("✅ Data cleared. Signing out...");

        // Clear login info
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');

        // Redirect
        window.location.href = "login.html";
    } catch (err) {
        console.error("❌ Sign out failed:", err);
    }
    }
    document.getElementById("signOutBtn").addEventListener("click", signOut);
    
