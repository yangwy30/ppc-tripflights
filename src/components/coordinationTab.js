/* Coordination Tab — streamlined group flight engine */

import { generateGroupOptions } from '../data/coordinationEngine.js';
import { generateConciergeSummary } from '../data/aiService.js';
import { renderRecommendationCard } from './recommendationCard.js';
import { getUserNickname, saveNickname, addFlight, setParticipantHomeAirport } from '../data/dataAdapter.js';
import { showToast } from './toast.js';
import { getIcon } from './icons.js';

const coordinationCache = {};

export async function renderCoordinationTab(container, trip) {
  const cached = coordinationCache[trip.id];
  let state = cached ? 'results' : 'idle';
  let options = cached?.options || [];
  let aiSummary = cached?.aiSummary || '';
  let searchDate = cached?.searchDate || trip.startDate || new Date().toISOString().split('T')[0];
  const participants = (trip.participants || []).map(person => typeof person === 'string' ? { name: person } : person);
  let currentNickname = getUserNickname(trip.id, trip);
  let currentUser = participants.find(person => normalize(person.name) === normalize(currentNickname));

  if (!currentUser && participants.length) {
    currentUser = participants[0];
    currentNickname = currentUser.name;
    saveNickname(trip.id, currentNickname);
  }

  const render = () => {
    container.innerHTML = `
      <div class="coordination-panel coordination-panel-simple">
        ${renderSetup(trip, participants, currentUser, currentNickname)}
        ${renderState(state, options, aiSummary, currentNickname, searchDate)}
      </div>
    `;

    container.querySelector('#select-active-traveler')?.addEventListener('change', event => {
      const newName = event.target.value;
      if (!newName) return;
      saveNickname(trip.id, newName);
      currentNickname = newName;
      currentUser = participants.find(person => person.name === newName) || { name: newName };
      render();
    });

    const homeInput = container.querySelector('#input-home-airport');
    container.querySelector('#btn-save-home-airport')?.addEventListener('click', async event => {
      const airport = homeInput?.value.trim().toUpperCase();
      if (!airport) {
        homeInput?.focus();
        return;
      }

      event.currentTarget.disabled = true;
      event.currentTarget.textContent = 'Saving…';
      const saved = await setParticipantHomeAirport(trip.id, currentNickname, airport);
      if (!saved) {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = 'Save';
        showToast('Could not save the departure airport', 'error');
        return;
      }
      currentUser.homeAirport = airport;
      showToast(`${currentNickname} now departs from ${airport}`, 'success');
      render();
    });

    container.querySelector('#btn-find-flights')?.addEventListener('click', async () => {
      delete coordinationCache[trip.id];
      state = 'loading';
      render();

      try {
        searchDate = trip.startDate || new Date().toISOString().split('T')[0];
        options = await generateGroupOptions(trip, currentNickname);
        aiSummary = options.length ? await generateConciergeSummary(options[0], currentNickname) : '';
        state = 'results';
        coordinationCache[trip.id] = { options, aiSummary, searchDate };
      } catch (error) {
        console.error('[Coordination] Search failed:', error);
        state = 'error';
      }
      render();
    });

    container.querySelectorAll('.btn-add-trip').forEach(button => {
      button.addEventListener('click', async event => {
        event.preventDefault();
        const encodedEntry = button.dataset.entry;
        if (!encodedEntry) return;

        try {
          button.disabled = true;
          button.textContent = 'Adding…';
          const entry = JSON.parse(decodeURIComponent(encodedEntry));
          const traveler = entry.passengerName || currentNickname;
          const legs = [entry.outbound, entry.inbound].filter(leg => leg?.airline);
          const addedFlights = [];

          for (const leg of legs) {
            const flight = await addRecommendationLeg(trip.id, leg, traveler, searchDate);
            if (flight) addedFlights.push(flight);
          }

          if (!addedFlights.length) {
            throw new Error('No recommendation flights were added');
          }

          const allAdded = addedFlights.length === legs.length;
          showToast(
            allAdded ? `Flights added for ${traveler}` : `Added ${addedFlights.length} of ${legs.length} flights`,
            allAdded ? 'success' : 'warning'
          );
          document.querySelector('.tab-btn[data-maintab="tracking"]')?.click();
        } catch (error) {
          console.error('[Coordination] Failed to add flights:', error);
          showToast('Failed to add flights', 'error');
          button.disabled = false;
          button.textContent = 'Add to Trip';
        }
      });
    });
  };

  render();
}

