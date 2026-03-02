/* ============================================
   PPC Trip Tracker — Alert Service
   
   Auto-refreshes flight status every 15 minutes
   and sends browser notifications for delays.
   ============================================ */

import { refreshFlightStatus } from './flightService.js';
import { getTrip, updateFlightStatus } from './dataAdapter.js';
import { emit, EVENTS } from './store.js';

// Refresh interval: 15 minutes
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
let activePollers = new Map(); // tripId -> intervalId

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
 * Check all flights in a trip for status changes.
 * Sends notifications for delays and cancellations.
 */
async function checkTripFlights(tripId) {
    const trip = await getTrip(tripId);
    if (!trip || trip.flights.length === 0) return;

    console.log(`🔄 Auto-refreshing ${trip.flights.length} flight(s) for "${trip.name}"`);

    for (const flight of trip.flights) {
        // Skip flights that have already landed or were cancelled
        if (flight.status === 'landed' || flight.status === 'cancelled') continue;

        try {
            const oldStatus = flight.status;
            const newStatus = await refreshFlightStatus(flight.flightNumber);

            if (newStatus && newStatus !== oldStatus) {
                // Update in storage
                await updateFlightStatus(tripId, flight.id, newStatus);

                console.log(`✈️ ${flight.flightNumber}: ${oldStatus} → ${newStatus}`);

                // Notify for concerning status changes
                if (newStatus === 'delayed') {
                    sendNotification(
                        `⚠️ ${flight.flightNumber} Delayed`,
                        `${flight.departure?.code} → ${flight.arrival?.code} (${flight.addedBy || 'Unknown'})\n` +
                        `Departure: ${flight.departure?.time || 'N/A'} on ${flight.date || 'N/A'}`,
                    );
                } else if (newStatus === 'cancelled') {
                    sendNotification(
                        `❌ ${flight.flightNumber} Cancelled`,
                        `${flight.departure?.code} → ${flight.arrival?.code} (${flight.addedBy || 'Unknown'})\n` +
                        `This flight has been cancelled.`,
                    );
                } else if (newStatus === 'landed' && oldStatus !== 'landed') {
                    sendNotification(
                        `🛬 ${flight.flightNumber} Landed`,
                        `Arrived at ${flight.arrival?.code || ''} ${flight.arrival?.city ? '(' + flight.arrival.city + ')' : ''}`,
                    );
                }

                // Emit event so the UI can re-render
                emit(EVENTS.FLIGHT_STATUS_CHANGED, { tripId, flightId: flight.id, oldStatus, newStatus });
            }
        } catch (error) {
            console.warn(`Failed to refresh ${flight.flightNumber}:`, error.message);
        }

        // Small delay between API calls to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
    }
}

/**
 * Start automatic status polling for a trip.
 * Runs immediately on first call, then every 15 minutes.
 */
export function startPolling(tripId) {
    // Don't double-poll
    if (activePollers.has(tripId)) return;

    console.log(`⏱️ Started auto-refresh for trip ${tripId} (every 15 min)`);

    // Run first check after 5 seconds (let the UI settle)
    setTimeout(() => checkTripFlights(tripId), 5000);

    // Set up interval
    const intervalId = setInterval(() => {
        checkTripFlights(tripId);
    }, REFRESH_INTERVAL_MS);

    activePollers.set(tripId, intervalId);
}

/**
 * Stop polling for a trip.
 */
export function stopPolling(tripId) {
    const intervalId = activePollers.get(tripId);
    if (intervalId) {
        clearInterval(intervalId);
        activePollers.delete(tripId);
        console.log(`⏱️ Stopped auto-refresh for trip ${tripId}`);
    }
}

/**
 * Stop all active pollers.
 */
export function stopAllPolling() {
    activePollers.forEach((intervalId, tripId) => {
        clearInterval(intervalId);
        console.log(`⏱️ Stopped auto-refresh for trip ${tripId}`);
    });
    activePollers.clear();
}

/**
 * Get the status of auto-refresh for a trip.
 */
export function isPolling(tripId) {
    return activePollers.has(tripId);
}
