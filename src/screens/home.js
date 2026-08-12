/* ============================================
   Home screen
   ============================================ */

import { getAllTrips } from '../data/dataAdapter.js';
import { navigate } from '../app.js';
import { getIcon } from '../components/icons.js';

export async function renderHome(container) {
  container.innerHTML = `
    <div class="screen" style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height: 85vh;">
      <div class="card" style="width: 100%; max-width: 440px; padding: var(--space-xl); background: rgba(15, 23, 42, 0.85); border: 1px solid var(--color-border); backdrop-filter: blur(20px);">
        <div style="display:flex; align-items:center; gap: 12px; margin-bottom: var(--space-lg);">
          <span style="color: var(--color-accent); display:flex; font-size: 1.5rem;">${getIcon('plane')}</span>
          <span style="font-size: 1.6rem; font-weight: 800; letter-spacing: -0.045em;">PPC: Delay No More</span>
        </div>
        
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
          <button class="btn btn-ghost" id="btn-create" style="width:100%; justify-flex-start; padding: 14px 18px; border-bottom: 1px solid var(--color-border); border-radius:0;">
            <span style="color: var(--color-text-secondary); width:20px; display:flex;">${getIcon('plus')}</span>
            <span style="font-weight: var(--font-weight-semibold); letter-spacing: -0.01em;">Create New Trip</span>
          </button>
          <button class="btn btn-ghost" id="btn-join" style="width:100%; justify-flex-start; padding: 14px 18px; border-radius:0;">
            <span style="color: var(--color-text-secondary); width:20px; display:flex;">${getIcon('share')}</span>
            <span style="font-weight: var(--font-weight-semibold); letter-spacing: -0.01em;">Join Trip with 6-Digit PIN</span>
          </button>
        </div>
      </div>

      <div id="trip-list-section" style="width: 100%; max-width: 440px; margin-top: var(--space-xl);"></div>
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