function renderSetup(trip, participants, currentUser, currentNickname) {
  const bookedTravelers = new Set((trip.flights || []).map(flight => normalize(flight.addedBy)).filter(Boolean));
  const readyCount = participants.filter(person => person.homeAirport || bookedTravelers.has(normalize(person.name))).length;
  const destination = trip.destinationAirport || 'LAX';
  const currentHome = currentUser?.homeAirport || '';

  return `
    <section class="coordination-setup-card" aria-labelledby="coordination-title">
      <header class="coordination-simple-header">
        <div>
          <span class="section-kicker">COORDINATION ENGINE</span>
          <h2 id="coordination-title">Bring everyone in together</h2>
          <p>Set an origin, then compare the best group arrival options.</p>
        </div>
        <span class="coordination-ready-count">${readyCount}/${participants.length} ready</span>
      </header>

      <div class="coordination-fields">
        <label>
          <span>Traveler</span>
          <select id="select-active-traveler">
            ${participants.map(person => `
              <option value="${escapeHtml(person.name)}" ${person.name === currentNickname ? 'selected' : ''}>
                ${escapeHtml(person.name)}
              </option>
            `).join('')}
          </select>
        </label>

        <label>
          <span>Flying from</span>
          <div class="coordination-airport-input">
            <input type="text" id="input-home-airport" value="${escapeHtml(currentHome)}" maxlength="3" placeholder="JFK" aria-label="Departure airport" />
            <button type="button" id="btn-save-home-airport">Save</button>
          </div>
        </label>

        <div class="coordination-destination">
          <span>Meeting in</span>
          <strong>${escapeHtml(destination)}</strong>
          ${trip.returnAirport ? `<small>Return from ${escapeHtml(trip.returnAirport)}</small>` : ''}
        </div>
      </div>

      <div class="coordination-setup-footer">
        <p>${readyCount === participants.length ? 'Everyone is ready to search.' : `${participants.length - readyCount} traveler${participants.length - readyCount === 1 ? '' : 's'} still need an origin.`}</p>
        <button type="button" id="btn-find-flights" class="btn btn-primary">
          ${getIcon('sparkles')} Find options
        </button>
      </div>
    </section>
  `;
}

function renderState(state, options, aiSummary, currentNickname, searchDate) {
  if (state === 'idle') {
    return '<p class="coordination-idle-hint">Results will appear here after one search.</p>';
  }

  if (state === 'loading') {
    return `
      <div class="coordination-state-card">
        <span class="coordination-state-icon">${getIcon('sparkles')}</span>
        <div><strong>Finding the best overlap…</strong><small>Comparing arrival windows and prices.</small></div>
      </div>
    `;
  }

  if (state === 'error') {
    return `
      <div class="coordination-state-card coordination-state-error">
        <div><strong>Search did not finish</strong><small>Try again in a moment.</small></div>
      </div>
    `;
  }

  if (!options.length) {
    return `
      <div class="coordination-state-card">
        <div><strong>No matching group options</strong><small>Try changing an origin or searching again.</small></div>
      </div>
    `;
  }

  return `
    <section class="coordination-results" aria-labelledby="coordination-results-title">
      <div class="coordination-results-header">
        <div>
          <span class="section-kicker">BEST MATCHES</span>
          <h2 id="coordination-results-title">${options.length} coordinated option${options.length === 1 ? '' : 's'}</h2>
        </div>
        ${aiSummary ? `<p>${escapeHtml(aiSummary)}</p>` : ''}
      </div>
      <div class="recommendations-list">
        ${options.map((option, index) => renderRecommendationCard(option, index + 1, currentNickname, searchDate)).join('')}
      </div>
    </section>
  `;
}

async function addRecommendationLeg(tripId, leg, traveler, fallbackDate) {
  return addFlight(tripId, {
    flightNumber: leg.flightNumber,
    airline: leg.airline,
    departure: { code: leg.origin, time: leg.departureTime },
    arrival: { code: leg.destination, time: leg.arrivalTime },
    date: leg.date || fallbackDate,
    duration: leg.duration,
    addedBy: traveler,
    status: 'scheduled'
  });
}

function normalize(value) {
  return (value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
