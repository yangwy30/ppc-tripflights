/* Flight status helpers and the dashboard's unified expandable flight card. */

import { getIcon } from './icons.js';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

const STATUS_MAP = {
  'on-time': { label: 'On Time', class: 'badge-success' },
  scheduled: { label: 'Scheduled', class: 'badge-info' },
  delayed: { label: 'Delayed', class: 'badge-warning' },
  cancelled: { label: 'Cancelled', class: 'badge-danger' },
  landed: { label: 'Landed', class: 'badge-success' },
  arrived: { label: 'Arrived', class: 'badge-success' },
  boarding: { label: 'Boarding', class: 'badge-accent' },
  taxiing: { label: 'Taxiing', class: 'badge-accent' },
  'in-air': { label: 'In Air', class: 'badge-accent' }
};

/**
 * Returns computed flight status based on current time vs departure/arrival.
 */
export function getComputedFlightStatus(flight) {
  if (flight.status && flight.status !== 'scheduled') {
    return flight.status;
  }

  if (!flight.date) return flight.status || 'scheduled';

  try {
    const now = new Date();
    const departureTime = flight.departure?.time || '00:00';
    const arrivalTime = flight.arrival?.time || '23:59';
    const departure = new Date(`${flight.date}T${departureTime}:00`);
    const arrival = new Date(`${flight.date}T${arrivalTime}:00`);

    if (arrival < departure) arrival.setDate(arrival.getDate() + 1);
    if (now > arrival) return 'landed';
    if (now >= departure && now <= arrival) return 'in-air';
    return 'scheduled';
  } catch (error) {
    return flight.status || 'scheduled';
  }
}

function formatTime(time) {
  if (!time) return '--:--';
  const match = String(time).match(/^(\d{1,2}:\d{2})(?:\+(\d+)|-(\d+))?$/);
  if (!match) return escapeHtml(time);

  const offset = match[2] ? `+${match[2]}d` : match[3] ? `-${match[3]}d` : '';
  return `${escapeHtml(match[1])}${offset ? `<small>${offset}</small>` : ''}`;
}

function formatTerminal(value) {
  if (!value) return 'Terminal TBD';
  const raw = String(value).trim();
  const terminal = /^T(?=[A-Z0-9]+$)/i.test(raw) ? raw.slice(1) : raw;
  return `Terminal ${terminal}`;
}

function getInitials(name) {
  const parts = String(name || 'Traveler').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?';
}

function getCardStatus(flight, computedStatus) {
  const delayMinutes = Number(flight.delayMinutes ?? flight.delay ?? flight.delay_minutes);
  if (computedStatus === 'delayed' && Number.isFinite(delayMinutes) && delayMinutes > 0) {
    return `+${Math.round(delayMinutes)}M DELAY`;
  }
  return (STATUS_MAP[computedStatus]?.label || computedStatus || 'Scheduled').toUpperCase();
}

function renderAirportDetail(label, endpoint) {
  const terminalAndGate = [
    formatTerminal(endpoint?.terminal),
    endpoint?.gate ? `Gate ${endpoint.gate}` : ''
  ].filter(Boolean).join(' · ');

  return `
    <div class="flight-expanded-item">
      <span>${label}</span>
      <strong>${escapeHtml(endpoint?.city || endpoint?.code || '—')}</strong>
      <small>${escapeHtml(terminalAndGate || 'Terminal and gate TBD')}</small>
    </div>
  `;
}

export function renderCompactFlightRow(flight, participants, isExpanded = false) {
  const participantList = participants.map(person => typeof person === 'string' ? { name: person } : person);
  const personIndex = participantList.findIndex(person => person.name === flight.addedBy);
  const personColor = PERSON_COLORS[personIndex >= 0 ? personIndex % PERSON_COLORS.length : 0];
  const computedStatus = getComputedFlightStatus(flight);
  const statusInfo = STATUS_MAP[computedStatus] || STATUS_MAP.scheduled;
  const departureCode = flight.departure?.code || 'DEP';
  const arrivalCode = flight.arrival?.code || 'ARR';
  const cardStatus = getCardStatus(flight, computedStatus);
  const arrivalTerminal = formatTerminal(flight.arrival?.terminal);

  return `
    <article class="flight-details-card flight-status-${escapeHtml(computedStatus)} ${isExpanded ? 'is-expanded' : ''}" style="--flight-person-color:${personColor}">
      <button
        type="button"
        class="flight-summary-trigger"
        data-expand-flight="${escapeHtml(flight.id)}"
        aria-expanded="${isExpanded}"
        aria-controls="flight-details-${escapeHtml(flight.id)}"
      >
        <span class="flight-traveler-avatar" aria-hidden="true">${escapeHtml(getInitials(flight.addedBy))}</span>

        <span class="flight-summary-identifiers">
          <strong>${escapeHtml(flight.addedBy || 'Traveler')}</strong>
          <small>${escapeHtml(flight.airline || 'Airline')} · ${escapeHtml(flight.flightNumber || 'Flight')}</small>
        </span>

        <span class="flight-summary-status">
          <strong>${escapeHtml(cardStatus)}</strong>
          <small>${escapeHtml(arrivalTerminal)}</small>
        </span>

        <span class="flight-summary-route">
          <span class="flight-route-endpoint">
            <small>${escapeHtml(departureCode)}</small>
            <strong>${formatTime(flight.departure?.time)}</strong>
          </span>
          <span class="flight-route-track" aria-hidden="true">
            <i>${getIcon('plane')}</i>
          </span>
          <span class="flight-route-endpoint align-right">
            <small>${escapeHtml(arrivalCode)}</small>
            <strong>${formatTime(flight.arrival?.time)}</strong>
          </span>
        </span>
        <span class="flight-summary-chevron" aria-hidden="true">⌄</span>
      </button>

      <div
        class="flight-expanded-shell"
        id="flight-details-${escapeHtml(flight.id)}"
        aria-hidden="${!isExpanded}"
        ${isExpanded ? '' : 'inert'}
      >
        <div class="flight-expanded-clip">
          <div class="flight-expanded-panel">
            <div class="flight-expanded-grid">
              ${renderAirportDetail('Departure', flight.departure)}
              ${renderAirportDetail('Arrival', flight.arrival)}
              <div class="flight-expanded-item">
                <span>Airline</span>
                <strong>${escapeHtml(flight.airline || flight.flightNumber || '—')}</strong>
                <small>${escapeHtml(flight.duration || 'Duration TBD')}</small>
              </div>
              <div class="flight-expanded-item">
                <span>Date</span>
                <strong>${escapeHtml(flight.date || '—')}</strong>
                <small>${escapeHtml(statusInfo.label)}</small>
              </div>
            </div>
            <div class="flight-expanded-footer">
              <span>Added by ${escapeHtml(flight.addedBy || 'Traveler')}</span>
              <button type="button" class="flight-remove-action" data-delete-flight="${escapeHtml(flight.id)}">
                ${getIcon('trash')} Remove flight
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
