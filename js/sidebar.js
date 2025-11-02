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
        console.log("Signing out...");

        // Clear login info
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');

        // Redirect
        window.location.href = "login.html";
    }

    // ==============================
    // SIGN OUT MODAL LOGIC
    // ==============================
    const signOutModal = document.getElementById('signOutModal');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    const signOutBtn = document.getElementById('signOutBtn');

    // Open modal when sign-out button is clicked
    if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            if (signOutModal) {
                signOutModal.classList.remove('hidden');
            }
        });
    }

    // Close modal on Cancel
    if (modalCancel && signOutModal) {
        modalCancel.addEventListener('click', () => {
            signOutModal.classList.add('hidden');
        });
    }

    // Confirm sign-out
    if (modalConfirm) {
        modalConfirm.addEventListener('click', async () => {
            try {
                signOut();
            } catch (err) {
                console.error("❌ Sign out failed:", err);
                if (signOutModal) {
                    signOutModal.classList.add('hidden'); // Close modal on error
                }
            }
        });
    }

    // ==============================
    // ADD USER MODAL LOGIC
    // ==============================
    const addUserModal = document.getElementById('addUserModal');
    const modalCancelAddUser = document.getElementById('modalCancelAddUser');
    const modalDoctor = document.getElementById('modalDoctor');
    const modalPatient = document.getElementById('modalPatient');
    const addUser = document.getElementById('addUser');

    // Open modal when sign-out button is clicked
    if (addUser) {
        addUser.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            if (addUserModal) {
                addUserModal.classList.remove('hidden');
            }
        });
    }

    // Close modal on Cancel
    if (modalCancelAddUser && addUserModal) {
        modalCancelAddUser.addEventListener('click', () => {
            addUserModal.classList.add('hidden');
        });
    }
    if (modalDoctor) {
        modalDoctor.addEventListener('click', async () => {
            window.location.href = "add-doctor.html"
        });
    }

    if (modalPatient) {
        modalPatient.addEventListener('click', async () => {
            window.location.href = "add-patient.html"
        });
    }

    


    
