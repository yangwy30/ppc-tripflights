/* ============================================
   TripFlights — Join Trip Screen
   ============================================ */

import { joinTrip } from '../data/dataAdapter.js';
import { emit, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';

export function renderJoinTrip(container) {
    container.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-back">
          ← Back
        </button>
      </div>

      <div class="screen-header">
        <h1>Join a Trip</h1>
        <p>Enter the PIN code shared by your friend</p>
      </div>

      <form id="join-form" class="flex-col" style="gap: var(--space-sm);">
        <div class="input-group">
          <label for="pin-code">Trip PIN Code</label>
          <input class="input" type="text" id="pin-code" placeholder="Enter 6-digit PIN" 
            maxlength="6" pattern="[0-9]{6}" inputmode="numeric" required 
            style="font-size: var(--font-size-xl); letter-spacing: 6px; text-align: center; font-weight: var(--font-weight-bold);" />
        </div>

        <div class="input-group">
          <label for="join-name">Your Nickname</label>
          <input class="input" type="text" id="join-name" placeholder="e.g. Jordan" required autocomplete="off" />
        </div>

        <button class="btn btn-primary mt-lg" type="submit">
          Join Trip 📌
        </button>

        <div id="join-error" style="display:none; text-align:center; margin-top: var(--space-base);">
          <p style="color: var(--color-danger); font-weight: var(--font-weight-medium);">
            No trip found with that PIN. Please check and try again.
          </p>
        </div>
      </form>
    </div>
  `;

    container.querySelector('#btn-back').addEventListener('click', () => navigate(''));

    container.querySelector('#join-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const pin = container.querySelector('#pin-code').value.trim();
        const nickname = container.querySelector('#join-name').value.trim();
        const errorEl = container.querySelector('#join-error');

        if (!pin || !nickname) return;

        const trip = joinTrip({ pin, nickname });
        if (trip) {
            errorEl.style.display = 'none';
            emit(EVENTS.TRIP_JOINED, trip);
            showToast(`Joined "${trip.name}"!`, 'success');
            navigate(`trip/${trip.id}`);
        } else {
            errorEl.style.display = 'block';
            showToast('Trip not found', 'error');
        }
    });
}
