/* ============================================
   PPC: Delay No More — Timeline Component (Overhauled)
   
   Features:
   - Scrollable horizontal timeline spanning all trip days
   - Multi-day flights rendered correctly
   - Click any bar to see full flight details in a modal
   - Color-coded by person with legend
   ============================================ */

const PERSON_COLORS_HEX = [
  '#0A84FF', '#FF9500', '#34C759',
  '#AF52DE', '#FF2D55', '#5AC8FA'
];

export function renderTimeline(container, flights, participants) {
  if (flights.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No flights to show</h3>
        <p>Add flights to see them on the timeline</p>
      </div>
    `;
    return;
  }

  // Determine total date range from flights
  const allDates = flights.map(f => f.date).filter(Boolean).sort();
  const startDate = allDates[0];
  const endDate = allDates[allDates.length - 1];

  // Build complete list of dates in range
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
  // Each day = 200px width for scrolling, min total 100% of container
  const dayWidthPx = Math.max(200, totalDays <= 3 ? 0 : 200);
  const totalWidthPx = totalDays <= 3 ? '100%' : `${totalDays * dayWidthPx}px`;

  // Group flights by person for separate rows  
  const personFlights = {};
  participants.forEach(p => { personFlights[p.name] = []; });
  flights.forEach(f => {
    const name = f.addedBy || 'Unknown';
    if (!personFlights[name]) personFlights[name] = [];
    personFlights[name].push(f);
  });

  let html = '<div class="tl-wrapper">';

  // Legend
  html += '<div class="tl-legend">';
  participants.forEach((p, i) => {
    html += `
      <div class="tl-legend-item">
        <span class="tl-legend-dot" style="background:${PERSON_COLORS_HEX[i % 6]};"></span>
        ${escapeHtml(p.name)}
      </div>
    `;
  });
  html += '<div class="tl-legend-hint">↔ Scroll timeline · Tap a flight for details</div>';
  html += '</div>';

  // Scrollable container
  html += `<div class="tl-scroll">`;
  html += `<div class="tl-canvas" style="min-width: ${totalWidthPx}; position: relative;">`;

  // Date headers row
  html += '<div class="tl-date-row">';
  dateList.forEach((date, i) => {
    const widthPct = (100 / totalDays);
    html += `<div class="tl-date-cell" style="width:${widthPct}%;">
      <span class="tl-date-label">${formatDateShort(date)}</span>
    </div>`;
  });
  html += '</div>';

  // Hour grid lines
  html += '<div class="tl-grid">';
  dateList.forEach((date, dayIdx) => {
    const dayStartPct = (dayIdx / totalDays) * 100;
    const dayWidthPct = 100 / totalDays;
    // Draw 6h markers
    for (let h = 0; h <= 24; h += 6) {
      const xPct = dayStartPct + (h / 24) * dayWidthPct;
      html += `<div class="tl-grid-line" style="left:${xPct}%;"></div>`;
      if (h < 24) {
        html += `<div class="tl-grid-hour" style="left:${xPct}%;">${String(h).padStart(2, '0')}:00</div>`;
      }
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
      ${escapeHtml(person.name)}
    </div>`;
    html += `<div class="tl-person-bars" style="min-height:${Math.max(42, pFlights.length * 40)}px;">`;

    pFlights.forEach((flight, flightIdx) => {
      const depHour = parseTime(flight.departure?.time);
      const arrHour = parseTime(flight.arrival?.time);
      const flightDateIdx = dateList.indexOf(flight.date);
      if (flightDateIdx < 0) return;

      // Determine if it's a multi-day flight (arrival time < departure time)
      const isOvernight = arrHour <= depHour;
      const spanDays = isOvernight ? 2 : 1;
      const effectiveArr = isOvernight ? arrHour + 24 : arrHour;

      // Calculate position: start from the flight's date at depHour, to effectiveArr
      const startPct = ((flightDateIdx + depHour / 24) / totalDays) * 100;
      const durationHours = effectiveArr - depHour;
      const widthPct = Math.max((durationHours / 24 / totalDays) * 100, 0.8); // min visible width

      // Vertical offset for stacking
      const topOffset = flightIdx * 40;

      // Flight data attribute for click handler
      const flightData = encodeURIComponent(JSON.stringify(flight));

      html += `
        <div class="tl-bar" data-flight="${flightData}" style="
          left: ${startPct}%;
          width: ${widthPct}%;
          top: ${topOffset}px;
          background: ${color};
        ">
          <span class="tl-bar-text">${escapeHtml(flight.flightNumber)}</span>
        </div>
      `;
    });

    html += '</div></div>'; // tl-person-bars, tl-person-row
  });

  html += '</div></div>'; // tl-canvas, tl-scroll
  html += '</div>'; // tl-wrapper

  container.innerHTML = html;

  // --- Click handler for flight detail modal ---
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

