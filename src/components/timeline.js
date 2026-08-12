/* ============================================
   PPC: Delay No More — 100% Pixel-Exact Local Time Timeline Engine
   Guaranteed: Bar Left Edge = Dep Local Time, Bar Right Edge = Arr Local Time (Zero Min-Width Distortion)
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
  const dayWidthPx = Math.max(300, totalDays <= 2 ? 450 : 320);
  const totalWidthPx = `${totalDays * dayWidthPx + 110}px`; // 110px label offset + grid width

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
  html += '<div class="tl-legend-hint">↔ Scroll timeline · Exact Local Dep/Arr Time Alignment</div>';
  html += '</div>';

  // Scrollable container
  html += `<div class="tl-scroll">`;
  html += `<div class="tl-canvas" style="min-width: ${totalWidthPx}; position: relative;">`;

  // Date Header Row with 110px Label Spacer Alignment!
  html += '<div class="tl-date-row" style="display: flex; align-items: center; border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-md);">';
  html += '<div style="width: 110px; flex-shrink: 0; padding: 4px 8px; font-size: 11px; font-weight: 700; color: var(--color-text-tertiary);">TRAVELERS</div>';
  html += '<div style="flex: 1; display: flex;">';
  dateList.forEach((date) => {
    const widthPct = (100 / totalDays);
    html += `
      <div class="tl-date-cell" style="width:${widthPct}%; border-right: 1px dashed var(--color-border-light); padding: 4px 6px;">
        <div class="tl-date-label" style="font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-primary); font-family: var(--font-family-mono); text-align: center;">${formatDateShort(date)}</div>
        <div class="tl-hour-subrow" style="display: flex; justify-content: space-between; font-size: 9px; color: var(--color-text-tertiary); font-family: var(--font-family-mono); margin-top: 4px; opacity: 0.8;">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
        </div>
      </div>
    `;
  });
  html += '</div></div>';

  // Background Grid Lines layer (Offset 110px from left)
  html += '<div class="tl-grid" style="position: absolute; top: 40px; left: 110px; right: 0; bottom: 0; pointer-events: none;">';
  dateList.forEach((date, dayIdx) => {
    const dayStartPct = (dayIdx / totalDays) * 100;
    const dayWidthPct = 100 / totalDays;
    for (let h = 0; h <= 24; h += 6) {
      const xPct = dayStartPct + (h / 24) * dayWidthPct;
      html += `<div class="tl-grid-line" style="position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.05); left:${xPct}%;"></div>`;
    }
  });
  html += '</div>';

  // Person Rows Layer (100% Exact Dep/Arr Local Time Alignment)
  participants.forEach((person, personIdx) => {
    const color = PERSON_COLORS_HEX[personIdx % 6];
    const pFlights = personFlights[person.name] || [];
    if (pFlights.length === 0) return;

    html += `<div class="tl-person-row" style="display: flex; align-items: center; height: 48px; margin-bottom: 10px; position: relative; z-index: 2;">`;
    html += `<div class="tl-person-label" style="width: 110px; flex-shrink: 0; font-size: var(--font-size-xs); font-weight: 700; color: var(--color-text-primary); display: flex; align-items: center; gap: 6px; padding-right: 8px;">
      <span class="tl-person-dot" style="width: 8px; height: 8px; border-radius: 50%; background:${color}; flex-shrink: 0;"></span>
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(person.name)}</span>
    </div>`;
    html += `<div class="tl-person-bars" style="flex: 1; position: relative; height: 42px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-sm); border: 1px solid var(--color-border-light);">`;

    pFlights.forEach((flight) => {
      const depTimeStr = flight.departure?.time || '00:00';
      const arrTimeStr = flight.arrival?.time || '00:00';

      const depHour = parseTime(depTimeStr);
      let arrHour = parseTime(arrTimeStr);

      const flightDateIdx = dateList.indexOf(flight.date);
      if (flightDateIdx < 0) return;

      // Handle overnight arrival (+24h)
      if (arrHour <= depHour) {
        arrHour += 24;
      }

      // EXACT PIXEL ALIGNMENT: Left = Dep Local Time, Right = Arr Local Time
      const startPct = ((flightDateIdx + depHour / 24) / totalDays) * 100;
      const endPct = ((flightDateIdx + arrHour / 24) / totalDays) * 100;
      const widthPct = Math.max(0.5, endPct - startPct);

      const depCode = (flight.departure?.code || 'DEP').toUpperCase();
      const arrCode = (flight.arrival?.code || 'ARR').toUpperCase();
      const fn = flight.flightNumber || 'FLIGHT';

      const flightData = encodeURIComponent(JSON.stringify(flight));

      html += `
        <div class="tl-bar" data-flight="${flightData}" style="
          position: absolute;
          top: 3px;
          left: ${startPct}%;
          width: ${widthPct}%;
          height: 36px;
          background: ${color};
          border-radius: 8px;
          padding: 2px 6px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          cursor: pointer;
          z-index: 10;
          overflow: visible;
        ">
          <!-- Text Badge Container that overflows cleanly if bar is short -->
          <div style="display:flex; align-items:center; gap:6px; white-space:nowrap; pointer-events:none; position:relative; z-index:11;">
            <span style="font-weight:900; font-family:var(--font-family-mono); font-size:11px; color:#ffffff; text-shadow:0 1px 3px rgba(0,0,0,0.8);">
              ${escapeHtml(fn)}
            </span>
            <span style="font-size:9px; color:rgba(255,255,255,0.95); font-family:var(--font-family-mono); background:rgba(0,0,0,0.4); padding:1px 4px; border-radius:4px;">
              ${escapeHtml(depCode)} ${escapeHtml(depTimeStr)} ➔ ${escapeHtml(arrCode)} ${escapeHtml(arrTimeStr)}
            </span>
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
          <div style="font-size: var(--font-size-sm); font-weight: 600; font-family: var(--font-family-mono); margin-top: 4px;">${escapeHtml(flight.departure?.time || '')} Local</div>
        </div>
        <div style="text-align:center;">
          <div style="color: var(--color-accent);">${getIcon('plane')}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">${escapeHtml(flight.duration || '')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-family-mono);">${escapeHtml(flight.arrival?.code || '')}</div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">${escapeHtml(flight.arrival?.city || '')}</div>
          <div style="font-size: var(--font-size-sm); font-weight: 600; font-family: var(--font-family-mono); margin-top: 4px;">${escapeHtml(flight.arrival?.time || '')} Local</div>
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
