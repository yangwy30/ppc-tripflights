/* ============================================
   PPC: Delay No More — Commercial Flight Card Component
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
  'boarding': { label: 'Boarding', class: 'badge-accent' }
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

export function renderFlightCard(flight, participants, index, trip) {
  const personIndex = participants.findIndex(p => p.name === flight.addedBy);
  const personColor = PERSON_COLORS[personIndex >= 0 ? personIndex % 6 : 0];
  const statusInfo = STATUS_MAP[flight.status] || STATUS_MAP.scheduled;

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
    <div class="flight-card" style="--flight-person-color: ${personColor};">
      <div class="flight-card-header">
        <div>
          <div style="display:flex; align-items:center; gap: var(--space-sm);">
            <span class="flight-number">${escapeHtml(flight.flightNumber)}</span>
            ${directionBadge}
          </div>
          <div class="flight-airline">${escapeHtml(flight.airline || '')}</div>
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-xs);">
          <span class="badge ${statusInfo.class}"><span class="live-dot"></span>${statusInfo.label}</span>
          <button class="btn btn-icon btn-ghost flight-refresh" data-flight-id="${flight.id}" data-flight-number="${flight.flightNumber}" data-flight-date="${flight.date || ''}" title="Refresh status" style="width:28px;height:28px;font-size:var(--font-size-xs);">${getIcon('refresh')}</button>
        </div>
      </div>

      <div class="flight-route">
        <div class="flight-airport">
          <div class="flight-airport-code">${escapeHtml(depCode)}${getTimezoneBadge(depCode)}</div>
          <div class="flight-airport-city">${escapeHtml(flight.departure?.city || '')}</div>
          <div class="flight-airport-time">${formatTimeWithBadge(flight.departure?.time || '')}</div>
        </div>
        <div class="flight-path">
          <div class="flight-path-icon" style="color: var(--color-accent);">${getIcon('plane')}</div>
          <div class="flight-path-line"></div>
          <div class="flight-path-duration">${escapeHtml(flight.duration || '')}</div>
        </div>
        <div class="flight-airport arrival">
          <div class="flight-airport-code">${escapeHtml(arrCode)}${getTimezoneBadge(arrCode)}</div>
          <div class="flight-airport-city">${escapeHtml(flight.arrival?.city || '')}</div>
          <div class="flight-airport-time">${formatTimeWithBadge(flight.arrival?.time || '')}</div>
        </div>
      </div>

      ${flight.departure?.terminal || flight.arrival?.terminal ? `
        <div style="display:flex; gap: var(--space-lg); font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--space-xs); font-family: var(--font-family-mono);">
          ${flight.departure?.terminal ? `<span>Dep Terminal: ${escapeHtml(flight.departure.terminal)}</span>` : ''}
          ${flight.arrival?.terminal ? `<span>Arr Terminal: ${escapeHtml(flight.arrival.terminal)}</span>` : ''}
        </div>
      ` : ''}

      <div class="flight-meta" style="margin-top: var(--space-sm);">
        <div class="flight-person">
          <span class="flight-person-dot" style="background: ${personColor}"></span>
          ${escapeHtml(flight.addedBy || 'Unknown')}
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-sm);">
          <span class="flight-date" style="font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${flight.date || ''}</span>
          <button class="btn btn-icon btn-ghost flight-delete" data-flight-id="${flight.id}" title="Remove flight" style="width:24px;height:24px;color:var(--color-danger);">${getIcon('trash')}</button>
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
