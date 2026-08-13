/* Flight Card Component — Flighty Boarding Pass Redesign */

import { getIcon } from './icons.js';

const PERSON_COLORS = [
  'var(--person-1)', 'var(--person-2)', 'var(--person-3)',
  'var(--person-4)', 'var(--person-5)', 'var(--person-6)'
];

const STATUS_MAP = {
  'on-time': { label: 'On Time', class: 'badge-success' },
  'scheduled': { label: 'Scheduled', class: 'badge-info' },
  'delayed': { label: 'Delayed', class: 'badge-warning' },
  'cancelled': { label: 'Cancelled', class: 'badge-danger' },
  'landed': { label: 'Landed', class: 'badge-success' },
  'boarding': { label: 'Boarding', class: 'badge-accent' },
  'in-air': { label: 'In Air', class: 'badge-accent' }
};

const AIRPORT_TIMEZONES = {
  JFK: 'EST', EWR: 'EST', LGA: 'EST', BOS: 'EST', MIA: 'EST', MCO: 'EST', IAD: 'EST', ATL: 'EST',
  ORD: 'CST', DFW: 'CST', IAH: 'CST', MSP: 'CST', DTW: 'EST', MDW: 'CST',
  DEN: 'MST', SLC: 'MST', PHX: 'MST',
  LAX: 'PST', SFO: 'PST', SEA: 'PST', SAN: 'PST', SJC: 'PST', OAK: 'PST', LAS: 'PST',
  LHR: 'GMT', LGW: 'GMT', CDG: 'CET', FRA: 'CET', AMS: 'CET', FCO: 'CET', MUC: 'CET',
  DXB: 'GST', SIN: 'SGT', HND: 'JST', NRT: 'JST', ICN: 'KST', HKG: 'HKT', PEK: 'CST', PVG: 'CST',
  SYD: 'AEST', MEL: 'AEST'
};

/**
 * Returns computed flight status based on current time vs departure/arrival
 */
export function getComputedFlightStatus(flight) {
  if (flight.status && flight.status !== 'scheduled') {
    return flight.status;
  }

  if (!flight.date) return flight.status || 'scheduled';

  const now = new Date();

  try {
    const depTime = flight.departure?.time || '00:00';
    const arrTime = flight.arrival?.time || '23:59';

    const depDateTime = new Date(`${flight.date}T${depTime}:00`);
    let arrDateTime = new Date(`${flight.date}T${arrTime}:00`);

    if (arrDateTime < depDateTime) {
      arrDateTime.setDate(arrDateTime.getDate() + 1);
    }

    if (now > arrDateTime) {
      return 'landed'; // Flight has already arrived!
    } else if (now >= depDateTime && now <= arrDateTime) {
      return 'in-air'; // Currently in flight!
    } else {
      return 'scheduled'; // Future flight
    }
  } catch (e) {
    return flight.status || 'scheduled';
  }
}

/**
 * Calculates in-flight progress percentage (0 - 100%)
 */
function getFlightProgressPercentage(flight) {
  if (!flight.date || !flight.departure?.time || !flight.arrival?.time) return 50;

  const now = new Date();
  try {
    const depDateTime = new Date(`${flight.date}T${flight.departure.time}:00`);
    let arrDateTime = new Date(`${flight.date}T${flight.arrival.time}:00`);
    if (arrDateTime < depDateTime) arrDateTime.setDate(arrDateTime.getDate() + 1);

    const total = arrDateTime.getTime() - depDateTime.getTime();
    const elapsed = now.getTime() - depDateTime.getTime();
    if (total <= 0) return 50;

    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return Math.round(pct);
  } catch (e) {
    return 50;
  }
}

function getTimezoneBadge(iataCode) {
  if (!iataCode) return '';
  const tz = AIRPORT_TIMEZONES[iataCode.toUpperCase().trim()];
  return tz ? `<span style="font-size: 10px; opacity: 0.6; font-family: var(--font-family-mono); margin-left: 2px;">(${tz})</span>` : '';
}

function formatTimeWithBadge(timeStr) {
  if (!timeStr) return '--:--';
  const match = timeStr.match(/^(\d{2}:\d{2})(\+(\d+)|-(\d+))?$/);
  if (!match) return escapeHtml(timeStr);

  const baseTime = match[1];
  const daysOffset = match[3] ? `+${match[3]}d` : match[4] ? `-${match[4]}d` : '';

  if (daysOffset) {
    return `${escapeHtml(baseTime)} <span style="font-size: 0.65rem; background: rgba(245, 158, 11, 0.15); color: #F59E0B; padding: 1px 4px; border-radius: 4px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3);">${daysOffset}</span>`;
  }
  return escapeHtml(baseTime);
}

