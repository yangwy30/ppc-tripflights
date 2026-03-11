/* ============================================
   PPC: Delay No More — Add Flight Screen
   
   Features:
   - Flight auto-lookup via AeroDataBox API
   - Route picker when multiple routes found
   - Book for self or any trip participant
   ============================================ */

import { addFlight, getTrip, getUserNickname, addParticipant } from '../data/dataAdapter.js';
import { emit, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { lookupFlight, getDemoFlightNumbers } from '../data/flightService.js';

export async function renderAddFlight(container, tripId) {
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);
  let lookupResult = null;   // selected flight (single object)
  let routeOptions = null;   // array of route options from API
  let isLooking = false;
  let selectedPerson = nickname; // default: current user

  // Default date = trip start date
  const defaultDate = trip.startDate || new Date().toISOString().split('T')[0];
  let currentDate = defaultDate;
  const demoFlights = getDemoFlightNumbers().slice(0, 6);

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="topbar-back" id="btn-back">← Back</button>
        </div>

        <div class="screen-header">
          <h1>Add Flight</h1>
          <p>Look up a flight or enter details manually</p>
        </div>

        <form id="flight-form" class="flex-col" style="gap: var(--space-base); padding-bottom: 100px;">
          
          <!-- Booking For (participant selector + add new) -->
          <div class="card">
            <h4 style="margin-bottom: var(--space-sm);">👤 Booking For</h4>
            <p style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-bottom: var(--space-md);">
              Select who this flight is for, or add a new traveler
            </p>
            <div class="chip-group" style="flex-wrap: wrap; margin-bottom: var(--space-sm);">
              ${currentTrip.participants.map(p => `
                <button type="button" class="chip person-chip ${selectedPerson === p.name ? 'active' : ''}" data-person="${escapeHtml(p.name)}">
                  ${escapeHtml(p.name)}${p.name === nickname ? ' (you)' : ''}
                </button>
              `).join('')}
            </div>
            <div class="input-with-btn">
              <input class="input" type="text" id="new-person-name" placeholder="Add new person (e.g. Candy)" autocomplete="off"
                style="font-size: var(--font-size-sm);" />
              <button class="btn btn-secondary btn-sm" id="btn-add-person" type="button">＋ Add</button>
            </div>
          </div>

          <!-- Flight Lookup -->
          <div class="card">
            <h4 style="margin-bottom: var(--space-md);">🔍 Flight Lookup</h4>
            <div class="input-with-btn mb-sm">
              <input class="input" type="text" id="flight-lookup" placeholder="e.g. AA100, DL665" autocomplete="off" 
                style="text-transform: uppercase;" />
              <button type="button" class="btn btn-primary btn-sm" id="btn-lookup" ${isLooking ? 'disabled' : ''}>
                ${isLooking ? '⏳' : 'Look Up'}
              </button>
            </div>
            <div style="margin-top: var(--space-sm); display: flex; flex-wrap: wrap; gap: 4px;">
              ${demoFlights.map(fn => `
                <button type="button" class="chip demo-flight" style="font-size: var(--font-size-xs); padding: 3px 8px;" data-fn="${fn}">${fn}</button>
              `).join('')}
            </div>
            
            <div class="input-group" style="margin-top: var(--space-md);">
              <label for="f-date">Flight Date</label>
              <input class="input" type="date" id="f-date" value="${currentDate}" required />
            </div>

            ${lookupResult === false ? `
              <p style="color: var(--color-warning); font-size: var(--font-size-sm); margin-top: var(--space-sm);">
                Flight not found. You can enter details manually below.
              </p>
            ` : ''}
          </div>

          <!-- Route Picker (shown when multiple routes found) -->
          ${routeOptions && routeOptions.length > 1 ? `
            <div class="card" style="border: 2px solid var(--color-accent); animation: scaleIn var(--transition-base) ease-out;">
              <h4 style="margin-bottom: var(--space-sm);">🔀 Multiple Routes Found</h4>
              <p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-md);">
                This flight number has ${routeOptions.length} different routes. Select the correct one:
              </p>
              <div class="flex-col" style="gap: var(--space-sm);">
                ${routeOptions.map((route, i) => `
                  <button type="button" class="route-option card-compact" data-route-index="${i}" style="
                    cursor: pointer; text-align: left; width: 100%;
                    border: 2px solid ${lookupResult === route ? 'var(--color-accent)' : 'var(--color-border-light)'};
                    background: ${lookupResult === route ? 'var(--color-accent-light)' : 'var(--color-surface)'};
                    transition: all var(--transition-fast);
                  ">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-md);">
                          ${escapeHtml(route.departure.code)} → ${escapeHtml(route.arrival.code)}
                        </div>
                        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                          ${escapeHtml(route.departure.city)} → ${escapeHtml(route.arrival.city)}
                        </div>
                        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 2px;">
                          ${escapeHtml(route.departure.time)} → ${escapeHtml(route.arrival.time)} · ${escapeHtml(route.duration)}
                        </div>
                      </div>
                      <div style="font-size: 1.2rem;">${lookupResult === route ? '✅' : '○'}</div>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Flight Details -->
          <div class="card flex-col" style="gap: var(--space-sm);">
            <div class="input-group">
              <label for="f-number">Flight Number</label>
              <input class="input" type="text" id="f-number" placeholder="e.g. UA901" required autocomplete="off"
                value="${lookupResult?.flightNumber || ''}" style="text-transform: uppercase;" />
            </div>

            <div class="input-group">
              <label for="f-airline">Airline</label>
              <input class="input" type="text" id="f-airline" placeholder="e.g. United Airlines" autocomplete="off"
                value="${lookupResult?.airline || ''}" />
            </div>

            <div class="flex" style="gap: var(--space-sm);">
              <div class="input-group" style="flex:1;">
                <label for="f-dep-code">From (Code)</label>
                <input class="input" type="text" id="f-dep-code" placeholder="JFK" maxlength="4" autocomplete="off"
                  value="${lookupResult?.departure?.code || ''}" style="text-transform: uppercase;" required />
              </div>
              <div class="input-group" style="flex:1;">
                <label for="f-arr-code">To (Code)</label>
                <input class="input" type="text" id="f-arr-code" placeholder="LHR" maxlength="4" autocomplete="off"
                  value="${lookupResult?.arrival?.code || ''}" style="text-transform: uppercase;" required />
              </div>
            </div>

            <div class="flex" style="gap: var(--space-sm);">
              <div class="input-group" style="flex:1;">
                <label for="f-dep-city">Departure City</label>
                <input class="input" type="text" id="f-dep-city" placeholder="New York" autocomplete="off"
                  value="${lookupResult?.departure?.city || ''}" />
              </div>
              <div class="input-group" style="flex:1;">
                <label for="f-arr-city">Arrival City</label>
                <input class="input" type="text" id="f-arr-city" placeholder="London" autocomplete="off"
                  value="${lookupResult?.arrival?.city || ''}" />
              </div>
            </div>

            <div class="flex" style="gap: var(--space-sm);">
              <div class="input-group" style="flex:1;">
                <label for="f-dep-time">Departure Time</label>
                <input class="input" type="time" id="f-dep-time"
                  value="${lookupResult ? convertTo24h(lookupResult.departure?.time) : ''}" />
              </div>
              <div class="input-group" style="flex:1;">
                <label for="f-arr-time">Arrival Time</label>
                <input class="input" type="time" id="f-arr-time"
                  value="${lookupResult ? convertTo24h(lookupResult.arrival?.time) : ''}" />
              </div>
            </div>

            <div class="flex" style="gap: var(--space-sm);">
              <div class="input-group" style="flex:1;">
                <label for="f-dep-terminal">Dep. Terminal</label>
                <input class="input" type="text" id="f-dep-terminal" placeholder="T1" autocomplete="off"
                  value="${lookupResult?.departure?.terminal || ''}" />
              </div>
              <div class="input-group" style="flex:1;">
                <label for="f-arr-terminal">Arr. Terminal</label>
                <input class="input" type="text" id="f-arr-terminal" placeholder="T5" autocomplete="off"
                  value="${lookupResult?.arrival?.terminal || ''}" />
              </div>
            </div>

            <div class="input-group">
              <label for="f-duration">Duration</label>
              <input class="input" type="text" id="f-duration" placeholder="e.g. 7h 15m" autocomplete="off"
                value="${lookupResult?.duration || ''}" />
            </div>
          </div>

          <div style="position: fixed; bottom: calc(var(--space-xl) + var(--safe-area-bottom)); left: 50%; transform: translateX(-50%); width: calc(100% - var(--space-xl) * 2); max-width: calc(var(--max-width) - var(--space-xl) * 2); z-index: 10;">
            <button class="btn btn-primary" type="submit" style="width: 100%; box-shadow: var(--shadow-lg);">
              Add Flight for ${escapeHtml(selectedPerson)} ✈️
            </button>
          </div>
        </form>
      </div>
    `;

    // --- Event Listeners ---
    container.querySelector('#btn-back').addEventListener('click', () => navigate(`trip/${tripId}`));
    container.querySelector('#btn-lookup').addEventListener('click', doLookup);

    // Enter key on lookup input
    container.querySelector('#flight-lookup').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doLookup(); }
    });

    // Demo flight chips
    container.querySelectorAll('.demo-flight').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelector('#flight-lookup').value = chip.dataset.fn;
        doLookup();
      });
    });

    // Route option selection
    container.querySelectorAll('.route-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.routeIndex, 10);
        if (routeOptions && routeOptions[index]) {
          lookupResult = routeOptions[index];
          showToast(`Selected: ${lookupResult.departure.code} → ${lookupResult.arrival.code}`, 'success');
          render();
        }
      });
    });

    // Person selector chips
    container.querySelectorAll('.person-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        selectedPerson = chip.dataset.person;
        render();
      });
    });

    // Add new person
    const addPersonBtn = container.querySelector('#btn-add-person');
    const newPersonInput = container.querySelector('#new-person-name');
    if (addPersonBtn && newPersonInput) {
      const doAddPerson = async () => {
        const name = newPersonInput.value.trim();
        if (!name) { showToast('Enter a name', 'warning'); return; }
        const result = await addParticipant(tripId, name);
        if (result) {
          selectedPerson = name;
          showToast(`${name} added to trip!`, 'success');
          render();
        }
      };
      addPersonBtn.addEventListener('click', doAddPerson);
      newPersonInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doAddPerson(); }
      });
    }

    // Submit form
    container.querySelector('#flight-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      // Auto-calculate duration if missing
      let finalDuration = container.querySelector('#f-duration').value.trim();
      if (!finalDuration) {
        const depTime = container.querySelector('#f-dep-time').value;
        const arrTime = container.querySelector('#f-arr-time').value;
        if (depTime && arrTime) {
            let [dHours, dMins] = depTime.split(':').map(Number);
            let [aHours, aMins] = arrTime.split(':').map(Number);
            let diffMins = (aHours * 60 + aMins) - (dHours * 60 + dMins);
            if (diffMins <= 0) diffMins += 24 * 60; // Assume cross overnight
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            finalDuration = `${h}h ${String(m).padStart(2, '0')}m`;
        }
      }

      const flight = {
        flightNumber: container.querySelector('#f-number').value.trim().toUpperCase(),
        airline: container.querySelector('#f-airline').value.trim(),
        date: container.querySelector('#f-date').value,
        departure: {
          code: container.querySelector('#f-dep-code').value.trim().toUpperCase(),
          city: container.querySelector('#f-dep-city').value.trim(),
          time: container.querySelector('#f-dep-time').value,
          terminal: container.querySelector('#f-dep-terminal').value.trim()
        },
        arrival: {
          code: container.querySelector('#f-arr-code').value.trim().toUpperCase(),
          city: container.querySelector('#f-arr-city').value.trim(),
          time: container.querySelector('#f-arr-time').value,
          terminal: container.querySelector('#f-arr-terminal').value.trim()
        },
        duration: finalDuration,
        addedBy: selectedPerson,
        status: lookupResult?.status || 'scheduled'
      };

      if (!flight.flightNumber || !flight.departure.code || !flight.arrival.code) {
        showToast('Please fill in flight number and airports', 'warning');
        return;
      }

      const submitBtn = container.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';

      await addFlight(tripId, flight);
      emit(EVENTS.FLIGHT_ADDED, flight);

      const forLabel = selectedPerson === nickname ? '' : ` for ${selectedPerson}`;
      showToast(`${flight.flightNumber} added${forLabel}!`, 'success');
      navigate(`trip/${tripId}`);
    });
  }

  async function doLookup() {
    const input = container.querySelector('#flight-lookup');
    const flightNumber = input.value.trim();
    if (!flightNumber) return;

    // Get date from form for API lookup
    const dateInput = container.querySelector('#f-date');
    const lookupDate = dateInput ? dateInput.value : undefined;

    isLooking = true;
    routeOptions = null;
    lookupResult = null;
    // Preserve the user's entered date before re-render
    if (dateInput) currentDate = dateInput.value;
    render();

    const results = await lookupFlight(flightNumber, lookupDate);
    isLooking = false;

    if (results && results.length > 0) {
      routeOptions = results;

      if (results.length === 1) {
        // Single route — auto-select it
        lookupResult = results[0];
        const source = results[0]._source === 'mock' ? ' (demo data)' : '';
        showToast(`Found ${lookupResult.flightNumber} — ${lookupResult.airline}${source}`, 'success');
      } else {
        // Multiple routes — show picker, auto-select first
        lookupResult = results[0];
        showToast(`${results.length} routes found — choose the correct one`, 'info');
      }
    } else {
      lookupResult = false;
      routeOptions = null;
      showToast('Flight not found', 'warning');
    }
    render();
  }

  render();
}

function convertTo24h(timeStr) {
  if (!timeStr) return '';
  return timeStr.replace(/\+\d+/, '');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
