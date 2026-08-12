/* ============================================
   PPC: Delay No More — Commercial Flight Card Component
   Dynamic Time-Based Flight Status Resolver (Landed / In-Air / Scheduled / Delayed)
   ============================================ */

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
 * Universal Time-Based Dynamic Flight Status Resolver
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

function getTimezoneBadge(iataCode) {
  if (!iataCode) return '';
  const tz = AIRPORT_TIMEZONES[iataCode.toUpperCase().trim()];
  return tz ? `<span class="flight-tz">(${tz})</span>` : '';
}

function formatTimeWithBadge(timeStr) {
  if (!timeStr) return '';
  const match = timeStr.match(/^(\d{2}:\d{2})(\+(\d+)|-(\d+))?$/);
  if (!match) return escapeHtml(timeStr);

  const baseTime = match[1];
  const daysOffset = match[3] ? `+${match[3]}d` : match[4] ? `-${match[4]}d` : '';

  if (daysOffset) {
    return `${escapeHtml(baseTime)} <span style="font-size: 0.7rem; background: rgba(245, 158, 11, 0.15); color: #F59E0B; padding: 1px 5px; border-radius: 4px; font-weight: 700; margin-left: 2px; border: 1px solid rgba(245, 158, 11, 0.3);">${daysOffset}</span>`;
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
      directionBadge = `<span class="badge-outbound">Outbound</span>`;
    } else if (destIata && depCode === destIata) {
      directionBadge = `<span class="badge-return">Return</span>`;
    } else if (retIata && depCode === retIata) {
      directionBadge = `<span class="badge-return">Return</span>`;
    }
  }

  const depCode = flight.departure?.code || '???';
  const arrCode = flight.arrival?.code || '???';

  return `
    <div class="flight-card ${isExpandedInCompactMode ? 'flight-card-expanded-in-compact' : ''}" data-flight-toggle-id="${flight.id}" style="--flight-person-color: ${personColor}; ${isExpandedInCompactMode ? 'cursor:pointer; border-color: rgba(10, 132, 255, 0.4);' : ''}">
      <div class="flight-card-header">
        <div>
          <div style="display:flex; align-items:center; gap: var(--space-sm);">
            <span class="flight-number">${escapeHtml(flight.flightNumber)}</span>
            ${directionBadge}
          </div>
          <div class="flight-airline">${escapeHtml(flight.airline || '')}</div>
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-xs);">
          ${isExpandedInCompactMode ? `
            <button class="btn btn-sm btn-secondary flight-collapse-btn" data-flight-collapse-id="${flight.id}" style="padding: 2px 8px; font-size: 10px; margin-right: 4px;">
              ▲ Collapse
            </button>
          ` : ''}
          <span class="badge ${statusInfo.class}"><span class="live-dot"></span>${statusInfo.label}</span>
          <button class="btn btn-icon btn-ghost flight-refresh" data-flight-id="${flight.id}" data-flight-number="${flight.flightNumber}" data-flight-date="${flight.date || ''}" title="Refresh status" style="width:28px;height:28px;font-size:var(--font-size-xs);">${getIcon('refresh')}</button>
        </div>
      </div>

      <div class="flight-route">
        <div class="flight-airport">
          <div class="flight-airport-code">${escapeHtml(depCode)}${getTimezoneBadge(depCode)}</div>
          <div class="flight-airport-city">${escapeHtml(flight.departure?.city || '')}</div>
          <div class="flight-time">${formatTimeWithBadge(flight.departure?.time)}</div>
          ${flight.departure?.terminal ? `<div class="flight-terminal">Term ${escapeHtml(flight.departure.terminal)}</div>` : ''}
        </div>

        <div class="flight-arrow" style="flex:1; text-align:center;">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono); font-weight:700;">${escapeHtml(flight.duration || '')}</div>
          <div style="color: var(--color-accent); margin: 2px 0;">➔</div>
          <div style="font-size: 10px; color: var(--color-text-tertiary);">${escapeHtml(flight.date || '')}</div>
        </div>

        <div class="flight-airport" style="text-align: right;">
          <div class="flight-airport-code">${escapeHtml(arrCode)}${getTimezoneBadge(arrCode)}</div>
          <div class="flight-airport-city">${escapeHtml(flight.arrival?.city || '')}</div>
          <div class="flight-time">${formatTimeWithBadge(flight.arrival?.time)}</div>
          ${flight.arrival?.terminal ? `<div class="flight-terminal">Term ${escapeHtml(flight.arrival.terminal)}</div>` : ''}
        </div>
      </div>

      <div class="flight-card-footer">
        <div class="flight-person">
          <span class="flight-person-dot" style="background: ${personColor};"></span>
          <span>${escapeHtml(flight.addedBy || 'Unknown')}</span>
        </div>
        <div class="flight-actions">
          <button class="btn btn-icon btn-ghost flight-delete" data-flight-id="${flight.id}" title="Remove flight">${getIcon('trash')}</button>
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

  let directionBadge = '';
  const depCode = flight.departure?.code || '???';
  const arrCode = flight.arrival?.code || '???';

  return `
    <div class="flight-row-compact" data-expand-flight="${flight.id}" style="--flight-person-color: ${personColor}; cursor: pointer;">
      <div class="flight-row-compact-inner">
        <span class="badge ${statusInfo.class}" style="font-size:10px; padding: 2px 6px;"><span class="live-dot"></span>${statusInfo.label}</span>
        
        <span class="flight-number" style="font-size: var(--font-size-xs); font-weight:700;">${escapeHtml(flight.flightNumber)}</span>
        
        ${directionBadge}

        <div style="display:flex; align-items:center; gap: 5px; font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-primary); margin-left: auto;">
          <span style="font-weight:700;">${escapeHtml(depCode)}</span>
          <span style="color: var(--color-text-tertiary);">${escapeHtml(flight.departure?.time || '')}</span>
          <span style="color: var(--color-accent); font-size:10px;">➔</span>
          <span style="font-weight:700;">${escapeHtml(arrCode)}</span>
          <span style="color: var(--color-text-tertiary);">${escapeHtml(flight.arrival?.time || '')}</span>
          ${flight.duration ? `<span style="color: var(--color-text-tertiary); opacity: 0.6; font-size:10px;">(${escapeHtml(flight.duration)})</span>` : ''}
        </div>

        <div class="flight-person" style="font-size: 11px; margin-left: 10px; gap: 4px; flex-shrink: 0;">
          <span class="flight-person-dot" style="background: ${personColor}; width: 6px; height: 6px;"></span>
          <span style="color: var(--color-text-secondary); max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(flight.addedBy || 'Unknown')}</span>
        </div>

        <div style="display:flex; align-items:center; gap: 2px; margin-left: 6px; flex-shrink: 0;">
          <button class="btn btn-icon btn-ghost flight-refresh" data-refresh-flight="${flight.id}" title="Refresh status" style="width:22px;height:22px;font-size:10px;padding:0;">${getIcon('refresh')}</button>
          <button class="btn btn-icon btn-ghost flight-delete" data-delete-flight="${flight.id}" title="Remove flight" style="width:22px;height:22px;color:var(--color-danger);font-size:10px;padding:0;">${getIcon('trash')}</button>
        </div>
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
