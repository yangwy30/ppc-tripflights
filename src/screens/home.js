/* ============================================
   TripFlights — Home Screen
   ============================================ */

import { getAllTrips } from '../data/dataAdapter.js';
import { navigate } from '../app.js';

export function renderHome(container) {
    const trips = getAllTrips();

    container.innerHTML = `
    <div class="screen">
      <div class="screen-header" style="padding-top: var(--space-xl);">
        <div style="margin-bottom: var(--space-xl);">
          <div style="font-size: 2.8rem; margin-bottom: var(--space-md);">✈️</div>
          <h1>TripFlights</h1>
          <p>Track group flights together</p>
        </div>
        <div class="flex-col" style="gap: var(--space-sm);">
          <button class="btn btn-primary" id="btn-create">
            <span>＋</span> Create a Trip
          </button>
          <button class="btn btn-secondary" id="btn-join">
            <span>📌</span> Join with PIN
          </button>
        </div>
      </div>

      ${trips.length > 0 ? `
        <div class="divider"></div>
        <h3 style="margin-bottom: var(--space-base);">Your Trips</h3>
        <div id="trip-list">
          ${trips.map((trip, i) => `
            <div class="trip-card stagger-${Math.min(i + 1, 6)}" data-trip-id="${trip.id}">
              <div class="trip-card-name">${escapeHtml(trip.name)}</div>
              <div class="trip-card-dates">📅 ${formatDateRange(trip.startDate, trip.endDate)}</div>
              <div class="trip-card-footer">
                <div class="trip-card-people">
                  👥 ${trip.participants.length} traveler${trip.participants.length > 1 ? 's' : ''}
                </div>
                <div class="trip-card-flights">
                  ✈️ ${trip.flights.length} flight${trip.flights.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state" style="padding-top: var(--space-xl);">
          <div class="empty-state-icon">🌍</div>
          <h3>No trips yet</h3>
          <p>Create a new trip or join one with a PIN code to get started</p>
        </div>
      `}
    </div>
  `;

    // Event listeners
    container.querySelector('#btn-create').addEventListener('click', () => navigate('create'));
    container.querySelector('#btn-join').addEventListener('click', () => navigate('join'));

    container.querySelectorAll('.trip-card').forEach(card => {
        card.addEventListener('click', () => {
            navigate(`trip/${card.dataset.tripId}`);
        });
    });
}

function formatDateRange(start, end) {
    if (!start) return '';
    const opts = { month: 'short', day: 'numeric' };
    const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
    const e = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts) : '';
    return e ? `${s} — ${e}` : s;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
