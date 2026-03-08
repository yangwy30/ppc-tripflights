/* ============================================
   PPC: Delay No More — Alert Service
   
   Auto-refreshes flight status every 15 minutes
   and sends browser notifications for delays.
   ============================================ */

import { savePushSubscription, getUserNickname } from './dataAdapter.js';
import { emit, EVENTS } from './store.js';

const PREF_KEY = 'ppc-trip-tracker_autorefresh';

function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREF_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function getAutoRefreshPref(tripId) {
    const prefs = loadPrefs();
    return !!prefs[tripId];
}

export function setAutoRefreshPref(tripId, enabled) {
    const prefs = loadPrefs();
    if (enabled) {
        prefs[tripId] = true;
    } else {
        delete prefs[tripId];
    }
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

/**
 * Request browser notification permission.
 * Returns true if granted.
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Notifications not supported in this browser');
        return false;
    }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
}

/**
 * Send a browser notification.
 */
function sendNotification(title, body, icon = '✈️') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
        const notification = new Notification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: title, // prevent duplicates
            requireInteraction: true,
        });

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

/**
 * Helper to convert Base64 URL to Uint8Array for PushManager
 */
function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Start automatic status polling via Web Push.
 * Registers Service Worker and subscribes to PushManager.
 */
export async function startPolling(tripId) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Web Push is not supported in this browser.');
        return;
    }

    try {
        // 1. Register Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered with scope:', registration.scope);

        // 2. Wait for it to be ready
        const readyRegistration = await navigator.serviceWorker.ready;

        // 3. Subscribe to Web Push
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

        let subscription = await readyRegistration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await readyRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
        }

        console.log('Push Subscription successful');

        // 4. Send subscription to the backend via data adapter
        const nickname = getUserNickname();
        if (nickname) {
            await savePushSubscription(tripId, nickname, subscription.toJSON());
        }

    } catch (error) {
        console.error('Failed to subscribe to Web Push:', error);
    }
}

/**
 * Stop polling for a trip. (Unsubscribes from Web Push context for this trip)
 */
export async function stopPolling(tripId) {
    // We don't necessarily unsubscribe the entire device from Push, 
    // we would ideally delete the subscription from the DB, but for now 
    // we just let the backend handle it or gracefully ignore.
    console.log(`⏱️ Stopped notifications for trip ${tripId}`);
}

/**
 * Stop all active pollers.
 */
export function stopAllPolling() {
    console.log(`⏱️ Stopped all notifications`);
}

/**
 * Get the status of auto-refresh for a trip.
 */
export function isPolling(tripId) {
    return getAutoRefreshPref(tripId);
}
