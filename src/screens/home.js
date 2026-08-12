/* Home screen */

import { getAllTrips } from '../data/dataAdapter.js';
import { navigate } from '../app.js';
import { getIcon } from '../components/icons.js';

export async function renderHome(container) {
  container.innerHTML = `
    <div class="screen" style="max-width: 540px; margin: 0 auto; padding-top: var(--space-xl);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--space-lg);">
        <div style="display:flex; align-items:center; gap: 10px;">
          <span style="color: var(--color-accent); display:flex; font-size: 1.5rem;">${getIcon('plane')}</span>
          <h1 style="font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; margin: 0;">PPC: Delay No More</h1>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); margin-bottom: var(--space-xl);">
        <button class="btn btn-primary" id="btn-create" style="padding: 12px 16px; font-size: var(--font-size-sm); justify-content: center;">
          <span style="display:flex;">${getIcon('plus')}</span> New Trip
        </button>
        <button class="btn btn-secondary" id="btn-join" style="padding: 12px 16px; font-size: var(--font-size-sm); justify-content: center;">
          <span style="display:flex;">${getIcon('share')}</span> Join with PIN
        </button>
      </div>

      <div id="trip-list-section"></div>
    </div>
  `;

  const trips = await getAllTrips();
  const listContainer = container.querySelector('#trip-list-section');

  if (trips && trips.length > 0) {
    listContainer.innerHTML = `
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--color-text-tertiary); margin-bottom: var(--space-sm); padding-left: 4px;">Recent Trips</div>
      <div class="flex-col" style="gap: var(--space-sm);">
        ${trips.map((trip) => `
          <div class="card card-compact trip-card" data-trip-id="${trip.id}" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition: all var(--transition-fast);">
            <div>
              <div style="font-size: var(--font-size-md); font-weight: 700; color: var(--color-text-primary); letter-spacing: -0.025em;">${escapeHtml(trip.name)}</div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 3px; font-family: var(--font-family-mono);">${formatDateRange(trip.startDate, trip.endDate)}</div>
            </div>
            <div style="display:flex; align-items:center; gap: var(--space-md); font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">
              <span style="display:flex; align-items:center; gap:4px;">${getIcon('user')} ${trip.participants?.length || 0}</span>
              <span style="display:flex; align-items:center; gap:4px;">${getIcon('plane')} ${trip.flights?.length || 0}</span>
              <span style="display:flex;">${getIcon('arrowRight')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    listContainer.querySelectorAll('.trip-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate(`trip/${card.dataset.tripId}`);
      });
    });
  }

  container.querySelector('#btn-create').addEventListener('click', () => navigate('create'));
  container.querySelector('#btn-join').addEventListener('click', () => navigate('join'));
}

function formatDateRange(start, end) {
  if (!start) return '';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
  const e = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts) : '';
  return e ? `${s} — ${e}` : s;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
