/* App Router (hash-based SPA) */

import { subscribe, EVENTS } from './data/store.js';
import { renderHome } from './screens/home.js';
import { renderCreateTrip } from './screens/createTrip.js';
import { renderJoinTrip } from './screens/joinTrip.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderAddFlight } from './screens/addFlight.js';
import { renderNotes } from './screens/notes.js';
import { loadAirports } from './data/airports.js';

const app = document.getElementById('app');

function getRoute() {
    const hash = window.location.hash.slice(1) || '';
    const parts = hash.split('/').filter(Boolean);

    // Route matching for #trip/:tripId/add-flight, #trip/:tripId/notes, #trip/:tripId
    if (parts[0] === 'trip' && parts[1]) {
        const tripId = parts[1];
        const subRoute = parts[2];

        if (subRoute === 'add-flight') {
            return { renderFn: renderAddFlight, params: tripId };
        }
        if (subRoute === 'notes') {
            return { renderFn: renderNotes, params: tripId };
        }
        return { renderFn: renderDashboard, params: tripId };
    }

    if (parts[0] === 'create') return { renderFn: renderCreateTrip };
    if (parts[0] === 'join') return { renderFn: renderJoinTrip, params: parts[1] || '' };
    if (parts[0] === 'add-flight') return { renderFn: renderAddFlight, params: parts[1] };
    if (parts[0] === 'notes') return { renderFn: renderNotes, params: parts[1] };

    return { renderFn: renderHome };
}

export function navigate(path) {
    window.location.hash = path;
}

function render() {
    const { renderFn, params } = getRoute();

    // Clear and render target screen
    app.innerHTML = '';
    renderFn(app, params);
}

export function initRouter() {
    window.addEventListener('hashchange', render);
    window.addEventListener('load', render);

    // Listen for programmatic navigation
    subscribe(EVENTS.NAVIGATE, (path) => navigate(path));

    // Preload airport dataset
    loadAirports();

    render();
}
