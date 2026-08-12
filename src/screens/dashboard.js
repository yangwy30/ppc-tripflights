/* ============================================
   PPC: Delay No More — Commercial SaaS Dashboard
   ============================================ */

import { getTrip, getUserNickname, deleteFlight, restoreFlight, deleteTrip, exportTripSummary, deleteParticipant } from '../data/dataAdapter.js';
import { emit, subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { refreshFlightStatus } from '../data/flightService.js';
import { updateFlightStatus } from '../data/dataAdapter.js';
import { renderTimeline } from '../components/timeline.js';
import { renderFlightCard } from '../components/flightCard.js';
import { renderCoordinationTab } from '../components/coordinationTab.js';
import { startPolling, stopPolling, isPolling, setAutoRefreshPref, getAutoRefreshPref } from '../data/alertService.js';
import { getIcon } from '../components/icons.js';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

let activeDashboardUnsubscribe = null;

export async function renderDashboard(container, tripId) {
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);
  let activeMainTab = 'tracking';
  let activeTab = 'flights';
  let phaseFilter = 'all'; // 'all' | 'outbound' | 'return'
  let filterPerson = 'all';

  if (getAutoRefreshPref(tripId)) {
    startPolling(tripId);
  }

  if (activeDashboardUnsubscribe) {
    activeDashboardUnsubscribe();
    activeDashboardUnsubscribe = null;
  }

  const unsubscribe = subscribe(EVENTS.FLIGHT_STATUS_CHANGED, (data) => {
    if (data.tripId === tripId) {
      showToast(`${data.flightId ? getIcon('plane') : ''} Flight status updated to ${data.newStatus}`, 'flight');
      render();
    }
  });
  activeDashboardUnsubscribe = unsubscribe;

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;

    // Helper to determine flight phase
    const getFlightPhase = (flight) => {
      const pIdx = currentTrip.participants.findIndex(p => p.name === flight.addedBy);
      const participant = currentTrip.participants[pIdx];
      const destIata = (participant?.destinationAirport || currentTrip.destinationAirport || '').toUpperCase().trim();
      const retIata = (participant?.destinationAirport || currentTrip.returnAirport || '').toUpperCase().trim();

      const arrCode = (flight.arrival?.code || '').toUpperCase().trim();
      const depCode = (flight.departure?.code || '').toUpperCase().trim();

      if (destIata && arrCode === destIata) return 'outbound';
      if (destIata && depCode === destIata) return 'return';
      if (retIata && depCode === retIata) return 'return';
      return 'outbound';
    };

    let filteredFlights = currentTrip.flights;

    if (filterPerson !== 'all') {
      filteredFlights = filteredFlights.filter(f => f.addedBy === filterPerson);
    }

    const outboundCount = filteredFlights.filter(f => getFlightPhase(f) === 'outbound').length;
    const returnCount = filteredFlights.filter(f => getFlightPhase(f) === 'return').length;

    if (activeTab === 'flights' && phaseFilter !== 'all') {
      filteredFlights = filteredFlights.filter(f => getFlightPhase(f) === phaseFilter);
    }

    const sortedFlights = [...filteredFlights].sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.departure?.time || '').localeCompare(b.departure?.time || '');
    });

    const alertsActive = isPolling(tripId);

    container.innerHTML = `
      <div class="screen">
        <!-- Topbar Header -->
        <div class="topbar">
          <button class="topbar-back" id="btn-back">
            <span style="display:flex;">${getIcon('arrowLeft')}</span> Trips
          </button>
          <div style="display: flex; gap: var(--space-xs); align-items: center;">
            <button class="btn btn-sm btn-ghost" id="btn-toggle-refresh" style="font-size: var(--font-size-xs); color: ${alertsActive ? 'var(--color-success)' : 'var(--color-text-tertiary)'};">
              <span class="live-dot" style="background:${alertsActive ? 'var(--color-success)' : 'var(--color-text-tertiary)'}; margin-right:4px;"></span>
              ${alertsActive ? 'Live Sync' : 'Offline'}
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-subscribe" title="Add to Calendar">
              <span style="display:flex;">${getIcon('calendar')}</span> <span class="hide-mobile">Subscribe</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-notes" title="Notes">
              <span style="display:flex;">${getIcon('notes')}</span> <span class="hide-mobile">Notes</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-share" title="Share Summary">
              <span style="display:flex;">${getIcon('share')}</span> <span class="hide-mobile">Share</span>
            </button>
            <button class="btn btn-sm btn-ghost" id="btn-delete-trip" title="Delete Trip" style="color: var(--color-danger);">
              <span style="display:flex;">${getIcon('trash')}</span> <span class="hide-mobile">Delete</span>
            </button>
          </div>
        </div>

        <!-- Dashboard Grid (2-Column Desktop / 1-Column Mobile Layout) -->
        <div class="dashboard-grid mb-xl">
          
          <!-- Main Content Column -->
          <div>
            <div style="margin-bottom: var(--space-lg);">
              <h1 style="font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em;">${escapeHtml(currentTrip.name)}</h1>
              <p style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 4px; font-family: var(--font-family-mono);">
                📅 ${formatDateRange(currentTrip.startDate, currentTrip.endDate)}
                ${currentTrip.destinationAirport ? ` · Dest: ${escapeHtml(currentTrip.destinationAirport)}` : ''}
              </p>
            </div>

            <!-- Main Navigation Tabs -->
            <div class="tab-container mb-base">
              <button class="tab-btn ${activeMainTab === 'tracking' ? 'active' : ''}" data-maintab="tracking">
                <span style="display:flex;">${getIcon('plane')}</span> Tracking
              </button>
              <button class="tab-btn ${activeMainTab === 'coordination' ? 'active' : ''}" data-maintab="coordination">
                <span style="display:flex;">${getIcon('sparkles')}</span> Coordination
              </button>
            </div>

            <!-- Tracking Tab -->
            <div id="tracking-tab-content" class="${activeMainTab === 'tracking' ? '' : 'hidden-tab'}">
              <!-- Traveler Filter Chips -->
              <div class="chip-group mb-base">
                <button class="chip ${filterPerson === 'all' ? 'active' : ''}" data-person="all">All Travelers (${currentTrip.participants.length})</button>
                ${currentTrip.participants.map((p, i) => `
                  <div class="chip ${filterPerson === p.name ? 'active' : ''}" data-person="${escapeHtml(p.name)}">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${PERSON_COLORS[i % 6]};margin-right:4px;"></span>
                    ${escapeHtml(p.name)}
                    <button class="chip-delete-btn" data-person-del="${escapeHtml(p.name)}" style="all:unset; cursor:pointer; font-size:12px; opacity:0.4; margin-left:4px;" title="Remove Profile">×</button>
                  </div>
                `).join('')}
              </div>

              <!-- Phase & View Sub-Tabs (Outbound / Return / All / Timeline) -->
              <div class="tabs mb-base">
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'all' ? 'active' : ''}" data-tab="flights" data-phase="all">All (${currentTrip.flights.length})</button>
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'outbound' ? 'active' : ''}" data-tab="flights" data-phase="outbound">
                  <span style="color: #34D399; display:flex;">${getIcon('plane')}</span> Outbound (${outboundCount})
                </button>
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'return' ? 'active' : ''}" data-tab="flights" data-phase="return">
                  <span style="color: #60A5FA; display:flex;">${getIcon('plane')}</span> Return (${returnCount})
                </button>
                <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">
                  <span style="display:flex;">${getIcon('timeline')}</span> Timeline
                </button>
              </div>

              <!-- Content Stream -->
              <div id="tab-content">
                ${activeTab === 'flights' ? renderFlightsList(sortedFlights, currentTrip) : ''}
              </div>
            </div>

            <!-- Coordination Tab -->
            <div id="coordination-tab-content" class="${activeMainTab === 'coordination' ? '' : 'hidden-tab'}">
              <!-- Rendered by renderCoordinationTab -->
            </div>
          </div>

          <!-- Sidebar Column -->
          <div class="side-card-stack">
            <!-- Share PIN Widget -->
            <div class="pin-display">
              <div>
                <div class="pin-label">Share PIN</div>
                <div class="pin-code">${currentTrip.pin}</div>
              </div>
              <button class="pin-copy" id="btn-copy-pin" title="Copy PIN">${getIcon('copy')}</button>
            </div>

            <!-- Group Members Card -->
            <div class="card card-compact">
              <div style="font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--color-text-tertiary); margin-bottom: var(--space-sm);">
                Group Travelers (${currentTrip.participants.length})
              </div>
              <div class="flex-col" style="gap: var(--space-xs);">
                ${currentTrip.participants.map((p, i) => `
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size: var(--font-size-sm); padding: 4px 0;">
                    <div style="display:flex; align-items:center; gap: 8px;">
                      <span style="width:24px; height:24px; border-radius:50%; background:${PERSON_COLORS[i % 6]}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:11px;">
                        ${(p.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span style="font-weight: var(--font-weight-medium);">${escapeHtml(p.name)}</span>
                    </div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">
                      ${currentTrip.flights.filter(f => f.addedBy === p.name).length} flights
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Quick Add Flight Button -->
            <button class="btn btn-primary" id="btn-add-flight">
              <span style="display:flex;">${getIcon('plus')}</span> Add Flight
            </button>
          </div>

        </div>
      </div>
    `;

    const coordContainer = container.querySelector('#coordination-tab-content');
    if (coordContainer) {
      renderCoordinationTab(coordContainer, currentTrip);
    }

    if (activeMainTab === 'tracking' && activeTab === 'timeline') {
      const timelineContainer = container.querySelector('#tab-content');
      renderTimeline(timelineContainer, currentTrip.flights, currentTrip.participants);
    }

    // Event Listeners
    container.querySelector('#btn-back').addEventListener('click', () => {
      stopPolling(tripId);
      unsubscribe();
      navigate('');
    });
    container.querySelector('#btn-add-flight').addEventListener('click', () => navigate(`add-flight/${tripId}`));
    container.querySelector('#btn-notes').addEventListener('click', () => navigate(`notes/${tripId}`));

    container.querySelector('#btn-subscribe').addEventListener('click', async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zgqjctiuycrhwrstorxw.supabase.co';
      const baseUrl = supabaseUrl.replace(/^https?:\/\//, 'webcal://');
      const subscribeUrl = `${baseUrl}/functions/v1/calendar-feed?tripId=${tripId}&token=${currentTrip.pin}`;
      window.location.href = subscribeUrl;
    });

    container.querySelector('#btn-copy-pin').addEventListener('click', () => {
      navigator.clipboard?.writeText(currentTrip.pin).then(() => {
        showToast('PIN copied!', 'success');
      }).catch(() => {
        showToast(`PIN: ${currentTrip.pin}`, 'info');
      });
    });

    container.querySelector('#btn-share').addEventListener('click', async () => {
      const summary = await exportTripSummary(tripId);
      if (navigator.share) {
        navigator.share({ title: currentTrip.name, text: summary }).catch(() => { });
      } else {
        navigator.clipboard?.writeText(summary).then(() => {
          showToast('Trip summary copied!', 'success');
        });
      }
    });

    container.querySelector('#btn-delete-trip').addEventListener('click', async () => {
      if (confirm(`Delete "${currentTrip.name}"? This cannot be undone.`)) {
        stopPolling(tripId);
        unsubscribe();
        await deleteTrip(tripId);
        showToast('Trip deleted', 'info');
        navigate('');
      }
    });

    const toggleBtn = container.querySelector('#btn-toggle-refresh');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (isPolling(tripId)) {
          stopPolling(tripId);
          setAutoRefreshPref(tripId, false);
          showToast('Auto-refresh turned off', 'info');
        } else {
          startPolling(tripId);
          setAutoRefreshPref(tripId, true);
          showToast('Auto-refresh turned on', 'success');
        }
        render();
      });
    }

    container.querySelectorAll('.tab-btn[data-maintab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMainTab = btn.dataset.maintab;
        render();
      });
    });

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        if (tab.dataset.phase) {
          phaseFilter = tab.dataset.phase;
        }
        render();
      });
    });

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-delete-btn')) return;
        filterPerson = chip.dataset.person;
        render();
      });
    });

    container.querySelectorAll('.chip-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const personToDel = btn.dataset.personDel;
        if (confirm(`Remove ${personToDel} and all their flights from this trip?`)) {
          btn.disabled = true;
          await deleteParticipant(tripId, personToDel);
          if (filterPerson === personToDel) filterPerson = 'all';
          showToast(`Removed ${personToDel}`, 'info');
          
          if (personToDel === nickname) {
            stopPolling(tripId);
            unsubscribe();
            navigate('');
          } else {
            render();
          }
        }
      });
    });

    container.querySelectorAll('.flight-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        const removedFlight = currentTrip.flights.find(f => f.id === flightId);
        await deleteFlight(tripId, flightId);
        render();
        showToast('Flight removed', 'info', 5000, {
          label: 'Undo',
          onClick: async () => {
            if (removedFlight) {
              await restoreFlight(tripId, removedFlight);
              showToast('Flight restored!', 'success');
              render();
            }
          }
        });
      });
    });

    container.querySelectorAll('.flight-refresh').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        const flightNum = btn.dataset.flightNumber;
        const flightDate = btn.dataset.flightDate || undefined;
        btn.textContent = '⏳';
        const newStatus = await refreshFlightStatus(flightNum, flightDate);
        await updateFlightStatus(tripId, flightId, newStatus);
        showToast(`${flightNum}: ${formatStatus(newStatus)}`, 'flight');
        render();
      });
    });
  }

  render();
}

function renderFlightsList(flights, trip) {
  if (flights.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon" style="display:flex; justify-content:center;">${getIcon('plane')}</div>
        <h3>No flights in this view</h3>
        <p>Try selecting "All" or adding flights to this trip</p>
      </div>
    `;
  }

  return flights.map((flight, i) => renderFlightCard(flight, trip.participants, i, trip)).join('');
}

function formatDateRange(start, end) {
  if (!start) return '';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
  const e = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts) : '';
  return e ? `${s} — ${e}` : s;
}

function formatStatus(status) {
  const map = { 'on-time': 'On Time ✅', 'delayed': 'Delayed ⚠️', 'cancelled': 'Cancelled ❌', 'landed': 'Landed 🛬', 'scheduled': 'Scheduled' };
  return map[status] || status;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