// --- Flight Detail Modal ---
function showFlightDetailModal(flight, participants) {
  const personIdx = participants.findIndex(p => p.name === flight.addedBy);
  const color = PERSON_COLORS_HEX[personIdx >= 0 ? personIdx % 6 : 0];

  const statusClass = {
    'on-time': 'badge-success', 'scheduled': 'badge-info',
    'delayed': 'badge-warning', 'cancelled': 'badge-danger',
    'landed': 'badge-success', 'boarding': 'badge-accent'
  }[flight.status] || 'badge-info';

  const statusLabel = {
    'on-time': '✅ On Time', 'scheduled': '📋 Scheduled',
    'delayed': '⚠️ Delayed', 'cancelled': '❌ Cancelled',
    'landed': '🛬 Landed', 'boarding': '🛫 Boarding'
  }[flight.status] || flight.status;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="animation: slideUp var(--transition-base) ease-out;">
      <div class="modal-handle"></div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--space-lg);">
        <div>
          <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);">
            ${escapeHtml(flight.flightNumber)}
          </div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${escapeHtml(flight.airline || '')}
          </div>
        </div>
        <span class="badge badge-dot ${statusClass}">${statusLabel}</span>
      </div>

      <!-- Route -->
      <div style="display:flex; align-items:center; gap: var(--space-lg); margin-bottom: var(--space-lg); padding: var(--space-base); background: var(--color-surface-secondary); border-radius: var(--radius-md);">
        <div style="flex:1;">
          <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);">${escapeHtml(flight.departure?.code || '')}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${escapeHtml(flight.departure?.city || '')}</div>
          <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); margin-top: var(--space-xs);">${escapeHtml(flight.departure?.time || '')}</div>
          ${flight.departure?.terminal ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top:2px;">Terminal ${escapeHtml(flight.departure.terminal)}</div>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div style="font-size: 1.2rem;">✈️</div>
          <div style="width:40px; height:2px; background: var(--color-border);"></div>
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${escapeHtml(flight.duration || '')}</div>
        </div>
        <div style="flex:1; text-align:right;">
          <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold);">${escapeHtml(flight.arrival?.code || '')}</div>
          <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${escapeHtml(flight.arrival?.city || '')}</div>
          <div style="font-size: var(--font-size-md); font-weight: var(--font-weight-semibold); margin-top: var(--space-xs);">${escapeHtml(flight.arrival?.time || '')}</div>
          ${flight.arrival?.terminal ? `<div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top:2px;">Terminal ${escapeHtml(flight.arrival.terminal)}</div>` : ''}
        </div>
      </div>

      <!-- Meta info -->
      <div style="display:flex; gap: var(--space-base); flex-wrap:wrap; margin-bottom: var(--space-lg);">
        <div style="flex:1; min-width:120px; padding: var(--space-sm) var(--space-base); background: var(--color-surface-secondary); border-radius: var(--radius-sm);">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.5px;">Date</div>
          <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); margin-top:2px;">📅 ${escapeHtml(flight.date || '')}</div>
        </div>
        <div style="flex:1; min-width:120px; padding: var(--space-sm) var(--space-base); background: var(--color-surface-secondary); border-radius: var(--radius-sm);">
          <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); text-transform:uppercase; letter-spacing:0.5px;">Traveler</div>
          <div style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); margin-top:2px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:4px;vertical-align:middle;"></span>
            ${escapeHtml(flight.addedBy || '')}
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" id="modal-close-btn">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  const closeModal = () => {
    overlay.style.animation = 'fadeIn var(--transition-fast) reverse';
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
}

// --- Utilities ---
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
