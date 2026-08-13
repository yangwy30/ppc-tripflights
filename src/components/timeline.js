/* Timeline Engine — Smart Auto-Zoom & Arrival Cluster Redesign */

import { getIcon } from './icons.js';

const PERSON_COLORS_HEX = [
  '#38BDF8', // Person 1: Sky Cyan
  '#F43F5E', // Person 2: Neon Coral Red
  '#F59E0B', // Person 3: Amber Gold
  '#A855F7', // Person 4: Electric Violet
  '#10B981', // Person 5: Mint Green
  '#FB923C'  // Person 6: Bright Orange
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
      <div class="empty-state card text-center" style="padding: var(--space-2xl) var(--space-lg); background: var(--color-surface); border-radius: 16px;">
        <div class="empty-state-icon" style="display:flex; justify-content:center; margin-bottom: var(--space-sm); font-size: 2.5rem; color: var(--color-accent);">${getIcon('timeline')}</div>
        <h3 style="margin-bottom: var(--space-xs); font-weight: 800;">No flights on timeline</h3>
        <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">Add flights to see them visualized across dates</p>
      </div>
    `;
    return;
  }

  // Extract all distinct dates sorted chronologically
  const dateList = Array.from(new Set(flights.map(f => f.date).filter(Boolean))).sort();
  if (dateList.length === 0) dateList.push(new Date().toISOString().split('T')[0]);

  // Selected active date tab (defaults to first date)
  let activeDate = dateList[0];

  function renderInner() {
    const activeFlights = flights.filter(f => f.date === activeDate);
    const renderFlights = activeFlights.length > 0 ? activeFlights : flights;

    // 1. SMART AUTO-CROP TIME WINDOW CALCULATIONS
    let minHour = 24;
    let maxHour = 0;

    renderFlights.forEach(f => {
      const depH = parseTime(f.departure?.time);
      let arrH = parseTime(f.arrival?.time);
      if (arrH <= depH) arrH += 24; // overnight flight

      minHour = Math.min(minHour, depH);
      maxHour = Math.max(maxHour, arrH);
    });

    // Fallbacks if single point or invalid
    if (minHour >= maxHour) {
      minHour = 8;
      maxHour = 22;
    }

    // Smart Padding: 1 hour before earliest dep, 1 hour after latest arr
    minHour = Math.max(0, Math.floor(minHour - 1));
    maxHour = Math.min(30, Math.ceil(maxHour + 1));

    // Ensure minimum 5-hour span for visual breathing room
    if (maxHour - minHour < 5) {
      maxHour = Math.min(30, minHour + 5);
    }

    const totalHoursSpan = maxHour - minHour;

    // 2. ARRIVAL CLUSTER HEATMAP DETECTION
    const arrivalClusters = detectArrivalClusters(renderFlights);
    const topCluster = arrivalClusters.length > 0 ? arrivalClusters[0] : null;

    // Generate Hourly Grid Labels
    const hourlyLabels = [];
    for (let h = minHour; h <= maxHour; h += (totalHoursSpan > 12 ? 2 : 1)) {
      const displayH = h % 24;
      const timeStr = `${String(displayH).padStart(2, '0')}:00`;
      hourlyLabels.push({ hour: h, label: timeStr });
    }

    let html = `
      <div class="smart-timeline-card" style="background: linear-gradient(145deg, rgba(14, 20, 32, 0.9) 0%, rgba(8, 12, 20, 0.95) 100%); border-radius: 20px; padding: 1.25rem; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.7); backdrop-filter: blur(20px);">
        
        <!-- Header Controls & Date Switcher Tabs -->
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom: 1rem; border-bottom: 1px dashed rgba(255, 255, 255, 0.08); padding-bottom: 1rem;">
          <div style="display:flex; align-items:center; gap: 8px;">
            <span style="color:#38BDF8; display:flex;">${getIcon('timeline')}</span>
            <h3 style="margin:0; font-size:1.15rem; font-weight:800; letter-spacing:-0.03em; color:#FFFFFF;">
              Flight Timeline
            </h3>
          </div>

          <!-- Multi-Date Switcher Pills -->
          <div style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.04); padding:3px; border-radius:999px; border:1px solid rgba(255,255,255,0.08);">
            ${dateList.map(date => `
              <button class="tl-date-tab ${date === activeDate ? 'active' : ''}" data-date="${date}" style="all:unset; cursor:pointer; padding:4px 12px; border-radius:999px; font-size:11px; font-weight:700; font-family:var(--font-family-mono); color:${date === activeDate ? '#06070B' : '#94A3B8'}; background:${date === activeDate ? '#38BDF8' : 'transparent'}; transition:all 0.2s ease;">
                ${formatDateShort(date)}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Arrival Cluster Heatmap Pill -->
        ${topCluster ? `
          <div class="arrival-cluster-pill" style="background: linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 8px 14px; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;">
            <div style="display:flex; align-items:center; gap: 8px;">
              <span style="font-size: 14px;">🛬</span>
              <span style="font-size: 12px; font-weight: 700; color: #38BDF8; font-family: var(--font-family-mono);">
                ${topCluster.count} Travelers Landing at <strong style="color:#FFF;">${topCluster.airport}</strong> between ${topCluster.minTime} - ${topCluster.maxTime}
              </span>
            </div>
            <div style="display:flex; align-items:center; gap: 4px;">
              ${topCluster.travelers.map(t => `
                <span style="font-size:10px; font-weight:700; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:999px; color:#F8FAFC;">${escapeHtml(t)}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Smart Auto-Cropped Canvas -->
        <div style="position: relative; overflow-x: auto; scrollbar-width: none; padding: 0.5rem 0;">
          
          <!-- Timeline Time Axis Header -->
          <div style="display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:12px;">
            <div style="width: 110px; flex-shrink: 0; font-size: 10px; font-weight: 800; color: #64748B; font-family: var(--font-family-mono); letter-spacing: 1px; text-transform: uppercase;">
              TRAVELER
            </div>
            <div style="flex: 1; position: relative; height: 20px;">
              ${hourlyLabels.map(item => {
                const pct = ((item.hour - minHour) / totalHoursSpan) * 100;
                return `
                  <div style="position: absolute; left: ${pct}%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: ${item.hour % 24 === 22 ? '#34D399' : '#94A3B8'}; font-family: var(--font-family-mono);">
                    ${item.label}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Timeline Background Vertical Dashed Lines -->
          <div style="position: absolute; top: 38px; left: 110px; right: 0; bottom: 0; pointer-events: none; z-index: 1;">
            ${hourlyLabels.map(item => {
              const pct = ((item.hour - minHour) / totalHoursSpan) * 100;
              return `
                <div style="position: absolute; top: 0; bottom: 0; left: ${pct}%; width: 1px; border-left: 1px dashed rgba(255, 255, 255, 0.05);"></div>
              `;
            }).join('')}
          </div>

          <!-- Traveler Rows Stream -->
          <div style="display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 2;">
            ${participants.map((person, personIdx) => {
              const personColor = PERSON_COLORS_HEX[personIdx % 6];
              const pFlights = renderFlights.filter(f => f.addedBy === person.name);
              if (pFlights.length === 0) return '';

              return `
                <div style="display: flex; align-items: center; min-height: 48px;">
                  
                  <!-- Traveler Label Pill -->
                  <div style="width: 110px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding-right: 8px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${personColor}; box-shadow: 0 0 10px ${personColor}; flex-shrink: 0;"></span>
                    <span style="font-size: 12px; font-weight: 700; color: #F8FAFC; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(person.name)}</span>
                  </div>

                  <!-- Timeline Flight Bar Container -->
                  <div style="flex: 1; position: relative; height: 46px;">
                    ${pFlights.map(flight => {
                      const depHour = parseTime(flight.departure?.time);
                      let arrHour = parseTime(flight.arrival?.time);
                      if (arrHour <= depHour) arrHour += 24;

                      // Calculate percentage position along cropped time axis
                      const startPct = Math.max(0, ((depHour - minHour) / totalHoursSpan) * 100);
                      const endPct = Math.min(100, ((arrHour - minHour) / totalHoursSpan) * 100);
                      const widthPct = Math.max(8, endPct - startPct);

                      const depCode = (flight.departure?.code || 'DEP').toUpperCase();
                      const arrCode = (flight.arrival?.code || 'ARR').toUpperCase();
                      const flightNo = flight.flightNumber || 'FLIGHT';
                      const flightData = encodeURIComponent(JSON.stringify(flight));

                      return `
                        <div class="tl-bar" data-flight="${flightData}" style="
                          position: absolute;
                          top: 2px;
                          left: ${startPct}%;
                          width: ${widthPct}%;
                          min-width: 160px;
                          height: 42px;
                          background: linear-gradient(135deg, rgba(18, 24, 38, 0.95) 0%, rgba(10, 14, 24, 0.98) 100%);
                          border-left: 4px solid ${personColor};
                          border-top: 1px solid rgba(255, 255, 255, 0.12);
                          border-right: 1px solid rgba(255, 255, 255, 0.12);
                          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                          border-radius: 10px;
                          padding: 0 10px;
                          display: flex;
                          align-items: center;
                          justify-content: space-between;
                          box-sizing: border-box;
                          cursor: pointer;
                          z-index: 10;
                          backdrop-filter: blur(16px);
                          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6), 0 0 12px ${hexToRgba(personColor, 0.25)};
                          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        ">
                          
                          <!-- Left: Flight IATA & Flight Number -->
                          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
                            <span style="font-weight: 800; font-family: var(--font-family-mono); font-size: 11px; color: #FFFFFF; letter-spacing: 0.05em; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px;">
                              ${escapeHtml(flightNo)}
                            </span>
                            <span style="font-family: var(--font-family-mono); font-size: 12px; font-weight: 800; color: ${personColor}; white-space: nowrap;">
                              ${escapeHtml(depCode)} ✈ ${escapeHtml(arrCode)}
                            </span>
                          </div>

                          <!-- Right: Local Time -->
                          <div style="font-family: var(--font-family-mono); font-size: 11px; font-weight: 700; color: #94A3B8; white-space: nowrap; margin-left: 6px;">
                            ${escapeHtml(flight.departure?.time || '')} - ${escapeHtml(flight.arrival?.time || '')}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                </div>
              `;
            }).join('')}
          </div>

        </div>

      </div>
    `;

    container.innerHTML = html;

    // Date Switcher Tab Listeners
    container.querySelectorAll('.tl-date-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeDate = tab.getAttribute('data-date');
        renderInner();
      });
    });

    // Bar hover & click handlers
    container.querySelectorAll('.tl-bar').forEach(bar => {
      bar.addEventListener('mouseenter', () => {
        bar.style.transform = 'translateY(-2px) scale(1.02)';
        bar.style.zIndex = '30';
      });
      bar.addEventListener('mouseleave', () => {
        bar.style.transform = 'none';
        bar.style.zIndex = '10';
      });
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

  renderInner();
}

/**
 * Detects group arrival clusters (passengers landing within 60 mins of each other)
 */
function detectArrivalClusters(flights) {
  if (!flights || flights.length < 2) return [];

  const airportGroups = {};
  flights.forEach(f => {
    const arrCode = (f.arrival?.code || '').toUpperCase().trim();
    if (!arrCode) return;
    if (!airportGroups[arrCode]) airportGroups[arrCode] = [];
    airportGroups[arrCode].push(f);
  });

  const clusters = [];
  Object.keys(airportGroups).forEach(code => {
    const fList = airportGroups[code];
    if (fList.length < 2) return;

    // Sort by arrival time
    const sorted = [...fList].sort((a, b) => parseTime(a.arrival?.time) - parseTime(b.arrival?.time));
    const minTime = sorted[0].arrival?.time || '18:00';
    const maxTime = sorted[sorted.length - 1].arrival?.time || '22:00';
    const travelers = Array.from(new Set(sorted.map(f => f.addedBy)));

    clusters.push({
      airport: code,
      count: travelers.length,
      travelers,
      minTime,
      maxTime
    });
  });

  return clusters.sort((a, b) => b.count - a.count);
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

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
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
