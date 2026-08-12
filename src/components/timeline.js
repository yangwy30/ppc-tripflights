/* ============================================
   PPC: Delay No More — Commercial Timeline Component
   ============================================ */

import { getIcon } from './icons.js';

const PERSON_COLORS_HEX = [
  '#0A84FF', '#34C759', '#F59E0B',
  '#A855F7', '#EC4899', '#38BDF8'
];

export function renderTimeline(container, flights, participants) {
  if (!flights || flights.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" style="display:flex; justify-content:center;">${getIcon('timeline')}</div>
        <h3>No flights on timeline</h3>
        <p>Add flights to see them visualized across dates</p>
      </div>
    `;
    return;
  }

  // Determine total date range from flights
  const allDates = flights.map(f => f.date).filter(Boolean).sort();
  const startDate = allDates[0];
  const endDate = allDates[allDates.length - 1];

  const dateList = [];
  if (startDate && endDate) {
    let d = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (d <= end) {
      dateList.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
  }
  if (dateList.length === 0) dateList.push(new Date().toISOString().split('T')[0]);

  const totalDays = dateList.length;
  const dayWidthPx = Math.max(180, totalDays <= 3 ? 0 : 180);
  const totalWidthPx = totalDays <= 3 ? '100%' : `${totalDays * dayWidthPx}px`;

  // Group flights by person
  const personFlights = {};
  participants.forEach(p => { personFlights[p.name] = []; });
  flights.forEach(f => {
    const name = f.addedBy || 'Unknown';
    if (!personFlights[name]) personFlights[name] = [];
    personFlights[name].push(f);
  });

  let html = '<div class="tl-wrapper">';

  // Legend Header
  html += '<div class="tl-legend">';
  participants.forEach((p, i) => {
    html += `
      <div class="tl-legend-item">
        <span class="tl-legend-dot" style="background:${PERSON_COLORS_HEX[i % 6]};"></span>
        <span>${escapeHtml(p.name)}</span>
      </div>
    `;
  });
  html += '<div class="tl-legend-hint">↔ Scroll timeline · Tap a flight bar for details</div>';
  html += '</div>';

  // Scrollable container
  html += `<div class="tl-scroll">`;
  html += `<div class="tl-canvas" style="min-width: ${totalWidthPx}; position: relative;">`;

  // Date Headers with 6-hour markers cleanly underneath
  html += '<div class="tl-date-row">';
  dateList.forEach((date) => {
    const widthPct = (100 / totalDays);
    html += `
      <div class="tl-date-cell" style="width:${widthPct}%;">
        <div class="tl-date-label">${formatDateShort(date)}</div>
        <div class="tl-hour-subrow">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
        </div>
      </div>
    `;
  });
  html += '</div>';

  // Background Grid Lines
  html += '<div class="tl-grid">';
  dateList.forEach((date, dayIdx) => {
    const dayStartPct = (dayIdx / totalDays) * 100;
    const dayWidthPct = 100 / totalDays;
    for (let h = 0; h <= 24; h += 6) {
      const xPct = dayStartPct + (h / 24) * dayWidthPct;
      html += `<div class="tl-grid-line" style="left:${xPct}%;"></div>`;
    }
  });
  html += '</div>';

  // Person rows
  participants.forEach((person, personIdx) => {
    const color = PERSON_COLORS_HEX[personIdx % 6];
    const pFlights = personFlights[person.name] || [];
    if (pFlights.length === 0) return;

    html += `<div class="tl-person-row">`;
    html += `<div class="tl-person-label">
      <span class="tl-person-dot" style="background:${color};"></span>
      <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(person.name)}</span>
    </div>`;
    html += `<div class="tl-person-bars">`;

    pFlights.forEach((flight) => {
      const depHour = parseTime(flight.departure?.time);
      const arrHour = parseTime(flight.arrival?.time);
      const flightDateIdx = dateList.indexOf(flight.date);
      if (flightDateIdx < 0) return;

      const isOvernight = arrHour <= depHour;
      const effectiveArr = isOvernight ? arrHour + 24 : arrHour;

      const startPct = ((flightDateIdx + depHour / 24) / totalDays) * 100;
      const durationHours = Math.max(effectiveArr - depHour, 1.5);
      const widthPct = Math.max((durationHours / 24 / totalDays) * 100, 1.2);

      const flightData = encodeURIComponent(JSON.stringify(flight));

      html += `
        <div class="tl-bar" data-flight="${flightData}" style="
          left: ${startPct}%;
          width: ${widthPct}%;
          background: ${color};
        ">
          <span class="tl-bar-text">${escapeHtml(flight.flightNumber)} (${escapeHtml(flight.departure?.code || '')}➔${escapeHtml(flight.arrival?.code || '')})</span>
        </div>
      `;
    });

    html += '</div></div>'; // tl-person-bars, tl-person-row
  });

  html += '</div></div>'; // tl-canvas, tl-scroll
  html += '</div>'; // tl-wrapper

  container.innerHTML = html;

  // Click handler for flight detail modal
  container.querySelectorAll('.tl-bar').forEach(bar => {
    bar.addEventListener('click', () => {
      try {
        const flight = JSON.parse(decodeURIComponent(bar.dataset.flight));
        showFlightDetailModal(flight, participants);
      } catch (e) {
        console.warn('Could not parse flight data', e);
      }
    });
  });
}

function showFlightDetailModal(flight, participants) {
  const personIdx = participants.findIndex(p => p.name === flight.addedBy);
  const color = PERSON_COLORS_HEX[personIdx >= 0 ? personIdx % 6 : 0];

  const statusClass = {
    'on-time': 'badge-success', 'scheduled': 'badge-info',
    'delayed': 'badge-warning', 'cancelled': 'badge-danger',
    'landed': 'badge-success', 'boarding': 'badge-accent'
  }[flight.status] || 'badge-info';

  const statusLabel = {
    'on-time': '● On Time', 'scheduled': '● Scheduled',
    'delayed': '● Delayed', 'cancelled': '● Cancelled',
    'landed': '● Landed', 'boarding': '● Boarding'
  }[flight.status] || flight.status;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="animation: scaleIn var(--transition-fast) ease-out;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--space-lg);">
        <div>
          <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); font-family: var(--font-family-mono);">
            ${escapeHtml(flight.flightNumber)}
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
            ${escapeHtml(flight.airline || '')}
          </div>
        </div>
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--space-lg); padding: var(--space-base); background: rgba(30, 41, 59, 0.6); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
        <div>
          <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-family-mono);">${escapeHtml(flight.departure?.code || '')}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(flight.departure?.city || '')}</div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; font-family: var(--font-family-mono); margin-top: 4px;">${escapeHtml(flight.departure?.time || '')}</div>
        </div>
        <div style="text-align:center;">
          <div style="color: var(--color-accent);">${getIcon('plane')}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">${escapeHtml(flight.duration || '')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-family-mono);">${escapeHtml(flight.arrival?.code || '')}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(flight.arrival?.city || '')}</div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; font-family: var(--font-family-mono); margin-top: 4px;">${escapeHtml(flight.arrival?.time || '')}</div>
        </div>
      </div>

      <div style="display:flex; gap: var(--space-base); margin-bottom: var(--space-lg);">
        <div style="flex:1; padding: var(--space-sm) var(--space-base); background: rgba(30, 41, 59, 0.4); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">Date</div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; font-family: var(--font-family-mono); margin-top:2px;">${escapeHtml(flight.date || '')}</div>
        </div>
        <div style="flex:1; padding: var(--space-sm) var(--space-base); background: rgba(30, 41, 59, 0.4); border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">Traveler</div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; margin-top:2px; display:flex; align-items:center; gap:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>
            ${escapeHtml(flight.addedBy || '')}
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" id="modal-close-btn">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => {
    overlay.remove();
  };

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

function parseTime(timeStr) {
  if (!timeStr) return 12;
  const cleaned = timeStr.replace(/\+\d+/, '');
  const [h, m] = cleaned.split(':').map(Number);
  return h + (m || 0) / 60;
}

function formatDateShort(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
