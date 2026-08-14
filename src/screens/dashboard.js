/* Dashboard screen */

import { getTrip, getUserNickname, deleteParticipant, deleteFlight } from '../data/dataAdapter.js';
import { subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { getComputedFlightStatus, renderCompactFlightRow } from '../components/flightCard.js';
import { renderCoordinationTab } from '../components/coordinationTab.js';
import { renderRouteMap, destroyRouteMap } from '../components/routeMap.js';
import { startPolling, stopPolling, isPolling, setAutoRefreshPref, getAutoRefreshPref } from '../data/alertService.js';
import { getIcon } from '../components/icons.js';

import { exportTripCalendar } from '../data/calendarService.js';

const ADD_FLIGHT_CONTEXT_PREFIX = 'ppc-add-flight-context:';
const DASHBOARD_RETURN_PREFIX = 'ppc-dashboard-return:';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

const PERSON_COLORS_HEX = [
  '#38BDF8', '#FF2D55', '#F59E0B',
  '#AF52DE', '#34C759', '#FF9500'
];

/**
 * Classifies a flight as outbound or return based on trip airports
 */
function getFlightPhase(flight, trip) {
  if (flight.phase) return flight.phase;

  const destCodes = (trip?.destinationAirport || 'LAX')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const retCodes = (trip?.returnAirport || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const arrCode = (flight.arrival?.code || '').toUpperCase().trim();
  const depCode = (flight.departure?.code || '').toUpperCase().trim();

  // If arriving at trip destination -> Outbound
  if (destCodes.includes(arrCode)) return 'outbound';
  // If departing from trip destination -> Return
  if (destCodes.includes(depCode)) return 'return';
  // If departing from return airport -> Return
  if (retCodes.includes(depCode)) return 'return';

  // Fallback heuristics: LAX departure is Return, LAX arrival is Outbound
  if (depCode === 'LAX') return 'return';
  if (arrCode === 'LAX') return 'outbound';

  return 'outbound';
}

function getDashboardStats(trip) {
  const participants = (trip.participants || []).map(p => typeof p === 'string' ? { name: p } : p);
  const flights = trip.flights || [];
  const outboundFlights = flights.filter(flight => getFlightPhase(flight, trip) === 'outbound');
  const bookedTravelers = new Set(outboundFlights.map(flight => (flight.addedBy || '').trim().toLowerCase()).filter(Boolean));
  const landed = outboundFlights.filter(flight => {
    const status = (getComputedFlightStatus(flight) || '').toLowerCase();
    return status.includes('landed') || status.includes('arrived');
  }).length;

  const arrivalTimes = outboundFlights.map(flight => {
    const date = flight.date || flight.arrival?.date;
    const time = flight.arrival?.time;
    if (!date || !time) return null;
    const timestamp = new Date(`${date}T${time}`).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }).filter(Number.isFinite);

  let arrivalSpread = '—';
  if (arrivalTimes.length === 1) arrivalSpread = '0m';
  if (arrivalTimes.length > 1) {
    const spreadMinutes = Math.round((Math.max(...arrivalTimes) - Math.min(...arrivalTimes)) / 60000);
    const hours = Math.floor(spreadMinutes / 60);
    const minutes = spreadMinutes % 60;
    arrivalSpread = hours ? `${hours}h ${minutes ? `${minutes}m` : ''}`.trim() : `${minutes}m`;
  }

  return {
    travelers: participants.length,
    landed,
    arrivalSpread,
    stillToBook: participants.filter(person => !bookedTravelers.has((person.name || '').trim().toLowerCase())).length
  };
}

function formatTripDates(startDate, endDate) {
  if (!startDate) return 'Dates to be confirmed';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const start = formatter.format(new Date(`${startDate}T00:00:00`));
  if (!endDate) return start;
  const end = formatter.format(new Date(`${endDate}T00:00:00`));
  return `${start} — ${end}`;
}

function formatJoinedDate(value) {
  if (!value) return 'Trip traveler';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Trip traveler';
  return `Joined ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
}

function getArrivalMoment(flight) {
  const flightDate = flight.date || flight.departure?.date || flight.arrival?.date;
  const arrivalTime = flight.arrival?.time?.match(/^\d{1,2}:\d{2}/)?.[0];
  if (!flightDate || !arrivalTime) return Number.POSITIVE_INFINITY;

  const arrival = new Date(`${flightDate}T${arrivalTime}:00`);
  if (Number.isNaN(arrival.getTime())) return Number.POSITIVE_INFINITY;

  const departureTime = flight.departure?.time;
  if (departureTime) {
    const normalizedDepartureTime = departureTime.match(/^\d{1,2}:\d{2}/)?.[0];
    if (normalizedDepartureTime) {
      const departure = new Date(`${flightDate}T${normalizedDepartureTime}:00`);
      if (!Number.isNaN(departure.getTime()) && arrival < departure) {
        arrival.setDate(arrival.getDate() + 1);
      }
    }
  }

  return arrival.getTime();
}

function getStatusPresentation(status) {
  const normalized = (status || 'scheduled').toLowerCase();
  const labels = {
    landed: 'Landed',
    arrived: 'Arrived',
    delayed: 'Delayed',
    cancelled: 'Cancelled',
    boarding: 'Boarding',
    'in-air': 'In air',
    'on-time': 'On time',
    scheduled: 'Scheduled'
  };
  return {
    key: normalized,
    label: labels[normalized] || normalized.replace(/(^|-)\w/g, match => match.replace('-', ' ').toUpperCase())
  };
}

function formatArrivalDate(flight) {
  const timestamp = getArrivalMoment(flight);
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
}

function renderArrivalTimeline(flights, participants, phaseFilter) {
  const orderedFlights = [...flights].sort((a, b) => getArrivalMoment(a) - getArrivalMoment(b));
  const participantList = participants.map(person => typeof person === 'string' ? { name: person } : person);

  return `
    <section class="arrival-timeline-card" aria-labelledby="arrival-timeline-title">
      <header class="arrival-timeline-header">
        <div>
          <span class="section-kicker">${phaseFilter === 'return' ? 'INBOUND' : 'OUTBOUND'}</span>
          <h2 id="arrival-timeline-title">Arrival timeline</h2>
          <p>Sorted by landing time</p>
        </div>
        <span class="arrival-timeline-count">${orderedFlights.length} ${orderedFlights.length === 1 ? 'arrival' : 'arrivals'}</span>
      </header>

      ${orderedFlights.length ? `
        <ol class="arrival-timeline-list">
          ${orderedFlights.map((flight, index) => {
            const participantIndex = participantList.findIndex(person => person.name === flight.addedBy);
            const color = PERSON_COLORS_HEX[(participantIndex >= 0 ? participantIndex : index) % PERSON_COLORS_HEX.length];
            const status = getStatusPresentation(getComputedFlightStatus(flight));
            const departureCode = flight.departure?.code || 'DEP';
            const arrivalCode = flight.arrival?.code || 'ARR';
            return `
              <li class="arrival-timeline-row">
                <span class="arrival-timeline-time">
                  <time>${escapeHtml(flight.arrival?.time || '--:--')}</time>
                  <small>${escapeHtml(formatArrivalDate(flight))}</small>
                </span>
                <span class="arrival-timeline-rail" style="--timeline-color:${color}">
                  <i>${escapeHtml((flight.addedBy || '?').charAt(0).toUpperCase())}</i>
                </span>
                <span class="arrival-timeline-copy">
                  <strong>${escapeHtml(flight.addedBy || 'Traveler')}</strong>
                  <small>${escapeHtml(departureCode)} → ${escapeHtml(arrivalCode)} · ${escapeHtml(flight.flightNumber || 'Flight')}</small>
                </span>
                <span class="arrival-status arrival-status-${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>
              </li>
            `;
          }).join('')}
        </ol>
      ` : `
        <div class="arrival-timeline-empty">No arrivals in this view yet.</div>
      `}
    </section>
  `;
}

export async function renderDashboard(container, tripId) {
  let filterPerson = 'all';
  let phaseFilter = 'outbound'; // Default tab: 'outbound'
  let activeMainTab = 'tracking'; // 'tracking', 'coordination'
  let expandedFlightIds = new Set();
  let focusFlightId = null;

  const trip = await getTrip(tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    navigate('');
    return;
  }

  try {
    const returnContext = JSON.parse(sessionStorage.getItem(`${DASHBOARD_RETURN_PREFIX}${tripId}`) || 'null');
    if (returnContext) {
      if (returnContext.phase === 'return' || returnContext.phase === 'outbound') {
        phaseFilter = returnContext.phase;
      }
      const travelerNames = (trip.participants || []).map(person => person.name);
      if (returnContext.filterPerson === 'all' || travelerNames.includes(returnContext.filterPerson)) {
        filterPerson = returnContext.filterPerson;
      }
      if (returnContext.flightId) {
        focusFlightId = String(returnContext.flightId);
        expandedFlightIds.add(focusFlightId);
      }
    }
    sessionStorage.removeItem(`${DASHBOARD_RETURN_PREFIX}${tripId}`);
  } catch {
    sessionStorage.removeItem(`${DASHBOARD_RETURN_PREFIX}${tripId}`);
  }

  let latestTrip = trip;

  // Keep the dashboard in sync with changes made from flight and coordination views.
  const unsubscribers = [
    subscribe(EVENTS.TRIP_DELETED, (deletedTripId) => {
      if (deletedTripId !== tripId) return;
      stopPolling(tripId);
      destroyRouteMap();
      showToast('Trip was deleted', 'info');
      navigate('');
    }),
    ...[
      EVENTS.FLIGHT_ADDED,
      EVENTS.FLIGHT_DELETED,
      EVENTS.FLIGHT_UPDATED,
      EVENTS.FLIGHT_STATUS_CHANGED,
      EVENTS.PARTICIPANT_ADDED,
      EVENTS.PARTICIPANT_DELETED
    ].map(eventName => subscribe(eventName, () => render()))
  ];
  const unsubscribe = () => unsubscribers.forEach(fn => fn());

  // Start auto-refresh polling if preferred
  if (getAutoRefreshPref(tripId)) {
    startPolling(tripId);
  }

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;
    latestTrip = currentTrip;

    const nickname = getUserNickname(tripId);

    // Filter flights by person and phase using robust getFlightPhase
    let filteredFlights = currentTrip.flights || [];
    if (filterPerson !== 'all') {
      filteredFlights = filteredFlights.filter(f => f.addedBy === filterPerson);
    }

    if (phaseFilter === 'outbound') {
      filteredFlights = filteredFlights.filter(f => getFlightPhase(f, currentTrip) === 'outbound');
    } else if (phaseFilter === 'return') {
      filteredFlights = filteredFlights.filter(f => getFlightPhase(f, currentTrip) === 'return');
    }

    const filteredOutbound = (currentTrip.flights || []).filter(f => (filterPerson === 'all' || f.addedBy === filterPerson) && getFlightPhase(f, currentTrip) === 'outbound').length;
    const filteredReturn = (currentTrip.flights || []).filter(f => (filterPerson === 'all' || f.addedBy === filterPerson) && getFlightPhase(f, currentTrip) === 'return').length;

    // Sort flights chronologically
    const sortedFlights = [...filteredFlights].sort((a, b) => {
      const dateA = a.departure?.date || '';
      const timeA = a.departure?.time || '';
      const dateB = b.departure?.date || '';
      const timeB = b.departure?.time || '';
      return (dateA + ' ' + timeA).localeCompare(dateB + ' ' + timeB);
    });

    const participantsList = (currentTrip.participants || []).map(p => typeof p === 'string' ? { name: p } : p);
    const visibleAvatars = participantsList.slice(0, 4);
    const overflowCount = Math.max(0, participantsList.length - 4);

    const isCurrentlyPolling = isPolling(tripId);
    const stats = getDashboardStats(currentTrip);
    const destinationCodes = (currentTrip.destinationAirport || 'Destination TBD')
      .split(',')
      .map(code => code.trim())
      .filter(Boolean)
      .join(' / ');

    container.innerHTML = `
      <div class="screen dashboard-screen">
        <header class="dashboard-topbar">
          <button class="topbar-back" id="btn-back">
            <span aria-hidden="true">${getIcon('arrowLeft')}</span>
            <span class="action-label">All trips</span>
          </button>

          <div class="dashboard-actions" aria-label="Trip actions">
            <details class="dashboard-tools-menu">
              <summary class="dashboard-tools-trigger" aria-label="More trip options">
                <span class="dashboard-more-dots" aria-hidden="true">•••</span>
                <span class="dashboard-more-label">More</span>
              </summary>
              <div class="dashboard-tools-popover">
                <header class="dashboard-tools-popover-header">
                  <strong>Trip options</strong>
                  <small>Shared utilities and settings</small>
                </header>
                <button id="btn-toggle-refresh" title="${isCurrentlyPolling ? 'Turn off live refresh' : 'Enable live refresh'}">
                  ${getIcon('refresh')}
                  <span><strong>Live updates</strong><small>Refresh flight status every 30s</small></span>
                  <em class="dashboard-tool-state ${isCurrentlyPolling ? 'is-on' : ''}">${isCurrentlyPolling ? 'On' : 'Off'}</em>
                </button>
                <button id="btn-notes" title="Open trip notes">
                  ${getIcon('notes')}<span><strong>Trip notes</strong><small>Meetups, hotels and shared details</small></span>
                </button>
                <button id="btn-calendar" title="Add flights to your calendar">
                  ${getIcon('calendar')}<span><strong>Calendar sync</strong><small>Subscribe to live flight updates</small></span>
                </button>
              </div>
            </details>
            <button class="btn btn-primary dashboard-add-action" id="btn-add-flight">
              ${getIcon('plus')}<span>Add flight</span>
            </button>
          </div>
        </header>

        <section class="dashboard-hero" aria-labelledby="trip-title">
          <div class="dashboard-hero-copy">
            <div class="dashboard-kicker">PPC: DELAY NO MORE</div>
            <h1 id="trip-title">${escapeHtml(currentTrip.name)}</h1>
            <div class="dashboard-trip-meta">
              <span>${getIcon('plane')} ${escapeHtml(destinationCodes)}</span>
              <span aria-hidden="true">•</span>
              <span>${getIcon('calendar')} ${escapeHtml(formatTripDates(currentTrip.startDate, currentTrip.endDate))}</span>
              ${currentTrip.returnAirport ? `<span aria-hidden="true">•</span><span>Return ${escapeHtml(currentTrip.returnAirport)}</span>` : ''}
            </div>
          </div>

          <div class="dashboard-hero-controls">
            <div class="avatar-group-wrapper" id="avatar-group-wrapper">
              <div class="crew-summary">
                <div>
                  <span class="crew-label">Trip crew</span>
                  <span class="crew-viewer">Viewing as ${escapeHtml(nickname || 'traveler')}</span>
                </div>
                <button class="avatar-group" id="avatar-group-trigger" title="See everyone in this trip" aria-label="See all ${participantsList.length} travelers">
                  ${visibleAvatars.map((p, i) => `
                    <span class="avatar-ring" style="--avatar-color:${PERSON_COLORS_HEX[i % 6]}">${escapeHtml((p.name || '?').charAt(0).toUpperCase())}</span>
                  `).join('')}
                  ${overflowCount > 0 ? `<span class="avatar-ring avatar-count-ring">+${overflowCount}</span>` : ''}
                </button>
              </div>

              <div class="avatar-popover hidden" id="avatar-popover">
                <div class="avatar-popover-header">Trip crew · ${participantsList.length}</div>
                <div class="avatar-popover-list">
                  ${participantsList.map((p, i) => {
                    const flightCount = (currentTrip.flights || []).filter(f => f.addedBy === p.name).length;
                    return `
                      <button class="avatar-popover-item" data-popover-person="${escapeHtml(p.name)}">
                        <span class="avatar-ring" style="--avatar-color:${PERSON_COLORS_HEX[i % 6]}">${escapeHtml((p.name || '?').charAt(0).toUpperCase())}</span>
                        <span class="crew-person-copy">
                          <strong>${escapeHtml(p.name)}</strong>
                          <small>${escapeHtml(formatJoinedDate(p.joinedAt))}</small>
                        </span>
                        <span class="crew-flight-count">${flightCount} ${flightCount === 1 ? 'flight' : 'flights'}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <button class="btn dashboard-share-action" id="btn-share" type="button">${getIcon('share')} Invite people</button>
          </div>
        </section>

        <section class="dashboard-metrics" aria-label="Trip readiness">
          <article class="metric-card">
            <span class="metric-label">Travelers</span>
            <strong>${stats.travelers}</strong>
            <small>${currentTrip.flights?.length || 0} tickets tracked</small>
          </article>
          <article class="metric-card metric-card-accent">
            <span class="metric-label">Landed</span>
            <strong>${stats.landed}</strong>
            <small>at destination</small>
          </article>
          <article class="metric-card">
            <span class="metric-label">Arrival spread</span>
            <strong>${stats.arrivalSpread}</strong>
            <small>first to last arrival</small>
          </article>
          <article class="metric-card ${stats.stillToBook > 0 ? 'metric-card-alert' : ''}">
            <span class="metric-label">Still to book</span>
            <strong>${stats.stillToBook}</strong>
            <small>${stats.stillToBook > 0 ? 'needs coordination' : 'everyone is covered'}</small>
          </article>
        </section>

        <nav class="tab-container dashboard-main-tabs" aria-label="Dashboard sections">
          <button class="tab-btn ${activeMainTab === 'tracking' ? 'active' : ''}" data-maintab="tracking">
            <span>${getIcon('plane')}</span> Flight board <span class="tab-count">${currentTrip.flights?.length || 0}</span>
          </button>
          <button class="tab-btn ${activeMainTab === 'coordination' ? 'active' : ''}" data-maintab="coordination">
            <span>${getIcon('sparkles')}</span> Coordination engine
            ${stats.stillToBook > 0 ? `<span class="tab-alert">${stats.stillToBook}</span>` : ''}
          </button>
        </nav>

        <!-- Workspace Section -->
        <div id="main-tab-workspace">
          
          <!-- Flight Tracking Workspace -->
          <div id="tracking-workspace" class="${activeMainTab === 'tracking' ? '' : 'hidden-tab'}">
            
            <div class="dashboard-section-row">
              <div>
                <span class="section-kicker">LIVE MANIFEST</span>
                <h2>Flight tracking</h2>
              </div>
              <span class="section-status"><span class="live-dot is-live"></span>${isCurrentlyPolling ? 'Auto-updating' : 'Manual refresh'}</span>
            </div>

            <div class="chip-group dashboard-crew-filter mb-base" aria-label="Filter by traveler">
              <div class="chip ${filterPerson === 'all' ? 'active' : ''}" data-person="all">
                Everyone <span>${currentTrip.participants.length}</span>
              </div>
              ${currentTrip.participants.map((p, i) => `
                <div class="chip ${filterPerson === p.name ? 'active' : ''}" data-person="${escapeHtml(p.name)}">
                  <span class="crew-dot" style="background:${PERSON_COLORS[i % 6]};"></span>
                  ${escapeHtml(p.name)}
                  <button class="chip-delete-btn" data-person-del="${escapeHtml(p.name)}" title="Remove ${escapeHtml(p.name)}">×</button>
                </div>
              `).join('')}
            </div>

            <div class="dashboard-subnav mb-base">
              <div class="tabs dashboard-direction-tabs" aria-label="Flight direction">
                <button class="tab ${phaseFilter === 'outbound' ? 'active' : ''}" data-phase="outbound">
                  Outbound <span>${filteredOutbound}</span>
                </button>
                <button class="tab ${phaseFilter === 'return' ? 'active' : ''}" data-phase="return">
                  Inbound <span>${filteredReturn}</span>
                </button>
              </div>
            </div>

            <div id="hero-map-container" class="mb-base"></div>

            ${renderArrivalTimeline(sortedFlights, currentTrip.participants || [], phaseFilter)}

            <div class="dashboard-list-header">
              <div>
                <span class="section-kicker">${phaseFilter === 'return' ? 'INBOUND' : 'OUTBOUND'}</span>
                <h2>Traveler details</h2>
              </div>
              <span class="traveler-details-hint">Select a flight for details</span>
            </div>

            <div id="tab-content">
              ${renderFlightsList(sortedFlights, currentTrip, expandedFlightIds)}
            </div>

            <div class="dashboard-bottom-action">
              <button class="btn btn-primary" id="btn-add-flight-bottom">
                ${getIcon('plus')} Add another flight
              </button>
            </div>
          </div>

          <!-- Coordination Tab -->
          <div id="coordination-tab-content" class="${activeMainTab === 'coordination' ? '' : 'hidden-tab'}">
            <!-- Lazy rendered via renderCoordinationTab -->
          </div>

        </div>

      </div>
      ${renderInviteDialog(currentTrip)}
    `;

    const heroMapContainer = container.querySelector('#hero-map-container');
    if (heroMapContainer) {
      renderRouteMap(heroMapContainer, sortedFlights, currentTrip.participants || [], currentTrip, filterPerson, phaseFilter);
    }

    // Lazy render Coordination Engine tab if active
    if (activeMainTab === 'coordination') {
      destroyRouteMap();
      const coordContainer = container.querySelector('#coordination-tab-content');
      if (coordContainer) {
        renderCoordinationTab(coordContainer, currentTrip, nickname);
      }
    }

    bindEvents();

    if (focusFlightId) {
      const focusedRow = [...container.querySelectorAll('[data-expand-flight]')]
        .find(row => row.getAttribute('data-expand-flight') === focusFlightId);
      if (focusedRow) {
        focusedRow.closest('.flight-details-card')?.classList.add('is-newly-added');
        requestAnimationFrame(() => focusedRow.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        focusFlightId = null;
      }
    }
  }

  function bindEvents() {
    // Topbar back
    container.querySelector('#btn-back')?.addEventListener('click', () => {
      destroyRouteMap();
      unsubscribe();
      navigate('');
    });

    // Invite people with a shareable link; keep the PIN as a secondary option.
    const shareBtn = container.querySelector('#btn-share');
    const inviteOverlay = container.querySelector('#invite-overlay');
    const closeInvite = () => inviteOverlay?.classList.add('is-hidden');
    const openInvite = () => {
      inviteOverlay?.classList.remove('is-hidden');
      requestAnimationFrame(() => container.querySelector('#btn-share-invite')?.focus());
    };

    shareBtn?.addEventListener('click', openInvite);
    container.querySelectorAll('[data-close-invite]').forEach(button => {
      button.addEventListener('click', closeInvite);
    });
    inviteOverlay?.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeInvite();
    });
    inviteOverlay?.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeInvite();
    });
    container.querySelector('#btn-copy-invite-link')?.addEventListener('click', async () => {
      const copied = await copyText(buildInviteUrl(latestTrip.pin));
      showToast(copied ? 'Invite link copied' : 'Could not copy the invite link', copied ? 'success' : 'error');
    });
    container.querySelector('#btn-copy-invite-pin')?.addEventListener('click', async () => {
      const pin = latestTrip.pin || '';
      const copied = await copyText(pin);
      showToast(copied ? `Trip PIN ${pin} copied` : `Trip PIN: ${pin}`, copied ? 'success' : 'info');
    });
    container.querySelector('#btn-share-invite')?.addEventListener('click', async () => {
      const pin = latestTrip.pin || '';
      const inviteUrl = buildInviteUrl(pin);
      const shareData = {
        title: `Join ${latestTrip.name}`,
        text: `Join my trip “${latestTrip.name}” on TripFlights. Your trip PIN is ${pin}.`,
        url: inviteUrl
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      const copied = await copyText(`${shareData.text}\n${inviteUrl}`);
      showToast(copied ? 'Invite message copied' : `Share this link: ${inviteUrl}`, copied ? 'success' : 'info');
    });

    // Calendar Sync Export
    container.querySelector('#btn-calendar')?.addEventListener('click', () => {
      container.querySelector('.dashboard-tools-menu')?.removeAttribute('open');
      exportTripCalendar(latestTrip);
    });

    // Shared trip notes
    container.querySelector('#btn-notes')?.addEventListener('click', () => {
      destroyRouteMap();
      unsubscribe();
      navigate(`trip/${tripId}/notes`);
    });

    // Toggle Live Refresh Polling
    container.querySelector('#btn-toggle-refresh')?.addEventListener('click', () => {
      const currentPref = getAutoRefreshPref(tripId);
      const newPref = !currentPref;
      setAutoRefreshPref(tripId, newPref);

      if (newPref) {
        startPolling(tripId);
        showToast('Live status refresh enabled (30s polling)', 'success');
      } else {
        stopPolling(tripId);
        showToast('Live status refresh disabled', 'info');
      }
      render();
    });

    // Add Flight
    const handleAddFlight = () => {
      try {
        sessionStorage.setItem(`${ADD_FLIGHT_CONTEXT_PREFIX}${tripId}`, JSON.stringify({
          phase: phaseFilter,
          traveler: filterPerson === 'all' ? getUserNickname(tripId) : filterPerson,
          returnFilter: filterPerson
        }));
      } catch {
        // The add flow still works if session storage is unavailable.
      }
      destroyRouteMap();
      unsubscribe();
      navigate(`trip/${tripId}/add-flight`);
    };
    container.querySelector('#btn-add-flight')?.addEventListener('click', handleAddFlight);
    container.querySelector('#btn-add-flight-bottom')?.addEventListener('click', handleAddFlight);

    // Avatar Popover Toggle
    const avatarTrigger = container.querySelector('#avatar-group-trigger');
    const avatarPopover = container.querySelector('#avatar-popover');

    avatarTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarPopover?.classList.toggle('hidden');
    });

    // Click outside to close popover
    document.addEventListener('click', (e) => {
      if (!container.querySelector('#avatar-group-wrapper')?.contains(e.target)) {
        avatarPopover?.classList.add('hidden');
      }
    });

    // Popover member click to filter
    avatarPopover?.querySelectorAll('[data-popover-person]').forEach(item => {
      item.addEventListener('click', () => {
        const personName = item.getAttribute('data-popover-person');
        filterPerson = filterPerson === personName ? 'all' : personName;
        avatarPopover.classList.add('hidden');
        render();
      });
    });

    // Main Tabs (Tracking vs Coordination)
    container.querySelectorAll('[data-maintab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMainTab = btn.getAttribute('data-maintab');
        render();
      });
    });

    // Person chips filter
    container.querySelectorAll('[data-person]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-delete-btn')) return;
        filterPerson = chip.getAttribute('data-person');
        render();
      });
    });

    // Delete person profile
    container.querySelectorAll('[data-person-del]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const personName = btn.getAttribute('data-person-del');

        if (confirm(`Remove profile "${personName}" and all associated flights from this trip?`)) {
          await deleteParticipant(tripId, personName);
          if (filterPerson === personName) filterPerson = 'all';
          showToast(`Profile "${personName}" removed`, 'info');
          render();
        }
      });
    });

    // Direction tabs drive the map, arrival timeline, and traveler details together.
    container.querySelectorAll('[data-phase]').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetPhase = tab.getAttribute('data-phase');
        if (targetPhase) phaseFilter = targetPhase;
        render();
      });
    });

    // One consistent flight card pattern: compact summary with expandable details.
    container.querySelectorAll('[data-expand-flight]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-delete-flight]')) return;
        const flightId = row.getAttribute('data-expand-flight');
        if (expandedFlightIds.has(flightId)) {
          expandedFlightIds.delete(flightId);
        } else {
          expandedFlightIds.add(flightId);
        }
        render();
      });
    });

    container.querySelectorAll('[data-delete-flight]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.getAttribute('data-delete-flight');

        if (confirm('Are you sure you want to delete this flight?')) {
          await deleteFlight(tripId, flightId);
          showToast('Flight removed', 'info');
          render();
        }
      });
    });
  }

  render();
}

