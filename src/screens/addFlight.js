/* Add Flight — guided lookup and confirmation flow */

import { addFlight, getTrip, getUserNickname, addParticipant } from '../data/dataAdapter.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { lookupFlight } from '../data/flightService.js';
import { getIcon } from '../components/icons.js';

const ADD_CONTEXT_PREFIX = 'ppc-add-flight-context:';
const DASHBOARD_CONTEXT_PREFIX = 'ppc-dashboard-return:';

export async function renderAddFlight(container, tripId) {
  let trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);
  const entryContext = readSessionJson(`${ADD_CONTEXT_PREFIX}${tripId}`) || {};
  const participantNames = (trip.participants || []).map(person => person.name);
  const initialPerson = participantNames.includes(entryContext.traveler)
    ? entryContext.traveler
    : (participantNames.includes(nickname) ? nickname : participantNames[0] || 'Traveler');
  const initialPhase = entryContext.phase === 'return' ? 'return' : 'outbound';
  const initialDate = getPhaseDate(trip, initialPhase);
  const initialRoute = getRouteDefaults(trip, initialPerson, initialPhase);

  const state = {
    selectedPerson: initialPerson,
    phase: initialPhase,
    returnFilter: entryContext.returnFilter || 'all',
    lookupNumber: '',
    lookupStatus: 'idle',
    lookupMessage: '',
    routeOptions: [],
    lookupResult: null,
    isLooking: false,
    manualMode: false,
    detailsOpen: false,
    showTravelerDialog: false,
    isAddingTraveler: false,
    isSubmitting: false,
    draft: createEmptyDraft(initialDate, initialRoute)
  };

  async function render() {
    trip = await getTrip(tripId);
    if (!trip) return;

    if (!(trip.participants || []).some(person => person.name === state.selectedPerson)) {
      state.selectedPerson = trip.participants?.[0]?.name || nickname || 'Traveler';
    }

    const routeDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
    const showConfirmation = Boolean(state.lookupResult) || state.manualMode;
    const phaseLabel = state.phase === 'return' ? 'Inbound' : 'Outbound';
    const routeHint = routeDefaults.from && routeDefaults.to
      ? `${routeDefaults.from} → ${routeDefaults.to}`
      : state.phase === 'return'
        ? `Leaving ${firstCode(trip.returnAirport) || firstCode(trip.destinationAirport) || 'the trip destination'}`
        : `Arriving at ${firstCode(trip.destinationAirport) || 'the trip destination'}`;

    container.innerHTML = `
      <div class="screen add-flight-screen">
        <header class="add-flight-topbar">
          <button class="topbar-back" id="btn-back" type="button">
            <span aria-hidden="true">${getIcon('arrowLeft')}</span>
            <span>Back to ${escapeHtml(trip.name)}</span>
          </button>
          <span class="add-flight-trip-direction">${escapeHtml(phaseLabel)} flight</span>
        </header>

        <section class="add-flight-intro" aria-labelledby="add-flight-title">
          <span class="add-flight-kicker">NEW ITINERARY</span>
          <h1 id="add-flight-title">Add a flight</h1>
          <p>Find the flight first, confirm the details, then add it to the shared trip.</p>
        </section>

        <form id="flight-form" class="add-flight-flow" novalidate>
          <section class="add-flight-step ${state.selectedPerson ? 'is-complete' : ''}" aria-labelledby="traveler-step-title">
            <header class="add-flight-step-header">
              <span class="add-flight-step-number">1</span>
              <span>
                <span class="add-flight-step-label">TRAVELER & DIRECTION</span>
                <h2 id="traveler-step-title">Who is flying?</h2>
              </span>
              <span class="add-flight-step-check" aria-hidden="true">${getIcon('check')}</span>
            </header>

            <div class="add-flight-context-grid">
              <label class="add-flight-field">
                <span>Traveler</span>
                <span class="add-flight-traveler-control">
                  <select id="traveler-select" aria-label="Traveler">
                    ${(trip.participants || []).map(person => `
                      <option value="${escapeHtml(person.name)}" ${person.name === state.selectedPerson ? 'selected' : ''}>
                        ${escapeHtml(person.name)}${person.name === nickname ? ' (you)' : ''}
                      </option>
                    `).join('')}
                  </select>
                  <button class="add-flight-icon-button" id="btn-open-add-traveler" type="button" aria-label="Add a new traveler" title="Add a new traveler">
                    ${getIcon('plus')}
                  </button>
                </span>
              </label>

              <fieldset class="add-flight-field add-flight-direction-field">
                <legend>Direction</legend>
                <span class="add-flight-direction-toggle" aria-label="Flight direction">
                  <button type="button" class="${state.phase === 'outbound' ? 'active' : ''}" data-add-phase="outbound">
                    Outbound
                  </button>
                  <button type="button" class="${state.phase === 'return' ? 'active' : ''}" data-add-phase="return">
                    Inbound
                  </button>
                </span>
              </fieldset>
            </div>
          </section>

          <section class="add-flight-step ${state.lookupResult ? 'is-complete' : ''}" aria-labelledby="lookup-step-title">
            <header class="add-flight-step-header">
              <span class="add-flight-step-number">2</span>
              <span>
                <span class="add-flight-step-label">FLIGHT LOOKUP</span>
                <h2 id="lookup-step-title">Find the flight</h2>
              </span>
              ${state.lookupResult ? `<span class="add-flight-step-check" aria-hidden="true">${getIcon('check')}</span>` : ''}
            </header>

            <div class="add-flight-lookup-grid">
              <label class="add-flight-field">
                <span>Flight number</span>
                <input id="flight-lookup" type="text" value="${escapeHtml(state.lookupNumber)}" placeholder="e.g. UA 353" autocomplete="off" autocapitalize="characters" />
              </label>
              <label class="add-flight-field">
                <span>Flight date</span>
                <input id="f-date" type="date" value="${escapeHtml(state.draft.date)}" />
              </label>
              <button type="button" class="add-flight-lookup-button" id="btn-lookup" ${state.isLooking ? 'disabled' : ''}>
                ${state.isLooking ? '<span class="add-flight-spinner" aria-hidden="true"></span> Looking up' : `${getIcon('plane')} Find flight`}
              </button>
            </div>

            <div class="add-flight-lookup-meta">
              <span>Searching for ${escapeHtml(routeHint)}</span>
              <button type="button" id="btn-enter-manually">Enter details manually</button>
            </div>

            <div class="add-flight-lookup-feedback" aria-live="polite">
              ${renderLookupFeedback(state)}
            </div>
          </section>

          ${showConfirmation ? renderConfirmationStep(state) : ''}
        </form>

        ${state.showTravelerDialog ? renderTravelerDialog() : ''}
      </div>
    `;

    bindEvents();
    updateSubmitState();
    if (state.showTravelerDialog) {
      requestAnimationFrame(() => container.querySelector('#new-traveler-name')?.focus());
    }
  }

  function bindEvents() {
    container.querySelector('#btn-back')?.addEventListener('click', () => returnToDashboard());

    container.querySelector('#traveler-select')?.addEventListener('change', event => {
      syncDraftFromInputs();
      const previousDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
      state.selectedPerson = event.target.value;
      const nextDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
      applyRouteDefaults(previousDefaults, nextDefaults);
      render();
    });

    container.querySelectorAll('[data-add-phase]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.dataset.addPhase === state.phase) return;
        syncDraftFromInputs();
        const previousDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
        const previousDate = getPhaseDate(trip, state.phase);
        state.phase = button.dataset.addPhase;
        const nextDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
        applyRouteDefaults(previousDefaults, nextDefaults);
        if (!state.draft.date || state.draft.date === previousDate) {
          state.draft.date = getPhaseDate(trip, state.phase);
        }
        clearLookupResult();
        render();
      });
    });

    const lookupInput = container.querySelector('#flight-lookup');
    lookupInput?.addEventListener('input', event => {
      state.lookupNumber = event.target.value.toUpperCase();
      if (state.lookupResult || state.routeOptions.length) {
        clearLookupResult();
        render().then(() => {
          const nextInput = container.querySelector('#flight-lookup');
          nextInput?.focus();
          nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
        });
      }
    });
    lookupInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        doLookup();
      }
    });

    container.querySelector('#f-date')?.addEventListener('change', event => {
      state.draft.date = event.target.value;
      if (state.lookupResult || state.routeOptions.length) {
        clearLookupResult();
        render();
      }
    });
    container.querySelector('#btn-lookup')?.addEventListener('click', doLookup);
    container.querySelector('#btn-enter-manually')?.addEventListener('click', enterManualMode);
    container.querySelector('#btn-feedback-manual')?.addEventListener('click', enterManualMode);

    container.querySelectorAll('[data-route-index]').forEach(button => {
      button.addEventListener('click', () => {
        const selectedRoute = state.routeOptions[Number(button.dataset.routeIndex)];
        if (!selectedRoute) return;
        state.lookupResult = selectedRoute;
        state.lookupStatus = 'success';
        state.lookupMessage = '';
        state.manualMode = false;
        state.detailsOpen = false;
        state.draft = draftFromFlight(selectedRoute, state.draft.date);
        render();
      });
    });

    container.querySelector('#btn-change-flight')?.addEventListener('click', () => {
      clearLookupResult();
      state.manualMode = false;
      render();
      container.querySelector('#flight-lookup')?.focus();
    });

    container.querySelectorAll('[data-draft-field]').forEach(input => {
      input.addEventListener('input', event => {
        setDraftValue(event.target.dataset.draftField, event.target.value);
        updateSubmitState();
      });
    });

    container.querySelector('.add-flight-edit-details')?.addEventListener('toggle', event => {
      state.detailsOpen = event.currentTarget.open;
    });

    container.querySelector('#flight-form')?.addEventListener('submit', submitFlight);

    container.querySelector('#btn-open-add-traveler')?.addEventListener('click', () => {
      syncDraftFromInputs();
      state.showTravelerDialog = true;
      render();
    });
    container.querySelectorAll('[data-close-traveler-dialog]').forEach(button => {
      button.addEventListener('click', () => {
        state.showTravelerDialog = false;
        render();
      });
    });
    container.querySelector('.add-traveler-overlay')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) {
        state.showTravelerDialog = false;
        render();
      }
    });
    container.querySelector('#new-traveler-name')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addNewTraveler();
      }
      if (event.key === 'Escape') {
        state.showTravelerDialog = false;
        render();
      }
    });
    container.querySelector('#btn-confirm-add-traveler')?.addEventListener('click', addNewTraveler);
  }

  async function doLookup() {
    syncDraftFromInputs();
    const flightNumber = state.lookupNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (!flightNumber) {
      state.lookupStatus = 'error';
      state.lookupMessage = 'Enter a flight number to continue.';
      render();
      return;
    }
    if (!state.draft.date) {
      state.lookupStatus = 'error';
      state.lookupMessage = 'Choose the flight date to continue.';
      render();
      return;
    }

    state.lookupNumber = flightNumber;
    state.isLooking = true;
    state.lookupStatus = 'loading';
    state.lookupMessage = '';
    state.lookupResult = null;
    state.routeOptions = [];
    state.manualMode = false;
    render();

    try {
      const results = await lookupFlight(flightNumber, state.draft.date);
      state.isLooking = false;

      if (!results?.length) {
        state.lookupStatus = 'error';
        state.lookupMessage = `We couldn't find ${flightNumber} on ${formatDateLabel(state.draft.date)}. Check the number and date, or enter it manually.`;
        render();
        return;
      }

      if (results.length === 1) {
        state.lookupResult = results[0];
        state.lookupStatus = 'success';
        state.draft = draftFromFlight(results[0], state.draft.date);
        state.detailsOpen = false;
        render();
        showToast(`${results[0].flightNumber} found`, 'success');
        return;
      }

      state.routeOptions = results;
      state.lookupStatus = 'multiple';
      state.lookupMessage = `${results.length} routes use this flight number. Choose the correct route.`;
      render();
    } catch (error) {
      console.error('Flight lookup failed:', error);
      state.isLooking = false;
      state.lookupStatus = 'error';
      state.lookupMessage = 'Flight lookup is temporarily unavailable. Try again or enter the details manually.';
      render();
    }
  }

  function enterManualMode() {
    syncDraftFromInputs();
    const defaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
    state.manualMode = true;
    state.lookupResult = null;
    state.routeOptions = [];
    state.lookupStatus = 'manual';
    state.lookupMessage = '';
    state.detailsOpen = true;
    if (!state.draft.flightNumber) state.draft.flightNumber = state.lookupNumber.trim().toUpperCase();
    if (!state.draft.departure.code) state.draft.departure.code = defaults.from;
    if (!state.draft.arrival.code) state.draft.arrival.code = defaults.to;
    render();
    container.querySelector('#f-number')?.focus();
  }

  async function addNewTraveler() {
    if (state.isAddingTraveler) return;
    const input = container.querySelector('#new-traveler-name');
    const name = input?.value.trim();
    if (!name) {
      showToast('Enter a traveler name', 'warning');
      return;
    }

    if ((trip.participants || []).some(person => person.name.toLowerCase() === name.toLowerCase())) {
      showToast(`${name} is already in this trip`, 'warning');
      return;
    }

    state.isAddingTraveler = true;
    const button = container.querySelector('#btn-confirm-add-traveler');
    if (button) {
      button.disabled = true;
      button.textContent = 'Adding…';
    }

    const added = await addParticipant(tripId, { name });
    state.isAddingTraveler = false;
    if (!added) {
      showToast('Could not add this traveler', 'error');
      render();
      return;
    }

    const previousDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
    trip = await getTrip(tripId);
    state.selectedPerson = added.name;
    const nextDefaults = getRouteDefaults(trip, state.selectedPerson, state.phase);
    applyRouteDefaults(previousDefaults, nextDefaults);
    state.showTravelerDialog = false;
    showToast(`${added.name} added to the trip`, 'success');
    render();
  }

  async function submitFlight(event) {
    event.preventDefault();
    if (state.isSubmitting) return;
    syncDraftFromInputs();

    if (!isDraftComplete(state.draft)) {
      showToast('Add the flight number and both airports first', 'warning');
      updateSubmitState();
      return;
    }

    state.isSubmitting = true;
    updateSubmitState();

    const flight = {
      flightNumber: state.draft.flightNumber.trim().toUpperCase(),
      airline: state.draft.airline.trim(),
      date: state.draft.date,
      departure: {
        code: state.draft.departure.code.trim().toUpperCase(),
        city: state.draft.departure.city.trim(),
        time: state.draft.departure.time,
        terminal: state.draft.departure.terminal.trim()
      },
      arrival: {
        code: state.draft.arrival.code.trim().toUpperCase(),
        city: state.draft.arrival.city.trim(),
        time: state.draft.arrival.time,
        terminal: state.draft.arrival.terminal.trim()
      },
      duration: state.draft.duration.trim() || calculateDuration(state.draft.departure.time, state.draft.arrival.time),
      aircraft: state.draft.aircraft.trim(),
      gate: state.draft.gate.trim(),
      addedBy: state.selectedPerson,
      status: state.lookupResult?.status || 'scheduled'
    };

    const created = await addFlight(tripId, flight);
    if (!created) {
      state.isSubmitting = false;
      updateSubmitState();
      showToast('Could not add this flight. Please try again.', 'error');
      return;
    }

    const forLabel = state.selectedPerson === nickname ? '' : ` for ${state.selectedPerson}`;
    showToast(`${created.flightNumber} added${forLabel}!`, 'success');
    returnToDashboard(created.id);
  }

  function syncDraftFromInputs() {
    const lookupInput = container.querySelector('#flight-lookup');
    const dateInput = container.querySelector('#f-date');
    if (lookupInput) state.lookupNumber = lookupInput.value.toUpperCase();
    if (dateInput) state.draft.date = dateInput.value;
    container.querySelectorAll('[data-draft-field]').forEach(input => {
      setDraftValue(input.dataset.draftField, input.value);
    });
  }

  function setDraftValue(path, value) {
    const parts = path.split('.');
    if (parts.length === 1) {
      state.draft[parts[0]] = value;
      return;
    }
    state.draft[parts[0]][parts[1]] = value;
  }

  function applyRouteDefaults(previousDefaults, nextDefaults) {
    if (!state.lookupResult) {
      if (!state.draft.departure.code || state.draft.departure.code === previousDefaults.from) {
        state.draft.departure.code = nextDefaults.from;
      }
      if (!state.draft.arrival.code || state.draft.arrival.code === previousDefaults.to) {
        state.draft.arrival.code = nextDefaults.to;
      }
    }
  }

  function clearLookupResult() {
    state.lookupResult = null;
    state.routeOptions = [];
    state.lookupStatus = 'idle';
    state.lookupMessage = '';
    state.detailsOpen = false;
  }

  function updateSubmitState() {
    const button = container.querySelector('#btn-submit-flight');
    const helper = container.querySelector('#add-flight-submit-helper');
    if (!button) return;
    const ready = isDraftComplete(state.draft);
    button.disabled = !ready || state.isSubmitting;
    button.innerHTML = state.isSubmitting
      ? '<span class="add-flight-spinner" aria-hidden="true"></span> Adding flight…'
      : `${getIcon('plus')} Add ${escapeHtml(state.draft.flightNumber || 'flight')} for ${escapeHtml(state.selectedPerson)}`;
    if (helper) {
      helper.textContent = ready
        ? `${state.phase === 'return' ? 'Inbound' : 'Outbound'} · ${state.draft.departure.code.toUpperCase()} → ${state.draft.arrival.code.toUpperCase()}`
        : 'Flight number and both airports are required.';
    }
  }

  function returnToDashboard(flightId = null) {
    writeSessionJson(`${DASHBOARD_CONTEXT_PREFIX}${tripId}`, {
      phase: state.phase,
      filterPerson: state.returnFilter,
      flightId
    });
    sessionStorage.removeItem(`${ADD_CONTEXT_PREFIX}${tripId}`);
    navigate(`trip/${tripId}`);
  }

  render();
}

