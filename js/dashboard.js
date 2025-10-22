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