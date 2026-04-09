/* ============================================
   PPC: Delay No More — Flight Card Component
   ============================================ */

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

export function renderFlightCard(flight, participants, index, trip) {
  const personIndex = participants.findIndex(p => p.name === flight.addedBy);
  const personColor = PERSON_COLORS[personIndex >= 0 ? personIndex % 6 : 0];
  const statusInfo = STATUS_MAP[flight.status] || STATUS_MAP.scheduled;
  const staggerClass = `stagger-${Math.min(index + 1, 6)}`;

  let directionBadge = '';
  if (trip) {
    const participant = participants[personIndex];
    // Use participant's override if available, otherwise fallback to trip's default
    const destIata = (participant?.destinationAirport || trip.destinationAirport || '').toUpperCase().trim();
    const retIata = (participant?.destinationAirport || trip.returnAirport || '').toUpperCase().trim();

    const arrCode = (flight.arrival?.code || '').toUpperCase().trim();
    const depCode = (flight.departure?.code || '').toUpperCase().trim();

    // Remove empty IATAs before comparing
    if (destIata && arrCode === destIata) {
      directionBadge = `<span style="display:inline-flex; align-items:center; gap:3px; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #16a34a; background: #dcfce7; padding: 2px 8px; border-radius: 999px;">🛫 Outbound</span>`;
    } else if (destIata && depCode === destIata) {
      directionBadge = `<span style="display:inline-flex; align-items:center; gap:3px; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #2563eb; background: #dbeafe; padding: 2px 8px; border-radius: 999px;">🛬 Return</span>`;
    } else if (retIata && depCode === retIata) {
      directionBadge = `<span style="display:inline-flex; align-items:center; gap:3px; font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: #2563eb; background: #dbeafe; padding: 2px 8px; border-radius: 999px;">🛬 Return</span>`;
    }
  }

  return `
    <div class="flight-card ${staggerClass}" style="--flight-person-color: ${personColor};">
      <div class="flight-card-header">
        <div>
          <div style="display:flex; align-items:center; gap: var(--space-sm);">
            <span class="flight-number">${escapeHtml(flight.flightNumber)}</span>
            ${directionBadge}
          </div>
          <div class="flight-airline">${escapeHtml(flight.airline || '')}</div>
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-sm);">
          <span class="badge badge-dot ${statusInfo.class}">${statusInfo.label}</span>
          <button class="btn btn-icon btn-ghost flight-refresh" data-flight-id="${flight.id}" data-flight-number="${flight.flightNumber}" data-flight-date="${flight.date || ''}" title="Refresh status" style="width:32px;height:32px;font-size:var(--font-size-sm);">🔄</button>
        </div>
      </div>

      <div class="flight-route">
        <div class="flight-airport">
          <div class="flight-airport-code">${escapeHtml(flight.departure?.code || '???')}</div>
          <div class="flight-airport-city">${escapeHtml(flight.departure?.city || '')}</div>
          <div class="flight-airport-time">${escapeHtml(flight.departure?.time || '')}</div>
        </div>
        <div class="flight-path">
          <div class="flight-path-icon">✈️</div>
          <div class="flight-path-line"></div>
          <div class="flight-path-duration">${escapeHtml(flight.duration || '')}</div>
        </div>
        <div class="flight-airport arrival">
          <div class="flight-airport-code">${escapeHtml(flight.arrival?.code || '???')}</div>
          <div class="flight-airport-city">${escapeHtml(flight.arrival?.city || '')}</div>
          <div class="flight-airport-time">${escapeHtml(flight.arrival?.time || '')}</div>
        </div>
      </div>

      ${flight.departure?.terminal || flight.arrival?.terminal ? `
        <div style="display:flex; gap: var(--space-lg); font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: var(--space-sm);">
          ${flight.departure?.terminal ? `<span>Dep Terminal: ${escapeHtml(flight.departure.terminal)}</span>` : ''}
          ${flight.arrival?.terminal ? `<span>Arr Terminal: ${escapeHtml(flight.arrival.terminal)}</span>` : ''}
        </div>
      ` : ''}

      <div class="flight-meta">
        <div class="flight-person">
          <span class="flight-person-dot" style="background: ${personColor}"></span>
          ${escapeHtml(flight.addedBy || 'Unknown')}
        </div>
        <div style="display:flex; align-items:center; gap: var(--space-sm);">
          <span class="flight-date">${flight.date || ''}</span>
          <button class="btn btn-icon btn-ghost flight-delete" data-flight-id="${flight.id}" title="Remove flight" style="width:28px;height:28px;font-size:var(--font-size-xs);color:var(--color-danger);">✕</button>
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