/**
 * Render a single, consistent expandable flight card list.
 */
function renderFlightsList(sortedFlights, trip, expandedFlightIds) {
  if (sortedFlights.length === 0) {
    return `
      <div class="card text-center" style="padding: var(--space-2xl) var(--space-lg);">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-sm); opacity: 0.5;">🛫</div>
        <h3 style="margin-bottom: var(--space-xs); font-weight: 700;">No Flights Match Filter</h3>
        <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--space-lg);">
          Try selecting another person or phase filter, or add a new flight.
        </p>
      </div>
    `;
  }

  return `
    <div class="compact-flight-list">
      ${sortedFlights.map(flight => {
      const isExpanded = expandedFlightIds.has(String(flight.id));
      return renderCompactFlightRow(flight, trip.participants || [], isExpanded);
    }).join('')}
    </div>
  `;
}

function renderInviteDialog(trip) {
  const pin = trip.pin || '';
  const inviteUrl = buildInviteUrl(pin);

  return `
    <div class="modal-overlay invite-overlay is-hidden" id="invite-overlay">
      <section class="modal invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
        <header class="invite-dialog-header">
          <span class="invite-dialog-icon" aria-hidden="true">${getIcon('share')}</span>
          <span>
            <span class="section-kicker">BRING THE CREW</span>
            <h2 id="invite-dialog-title">Invite people to ${escapeHtml(trip.name)}</h2>
          </span>
          <button type="button" class="invite-dialog-close" data-close-invite aria-label="Close invite dialog">✕</button>
        </header>

        <p class="invite-dialog-intro">Send the private invite link. The trip PIN is already filled in, so they only need to add their name and home airport.</p>

        <div class="invite-link-card">
          <span>
            <small>INVITE LINK</small>
            <code>${escapeHtml(inviteUrl)}</code>
          </span>
          <button type="button" id="btn-copy-invite-link">${getIcon('copy')} Copy link</button>
        </div>

        <div class="invite-pin-card">
          <span>
            <small>JOIN MANUALLY WITH PIN</small>
            <strong>${escapeHtml(pin)}</strong>
          </span>
          <button type="button" id="btn-copy-invite-pin">${getIcon('copy')} Copy PIN</button>
        </div>

        <p class="invite-privacy-note">Anyone with this link or PIN can join the trip. Share it only with your group.</p>

        <footer class="invite-dialog-footer">
          <button type="button" class="invite-dialog-cancel" data-close-invite>Cancel</button>
          <button type="button" class="invite-dialog-share" id="btn-share-invite">${getIcon('share')} Share invite</button>
        </footer>
      </section>
    </div>
  `;
}

function buildInviteUrl(pin) {
  return `${window.location.origin}${window.location.pathname}#join/${encodeURIComponent(pin || '')}`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
