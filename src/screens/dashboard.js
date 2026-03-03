/* ============================================
   PPC Trip Tracker — Dashboard Screen
   ============================================ */

import { getTrip, getUserNickname, deleteFlight, restoreFlight, deleteTrip, exportTripSummary } from '../data/dataAdapter.js';
import { emit, subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { refreshFlightStatus } from '../data/flightService.js';
import { updateFlightStatus } from '../data/dataAdapter.js';
import { renderTimeline } from '../components/timeline.js';
import { renderFlightCard } from '../components/flightCard.js';
import { startPolling, stopPolling, requestNotificationPermission, isPolling, getAutoRefreshPref, setAutoRefreshPref } from '../data/alertService.js';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

export async function renderDashboard(container, tripId) {
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);
  let activeTab = 'flights';
  let filterPerson = 'all';

  // Start auto-refresh polling for this trip if enabled
  if (getAutoRefreshPref(tripId)) {
    startPolling(tripId);
  }

  // Listen for status changes from the alert service to auto-update the UI
  const unsubscribe = subscribe(EVENTS.FLIGHT_STATUS_CHANGED, (data) => {
    if (data.tripId === tripId) {
      showToast(`${data.flightId ? '✈️' : ''} Flight status changed to ${data.newStatus}`, 'flight');
      render();
    }
  });

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;

    const filteredFlights = filterPerson === 'all'
      ? currentTrip.flights
      : currentTrip.flights.filter(f => f.addedBy === filterPerson);

    // Sort flights by date then departure time
    const sortedFlights = [...filteredFlights].sort((a, b) => {
      const dateCompare = (a.date || '').localeCompare(b.date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.departure?.time || '').localeCompare(b.departure?.time || '');
    });

    const alertsActive = isPolling(tripId);
    const notifPermission = 'Notification' in window ? Notification.permission : 'unsupported';

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="topbar-back" id="btn-back">← Trips</button>
          <div class="topbar-actions">
            <button class="btn btn-sm btn-ghost" id="btn-notes" title="Notes">📝</button>
            <button class="btn btn-sm btn-ghost" id="btn-share" title="Share">📤</button>
            <button class="btn btn-sm btn-ghost" id="btn-delete-trip" title="Delete Trip" style="color: var(--color-danger);">🗑</button>
          </div>
        </div>

        <div class="screen-header" style="margin-bottom: var(--space-base);">
          <h2>${escapeHtml(currentTrip.name)}</h2>
          <p style="font-size: var(--font-size-sm);">📅 ${formatDateRange(currentTrip.startDate, currentTrip.endDate)}</p>
        </div>

        <!-- PIN Display -->
        <div class="pin-display mb-base">
          <div>
            <div class="pin-label">Share PIN</div>
            <div class="pin-code">${currentTrip.pin}</div>
          </div>
          <button class="pin-copy" id="btn-copy-pin" title="Copy PIN">📋</button>
        </div>

        <!-- Alerts Status -->
        <div class="card mb-base" style="padding: var(--space-sm) var(--space-base); display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap: var(--space-sm); flex:1;">
            <span style="font-size: var(--font-size-md);">🔔</span>
            <div>
              <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">
                Auto-Refresh ${alertsActive ? '● Active' : '○ Off'}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">
                ${alertsActive ? 'Checking every 15 min' : 'Flight status updates paused'}
                ${notifPermission === 'granted' ? ' · Notifications on' : notifPermission === 'denied' ? ' · Notifications blocked' : ''}
              </div>
            </div>
          </div>
          <div style="display:flex; gap: var(--space-xs);">
            <button class="btn btn-sm ${alertsActive ? 'btn-ghost' : 'btn-secondary'}" id="btn-toggle-refresh" style="color: ${alertsActive ? 'var(--color-danger)' : 'var(--color-accent)'};">
              ${alertsActive ? 'Turn Off' : 'Turn On'}
            </button>
            ${!alertsActive && notifPermission !== 'granted' && notifPermission !== 'denied' ? `
              <button class="btn btn-sm btn-secondary" id="btn-enable-notif">🔔 Alerts</button>
            ` : ''}
          </div>
        </div>

        <!-- Travelers -->
        <div class="chip-group mb-base">
          <button class="chip ${filterPerson === 'all' ? 'active' : ''}" data-person="all">All</button>
          ${currentTrip.participants.map((p, i) => `
            <button class="chip ${filterPerson === p.name ? 'active' : ''}" data-person="${escapeHtml(p.name)}">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${PERSON_COLORS[i % 6]};margin-right:4px;"></span>
              ${escapeHtml(p.name)}
            </button>
          `).join('')}
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab ${activeTab === 'flights' ? 'active' : ''}" data-tab="flights">✈️ Flights</button>
          <button class="tab ${activeTab === 'timeline' ? 'active' : ''}" data-tab="timeline">📊 Timeline</button>
        </div>

        <!-- Content -->
        <div id="tab-content">
          ${activeTab === 'flights' ? renderFlightsList(sortedFlights, currentTrip) : ''}
        </div>

        <!-- Add Flight FAB -->
        <div style="position: fixed; bottom: calc(var(--space-xl) + var(--safe-area-bottom)); left:50%; transform:translateX(-50%); width: calc(var(--max-width) - var(--space-2xl));">
          <button class="btn btn-primary" id="btn-add-flight" style="box-shadow: var(--shadow-lg);">
            ＋ Add Flight
          </button>
        </div>
      </div>
    `;

    // Render timeline if active tab
    if (activeTab === 'timeline') {
      const timelineContainer = container.querySelector('#tab-content');
      renderTimeline(timelineContainer, sortedFlights, currentTrip.participants);
    }

    // --- Event Listeners ---
    container.querySelector('#btn-back').addEventListener('click', () => {
      stopPolling(tripId);
      unsubscribe();
      navigate('');
    });
    container.querySelector('#btn-add-flight').addEventListener('click', () => navigate(`add-flight/${tripId}`));
    container.querySelector('#btn-notes').addEventListener('click', () => navigate(`notes/${tripId}`));

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

    // Toggle auto-refresh
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

    // Enable notifications button
    const enableNotifBtn = container.querySelector('#btn-enable-notif');
    if (enableNotifBtn) {
      enableNotifBtn.addEventListener('click', async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
          showToast('✅ Delay alerts enabled!', 'success');
        } else {
          showToast('Notifications were blocked', 'warning');
        }
        render();
      });
    }

    // Tab switching
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render();
      });
    });

    // Person filter
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filterPerson = chip.dataset.person;
        render();
      });
    });

    // Flight card actions — delete with undo
    container.querySelectorAll('.flight-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        // Save the flight before deleting so we can restore it
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

    // Refresh status
    container.querySelectorAll('.flight-refresh').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const flightId = btn.dataset.flightId;
        const flightNum = btn.dataset.flightNumber;
        btn.textContent = '⏳';
        const newStatus = await refreshFlightStatus(flightNum);
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
        <div class="empty-state-icon">✈️</div>
        <h3>No flights yet</h3>
        <p>Add your first flight to start tracking</p>
      </div>
    `;
  }

  return flights.map((flight, i) => renderFlightCard(flight, trip.participants, i)).join('');
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
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
