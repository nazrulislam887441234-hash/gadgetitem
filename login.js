/**
 * ==========================================
 * GADGETA ITEM - AUTHENTICATION LOGIC JS
 * ==========================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. REUSE EXISTING FIREBASE CONFIGURATION OR INITIALIZE SAFELY
    // Note: Reusing exact project setup. Replace config details if not auto-injected by host platform environment.
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
            // Respect existing project routing convention (/profile)
            window.location.href = '/profile';
        }
    });

    // 4. MODE SWITCHING FUNCTIONS (No Page Reload)
    function switchMode(targetSection) {
        [loginSection, signupSection, forgotSection].forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        targetSection.style.display = 'block';
        setTimeout(() => targetSection.classList.add('active'), 10);
        clearAllAlerts();
    }

    toSignupBtn.addEventListener('click', () => switchMode(signupSection));
    toLoginBtn.addEventListener('click', () => switchMode(loginSection));
    forgotPwdTrigger.addEventListener('click', () => switchMode(forgotSection));
    backToLoginBtn.addEventListener('click', () => switchMode(loginSection));

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
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
                toggleBtn.setAttribute('aria-label', 'Hide password');
            } else {
                eyeIcon.style.display = 'block';
                eyeOffIcon.style.display = 'none';
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
        const textSpan = btn.querySelector('.gi-btn-text');
        const loaderSpan = btn.querySelector('.gi-btn-loader');
        
        if (isLoading) {
            btn.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loaderSpan) {
                loaderSpan.style.display = 'flex';
                const spanTxt = loaderSpan.childNodes[2];
                if (spanTxt && spanTxt.nodeType === Node.TEXT_NODE) {
                    spanTxt.textContent = ` ${customText}`;
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
            inputEl.style.borderColor = 'var(--gi-danger)';
        }
    }

    function clearFieldError(fieldId) {
        const errorEl = document.getElementById(`${fieldId}-error`);
        const inputEl = document.getElementById(fieldId);
        if (errorEl && inputEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
            inputEl.style.borderColor = 'var(--gi-border)';
        }
    }

    // 9. EMAIL/PASSWORD LOGIN HANDLER
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlerts('login');

        const email = document.getElementById('gi-login-email').value.trim();
        const password = document.getElementById('gi-login-password').value;
        const submitBtn = document.getElementById('gi-login-submit-btn');

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
            // Redirect is handled automatically by onAuthStateChanged
        } catch (error) {
            setButtonLoading(submitBtn, false);
            showAlert('error', getFriendlyErrorMessage(error.code), 'login');
        }
    });

    // 10. EMAIL/PASSWORD SIGNUP HANDLER
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlerts('signup');

        const fullName = document.getElementById('gi-signup-name').value.trim();
        const email = document.getElementById('gi-signup-email').value.trim();
        const password = document.getElementById('gi-signup-password').value;
        const confirmPassword = document.getElementById('gi-signup-confirm-password').value;
        const submitBtn = document.getElementById('gi-signup-submit-btn');

        let isValid = true;

        if (!fullName) {
            showFieldError('gi-signup-name', 'Full name is required.');
            isValid = false;
        } else {
            clearFieldError('gi-signup-name');
        }

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
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            if (userCredential.user) {
                await userCredential.user.updateProfile({
                    displayName: fullName
                });
            }
            // Redirect managed by auth state listener to /profile
        } catch (error) {
            setButtonLoading(submitBtn, false);
            showAlert('error', getFriendlyErrorMessage(error.code), 'signup');
        }
    });

    // 11. GOOGLE AUTHENTICATION HANDLER
    async function handleGoogleAuth(btnElement) {
        clearAllAlerts();
        const originalText = btnElement.innerHTML;
        btnElement.disabled = true;

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
            // Redirect handled by onAuthStateChanged
        } catch (error) {
            btnElement.disabled = false;
            btnElement.innerHTML = originalText;
            showAlert('error', 'Google sign-in could not be completed. Please try again.', 'login');
        }
    }

    googleLoginBtn.addEventListener('click', () => handleGoogleAuth(googleLoginBtn));
    googleSignupBtn.addEventListener('click', () => handleGoogleAuth(googleSignupBtn));

    // 12. FORGOT PASSWORD HANDLER
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlerts('forgot');

        const email = document.getElementById('gi-forgot-email').value.trim();
        const submitBtn = document.getElementById('gi-forgot-submit-btn');

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
            // For security, handle non-existing emails gracefully without throwing direct enumeration feedback
            showAlert('success', 'Password reset instructions have been sent to your email.', 'forgot');
        }
    });
});
