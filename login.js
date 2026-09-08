/**
 * ==========================================
 * GADGETA ITEM - AUTHENTICATION LOGIC JS
 * ==========================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. FIREBASE CONFIGURATION & INITIALIZATION
    const firebaseConfig = {
  apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA",
  authDomain: "gadget-item.firebaseapp.com",
  projectId: "gadget-item",
  storageBucket: "gadget-item.firebasestorage.app",
  messagingSenderId: "1048854789116",
  appId: "1:1048854789116:web:91c20aa6dd633815be5079",
  measurementId: "G-2YMX097PSJ"
};


    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();

    // 2. DOM REFERENCES
    const loginSection = document.getElementById('gi-login-section');
    const signupSection = document.getElementById('gi-signup-section');
    const forgotSection = document.getElementById('gi-forgot-section');

    // Switch triggers
    const toSignupBtn = document.getElementById('gi-to-signup-btn');
    const toLoginBtn = document.getElementById('gi-to-login-btn');
    const forgotPwdTrigger = document.getElementById('gi-forgot-pwd-trigger');
    const backToLoginBtn = document.getElementById('gi-back-to-login-btn');

    // Forms
    const loginForm = document.getElementById('gi-login-form');
    const signupForm = document.getElementById('gi-signup-form');
    const forgotForm = document.getElementById('gi-forgot-form');

    // Google Buttons
    const googleLoginBtn = document.getElementById('gi-google-login-btn');
    const googleSignupBtn = document.getElementById('gi-google-signup-btn');

    // 3. AUTH STATE LISTENER (Redirect if already logged in)
    auth.onAuthStateChanged((user) => {
        if (user) {
            window.location.href = '/profile';
        }
    });

    // 4. MODE SWITCHING FUNCTIONS (No Page Reload)
    function switchMode(targetSection) {
        [loginSection, signupSection, forgotSection].forEach(section => {
            if (section) {
                section.style.display = 'none';
                section.classList.remove('active');
            }
        });
        if (targetSection) {
            targetSection.style.display = 'block';
            setTimeout(() => targetSection.classList.add('active'), 10);
        }
        clearAllAlerts();
    }

    if (toSignupBtn) toSignupBtn.addEventListener('click', () => switchMode(signupSection));
    if (toLoginBtn) toLoginBtn.addEventListener('click', () => switchMode(loginSection));
    if (forgotPwdTrigger) forgotPwdTrigger.addEventListener('click', () => switchMode(forgotSection));
    if (backToLoginBtn) backToLoginBtn.addEventListener('click', () => switchMode(loginSection));

    // 5. PASSWORD VISIBILITY TOGGLE
    function setupPasswordToggle(toggleId, inputId) {
        const toggleBtn = document.getElementById(toggleId);
        const inputField = document.getElementById(inputId);
        if (!toggleBtn || !inputField) return;

        const eyeIcon = toggleBtn.querySelector('.gi-eye-icon');
        const eyeOffIcon = toggleBtn.querySelector('.gi-eye-off-icon');

        toggleBtn.addEventListener('click', () => {
            const isPassword = inputField.type === 'password';
            inputField.type = isPassword ? 'text' : 'password';
            
            if (isPassword) {
                if (eyeIcon) eyeIcon.style.display = 'none';
                if (eyeOffIcon) eyeOffIcon.style.display = 'block';
                toggleBtn.setAttribute('aria-label', 'Hide password');
            } else {
                if (eyeIcon) eyeIcon.style.display = 'block';
                if (eyeOffIcon) eyeOffIcon.style.display = 'none';
                toggleBtn.setAttribute('aria-label', 'Show password');
            }
        });
    }

    setupPasswordToggle('gi-login-pwd-toggle', 'gi-login-password');
    setupPasswordToggle('gi-signup-pwd-toggle', 'gi-signup-password');
    setupPasswordToggle('gi-signup-confirm-pwd-toggle', 'gi-signup-confirm-password');

    // 6. HELPER UTILITIES: ALERTS & LOADING
    function showAlert(type, message, prefix = 'login') {
        const errBox = document.getElementById(`gi-${prefix}-error`);
        const succBox = document.getElementById(`gi-${prefix}-success`);
        
        clearAlerts(prefix);

        if (type === 'error' && errBox) {
            errBox.textContent = message;
            errBox.style.display = 'block';
        } else if (type === 'success' && succBox) {
            succBox.textContent = message;
            succBox.style.display = 'block';
        }
    }

    function clearAlerts(prefix) {
        const errBox = document.getElementById(`gi-${prefix}-error`);
        const succBox = document.getElementById(`gi-${prefix}-success`);
        if (errBox) errBox.style.display = 'none';
        if (succBox) succBox.style.display = 'none';
    }

    function clearAllAlerts() {
        ['login', 'signup', 'forgot'].forEach(p => clearAlerts(p));
    }

    function setButtonLoading(btn, isLoading, customText = 'Processing...') {
        if (!btn) return;
        const textSpan = btn.querySelector('.gi-btn-text');
        const loaderSpan = btn.querySelector('.gi-btn-loader');
        
        if (isLoading) {
            btn.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loaderSpan) {
                loaderSpan.style.display = 'flex';
                // Safe way to update loader text without dropping child nodes
                const textNode = Array.from(loaderSpan.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                if (textNode) {
                    textNode.textContent = ` ${customText}`;
                }
            }
        } else {
            btn.disabled = false;
            if (textSpan) textSpan.style.display = 'inline';
            if (loaderSpan) loaderSpan.style.display = 'none';
        }
    }

    // 7. FIREBASE ERROR CODE MAPPING
    function getFriendlyErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Email or password is incorrect.';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists.';
            case 'auth/weak-password':
                return 'Please choose a stronger password (at least 6 characters).';
            case 'auth/network-request-failed':
                return 'Unable to connect. Please check your internet connection and try again.';
            case 'auth/popup-closed-by-user':
                return 'Google sign-in window was closed before completion.';
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    // 8. VALIDATION HELPERS
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function showFieldError(fieldId, message) {
        const errorEl = document.getElementById(`${fieldId}-error`);
        const inputEl = document.getElementById(fieldId);
        if (errorEl && inputEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
            inputEl.style.borderColor = '#ef4444';
        }
    }

    function clearFieldError(fieldId) {
        const errorEl = document.getElementById(`${fieldId}-error`);
        const inputEl = document.getElementById(fieldId);
        if (errorEl && inputEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
            inputEl.style.borderColor = '';
        }
    }

    // 9. EMAIL/PASSWORD LOGIN HANDLER
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts('login');

            const emailInput = document.getElementById('gi-login-email');
            const passwordInput = document.getElementById('gi-login-password');
            const submitBtn = document.getElementById('gi-login-submit-btn');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';

            let isValid = true;
            if (!email || !validateEmail(email)) {
                showFieldError('gi-login-email', 'Please enter a valid email address.');
                isValid = false;
            } else {
                clearFieldError('gi-login-email');
            }

            if (!password) {
                showFieldError('gi-login-password', 'Password is required.');
                isValid = false;
            } else {
                clearFieldError('gi-login-password');
            }

            if (!isValid) return;

            setButtonLoading(submitBtn, true, 'Signing in...');

            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                setButtonLoading(submitBtn, false);
                showAlert('error', getFriendlyErrorMessage(error.code), 'login');
            }
        });
    }

    // 10. EMAIL/PASSWORD SIGNUP HANDLER
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts('signup');

            const emailInput = document.getElementById('gi-signup-email');
            const passwordInput = document.getElementById('gi-signup-password');
            const confirmPasswordInput = document.getElementById('gi-signup-confirm-password');
            const submitBtn = document.getElementById('gi-signup-submit-btn');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = passwordInput ? passwordInput.value : '';
            const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

            let isValid = true;

            if (!email || !validateEmail(email)) {
                showFieldError('gi-signup-email', 'Please enter a valid email address.');
                isValid = false;
            } else {
                clearFieldError('gi-signup-email');
            }

            if (!password || password.length < 6) {
                showFieldError('gi-signup-password', 'Password must be at least 6 characters.');
                isValid = false;
            } else {
                clearFieldError('gi-signup-password');
            }

            if (password !== confirmPassword) {
                showFieldError('gi-signup-confirm-password', 'Passwords do not match.');
                isValid = false;
            } else {
                clearFieldError('gi-signup-confirm-password');
            }

            if (!isValid) return;

            setButtonLoading(submitBtn, true, 'Creating account...');

            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (error) {
                setButtonLoading(submitBtn, false);
                showAlert('error', getFriendlyErrorMessage(error.code), 'signup');
            }
        });
    }

    // 11. GOOGLE AUTHENTICATION HANDLER
    async function handleGoogleAuth(btnElement) {
        if (!btnElement) return;
        clearAllAlerts();
        const originalHTML = btnElement.innerHTML;
        btnElement.disabled = true;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (error) {
            btnElement.disabled = false;
            btnElement.innerHTML = originalHTML;
            showAlert('error', getFriendlyErrorMessage(error.code) || 'Google sign-in could not be completed. Please try again.', 'login');
        }
    }

    if (googleLoginBtn) googleLoginBtn.addEventListener('click', () => handleGoogleAuth(googleLoginBtn));
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', () => handleGoogleAuth(googleSignupBtn));

    // 12. FORGOT PASSWORD HANDLER
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlerts('forgot');

            const emailInput = document.getElementById('gi-forgot-email');
            const submitBtn = document.getElementById('gi-forgot-submit-btn');
            const email = emailInput ? emailInput.value.trim() : '';

            if (!email || !validateEmail(email)) {
                showFieldError('gi-forgot-email', 'Please enter a valid email address.');
                return;
            } else {
                clearFieldError('gi-forgot-email');
            }

            setButtonLoading(submitBtn, true, 'Sending link...');

            try {
                await auth.sendPasswordResetEmail(email);
                setButtonLoading(submitBtn, false);
                showAlert('success', 'Password reset instructions have been sent to your email.', 'forgot');
            } catch (error) {
                setButtonLoading(submitBtn, false);
                showAlert('success', 'Password reset instructions have been sent to your email.', 'forgot');
            }
        });
    }
});