export function renderFlightCard(flight, participants, index, trip, isExpandedInCompactMode = false) {
  const personIndex = participants.findIndex(p => p.name === flight.addedBy);
  const personColor = PERSON_COLORS[personIndex >= 0 ? personIndex % 6 : 0];

  const computedStatus = getComputedFlightStatus(flight);
  const statusInfo = STATUS_MAP[computedStatus] || STATUS_MAP.scheduled;

  let directionBadge = '';
  if (trip) {
    const participant = participants[personIndex];
    const destIata = (participant?.destinationAirport || trip.destinationAirport || '').toUpperCase().trim();
    const retIata = (participant?.destinationAirport || trip.returnAirport || '').toUpperCase().trim();

    const arrCode = (flight.arrival?.code || '').toUpperCase().trim();
    const depCode = (flight.departure?.code || '').toUpperCase().trim();

    if (destIata && arrCode === destIata) {
      directionBadge = `<span class="badge-outbound" style="font-size:10px; padding:2px 6px;">Outbound</span>`;
    } else if (destIata && depCode === destIata) {
      directionBadge = `<span class="badge-return" style="font-size:10px; padding:2px 6px;">Return</span>`;
    } else if (retIata && depCode === retIata) {
      directionBadge = `<span class="badge-return" style="font-size:10px; padding:2px 6px;">Return</span>`;
    }
  }

  const depCode = flight.departure?.code || '???';
  const arrCode = flight.arrival?.code || '???';
  const isLiveInAir = computedStatus === 'in-air';
  const progressPct = isLiveInAir ? getFlightProgressPercentage(flight) : 0;

  return `
    <div class="boarding-pass-card ${isExpandedInCompactMode ? 'flight-card-expanded-in-compact' : ''}" data-flight-toggle-id="${flight.id}" style="border-left: 3px solid ${personColor};">
      
      <!-- Ticket Header -->
      <div class="ticket-header">
        <div class="ticket-airline-tag">
          <span class="airline-badge">${escapeHtml(flight.flightNumber)}</span>
          <span style="font-size: 12px; font-weight: 600; color: var(--color-text-secondary);">${escapeHtml(flight.airline || '')}</span>
          ${directionBadge}
        </div>
        
        <div style="display:flex; align-items:center; gap: 6px;">
          ${isExpandedInCompactMode ? `
            <button class="btn btn-sm btn-secondary flight-collapse-btn" data-flight-collapse-id="${flight.id}" style="padding: 2px 6px; font-size: 10px;">
              ▲ Collapse
            </button>
          ` : ''}
          <span class="badge ${statusInfo.class}" style="font-size: 11px;"><span class="live-dot"></span>${statusInfo.label}</span>
          <button class="btn btn-icon btn-ghost flight-refresh" data-flight-id="${flight.id}" data-flight-number="${flight.flightNumber}" data-flight-date="${flight.date || ''}" title="Refresh flight status" style="width:26px;height:26px;font-size:11px;">${getIcon('refresh')}</button>
        </div>
      </div>

      <!-- Ticket Route Display -->
      <div class="ticket-route-display">
        <div class="ticket-airport-node">
          <div class="iata-code">${escapeHtml(depCode)}${getTimezoneBadge(depCode)}</div>
          <div class="airport-city">${escapeHtml(flight.departure?.city || 'Origin')}</div>
          <div class="time-display">${formatTimeWithBadge(flight.departure?.time)}</div>
        </div>

        <div class="ticket-flight-vector">
          ${flight.duration ? `<div class="flight-duration-badge">${escapeHtml(flight.duration)}</div>` : ''}
          <div class="flight-vector-line">
            <div class="flight-icon-center">
              <span style="display:flex; transform: rotate(90deg); font-size:11px;">✈</span>
            </div>
          </div>
        </div>

        <div class="ticket-airport-node align-right">
          <div class="iata-code">${escapeHtml(arrCode)}${getTimezoneBadge(arrCode)}</div>
          <div class="airport-city">${escapeHtml(flight.arrival?.city || 'Destination')}</div>
          <div class="time-display">${formatTimeWithBadge(flight.arrival?.time)}</div>
        </div>
      </div>

      <!-- Live Flight Progress Bar (Active Flight) -->
      ${isLiveInAir ? `
        <div class="live-progress-container">
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; font-family:var(--font-family-mono); font-weight:700; color:#38BDF8;">
            <span>LIVE FLIGHT EN ROUTE</span>
            <span>${progressPct}% COMPLETED</span>
          </div>
          <div class="live-progress-bar-bg">
            <div class="live-progress-bar-fill" style="width: ${progressPct}%;"></div>
          </div>
        </div>
      ` : ''}

      <!-- Ticket Footer Meta Grid -->
      <div class="ticket-footer-meta">
        <div class="meta-item">
          <span class="meta-label">Traveler</span>
          <div class="ticket-person-pill" style="margin-top:2px;">
            <span style="width:6px; height:6px; border-radius:50%; background:${personColor}; display:inline-block;"></span>
            <span>${escapeHtml(flight.addedBy || 'Unknown')}</span>
          </div>
        </div>

        <div class="meta-item">
          <span class="meta-label">Date</span>
          <span class="meta-value">${escapeHtml(flight.date || '--')}</span>
        </div>

        ${flight.departure?.terminal ? `
          <div class="meta-item">
            <span class="meta-label">Terminal</span>
            <span class="meta-value">Term ${escapeHtml(flight.departure.terminal)}</span>
          </div>
        ` : ''}

        ${flight.departure?.gate ? `
          <div class="meta-item">
            <span class="meta-label">Gate</span>
            <span class="meta-value">${escapeHtml(flight.departure.gate)}</span>
          </div>
        ` : ''}

        <div class="meta-item" style="align-items:flex-end; justify-content:flex-end;">
          <button class="btn btn-icon btn-ghost flight-delete" data-flight-id="${flight.id}" title="Remove ticket" style="color:var(--color-danger); opacity:0.6; width:26px; height:26px;">${getIcon('trash')}</button>
        </div>
      </div>

    </div>
  `;
}