function renderLookupFeedback(state) {
  if (state.lookupStatus === 'loading') {
    return `
      <div class="add-flight-feedback add-flight-feedback-loading">
        <span class="add-flight-spinner" aria-hidden="true"></span>
        <span><strong>Checking the schedule</strong><small>Looking for ${escapeHtml(state.lookupNumber)} on ${escapeHtml(formatDateLabel(state.draft.date))}.</small></span>
      </div>
    `;
  }

  if (state.lookupStatus === 'error') {
    return `
      <div class="add-flight-feedback add-flight-feedback-error">
        <span aria-hidden="true">!</span>
        <span><strong>Flight not found</strong><small>${escapeHtml(state.lookupMessage)}</small></span>
        <button type="button" id="btn-feedback-manual">Enter manually</button>
      </div>
    `;
  }

  if (state.lookupStatus === 'multiple') {
    return `
      <div class="add-flight-route-picker">
        <p>${escapeHtml(state.lookupMessage)}</p>
        ${state.routeOptions.map((route, index) => `
          <button type="button" class="add-flight-route-option" data-route-index="${index}">
            <span>
              <strong>${escapeHtml(route.departure?.code || '—')} → ${escapeHtml(route.arrival?.code || '—')}</strong>
              <small>${escapeHtml(route.departure?.city || '')} to ${escapeHtml(route.arrival?.city || '')}</small>
            </span>
            <span>
              <strong>${escapeHtml(convertTo24h(route.departure?.time) || '--:--')} – ${escapeHtml(convertTo24h(route.arrival?.time) || '--:--')}</strong>
              <small>${escapeHtml(route.duration || 'Select route')}</small>
            </span>
            <span aria-hidden="true">${getIcon('arrowRight')}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  if (state.lookupStatus === 'success') {
    return '<p class="add-flight-found-copy">Flight found. Review the result below before adding it.</p>';
  }

  return '';
}

function renderConfirmationStep(state) {
  const draft = state.draft;
  const statusLabel = state.lookupResult ? 'Found automatically' : 'Manual entry';
  const detailsContent = renderDetailsFields(draft);

  return `
    <section class="add-flight-step add-flight-confirm-step" aria-labelledby="confirm-step-title">
      <header class="add-flight-step-header">
        <span class="add-flight-step-number">3</span>
        <span>
          <span class="add-flight-step-label">REVIEW</span>
          <h2 id="confirm-step-title">${state.manualMode ? 'Enter the details' : 'Confirm the flight'}</h2>
        </span>
      </header>

      ${state.manualMode ? `
        <div class="add-flight-manual-notice">
          <span aria-hidden="true">${getIcon('notes')}</span>
          <span><strong>Manual entry</strong><small>Only the flight number and airport codes are required. Add times and terminals when you have them.</small></span>
        </div>
        <div class="add-flight-details-form">${detailsContent}</div>
      ` : `
        <article class="add-flight-confirm-card">
          <header>
            <span class="add-flight-result-status"><i></i>${escapeHtml(statusLabel)}</span>
            <button id="btn-change-flight" type="button">Change flight</button>
          </header>
          <div class="add-flight-confirm-main">
            <span>
              <small>${escapeHtml(draft.airline || 'Airline')}</small>
              <strong>${escapeHtml(draft.flightNumber || 'Flight')}</strong>
            </span>
            <span class="add-flight-confirm-route">
              <span><strong>${escapeHtml(draft.departure.code || '—')}</strong><small>${escapeHtml(draft.departure.time || '--:--')}</small></span>
              <i aria-hidden="true">${getIcon('arrowRight')}</i>
              <span><strong>${escapeHtml(draft.arrival.code || '—')}</strong><small>${escapeHtml(draft.arrival.time || '--:--')}</small></span>
            </span>
          </div>
          <footer>
            <span>${escapeHtml(formatDateLabel(draft.date))}</span>
            <span>${escapeHtml(draft.duration || 'Duration TBD')}</span>
            <span>For ${escapeHtml(state.selectedPerson)}</span>
          </footer>
        </article>

        <details class="add-flight-edit-details" ${state.detailsOpen ? 'open' : ''}>
          <summary><span>Edit flight details</span><small>Times, terminals, gate, aircraft</small></summary>
          <div class="add-flight-details-form">${detailsContent}</div>
        </details>
      `}

      <div class="add-flight-submit-row">
        <span>
          <strong>Ready to add</strong>
          <small id="add-flight-submit-helper">Flight number and both airports are required.</small>
        </span>
        <button class="add-flight-submit-button" id="btn-submit-flight" type="submit" disabled>
          ${getIcon('plus')} Add flight for ${escapeHtml(state.selectedPerson)}
        </button>
      </div>
    </section>
  `;
}

function renderDetailsFields(draft) {
  return `
    <div class="add-flight-form-grid add-flight-form-grid-primary">
      ${renderField('Flight number', 'f-number', 'flightNumber', draft.flightNumber, 'e.g. UA 353', 'text', true)}
      ${renderField('Airline', 'f-airline', 'airline', draft.airline, 'e.g. United Airlines')}
    </div>
    <div class="add-flight-form-grid">
      ${renderField('From', 'f-dep-code', 'departure.code', draft.departure.code, 'JFK', 'text', true, 4)}
      ${renderField('To', 'f-arr-code', 'arrival.code', draft.arrival.code, 'LAX', 'text', true, 4)}
    </div>
    <div class="add-flight-form-grid">
      ${renderField('Departure city', 'f-dep-city', 'departure.city', draft.departure.city, 'New York')}
      ${renderField('Arrival city', 'f-arr-city', 'arrival.city', draft.arrival.city, 'Los Angeles')}
    </div>
    <div class="add-flight-form-grid">
      ${renderField('Departure time', 'f-dep-time', 'departure.time', draft.departure.time, '', 'time')}
      ${renderField('Arrival time', 'f-arr-time', 'arrival.time', draft.arrival.time, '', 'time')}
    </div>
    <div class="add-flight-form-grid add-flight-form-grid-three">
      ${renderField('Departure terminal', 'f-dep-terminal', 'departure.terminal', draft.departure.terminal, 'T1')}
      ${renderField('Arrival terminal', 'f-arr-terminal', 'arrival.terminal', draft.arrival.terminal, 'T5')}
      ${renderField('Departure gate', 'f-gate', 'gate', draft.gate, 'B12')}
    </div>
    <div class="add-flight-form-grid add-flight-form-grid-three">
      ${renderField('Duration', 'f-duration', 'duration', draft.duration, '6h 15m')}
      ${renderField('Aircraft', 'f-aircraft', 'aircraft', draft.aircraft, 'Boeing 737')}
    </div>
  `;
}

function renderField(label, id, path, value, placeholder = '', type = 'text', required = false, maxLength = null) {
  return `
    <label class="add-flight-field">
      <span>${escapeHtml(label)}${required ? ' *' : ''}</span>
      <input
        id="${id}"
        data-draft-field="${path}"
        type="${type}"
        value="${escapeHtml(value || '')}"
        placeholder="${escapeHtml(placeholder)}"
        ${required ? 'required' : ''}
        ${maxLength ? `maxlength="${maxLength}"` : ''}
        ${path === 'flightNumber' || path.endsWith('.code') ? 'autocapitalize="characters"' : ''}
      />
    </label>
  `;
}

function renderTravelerDialog() {
  return `
    <div class="modal-overlay add-traveler-overlay">
      <div class="modal add-traveler-dialog" role="dialog" aria-modal="true" aria-labelledby="add-traveler-title">
        <header>
          <span class="add-traveler-icon" aria-hidden="true">${getIcon('user')}</span>
          <span><span class="add-flight-step-label">TRIP CREW</span><h2 id="add-traveler-title">Add a traveler</h2></span>
          <button type="button" data-close-traveler-dialog aria-label="Close">✕</button>
        </header>
        <p>Add someone to the trip, then this flight will be assigned to them.</p>
        <label class="add-flight-field">
          <span>Name</span>
          <input id="new-traveler-name" type="text" placeholder="Traveler name" autocomplete="off" />
        </label>
        <footer>
          <button type="button" class="add-traveler-cancel" data-close-traveler-dialog>Cancel</button>
          <button type="button" class="add-traveler-confirm" id="btn-confirm-add-traveler">${getIcon('plus')} Add traveler</button>
        </footer>
      </div>
    </div>
  `;
}

function createEmptyDraft(date, route) {
  return {
    flightNumber: '',
    airline: '',
    date,
    departure: { code: route.from || '', city: '', time: '', terminal: '' },
    arrival: { code: route.to || '', city: '', time: '', terminal: '' },
    duration: '',
    aircraft: '',
    gate: ''
  };
}

function draftFromFlight(flight, date) {
  return {
    flightNumber: flight.flightNumber || '',
    airline: flight.airline || '',
    date,
    departure: {
      code: flight.departure?.code || '',
      city: flight.departure?.city || '',
      time: convertTo24h(flight.departure?.time),
      terminal: flight.departure?.terminal || ''
    },
    arrival: {
      code: flight.arrival?.code || '',
      city: flight.arrival?.city || '',
      time: convertTo24h(flight.arrival?.time),
      terminal: flight.arrival?.terminal || ''
    },
    duration: flight.duration || '',
    aircraft: flight.aircraft || '',
    gate: flight.gate || ''
  };
}

function getRouteDefaults(trip, travelerName, phase) {
  const traveler = (trip.participants || []).find(person => person.name === travelerName);
  const homeAirport = firstCode(traveler?.homeAirport);
  const destination = firstCode(trip.destinationAirport);
  const returnOrigin = firstCode(trip.returnAirport) || destination;
  return phase === 'return'
    ? { from: returnOrigin, to: homeAirport }
    : { from: homeAirport, to: destination };
}

function getPhaseDate(trip, phase) {
  return (phase === 'return' ? trip.endDate : trip.startDate) || new Date().toISOString().split('T')[0];
}

function firstCode(value) {
  return String(value || '').split(',')[0].trim().toUpperCase();
}

function isDraftComplete(draft) {
  return Boolean(
    draft.date &&
    draft.flightNumber?.trim() &&
    draft.departure?.code?.trim() &&
    draft.arrival?.code?.trim()
  );
}

function calculateDuration(departureTime, arrivalTime) {
  if (!departureTime || !arrivalTime) return '';
  const [departureHours, departureMinutes] = departureTime.split(':').map(Number);
  const [arrivalHours, arrivalMinutes] = arrivalTime.split(':').map(Number);
  let totalMinutes = (arrivalHours * 60 + arrivalMinutes) - (departureHours * 60 + departureMinutes);
  if (totalMinutes <= 0) totalMinutes += 24 * 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatDateLabel(dateString) {
  if (!dateString) return 'the selected date';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function convertTo24h(timeStr) {
  if (!timeStr) return '';
  return timeStr.replace(/\+\d+/, '');
}

function readSessionJson(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function writeSessionJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Navigation still works when storage is unavailable.
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
