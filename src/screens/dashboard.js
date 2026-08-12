/* Dashboard screen */

import { getTrip, updateFlightStatus, getUserNickname, deleteParticipant, deleteFlight } from '../data/dataAdapter.js';
import { subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { renderTimeline } from '../components/timeline.js';
import { renderFlightCard, renderCompactFlightRow } from '../components/flightCard.js';
import { renderCoordinationTab } from '../components/coordinationTab.js';
import { renderRouteMap, destroyRouteMap } from '../components/routeMap.js';
import { startPolling, stopPolling, isPolling, setAutoRefreshPref, getAutoRefreshPref } from '../data/alertService.js';
import { getIcon } from '../components/icons.js';

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

export async function renderDashboard(container, tripId) {
  let filterPerson = 'all';
  let phaseFilter = 'outbound'; // Default tab: 'outbound'
  let activeTab = 'flights'; // 'flights', 'timeline'
  let activeMainTab = 'tracking'; // 'tracking', 'coordination'
  let viewMode = 'compact'; // 'compact' vs 'expanded'
  let expandedFlightIds = new Set(); // Track expanded rows in compact mode

  const trip = await getTrip(tripId);
  if (!trip) {
    showToast('Trip not found', 'error');
    navigate('');
    return;
  }

  // Handle trip deleted / changed events with correct event constants
  const unsubscribe = subscribe((event, data) => {
    if (event === EVENTS.TRIP_DELETED && data === tripId) {
      stopPolling(tripId);
      destroyRouteMap();
      showToast('Trip was deleted', 'info');
      navigate('');
    } else if (
      event === EVENTS.FLIGHT_ADDED ||
      event === EVENTS.FLIGHT_DELETED ||
      event === EVENTS.FLIGHT_UPDATED ||
      event === EVENTS.FLIGHT_STATUS_CHANGED ||
      event === EVENTS.PARTICIPANT_ADDED ||
      event === EVENTS.PARTICIPANT_DELETED
    ) {
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

    container.innerHTML = `
      <div class="screen">

        <!-- Compact Top Navigation Bar -->
        <div class="topbar" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md);">
          <button class="topbar-back" id="btn-back">
            <span style="display:flex;">${getIcon('arrowLeft')}</span> All Trips
          </button>

          <div style="display: flex; align-items: center; gap: var(--space-xs);">
            <!-- Live Auto Refresh Indicator -->
            <button class="btn btn-ghost btn-sm" id="btn-toggle-refresh" title="${isCurrentlyPolling ? 'Live Refresh Active (Polling 30s)' : 'Click to enable live status refresh'}" style="font-family: var(--font-family-mono); font-size: 11px;">
              <span class="live-dot" style="background: ${isCurrentlyPolling ? 'var(--color-success)' : 'var(--color-text-tertiary)'};"></span>
              ${isCurrentlyPolling ? 'LIVE' : 'REFRESH'}
            </button>

            <!-- Add Flight Action -->
            <button class="btn btn-primary btn-sm" id="btn-add-flight">
              <span style="display:flex;">${getIcon('plus')}</span> Add Flight
            </button>

            <!-- Share PIN Trigger -->
            <button class="btn btn-secondary btn-sm" id="btn-share" title="Share Trip Code">
              <span style="display:flex;">${getIcon('share')}</span> PIN
            </button>
          </div>
        </div>

        <!-- Embedded Hero Insights Card -->
        <div class="hero-insights-card">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm);">
            <div>
              <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 4px;">
                <h1 style="font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; color: var(--color-text-primary); margin:0;">
                  ${escapeHtml(currentTrip.name)}
                </h1>
                
                <!-- Shareable PIN Badge Pill -->
                <div class="hero-pin-pill" id="hero-pin-copy-trigger" title="Click to copy PIN code">
                  <span class="hero-pin-label">PIN</span>
                  <span class="hero-pin-code">${escapeHtml(currentTrip.pin || 'PPC')}</span>
                  <span class="hero-pin-copy">${getIcon('copy')}</span>
                </div>
              </div>

              <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span>${currentTrip.startDate || ''} ~ ${currentTrip.endDate || ''}</span>
                <span>·</span>
                <span>Destination: <strong style="font-family: var(--font-family-mono); color: var(--color-text-primary);">${currentTrip.destinationAirport || 'Not Set'}</strong></span>
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
            <span style="display:flex;">${getIcon('plane')}</span> Flights (${currentTrip.flights?.length || 0})
          </button>
          <button class="tab-btn ${activeMainTab === 'coordination' ? 'active' : ''}" data-maintab="coordination">
            <span style="display:flex;">${getIcon('sparkles')}</span> Group Planning
          </button>
        </div>

        <!-- Workspace Section -->
        <div id="main-tab-workspace">
          
          <!-- Flight Tracking Workspace -->
          <div id="tracking-workspace" class="${activeMainTab === 'tracking' ? '' : 'hidden-tab'}">
            
            <!-- Person Filter Bar -->
            <div class="chip-group mb-base">
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

            <!-- Three-Segment Sub-Tabs Bar: Outbound -> Return -> Timeline -->
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-sm);" class="mb-base">
              <div class="tabs">
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'outbound' ? 'active' : ''}" data-tab="flights" data-phase="outbound">
                  <span style="color: #34D399; display:flex;">${getIcon('plane')}</span> Outbound (${filteredOutbound})
                </button>
                <button class="tab ${activeTab === 'flights' && phaseFilter === 'return' ? 'active' : ''}" data-tab="flights" data-phase="return">
                  <span style="color: #60A5FA; display:flex;">${getIcon('plane')}</span> Return (${filteredReturn})
                </button>
                <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">
                  <span style="display:flex;">${getIcon('timeline')}</span> Timeline
                </button>
              </div>
            </div>

            <!-- HERO ROUTE MAP CONTAINER -->
            ${activeTab !== 'timeline' ? `<div id="hero-map-container" class="mb-base"></div>` : ''}

            <!-- Flight List Section Header & Mode Toggles -->
            ${activeTab !== 'timeline' ? `
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-sm);">
                <div style="font-size:12px; font-weight:700; color:var(--color-text-secondary);">
                  Flights (${sortedFlights.length})
                </div>
                <div class="tabs" style="padding: 2px;">
                  <button class="tab ${viewMode === 'compact' ? 'active' : ''}" id="btn-view-compact" title="Compact Ticket Rows" style="padding: 4px 10px; font-size: 11px;">
                    <span style="display:flex;">${getIcon('list')}</span> Compact
                  </button>
                  <button class="tab ${viewMode === 'expanded' ? 'active' : ''}" id="btn-view-expanded" title="Full Flight Cards" style="padding: 4px 10px; font-size: 11px;">
                    <span style="display:flex;">${getIcon('grid')}</span> Cards
                  </button>
                </div>
              </div>
            ` : ''}

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
            <!-- Lazy rendered via renderCoordinationTab -->
          </div>

        </div>

      </div>
    `;

    // Render Hero Route Map if activeTab !== 'timeline'
    if (activeTab !== 'timeline') {
      const heroMapContainer = container.querySelector('#hero-map-container');
      if (heroMapContainer) {
        renderRouteMap(heroMapContainer, sortedFlights, currentTrip.participants || [], currentTrip, filterPerson, phaseFilter);
      }
    } else {
      destroyRouteMap(); // Clean teardown of Leaflet map and 60fps animation frame loop!
      const tabContent = container.querySelector('#tab-content');
      if (tabContent) {
        renderTimeline(tabContent, currentTrip, filterPerson);
      }
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
  }

  function bindEvents() {
    // Topbar back
    container.querySelector('#btn-back')?.addEventListener('click', () => {
      destroyRouteMap();
      unsubscribe();
      navigate('');
    });

    // Share PIN Copy
    const copyPinTrigger = container.querySelector('#hero-pin-copy-trigger');
    const shareBtn = container.querySelector('#btn-share');

    const handleShare = () => {
      const pin = trip.pin || '';

      if (navigator.clipboard) {
        navigator.clipboard.writeText(pin);
        showToast(`PIN Code ${pin} copied to clipboard!`, 'success');
      } else {
        showToast(`PIN Code: ${pin}`, 'info');
      }
    };

    copyPinTrigger?.addEventListener('click', handleShare);
    shareBtn?.addEventListener('click', handleShare);

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

    // Sub-Tabs Bar: Outbound -> Return -> Timeline
    container.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        const targetPhase = tab.getAttribute('data-phase');

        activeTab = targetTab;
        if (targetPhase) {
          phaseFilter = targetPhase;
        }

        render();
      });
    });

    // View Mode Toggles (Compact vs Expanded)
    container.querySelector('#btn-view-compact')?.addEventListener('click', () => {
      viewMode = 'compact';
      render();
    });

    container.querySelector('#btn-view-expanded')?.addEventListener('click', () => {
      viewMode = 'expanded';
      render();
    });

    // Expandable Compact Row Toggle
    container.querySelectorAll('[data-expand-flight]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const flightId = row.getAttribute('data-expand-flight');
        if (expandedFlightIds.has(flightId)) {
          expandedFlightIds.delete(flightId);
        } else {
          expandedFlightIds.add(flightId);
        }
        render();
      });
    });

    // Flight Card Actions (Refresh status & Delete)
    container.querySelectorAll('[data-refresh-flight]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.getAttribute('data-refresh-flight');

        btn.disabled = true;
        btn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Refreshing...`;

        try {
          const result = await updateFlightStatus(tripId, flightId);
          if (result.success) {
            showToast(`Flight status updated: ${result.status}`, 'success');
          } else {
            showToast(`Status refresh: ${result.error}`, 'info');
          }
        } catch (err) {
          showToast('Failed to refresh status', 'error');
        } finally {
          render();
        }
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
 * Render Flight List supporting both Compact (48px) and Expanded (Full Card) views
 */
function renderFlightsList(sortedFlights, trip, viewMode, expandedFlightIds) {
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

  if (viewMode === 'compact') {
    return `
      <div class="compact-flight-list" style="display:flex; flex-direction:column;">
        ${sortedFlights.map(flight => {
      const isExpanded = expandedFlightIds.has(flight.id);
      return renderCompactFlightRow(flight, trip.participants || [], isExpanded);
    }).join('')}
      </div>
    `;
  }

  return sortedFlights.map(flight => renderFlightCard(flight, trip.participants || [])).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
