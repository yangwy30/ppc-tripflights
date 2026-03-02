/* ============================================
   TripFlights — Reactive Store (pub/sub)
   ============================================ */

const listeners = new Map();

export function subscribe(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
    return () => listeners.get(event).delete(callback);
}

export function emit(event, data) {
    if (listeners.has(event)) {
        listeners.get(event).forEach(cb => cb(data));
    }
}

// Events
export const EVENTS = {
    TRIP_CREATED: 'trip:created',
    TRIP_JOINED: 'trip:joined',
    TRIP_DELETED: 'trip:deleted',
    FLIGHT_ADDED: 'flight:added',
    FLIGHT_DELETED: 'flight:deleted',
    FLIGHT_STATUS_CHANGED: 'flight:statusChanged',
    NOTE_ADDED: 'note:added',
    NOTE_DELETED: 'note:deleted',
    NAVIGATE: 'navigate'
};
