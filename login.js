:root {
    --gi-primary: #0066ff;
    --gi-primary-dark: #004dcc;
    --gi-primary-light: #e6f0ff;
    --gi-text: #10213f;
    --gi-muted: #667085;
    --gi-background: #ffffff;
    --gi-surface: #f7faff;
    --gi-border: #e5edf8;
    --gi-shadow: 0 4px 20px rgba(0, 102, 255, 0.06);
    --gi-radius: 12px;
    --gi-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --gi-danger: #d92d20;
    --gi-danger-light: #fef3f2;
    --gi-success: #039855;
    --gi-success-light: #ecfdf3;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Outfit', 'Hind Siliguri', sans-serif;
    background-color: var(--gi-surface);
    color: var(--gi-text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
}

/* Header Styles */
.gi-header {
    background: var(--gi-background);
    border-bottom: 1px solid var(--gi-border);
    position: sticky;
    top: 0;
    z-index: 100;
}

.gi-header-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.gi-logo-link {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
}

.gi-brand-logo {
    height: 36px;
    width: auto;
    object-fit: contain;
}

.gi-brand-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--gi-text);
}

.gi-watermark-icon {
    height: 24px;
    opacity: 0.6;
    object-fit: contain;
}

/* Main Content Layout */
.gi-main-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 16px;
}

.gi-auth-container {
    width: 100%;
    max-width: 960px;
}

.gi-auth-card {
    background: var(--gi-background);
    border-radius: var(--gi-radius);
    box-shadow: var(--gi-shadow);
    border: 1px solid var(--gi-border);
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    overflow: hidden;
}

/* Left Side Branding Banner */
.gi-auth-banner {
    background: linear-gradient(135deg, #004dcc 0%, #0066ff 100%);
    color: #ffffff;
    padding: 48px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
}

.gi-banner-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: center;
}

.gi-banner-watermark-wrap {
    margin-bottom: 24px;
}

.gi-banner-watermark {
    height: 48px;
    filter: brightness(0) invert(1);
    opacity: 0.9;
}

.gi-auth-banner h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 16px;
    line-height: 1.2;
}

.gi-auth-banner p {
    font-size: 0.95rem;
    opacity: 0.85;
    line-height: 1.5;
}

.gi-abstract-shape {
    position: absolute;
    width: 200px;
    height: 200px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 50%;
    bottom: -50px;
    right: -50px;
    pointer-events: none;
}

/* Right Side Forms Wrapper */
.gi-auth-forms-wrapper {
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.gi-form-header {
    margin-bottom: 24px;
}

.gi-form-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--gi-text);
    margin-bottom: 6px;
}

.gi-form-header p {
    font-size: 0.875rem;
    color: var(--gi-muted);
}

/* Input Elements */
.gi-input-group {
    margin-bottom: 18px;
    display: flex;
    flex-direction: column;
}

.gi-input-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--gi-text);
}

.gi-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.gi-input-icon {
    position: absolute;
    left: 14px;
    width: 18px;
    height: 18px;
    color: var(--gi-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.gi-input-icon svg {
    width: 100%;
    height: 100%;
}

.gi-input-wrapper input {
    width: 100%;
    padding: 12px 16px 12px 42px;
    border: 1px solid var(--gi-border);
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9375rem;
    color: var(--gi-text);
    background: var(--gi-background);
    transition: var(--gi-transition);
}

.gi-input-wrapper input:focus {
    outline: none;
    border-color: var(--gi-primary);
    box-shadow: 0 0 0 3px var(--gi-primary-light);
}

.gi-password-toggle {
    position: absolute;
    right: 12px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gi-muted);
    display: flex;
    align-items: center;
    padding: 4px;
}

.gi-password-toggle svg {
    width: 18px;
    height: 18px;
}

.gi-field-error {
    font-size: 0.75rem;
    color: var(--gi-danger);
    margin-top: 4px;
    display: none;
}

.gi-field-error.visible {
    display: block;
}

/* Actions & Buttons */
.gi-form-actions-row {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
}

.gi-text-btn {
    background: none;
    border: none;
    color: var(--gi-primary);
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
}

.gi-text-btn:hover {
    text-decoration: underline;
}

.gi-btn {
    width: 100%;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: var(--gi-transition);
    border: none;
}

.gi-btn-primary {
    background: var(--gi-primary);
    color: #ffffff;
}

.gi-btn-primary:hover:not(:disabled) {
    background: var(--gi-primary-dark);
}

.gi-btn-secondary {
    background: var(--gi-background);
    color: var(--gi-text);
    border: 1px solid var(--gi-border);
}

.gi-btn-secondary:hover:not(:disabled) {
    background: var(--gi-surface);
    border-color: var(--gi-muted);
}

.gi-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

/* Spinner Loader Animation */
.gi-spinner {
    width: 16px;
    height: 16px;
    animation: gi-spin 0.8s linear infinite;
}

@keyframes gi-spin {
    to { transform: rotate(360deg); }
}

/* Dividers & Mode Switch */
.gi-divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 20px 0;
    color: var(--gi-muted);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.gi-divider::before,
.gi-divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--gi-border);
}

