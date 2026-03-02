/* ============================================
   PPC Trip Tracker — App Router (hash-based SPA)
   ============================================ */

import { subscribe, EVENTS } from './data/store.js';
import { renderHome } from './screens/home.js';
import { renderCreateTrip } from './screens/createTrip.js';
import { renderJoinTrip } from './screens/joinTrip.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderAddFlight } from './screens/addFlight.js';
import { renderNotes } from './screens/notes.js';

const app = document.getElementById('app');

const routes = {
    '': renderHome,
    'home': renderHome,
    'create': renderCreateTrip,
    'join': renderJoinTrip,
    'trip': renderDashboard,
    'add-flight': renderAddFlight,
    'notes': renderNotes
};

function getRoute() {
    const hash = window.location.hash.slice(1) || '';
    const [path, ...paramParts] = hash.split('/');
    const params = paramParts.join('/');
    return { path, params };
}

export function navigate(path) {
    window.location.hash = path;
}

function render() {
    const { path, params } = getRoute();
    const routeKey = path.split('/')[0];
    const renderFn = routes[routeKey] || routes[''];

    // Clear and render
    app.innerHTML = '';
    renderFn(app, params || path.split('/').slice(1).join('/'));
}

export function initRouter() {
    window.addEventListener('hashchange', render);
    window.addEventListener('load', render);

    // Listen for programmatic navigation
    subscribe(EVENTS.NAVIGATE, (path) => navigate(path));

    render();
}
