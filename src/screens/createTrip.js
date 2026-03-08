/* ============================================
   PPC: Delay No More — Create Trip Screen
   ============================================ */

import { createTrip } from '../data/dataAdapter.js';
import { emit, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { setupAirportAutocomplete } from '../components/airportSearch.js';

export function renderCreateTrip(container) {
  // Default dates: today + 7 days
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const todayStr = today.toISOString().split('T')[0];
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-back">
          ← Back
        </button>
      </div>

      <div class="screen-header">
        <h1>Create a Trip</h1>
        <p>Name your trip, set dates, and share the PIN</p>
      </div>

      <form id="create-form" class="flex-col" style="gap: var(--space-sm);">
        <div class="input-group">
          <label for="trip-name">Trip Name</label>
          <input class="input" type="text" id="trip-name" placeholder="e.g. Hawaii Vacation 2026" required autocomplete="off" />
        </div>

        <div class="flex" style="gap: var(--space-sm);">
          <div class="input-group" style="flex:1;">
            <label for="trip-start">Start Date</label>
            <input class="input" type="date" id="trip-start" value="${todayStr}" required />
          </div>
          <div class="input-group" style="flex:1;">
            <label for="trip-end">End Date</label>
            <input class="input" type="date" id="trip-end" value="${nextWeekStr}" required />
          </div>
        </div>

        <div class="input-group">
          <label for="destination-airport">Destination (City or Airport, Optional)</label>
          <div id="destination-airport-container"></div>
        </div>

        <div class="input-group">
          <label for="return-airport">Return From (City or Airport, Optional)</label>
          <div id="return-airport-container"></div>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 4px;">Leave blank if returning from the destination.</p>
        </div>

        <div class="input-group">
          <label for="your-name">Your Nickname</label>
          <input class="input" type="text" id="your-name" placeholder="e.g. Alex" required autocomplete="off" />
        </div>

        <div class="input-group">
          <label for="home-airport">Your Origin (City or Airport, Optional)</label>
          <div id="home-airport-container"></div>
          <p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 4px;">Where are you flying from?</p>
        </div>

        <button class="btn btn-primary mt-lg" type="submit">
          Create Trip ✈️
        </button>
      </form>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => navigate(''));

  const destAirportContainer = container.querySelector('#destination-airport-container');
  const destAirportInput = setupAirportAutocomplete(destAirportContainer, 'e.g. LON or LHR');

  const returnAirportContainer = container.querySelector('#return-airport-container');
  const returnAirportInput = setupAirportAutocomplete(returnAirportContainer, 'e.g. CDG or Paris');

  const homeAirportContainer = container.querySelector('#home-airport-container');
  const homeAirportInput = setupAirportAutocomplete(homeAirportContainer, 'e.g. JFK or New York', false);

  container.querySelector('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = container.querySelector('#trip-name').value.trim();
    const startDate = container.querySelector('#trip-start').value;
    const endDate = container.querySelector('#trip-end').value;
    const creatorName = container.querySelector('#your-name').value.trim();
    const destinationAirport = destAirportInput.getValues().join(',');
    const returnAirport = returnAirportInput.getValues().join(',');
    const homeAirport = homeAirportInput.getValues().join(',');

    if (!name || !creatorName) return;

    const submitBtn = container.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const trip = await createTrip({ name, startDate, endDate, creatorName, destinationAirport, returnAirport, homeAirport });
    if (trip) {
      emit(EVENTS.TRIP_CREATED, trip);
      showToast(`Trip "${trip.name}" created! PIN: ${trip.pin}`, 'success');
      navigate(`trip/${trip.id}`);
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Trip ✈️';
      showToast('Failed to create trip', 'error');
    }
  });
}