.gi-divider span {
    padding: 0 12px;
}

.gi-switch-auth-mode {
    margin-top: 24px;
    text-align: center;
    font-size: 0.875rem;
    color: var(--gi-muted);
}

.gi-text-link {
    background: none;
    border: none;
    color: var(--gi-primary);
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
}

.gi-text-link:hover {
    text-decoration: underline;
}

/* Alert Boxes */
.gi-alert-box {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.8125rem;
    margin-bottom: 16px;
    line-height: 1.4;
}

.gi-alert-error {
    background-color: var(--gi-danger-light);
    color: var(--gi-danger);
    border: 1px solid rgba(217, 45, 32, 0.2);
}

.gi-alert-success {
    background-color: var(--gi-success-light);
    color: var(--gi-success);
    border: 1px solid rgba(3, 152, 85, 0.2);
}

/* Footer Section Exact Preservation */
.tj-footer {
    background: #0d1b32;
    color: #ffffff;
    padding: 48px 24px 24px;
    margin-top: auto;
}

.tj-footer-container {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 32px;
    margin-bottom: 32px;
}

.tj-footer-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}

.tj-footer-logo {
    height: 30px;
}

.tj-footer-brand span {
    font-size: 1.125rem;
    font-weight: 700;
}

.tj-footer-desc {
    font-size: 0.8125rem;
    color: #94a3b8;
    line-height: 1.5;
}

.tj-footer-col h4 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: 16px;
    color: #ffffff;
}

.tj-footer-col ul {
    list-style: none;
}

.tj-footer-col ul li {
    margin-bottom: 10px;
}

.tj-footer-col ul li a,
.tj-footer-col p {
    font-size: 0.8125rem;
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s;
}

.tj-footer-col ul li a:hover {
    color: var(--gi-primary);
}

.tj-footer-bottom {
    max-width: 1280px;
    margin: 0 auto;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
    font-size: 0.75rem;
    color: #64748b;
}

/* Mobile Bottom Navigation Visibility Rules */
.gi-mobile-bottom-nav {
    display: none;
}

@media (max-width: 768px) {
    .gi-mobile-bottom-nav {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: var(--gi-background);
        border-top: 1px solid var(--gi-border);
        z-index: 1000;
        justify-content: space-around;
        align-items: center;
        box-shadow: 0 -4px 12px rgba(0,0,0,0.05);
    }

    .gi-mob-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-decoration: none;
        color: var(--gi-muted);
        font-size: 0.625rem;
        font-weight: 600;
        gap: 4px;
        flex: 1;
    }

    .gi-mob-nav-item svg {
        width: 20px;
        height: 20px;
    }

    .gi-mob-nav-item.active,
    .gi-mob-nav-item:hover {
        color: var(--gi-primary);
    }

    /* Extra padding at bottom to clear mobile navigation bar */
    body {
        padding-bottom: 60px;
    }

    .gi-auth-card {
        grid-template-columns: 1fr;
    }

    .gi-auth-banner {
        display: none; /* Hide decorative banner on small screens for comfortable clean layout */
    }

    .gi-auth-forms-wrapper {
        padding: 24px 16px;
    }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
