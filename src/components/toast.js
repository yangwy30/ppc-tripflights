/* Toast Notification System */

const STATUS_ICONS = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
    flight: '✈️'
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {string} type - success, error, warning, info, flight
 * @param {number} duration - ms before auto-dismiss
 * @param {{ label: string, onClick: Function }} [action] - optional action button (e.g. Undo)
 */
export function showToast(message, type = 'info', duration = 3000, action = null) {
    const container = document.getElementById('toast-container');
    if (!container) return () => {};

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' || type === 'warning' ? 'assertive' : 'polite');

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = STATUS_ICONS[type] || STATUS_ICONS.info;

    const copy = document.createElement('span');
    copy.className = 'toast-message';
    copy.textContent = String(message || '');

    toast.append(icon, copy);

    let timer = null;
    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        if (timer) window.clearTimeout(timer);
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
        // Reduced-motion mode and interrupted animations do not emit animationend.
        window.setTimeout(() => toast.remove(), 260);
    };

    if (action && action.label && action.onClick) {
        const btn = document.createElement('button');
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                action.onClick();
            } finally {
                dismiss();
            }
        });
        toast.appendChild(btn);
        // Longer timeout when there's an action
        duration = Math.max(duration, 5000);
    }

    toast.addEventListener('click', dismiss);

    while (container.children.length >= 4) {
        container.firstElementChild?.remove();
    }
    container.appendChild(toast);

    const timeout = Number.isFinite(duration) ? Math.max(750, duration) : 3000;
    timer = window.setTimeout(dismiss, timeout);
    return dismiss;
}
