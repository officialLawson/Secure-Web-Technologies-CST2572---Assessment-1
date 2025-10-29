document.addEventListener('DOMContentLoaded', () => {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    const matchMessage = document.getElementById('match-message');
    const form = document.querySelector('form');

    // Password strength checker
    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 0;
        let text = 'Password strength';

        // Check requirements
        const hasLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        // Update requirement indicators
        updateRequirement('req-length', hasLength);
        updateRequirement('req-uppercase', hasUppercase);
        updateRequirement('req-lowercase', hasLowercase);
        updateRequirement('req-number', hasNumber);
        updateRequirement('req-special', hasSpecial);

        if (password.length === 0) {
            strength = 0;
            text = 'Password strength';;
        } else if (password.length < 6) {
            strength = 20;
            text = 'Too short';
            color = '#ff6b6b';
        } else {
            if (hasLowercase) strength += 20;
            if (hasUppercase) strength += 20;
            if (hasNumber) strength += 20;
            if (hasSpecial) strength += 20;
            if (hasLength) strength += 20;

            strength = Math.min(strength, 100);

            if (strength < 40) {
                text = 'Weak';
                color = '#ff6b6b';
            } else if (strength < 80) {
                text = 'Medium';
                color = '#ffd166';
            } else {
                text = 'Strong';
                color = '#06d6a0';
            }
        }

        strengthFill.style.width = `${strength}%`;
        strengthFill.style.backgroundColor = color;
        strengthText.textContent = text;
        strengthText.style.color = color;

        checkPasswordMatch();
    });

    // Function to update requirement status
    function updateRequirement(id, isMet) {
        const element = document.getElementById(id);
        if (element) {
            if (isMet) {
                element.classList.add('met');
            } else {
                element.classList.remove('met');
            }
        }
    }

    // Password match checker
    confirmPasswordInput.addEventListener('input', checkPasswordMatch);

    function checkPasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (confirmPassword.length === 0) {
            matchMessage.textContent = '';
            matchMessage.className = 'password-match-message';
        } else if (password === confirmPassword) {
            matchMessage.textContent = '✓ Passwords match';
            matchMessage.className = 'password-match-message match';
        } else {
            matchMessage.textContent = '✗ Passwords do not match';
            matchMessage.className = 'password-match-message no-match';
        }
    }

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        alert('Password set successfully!');
        // window.location.href = '../HTML/login.html';
    });
});