import { getIcon } from './icons.js';

export function renderRecommendationCard(option, index, currentNickname) {
  const travelers = option.flights || [];
  const userEntry = travelers.find(entry => entry.passengerName === currentNickname) || travelers[0];
  const userCost = userEntry
    ? (userEntry.outbound?.price || 0) + (userEntry.inbound?.price || 0)
    : option.totalCost || 0;

  return `
    <article class="coordination-option-card">
      <header class="coordination-option-header">
        <div class="coordination-option-rank">
          <span>${index}</span>
          <div>
            <strong>${index === 1 ? 'Best match' : `Option ${index}`}</strong>
            <small>${escapeHtml(option.maxArrivalDiff || 'Arrival spread unavailable')}</small>
          </div>
        </div>
        <div class="coordination-option-price">
          <strong>${userEntry ? `$${userCost}` : '—'}</strong>
          <small>Your fare</small>
        </div>
      </header>

      <div class="coordination-option-legs">
        ${renderLeg('Outbound', userEntry?.outbound)}
        ${userEntry?.inbound?.airline ? renderLeg('Inbound', userEntry.inbound) : ''}
      </div>

      <details class="coordination-group-details">
        <summary>Group alignment · ${travelers.length} traveler${travelers.length === 1 ? '' : 's'}</summary>
        <div class="coordination-group-list">
          ${travelers.map(entry => renderTravelerAlignment(entry, currentNickname)).join('')}
        </div>
      </details>

      <footer class="coordination-option-actions">
        ${userEntry ? `
          <button class="btn btn-add-trip" data-entry="${encodeURIComponent(JSON.stringify(userEntry))}">
            ${getIcon('check')} Add to Trip
          </button>
        ` : ''}
        <a href="${buildGoogleFlightsUrl(userEntry?.outbound, userEntry?.inbound)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          View flights ${getIcon('arrowRight')}
        </a>
      </footer>
    </article>
  `;
}

function renderLeg(label, flight) {
  if (!flight?.airline) return '';
  return `
    <div class="coordination-leg">
      <span>${label}</span>
      <strong>${escapeHtml(flight.origin)} <i>→</i> ${escapeHtml(flight.destination)}</strong>
      <small>${formatTime(flight.departureTime)} – ${formatTime(flight.arrivalTime)} · ${escapeHtml(flight.flightNumber || flight.airline)}</small>
    </div>
  `;
}

function renderTravelerAlignment(entry, currentNickname) {
  const outbound = entry.outbound;
  const inbound = entry.inbound;
  return `
    <div class="coordination-group-row ${entry.passengerName === currentNickname ? 'is-current' : ''}">
      <strong>${escapeHtml(entry.passengerName || 'Traveler')}</strong>
      <span>${outbound ? `${escapeHtml(outbound.origin)} → ${escapeHtml(outbound.destination)} · ${formatTime(outbound.arrivalTime)}` : 'No outbound option'}</span>
      <small>${inbound?.airline ? `Back ${formatTime(inbound.departureTime)}` : ''}</small>
    </div>
  `;
}

function buildGoogleFlightsUrl(outbound, inbound) {
  if (!outbound) return 'https://www.google.com/travel/flights';
  const origin = (outbound.origin || '').substring(0, 3).toUpperCase();
  const destination = (outbound.destination || '').substring(0, 3).toUpperCase();
  const date = outbound.date || new Date().toISOString().split('T')[0];
  if (!origin || !destination) return 'https://www.google.com/travel/flights';

  const query = inbound?.date
    ? `Flights from ${origin} to ${destination} on ${date} through ${inbound.date}`
    : `Flights from ${origin} to ${destination} on ${date}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

function formatTime(value) {
  if (!value) return '—';
  return escapeHtml(String(value).replace(/([+-]\d+)$/, ' $1d'));
}

function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
