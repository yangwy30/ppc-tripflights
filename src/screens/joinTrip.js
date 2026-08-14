/* Join Trip screen */

import { joinTrip, updateParticipantDestination, getUserNickname } from '../data/dataAdapter.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { setupAirportAutocomplete } from '../components/airportSearch.js';
import { getIcon } from '../components/icons.js';

export function renderJoinTrip(container, invitePin = '') {
  const prefilledPin = /^\d{6}$/.test(invitePin) ? invitePin : '';
  container.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-back">
          <span style="display:flex;">${getIcon('arrowLeft')}</span> Back
        </button>
      </div>

      <div class="screen-header">
        <h1 style="font-size: 2.2rem; font-weight: 800; letter-spacing: -0.04em;">Join a Trip</h1>
        <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${prefilledPin ? 'Your invite code is ready. Add your details to join the trip.' : 'Enter the PIN code shared by your friend'}</p>
      </div>

      <form id="join-form" class="flex-col" style="gap: var(--space-sm);">
        <div class="input-group">
          <label for="pin-code">Trip PIN Code</label>
          <input class="input" type="text" id="pin-code" placeholder="Enter 6-digit PIN" value="${prefilledPin}"
            maxlength="6" pattern="[0-9]{6}" inputmode="numeric" required 
            style="font-family: var(--font-family-mono); font-size: 2.2rem; letter-spacing: 8px; text-align: center; font-weight: 800;" />
        </div>

        <div class="input-group">
          <label for="join-name">Your Nickname</label>
          <input class="input" type="text" id="join-name" placeholder="e.g. Jordan" required autocomplete="off" />
        </div>

        <div class="input-group">
          <label for="home-airport">Origin (City or Airport, Optional)</label>
          <div id="home-airport-container"></div>
        </div>

        <div class="input-group">
          <label for="dest-airport">Preferred Arrival Airport (Optional)</label>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-xs);">Override the trip's destination if you prefer a different airport</p>
          <div id="dest-airport-container"></div>
        </div>

        <button class="btn btn-primary mt-lg" type="submit" style="padding: 0.85rem var(--space-lg); font-size: var(--font-size-md);">
          <span style="display:flex;">${getIcon('share')}</span> Join Trip
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

  if (prefilledPin) {
    container.querySelector('#join-name')?.focus();
  }

  const homeAirportContainer = container.querySelector('#home-airport-container');
  const homeAirportInput = setupAirportAutocomplete(homeAirportContainer, 'e.g. JFK or New York');

  const destAirportContainer = container.querySelector('#dest-airport-container');
  const destAirportInput = setupAirportAutocomplete(destAirportContainer, 'e.g. SNA or Santa Ana', false);

  container.querySelector('#join-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const pin = container.querySelector('#pin-code').value.trim();
    const nickname = container.querySelector('#join-name').value.trim();
    const homeAirport = homeAirportInput.getValues().join(',');
    const destAirport = destAirportInput.getValues().join(',');
    const errorEl = container.querySelector('#join-error');

    if (!pin || !nickname) return;

    const submitBtn = container.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining...';

    const trip = await joinTrip({ pin, nickname, homeAirport });
    if (trip) {
      // Update per-person destination if set
      let destinationUpdated = true;
      if (destAirport) {
        destinationUpdated = await updateParticipantDestination(
          trip.id,
          getUserNickname(trip.id, trip) || nickname,
          destAirport
        );
      }
      errorEl.style.display = 'none';
      showToast(
        destinationUpdated ? `Joined "${trip.name}"!` : `Joined "${trip.name}", but the preferred airport was not saved`,
        destinationUpdated ? 'success' : 'warning'
      );
      navigate(`trip/${trip.id}`);
    } else {
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span style="display:flex;">${getIcon('share')}</span> Join Trip`;
      showToast('Trip not found', 'error');
    }
  });
}
