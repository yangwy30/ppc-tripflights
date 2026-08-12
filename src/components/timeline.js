/* ============================================
   PPC: Delay No More — Commercial Pro Timeline Component
   Features: Timezone-Calibrated Flight Duration Width + Full Flight Number & Route Display
   ============================================ */

import { getIcon } from './icons.js';

const PERSON_COLORS_HEX = [
  '#38BDF8', // Person 1: Sky Cyan
  '#FF2D55', // Person 2: Neon Coral Red
  '#F59E0B', // Person 3: Amber Gold
  '#AF52DE', // Person 4: Electric Violet
  '#34C759', // Person 5: Mint Green
  '#FF9500'  // Person 6: Bright Orange
];

const AIRPORT_TZ_OFFSETS = {
  JFK: -5, EWR: -5, LGA: -5, BOS: -5, MIA: -5, MCO: -5, IAD: -5, ATL: -5, DTW: -5,
  ORD: -6, DFW: -6, IAH: -6, MSP: -6, MDW: -6,
  DEN: -7, SLC: -7, PHX: -7,
  LAX: -8, SFO: -8, SEA: -8, SAN: -8, SJC: -8, OAK: -8, LAS: -8,
  LHR: 0, LGW: 0, CDG: 1, FRA: 1, AMS: 1, FCO: 1, MUC: 1,
  DXB: 4, SIN: 8, HND: 9, NRT: 9, ICN: 9, HKG: 8, PEK: 8, PVG: 8,
  SYD: 10, MEL: 10
};

export function renderTimeline(container, tripOrFlights, participantsOrFilter, filterPerson = 'all') {
  let flights = [];
  let participants = [];

  if (Array.isArray(tripOrFlights)) {
    flights = tripOrFlights;
    participants = Array.isArray(participantsOrFilter) ? participantsOrFilter : [];
  } else if (tripOrFlights && typeof tripOrFlights === 'object') {
    flights = tripOrFlights.flights || [];
    participants = tripOrFlights.participants || [];
    if (typeof participantsOrFilter === 'string') {
      filterPerson = participantsOrFilter;
    }
  }

  // Normalize participants
  participants = participants.map(p => typeof p === 'string' ? { name: p } : p);

  // Filter flights by person if filterPerson is active
  if (filterPerson && filterPerson !== 'all') {
    flights = flights.filter(f => f.addedBy === filterPerson);
  }

  if (!flights || flights.length === 0) {
    container.innerHTML = `
      <div class="empty-state card text-center" style="padding: var(--space-2xl) var(--space-lg);">
        <div class="empty-state-icon" style="display:flex; justify-content:center; margin-bottom: var(--space-sm); font-size: 2.5rem;">${getIcon('timeline')}</div>
        <h3 style="margin-bottom: var(--space-xs); font-weight: 700;">No flights on timeline</h3>
        <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Add flights to see them visualized across dates</p>
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
  // Make day column wide enough so bars have clear space to display flight numbers
  const dayWidthPx = Math.max(260, totalDays <= 2 ? 380 : 280);
  const totalWidthPx = `${totalDays * dayWidthPx}px`;

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

    html += `<div class="tl-person-row" style="height: 48px; margin-bottom: 10px;">`;
    html += `<div class="tl-person-label" style="width: 100px;">
      <span class="tl-person-dot" style="background:${color};"></span>
      <span style="overflow:hidden; text-overflow:ellipsis; font-weight:700;">${escapeHtml(person.name)}</span>
    </div>`;
    html += `<div class="tl-person-bars" style="height: 42px;">`;

    pFlights.forEach((flight) => {
      const depHour = parseTime(flight.departure?.time);
      const flightDateIdx = dateList.indexOf(flight.date);
      if (flightDateIdx < 0) return;

      // Accurate Flight Duration Calculation (accounting for Timezone Offsets)
      const durationHours = getDurationHours(flight);

      const startPct = ((flightDateIdx + depHour / 24) / totalDays) * 100;
      const widthPct = Math.max((durationHours / 24 / totalDays) * 100, 1.8);

      const depCode = (flight.departure?.code || 'DEP').toUpperCase();
      const arrCode = (flight.arrival?.code || 'ARR').toUpperCase();
      const fn = flight.flightNumber || 'FLIGHT';

      const flightData = encodeURIComponent(JSON.stringify(flight));

      html += `
        <div class="tl-bar" data-flight="${flightData}" style="
          left: ${startPct}%;
          width: ${widthPct}%;
          min-width: 115px;
          height: 36px;
          background: ${color};
          border-radius: 8px;
          padding: 3px 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          z-index: 5;
        ">
          <div style="display:flex; flex-direction:column; overflow:hidden; line-height:1.2;">
            <div style="font-weight:900; font-family:var(--font-family-mono); font-size:11px; color:#ffffff; white-space:nowrap;">
              ${escapeHtml(fn)}
            </div>
            <div style="font-size:9px; color:rgba(255,255,255,0.85); font-family:var(--font-family-mono); white-space:nowrap;">
              ${escapeHtml(depCode)}➔${escapeHtml(arrCode)}
            </div>
          </div>
          <div style="font-size:9px; font-weight:800; font-family:var(--font-family-mono); color:rgba(255,255,255,0.9); background:rgba(0,0,0,0.25); padding:2px 5px; border-radius:4px; margin-left:4px; flex-shrink:0;">
            ${durationHours.toFixed(1)}h
          </div>
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

/**
 * Timezone-Calibrated Duration Resolver
 */
function getDurationHours(flight) {
  // 1. Try parsing explicit duration string (e.g. "6h 30m", "5.5h", "320m")
  if (flight.duration) {
    const durStr = String(flight.duration).toLowerCase().trim();
    const hMatch = durStr.match(/(\d+)\s*h/);
    const mMatch = durStr.match(/(\d+)\s*m/);

    if (hMatch || mMatch) {
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      return Math.max(1.0, h + m / 60);
    }
  }

  // 2. Compute local wall-clock times + timezone offset
  const depCode = (flight.departure?.code || '').toUpperCase().trim();
  const arrCode = (flight.arrival?.code || '').toUpperCase().trim();

  const depHour = parseTime(flight.departure?.time);
  let arrHour = parseTime(flight.arrival?.time);

  if (arrHour <= depHour) {
    arrHour += 24; // Cross overnight
  }

  let localDiff = arrHour - depHour;

  // Timezone adjustment if offsets are known
  const depTz = AIRPORT_TZ_OFFSETS[depCode];
  const arrTz = AIRPORT_TZ_OFFSETS[arrCode];

  if (depTz !== undefined && arrTz !== undefined) {
    // True elapsed flight time = Local Arrival - Local Departure + (Dep TZ - Arr TZ)
    const tzDiff = depTz - arrTz;
    const trueDuration = localDiff + tzDiff;
    if (trueDuration > 0.5 && trueDuration < 24) {
      return trueDuration;
    }
  }

  return Math.max(1.5, localDiff);
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
  const cleaned = String(timeStr).replace(/\+\d+/, '');
  const [h, m] = cleaned.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
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
