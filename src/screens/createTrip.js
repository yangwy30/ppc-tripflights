/* ============================================
   TripFlights — Create Trip Screen
   ============================================ */

import { createTrip } from '../data/dataAdapter.js';
import { emit, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';

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
          <label for="your-name">Your Nickname</label>
          <input class="input" type="text" id="your-name" placeholder="e.g. Alex" required autocomplete="off" />
        </div>

        <button class="btn btn-primary mt-lg" type="submit">
          Create Trip ✈️
        </button>
      </form>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => navigate(''));

  container.querySelector('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = container.querySelector('#trip-name').value.trim();
    const startDate = container.querySelector('#trip-start').value;
    const endDate = container.querySelector('#trip-end').value;
    const creatorName = container.querySelector('#your-name').value.trim();

    if (!name || !creatorName) return;

    const submitBtn = container.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    const trip = await createTrip({ name, startDate, endDate, creatorName });
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
