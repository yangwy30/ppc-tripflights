/* Home screen — trip command center */

import { getAllTrips } from '../data/dataAdapter.js';
import { navigate } from '../app.js';
import { getIcon } from '../components/icons.js';

const PERSON_COLORS = ['#38BDF8', '#F43F5E', '#F59E0B', '#A855F7', '#10B981', '#FB923C'];

export async function renderHome(container) {
  container.innerHTML = `
    <main class="screen home-command-screen">
      <header class="home-command-header">
        <div class="home-command-brand">
          <span class="home-command-mark" aria-hidden="true">${getIcon('plane')}</span>
          <strong>PPC</strong>
        </div>
        <span class="home-command-live"><i aria-hidden="true"></i> Trip command</span>
      </header>

      <section class="home-command-grid" aria-labelledby="home-command-title">
        <div class="home-command-copy">
          <span class="section-kicker">DELAY NO MORE</span>
          <h1 id="home-command-title">Everyone lands.<br />You know when.</h1>
          <p>Build one live arrival board for the whole crew—routes, terminals, timing, and the people still figuring it out.</p>
        </div>

        <div class="home-route-preview" role="img" aria-label="Flights from Seattle, San Francisco, and New York converging on Los Angeles">
          <span class="home-route-destination">${getIcon('mapPin')} <span id="home-route-code">Next destination</span></span>
          <svg viewBox="0 0 560 320" aria-hidden="true">
            <path class="home-route-gridline" d="M0 80H560M0 160H560M0 240H560M140 0V320M280 0V320M420 0V320" />

            <path class="home-route-base home-route-blue" d="M48 240 C170 142, 356 102, 462 162" />
            <path class="home-route-flow home-route-blue" pathLength="1" d="M48 240 C170 142, 356 102, 462 162" />

            <path class="home-route-base home-route-violet" d="M58 76 C216 54, 366 102, 462 162" />
            <path class="home-route-flow home-route-violet" pathLength="1" d="M58 76 C216 54, 366 102, 462 162" />

            <path class="home-route-base home-route-green" d="M150 286 C274 242, 386 198, 462 162" />
            <path class="home-route-flow home-route-green" pathLength="1" d="M150 286 C274 242, 386 198, 462 162" />

            <circle class="home-route-origin" cx="48" cy="240" r="4" />
            <circle class="home-route-origin" cx="58" cy="76" r="4" />
            <circle class="home-route-origin" cx="150" cy="286" r="4" />
            <circle class="home-route-hub-ring" cx="462" cy="162" r="28" />
            <circle class="home-route-hub" cx="462" cy="162" r="7" />
            <text class="home-route-label" x="28" y="265">SFO</text>
            <text class="home-route-label" x="38" y="58">SEA</text>
            <text class="home-route-label" x="130" y="310">JFK</text>
          </svg>
        </div>

        <div class="home-command-actions">
          <button class="home-create-trip" id="btn-create" type="button">
            <span>${getIcon('plus')} Start a new trip</span>
            ${getIcon('arrowRight')}
          </button>

          <form class="home-join-trip" id="home-join-form" novalidate>
            <label for="home-pin">
              <span>ALREADY INVITED?</span>
              <input id="home-pin" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="Enter 6-digit PIN" aria-describedby="home-pin-hint" />
            </label>
            <button id="btn-join" type="submit" disabled>Join</button>
          </form>

          <div class="home-command-proof" id="home-pin-hint">
            <span>${getIcon('check')} Private by trip PIN</span>
            <span>${getIcon('user')} No account required</span>
          </div>
        </div>
      </section>

      <section class="home-trip-section" id="trip-list-section" aria-live="polite">
        <div class="home-trip-loading" aria-label="Loading saved trips"></div>
      </section>
    </main>
  `;

  bindPrimaryActions(container);

  const trips = await getAllTrips();
  const listContainer = container.querySelector('#trip-list-section');
  if (!listContainer?.isConnected) return;

  syncRouteDestination(container, trips || []);
  renderTripList(listContainer, trips || []);
  bindTripCards(listContainer);
}

function bindPrimaryActions(container) {
  container.querySelector('#btn-create')?.addEventListener('click', () => navigate('create'));

  const form = container.querySelector('#home-join-form');
  const input = container.querySelector('#home-pin');
  const button = container.querySelector('#btn-join');

  const syncPinState = () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    const ready = input.value.length === 6;
    button.disabled = !ready;
    button.classList.toggle('is-ready', ready);
  };

  input?.addEventListener('input', syncPinState);
  form?.addEventListener('submit', event => {
    event.preventDefault();
    const pin = input.value.trim();
    if (!/^\d{6}$/.test(pin)) {
      input.focus();
      return;
    }
    navigate(`join/${pin}`);
  });
}

