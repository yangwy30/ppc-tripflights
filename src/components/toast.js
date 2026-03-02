/* ============================================
   PPC Trip Tracker — Toast Notification System
   ============================================ */

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
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
    <span class="toast-icon">${STATUS_ICONS[type] || STATUS_ICONS.info}</span>
    <span style="flex:1;">${message}</span>
  `;

    if (action && action.label && action.onClick) {
        const btn = document.createElement('button');
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            action.onClick();
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        });
        toast.appendChild(btn);
        // Longer timeout when there's an action
        duration = Math.max(duration, 5000);
    }

    container.appendChild(toast);

    const timer = setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}