export function renderCompactFlightRow(flight, participants, isExpanded = false) {
  const personIndex = participants.findIndex(p => p.name === flight.addedBy);
  const personColor = PERSON_COLORS[personIndex >= 0 ? personIndex % 6 : 0];

  const computedStatus = getComputedFlightStatus(flight);
  const statusInfo = STATUS_MAP[computedStatus] || STATUS_MAP.scheduled;

  if (isExpanded) {
    return renderFlightCard(flight, participants, 0, null, true);
  }

  const depCode = flight.departure?.code || '???';
  const arrCode = flight.arrival?.code || '???';

  return `
    <div class="ticket-row-compact" data-expand-flight="${flight.id}" style="border-left: 3px solid ${personColor};">
      <div style="display:flex; align-items:center; gap: 8px;">
        <span class="badge ${statusInfo.class}" style="font-size:10px; padding: 2px 6px;"><span class="live-dot"></span>${statusInfo.label}</span>
        <span class="airline-badge" style="font-size:10px; padding: 1px 6px;">${escapeHtml(flight.flightNumber)}</span>
      </div>

      <div style="display:flex; align-items:center; gap: 8px; font-family: var(--font-family-mono); font-size: 13px; font-weight: 800; color: #FFFFFF;">
        <span>${escapeHtml(depCode)}</span>
        <span style="font-size:11px; font-weight:500; color:var(--color-text-tertiary);">${escapeHtml(flight.departure?.time || '')}</span>
        <span style="color: #38BDF8; font-size: 10px;">➔</span>
        <span>${escapeHtml(arrCode)}</span>
        <span style="font-size:11px; font-weight:500; color:var(--color-text-tertiary);">${escapeHtml(flight.arrival?.time || '')}</span>
      </div>

      <div style="display:flex; align-items:center; gap: 8px; flex-shrink:0;">
        <div class="ticket-person-pill" style="font-size:10px; padding:2px 8px;">
          <span style="width:6px; height:6px; border-radius:50%; background:${personColor}; display:inline-block;"></span>
          <span style="max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(flight.addedBy || 'Unknown')}</span>
        </div>

        <button class="btn btn-icon btn-ghost flight-refresh" data-refresh-flight="${flight.id}" title="Refresh status" style="width:22px;height:22px;font-size:10px;padding:0;">${getIcon('refresh')}</button>
        <button class="btn btn-icon btn-ghost flight-delete" data-delete-flight="${flight.id}" title="Remove ticket" style="width:22px;height:22px;color:var(--color-danger);font-size:10px;padding:0;">${getIcon('trash')}</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