function renderTripList(container, trips) {
  if (!trips.length) {
    container.innerHTML = `
      <div class="home-empty-note">
        <span>YOUR NEXT TRIP STARTS HERE</span>
        <p>Create a board or enter the PIN your crew sent you.</p>
      </div>
    `;
    return;
  }

  const orderedTrips = [...trips].sort((a, b) => {
    const aTime = new Date(`${a.startDate || '1970-01-01'}T00:00:00`).getTime();
    const bTime = new Date(`${b.startDate || '1970-01-01'}T00:00:00`).getTime();
    return bTime - aTime;
  });

  container.innerHTML = `
    <header class="home-trip-section-header">
      <div>
        <span class="section-kicker">YOUR BOARDS</span>
        <h2>Trips in motion</h2>
      </div>
      <span>${orderedTrips.length} ${orderedTrips.length === 1 ? 'trip' : 'trips'}</span>
    </header>

    <div class="home-trip-grid">
      ${orderedTrips.map(renderTripCard).join('')}
    </div>
  `;
}

function renderTripCard(trip) {
  const status = getTripStatus(trip);
  const people = (trip.participants || []).map(participant =>
    typeof participant === 'string' ? participant : participant.name
  ).filter(Boolean);
  const visiblePeople = people.slice(0, 3);
  const overflowCount = Math.max(0, people.length - visiblePeople.length);
  const destination = String(trip.destinationAirport || 'Destination TBD')
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');

  return `
    <button class="home-trip-card" type="button" data-trip-id="${escapeHtml(trip.id)}">
      <span class="home-trip-card-topline">
        <span class="home-trip-status home-trip-status-${status.key}"><i aria-hidden="true"></i>${status.label}</span>
        <span class="home-trip-destination">${escapeHtml(destination)}</span>
      </span>

      <span class="home-trip-card-copy">
        <strong>${escapeHtml(trip.name)}</strong>
        <small>${escapeHtml(formatDateRange(trip.startDate, trip.endDate))}</small>
      </span>

      <span class="home-trip-card-footer">
        <span class="home-trip-crew" aria-label="${people.length} travelers">
          ${visiblePeople.map((name, index) => `
            <i style="--home-person-color:${PERSON_COLORS[index % PERSON_COLORS.length]}">${escapeHtml(name.charAt(0).toUpperCase())}</i>
          `).join('')}
          ${overflowCount ? `<i class="home-trip-crew-more">+${overflowCount}</i>` : ''}
        </span>
        <span class="home-trip-flight-count">${getIcon('plane')} ${trip.flights?.length || 0} flights</span>
        <span class="home-trip-arrow">${getIcon('arrowRight')}</span>
      </span>
    </button>
  `;
}

function bindTripCards(container) {
  container.querySelectorAll('[data-trip-id]').forEach(card => {
    card.addEventListener('click', () => navigate(`trip/${card.dataset.tripId}`));
  });
}

function syncRouteDestination(container, trips) {
  const destinationLabel = container.querySelector('#home-route-code');
  if (!destinationLabel || !trips.length) return;

  const destination = String(trips[0].destinationAirport || '')
    .split(',')
    .map(code => code.trim())
    .find(Boolean);
  if (destination) destinationLabel.textContent = `${destination} · Rendezvous`;
}

function getTripStatus(trip) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = trip.startDate ? new Date(`${trip.startDate}T00:00:00`).getTime() : null;
  const end = trip.endDate ? new Date(`${trip.endDate}T23:59:59`).getTime() : start;

  if (Number.isFinite(start) && Number.isFinite(end) && today >= start && today <= end) {
    return { key: 'active', label: 'In progress' };
  }
  if (Number.isFinite(start) && today < start) return { key: 'upcoming', label: 'Upcoming' };
  return { key: 'past', label: 'Past trip' };
}

function formatDateRange(start, end) {
  if (!start) return 'Dates to be confirmed';
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = end ? new Date(`${end}T00:00:00`) : null;
  const startLabel = startDate.toLocaleDateString('en-US', opts);
  if (!endDate) return startLabel;

  const endOpts = startDate.getFullYear() === endDate.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : opts;
  return `${startLabel} — ${endDate.toLocaleDateString('en-US', endOpts)}`;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
