/* ============================================
   PPC: Delay No More — Commercial SaaS Dashboard (Hero Embedded Insights + Avatar Popover + Route Map)
   ============================================ */

import { getTrip, getUserNickname, deleteFlight, restoreFlight, deleteTrip, exportTripSummary, deleteParticipant } from '../data/dataAdapter.js';
import { emit, subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { refreshFlightStatus } from '../data/flightService.js';
import { updateFlightStatus } from '../data/dataAdapter.js';
import { renderTimeline } from '../components/timeline.js';
import { renderFlightCard, renderCompactFlightRow } from '../components/flightCard.js';
import { renderCoordinationTab } from '../components/coordinationTab.js';
import { renderRouteMap } from '../components/routeMap.js';
import { startPolling, stopPolling, isPolling, setAutoRefreshPref, getAutoRefreshPref } from '../data/alertService.js';
import { getIcon } from '../components/icons.js';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

const PERSON_COLORS_HEX = [
  '#0A84FF', '#34C759', '#F59E0B',
  '#A855F7', '#EC4899', '#38BDF8'
];

export async function renderDashboard(container, tripId) {
  let filterPerson = 'all';
  let phaseFilter = 'all'; // 'all', 'outbound', 'return'
  let activeTab = 'flights'; // 'flights', 'timeline', 'map'
  let activeMainTab = 'tracking'; // 'tracking', 'coordination'
  let viewMode = 'compact'; // 'compact' vs 'expanded'
  let expandedFlightIds = new Set(); // Track expanded rows in compact mode

  const trip = await getTrip(tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    navigate('');
    return;
  }

  // Handle trip deleted / changed events
  const unsubscribe = subscribe((event, data) => {
    if (event === EVENTS.TRIP_DELETED && data === tripId) {
      stopPolling(tripId);
      showToast('Trip was deleted', 'info');
      navigate('');
    } else if (event === EVENTS.FLIGHT_ADDED || event === EVENTS.FLIGHT_DELETED || event === EVENTS.FLIGHT_UPDATED || event === EVENTS.PARTICIPANT_ADDED || event === EVENTS.PARTICIPANT_DELETED) {
      render();
    }
  });

  // Start auto-refresh polling if preferred
  if (getAutoRefreshPref(tripId)) {
    startPolling(tripId);
  }

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;

    const nickname = getUserNickname(tripId);

    // Filter flights by person and phase
    let filteredFlights = currentTrip.flights || [];
    if (filterPerson !== 'all') {
      filteredFlights = filteredFlights.filter(f => f.addedBy === filterPerson);
    }
    if (phaseFilter === 'outbound') {
      filteredFlights = filteredFlights.filter(f => isOutboundFlight(f, currentTrip));
    } else if (phaseFilter === 'return') {
      filteredFlights = filteredFlights.filter(f => isReturnFlight(f, currentTrip));
    }

    // Sort by date and departure time
    const sortedFlights = [...filteredFlights].sort((a, b) => {
      const da = (a.date || '') + (a.departure?.time || '');
      const db = (b.date || '') + (b.departure?.time || '');
      return da.localeCompare(db);
    });

    const isAutoRefreshing = isPolling(tripId);

    // Filter counts for badges
    const totalOutbound = (currentTrip.flights || []).filter(f => isOutboundFlight(f, currentTrip)).length;
    const totalReturn = (currentTrip.flights || []).filter(f => isReturnFlight(f, currentTrip)).length;
    const filteredOutbound = filterPerson === 'all'
      ? totalOutbound
      : (currentTrip.flights || []).filter(f => f.addedBy === filterPerson && isOutboundFlight(f, currentTrip)).length;
    const filteredReturn = filterPerson === 'all'
      ? totalReturn
      : (currentTrip.flights || []).filter(f => f.addedBy === filterPerson && isReturnFlight(f, currentTrip)).length;

    // Avatar ring data for Hero Insights Banner
    const participantsList = currentTrip.participants || [];
    const visibleAvatars = participantsList.slice(0, 4);
    const overflowCount = Math.max(0, participantsList.length - 4);

    container.innerHTML = `
      <div class="screen">
        <!-- Top Bar -->
        <div class="topbar">
          <button class="topbar-back" id="btn-back">
            <span style="display:flex;">${getIcon('arrowLeft')}</span> All Trips
          </button>
          <div style="display:flex; gap: var(--space-xs); align-items:center;">
            <button class="btn btn-ghost btn-sm" id="btn-toggle-refresh" title="${isAutoRefreshing ? 'Auto-refresh Active (Every 60s)' : 'Click to enable Auto-refresh'}">
              <span class="live-dot" style="background:${isAutoRefreshing ? 'var(--color-success)' : 'var(--color-text-tertiary)'};"></span>
              ${isAutoRefreshing ? 'Live' : 'Off'}
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-notes">
              <span style="display:flex;">${getIcon('notes')}</span> Notes
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-subscribe" title="Add to Apple/Google Calendar">
              <span style="display:flex;">${getIcon('calendar')}</span> Calendar
            </button>
            <button class="btn btn-primary btn-sm" id="btn-add-flight-top">
              <span style="display:flex;">${getIcon('plus')}</span> Add Flight
            </button>
          </div>
        </div>

        <!-- Hero Title Header with Embedded PIN Badge -->
        <div class="screen-header" style="margin-bottom: var(--space-md);">
          <div style="display:flex; align-items:center; gap: var(--space-md); flex-wrap:wrap;">
            <h1 style="font-size: var(--font-size-3xl); margin:0;">${escapeHtml(currentTrip.name)}</h1>
            <div class="hero-pin-pill" title="Click to copy 6-digit PIN code">
              <span class="hero-pin-label">PIN</span>
              <span class="hero-pin-code">${currentTrip.pin}</span>
              <button class="hero-pin-copy" id="btn-copy-pin" title="Copy PIN">
                <span style="display:flex;">${getIcon('copy')}</span>
              </button>
            </div>
          </div>
          <p style="margin-top: 4px; font-family: var(--font-family-mono); font-size: var(--font-size-sm); color: var(--color-text-tertiary);">
            ${formatDateRange(currentTrip.startDate, currentTrip.endDate)}
          </p>
        </div>

        <!-- Hero Embedded Insights Card (Avatar Popover Interactivity) -->
        <div class="hero-insights-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap: var(--space-sm);">
            <div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--color-text-tertiary);">
                Trip Insights & Group Overview
              </div>
              <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); color: var(--color-text-primary); margin-top: 2px;">
                Destination: <strong style="font-family: var(--font-family-mono);">${currentTrip.destinationAirport || 'Not set'}</strong>
                ${currentTrip.returnAirport ? ` · Return: <strong style="font-family: var(--font-family-mono);">${currentTrip.returnAirport}</strong>` : ''}
              </div>
            </div>

            <!-- Overlapping Avatar Ring with Interactive Popover -->
            <div class="avatar-group-wrapper" id="avatar-group-wrapper">
              <div style="display:flex; align-items:center; gap: 8px;">
                <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-weight: 500;">
                  ${participantsList.length} Members
                </span>
                <div class="avatar-group" id="avatar-group-trigger" title="Click to see all members">
                  ${visibleAvatars.map((p, i) => `
                    <div class="avatar-ring" style="background:${PERSON_COLORS_HEX[i % 6]};">
                      ${escapeHtml(p.name.charAt(0).toUpperCase())}
                    </div>
                  `).join('')}
                  ${overflowCount > 0 ? `
                    <div class="avatar-ring avatar-count-ring">
                      +${overflowCount}
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Interactive Popover Panel -->
              <div class="avatar-popover hidden" id="avatar-popover">
                <div class="avatar-popover-header">
                  All Group Members (${participantsList.length})
                </div>
                <div class="avatar-popover-list">
                  ${participantsList.map((p, i) => {
                    const flightCount = (currentTrip.flights || []).filter(f => f.addedBy === p.name).length;
                    return `
                      <div class="avatar-popover-item" data-popover-person="${escapeHtml(p.name)}">
                        <div class="avatar-ring" style="background:${PERSON_COLORS_HEX[i % 6]}; width:22px; height:22px; font-size:9px; margin-left:0;">
                          ${escapeHtml(p.name.charAt(0).toUpperCase())}
                        </div>
                        <span style="font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); flex:1;">${escapeHtml(p.name)}</span>
                        <span style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">${flightCount} flights</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Workspace Tab Bar: Tracking vs Flight Coordination Engine -->
        <div class="tab-container mb-lg">
          <button class="tab-btn ${activeMainTab === 'tracking' ? 'active' : ''}" data-maintab="tracking">
            <span style="display:flex;">${getIcon('plane')}</span> Flight Tracking (${currentTrip.flights?.length || 0})
          </button>
          <button class="tab-btn ${activeMainTab === 'coordination' ? 'active' : ''}" data-maintab="coordination">
            <span style="display:flex;">${getIcon('sparkles')}</span> Coordination Engine
          </button>
        </div>

        <!-- Workspace Section -->
        <div id="main-tab-workspace">
          
          <!-- Flight Tracking Workspace -->
          <div id="tracking-workspace" class="${activeMainTab === 'tracking' ? '' : 'hidden-tab'}">
            
            <!-- Person Filter Bar -->
            <div class="chip-group mb-base" style="flex-wrap: wrap;">
              <div class="chip ${filterPerson === 'all' ? 'active' : ''}" data-person="all">
                All Travelers (${currentTrip.participants.length})
              </div>
              ${currentTrip.participants.map((p, i) => `
                <div class="chip ${filterPerson === p.name ? 'active' : ''}" data-person="${escapeHtml(p.name)}">
                  <span style="width:6px; height:6px; border-radius:50%; background:${PERSON_COLORS[i % 6]}; display:inline-block; margin-right:4px;"></span>
                  ${escapeHtml(p.name)}
                  <button class="chip-delete-btn" data-person-del="${escapeHtml(p.name)}" style="all:unset; cursor:pointer; font-size:12px; opacity:0.4; margin-left:4px;" title="Remove Profile">×</button>
                </div>
              `).join('')}
            </div>

            <!-- Phase & View Sub-Tabs + View Mode Toggle -->
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-sm);" class="mb-base">
              <div class="tabs">
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'all' ? 'active' : ''}" data-tab="flights" data-phase="all">All (${currentTrip.flights.length})</button>
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'outbound' ? 'active' : ''}" data-tab="flights" data-phase="outbound">
                  <span style="color: #34D399; display:flex;">${getIcon('plane')}</span> Outbound (${filteredOutbound})
                </button>
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'return' ? 'active' : ''}" data-tab="flights" data-phase="return">
                  <span style="color: #60A5FA; display:flex;">${getIcon('plane')}</span> Return (${filteredReturn})
                </button>
                <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">
                  <span style="display:flex;">${getIcon('timeline')}</span> Timeline
                </button>
                <button class="tab ${activeTab === 'map' ? 'active' : ''}" data-tab="map">
                  <span style="display:flex;">${getIcon('plane')}</span> Route Map
                </button>
              </div>

              ${activeTab === 'flights' ? `
                <div class="tabs" style="padding: 2px;">
                  <button class="tab ${viewMode === 'compact' ? 'active' : ''}" id="btn-view-compact" title="Compact Ticket Rows" style="padding: 4px 10px; font-size: 11px;">
                    ☰ Compact
                  </button>
                  <button class="tab ${viewMode === 'expanded' ? 'active' : ''}" id="btn-view-expanded" title="Full Flight Cards" style="padding: 4px 10px; font-size: 11px;">
                    🎴 Cards
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Content Stream -->
            <div id="tab-content">
              ${activeTab === 'flights' ? renderFlightsList(sortedFlights, currentTrip, viewMode, expandedFlightIds) : ''}
            </div>

            <!-- Full-Width Bottom Add Flight Button -->
            ${activeTab === 'flights' ? `
              <div style="margin-top: var(--space-lg);">
                <button class="btn btn-primary" id="btn-add-flight-bottom" style="padding: 0.85rem var(--space-lg); font-size: var(--font-size-md);">
                  <span style="display:flex;">${getIcon('plus')}</span> Add Flight
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Coordination Tab -->
          <div id="coordination-tab-content" class="${activeMainTab === 'coordination' ? '' : 'hidden-tab'}">
            <!-- Rendered by renderCoordinationTab -->
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
    } else if (activeMainTab === 'tracking' && activeTab === 'map') {
      const mapContainer = container.querySelector('#tab-content');
      renderRouteMap(mapContainer, sortedFlights, currentTrip.participants, currentTrip, filterPerson);
    }

    // Avatar Popover Interactivity
    const wrapper = container.querySelector('#avatar-group-wrapper');
    const trigger = container.querySelector('#avatar-group-trigger');
    const popover = container.querySelector('#avatar-popover');

    if (wrapper && trigger && popover) {
      const togglePopover = (e) => {
        e.stopPropagation();
        popover.classList.toggle('hidden');
      };

      trigger.addEventListener('click', togglePopover);

      const handleOutsideClick = (e) => {
        if (!wrapper.contains(e.target)) {
          popover.classList.add('hidden');
        }
      };
      document.addEventListener('click', handleOutsideClick);

      container.querySelectorAll('.avatar-popover-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          filterPerson = item.dataset.popoverPerson;
          popover.classList.add('hidden');
          render();
        });
      });
    }

    // View mode toggle handlers
    const btnCompact = container.querySelector('#btn-view-compact');
    const btnExpanded = container.querySelector('#btn-view-expanded');

    if (btnCompact) {
      btnCompact.addEventListener('click', () => {
        viewMode = 'compact';
        render();
      });
    }

    if (btnExpanded) {
      btnExpanded.addEventListener('click', () => {
        viewMode = 'expanded';
        render();
      });
    }

    // Bidirectional Expand / collapse in compact mode
    if (viewMode === 'compact') {
      container.querySelectorAll('[data-flight-toggle-id]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.flight-refresh') || e.target.closest('.flight-delete')) return;
          const flightId = el.dataset.flightToggleId;
          if (!flightId) return;
          if (expandedFlightIds.has(flightId)) {
            expandedFlightIds.delete(flightId);
          } else {
            expandedFlightIds.add(flightId);
          }
          render();
        });
      });
    }

    // Event Listeners
    container.querySelector('#btn-back')?.addEventListener('click', () => {
      stopPolling(tripId);
      unsubscribe();
      navigate('');
    });

    const triggerAddFlight = () => navigate(`add-flight/${tripId}`);
    container.querySelector('#btn-add-flight-top')?.addEventListener('click', triggerAddFlight);
    container.querySelector('#btn-add-flight-bottom')?.addEventListener('click', triggerAddFlight);

    container.querySelector('#btn-notes')?.addEventListener('click', () => navigate(`notes/${tripId}`));

    container.querySelector('#btn-subscribe')?.addEventListener('click', async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zgqjctiuycrhwrstorxw.supabase.co';
      const baseUrl = supabaseUrl.replace(/^https?:\/\//, 'webcal://');
      const subscribeUrl = `${baseUrl}/functions/v1/calendar-feed?tripId=${tripId}&token=${currentTrip.pin}`;
      window.location.href = subscribeUrl;
    });

    container.querySelector('#btn-copy-pin')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(currentTrip.pin).then(() => {
        showToast('PIN copied!', 'success');
      }).catch(() => {
        showToast(`PIN: ${currentTrip.pin}`, 'info');
      });
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

    // Clean Combined Tab Switching Event Delegator
    container.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = tab.dataset.tab;
        const targetPhase = tab.dataset.phase;

        if (targetPhase) {
          activeTab = 'flights';
          phaseFilter = targetPhase;
        } else {
          activeTab = targetTab;
        }
        render();
      });
    });

    container.querySelectorAll('.chip[data-person]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('chip-delete-btn')) return;
        filterPerson = chip.dataset.person;
        render();
      });
    });

    // Handle profile deletion from chip
    container.querySelectorAll('.chip-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const pName = btn.dataset.personDel;
        if (confirm(`Remove ${pName}'s profile from this trip?`)) {
          await deleteParticipant(tripId, pName);
          if (filterPerson === pName) filterPerson = 'all';
          showToast(`Profile ${pName} removed`, 'info');
          render();
        }
      });
    });

    // Refresh flight status
    container.querySelectorAll('.flight-refresh').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        const flight = currentTrip.flights.find(f => f.id === flightId);
        if (!flight) return;

        btn.disabled = true;
        btn.textContent = '⏳';

        const updated = await refreshFlightStatus(flight);
        await updateFlightStatus(tripId, flightId, updated.status);
        emit(EVENTS.FLIGHT_UPDATED);
        showToast(`${flight.flightNumber} status updated: ${updated.status}`, 'success');
        render();
      });
    });

    // Delete flight
    container.querySelectorAll('.flight-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        const flight = currentTrip.flights.find(f => f.id === flightId);
        if (!flight) return;

        if (confirm(`Delete flight ${flight.flightNumber}?`)) {
          await deleteFlight(tripId, flightId);
          emit(EVENTS.FLIGHT_DELETED, flightId);
          showToast(`${flight.flightNumber} deleted`, 'info');
          render();
        }
      });
    });
  }

  render();
}

function renderFlightsList(flights, trip, viewMode = 'compact', expandedFlightIds = new Set()) {
  if (flights.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${getIcon('plane')}</div>
        <h3>No Flights Found</h3>
        <p>Add a flight to start tracking and coordinating your group travel.</p>
      </div>
    `;
  }

  return flights.map(flight => {
    const isExpanded = viewMode === 'expanded' || expandedFlightIds.has(flight.id);
    if (isExpanded) {
      return renderFlightCard(flight, trip.participants, viewMode === 'compact');
    } else {
      return renderCompactFlightRow(flight, trip.participants);
    }
  }).join('');
}

function isOutboundFlight(flight, trip) {
  if (!trip.destinationAirport) return true;
  const dests = trip.destinationAirport.split(',').map(s => s.trim().toUpperCase());
  const arrCode = (flight.arrival?.code || '').toUpperCase();
  return dests.includes(arrCode);
}

function isReturnFlight(flight, trip) {
  if (!trip.destinationAirport) return false;
  return !isOutboundFlight(flight, trip);
}

function formatDateRange(start, end) {
  if (!start) return '';
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', opts);
  const e = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', opts) : '';
  return e ? `${s} — ${e}` : s;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
