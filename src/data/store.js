/* ============================================
   Reactive Store (pub/sub)
   ============================================ */

const listeners = new Map();

export function subscribe(event, callback) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);
    return () => {
        if (listeners.has(event)) {
            listeners.get(event).delete(callback);
        }
    };
}

export function emit(event, data) {
    if (listeners.has(event)) {
        listeners.get(event).forEach(cb => {
            try {
                cb(data);
            } catch (e) {
                console.error(`Error in event listener for ${event}:`, e);
            }
        });
    }
}

// Events
export const EVENTS = {
    TRIP_CREATED: 'trip:created',
    TRIP_JOINED: 'trip:joined',
    TRIP_DELETED: 'trip:deleted',
    FLIGHT_ADDED: 'flight:added',
    FLIGHT_DELETED: 'flight:deleted',
    FLIGHT_UPDATED: 'flight:updated',
    FLIGHT_STATUS_CHANGED: 'flight:statusChanged',
    PARTICIPANT_ADDED: 'participant:added',
    PARTICIPANT_DELETED: 'participant:deleted',
    NOTE_ADDED: 'note:added',
    NOTE_DELETED: 'note:deleted',
    NAVIGATE: 'navigate'
};
