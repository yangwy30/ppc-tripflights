/* ============================================
   PPC: Delay No More — Self-Contained Dark Vector World Flight Route Map Engine
   Flighty Aesthetic (Zero External Dependency, 100% Guarantee Visual World Map)
   ============================================ */

import { getIcon } from './icons.js';

const PERSON_COLORS_HEX = [
  '#0A84FF', '#34C759', '#F59E0B',
  '#A855F7', '#EC4899', '#38BDF8'
];

// Simplified World Continent Outlines (lat, lon pairs)
const WORLD_CONTINENTS = [
  // North America
  [ [70, -165], [65, -140], [55, -130], [48, -124], [34, -118], [30, -115], [20, -105], [15, -90], [8, -77], [10, -73], [25, -80], [30, -81], [37, -76], [41, -71], [45, -63], [55, -60], [65, -65], [72, -85] ],
  // South America
  [ [12, -72], [8, -77], [-5, -81], [-18, -70], [-34, -72], [-55, -68], [-52, -65], [-35, -53], [-22, -40], [-6, -35], [5, -60], [10, -65] ],
  // Europe
  [ [71, 28], [60, 5], [50, -5], [43, -9], [36, -5], [37, 15], [40, 26], [45, 35], [55, 38], [65, 40], [70, 30] ],
  // Africa
  [ [35, -6], [30, 32], [12, 43], [-10, 40], [-34, 20], [-34, 18], [5, 9], [15, -17], [30, -10] ],
  // Asia
  [ [75, 100], [70, 170], [60, 160], [40, 140], [30, 120], [22, 115], [10, 100], [10, 75], [25, 60], [40, 50], [55, 60], [70, 70] ],
  // Australia
  [ [-12, 130], [-15, 140], [-25, 150], [-38, 145], [-32, 115], [-20, 115] ],
  // Japan
  [ [45, 142], [40, 140], [34, 135], [31, 130], [35, 138], [42, 144] ],
  // UK & Ireland
  [ [58, -5], [55, -1], [50, -1], [51, -5], [55, -6] ]
];

const AIRPORT_COORDS = {
  JFK: [40.6413, -73.7781],
  EWR: [40.6895, -74.1745],
  LGA: [40.7769, -73.8740],
  BOS: [42.3656, -71.0096],
  MIA: [25.7959, -80.2870],
  MCO: [28.4312, -81.3081],
  IAD: [38.9531, -77.4565],
  DCA: [38.8512, -77.0402],
  ATL: [33.6407, -84.4277],
  ORD: [41.9742, -87.9073],
  MDW: [41.7868, -87.7522],
  DFW: [32.8998, -97.0403],
  IAH: [29.9902, -95.3368],
  MSP: [44.8848, -93.2223],
  DTW: [42.2162, -83.3554],
  DEN: [39.8561, -104.6737],
  SLC: [40.7899, -111.9791],
  PHX: [33.4352, -112.0101],
  LAX: [33.9416, -118.4085],
  SFO: [37.6213, -122.3790],
  SJC: [37.3639, -121.9289],
  OAK: [37.7213, -122.2207],
  SEA: [47.4502, -122.3088],
  SAN: [32.7338, -117.1933],
  SNA: [33.6757, -117.8674],
  LAS: [36.0840, -115.1537],
  HNL: [21.3187, -157.9225],
  OGG: [20.8986, -156.4305],
  LHR: [51.4700, -0.4543],
  LGW: [51.1537, -0.1821],
  CDG: [49.0097, 2.5479],
  AMS: [52.3105, 4.7683],
  FRA: [50.0379, 8.5622],
  FCO: [41.8003, 12.2389],
  MUC: [48.3537, 11.7860],
  ZRH: [47.4582, 8.5555],
  DXB: [25.2532, 55.3657],
  SIN: [1.3644, 103.9915],
  HND: [35.5494, 139.7798],
  NRT: [35.7720, 140.3929],
  ICN: [37.4602, 126.4407],
  HKG: [22.3080, 113.9185],
  PEK: [40.0799, 116.6031],
  PVG: [31.1443, 121.8083],
  SYD: [-33.9399, 151.1753],
  MEL: [-37.8670, 144.9070],
  BNE: [-27.3842, 153.1175]
};

let animReqId = null;

export function renderRouteMap(container, flights = [], participants = [], trip = {}, activePersonFilter = 'all') {
  if (animReqId) {
    cancelAnimationFrame(animReqId);
    animReqId = null;
  }

  container.innerHTML = `
    <div class="route-map-wrapper">
      <div class="route-map-header">
        <div>
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--color-text-tertiary);">
            Group Flight Network Map
          </div>
          <div style="font-size: var(--font-size-md); font-weight: 800; color: var(--color-text-primary); letter-spacing: -0.03em; margin-top:2px;">
            ${flights.length} Active Route Arcs Converging
          </div>
        </div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); font-family: var(--font-family-mono);">
          Hover / Tap Arcs for Details
        </div>
      </div>

      <div class="canvas-container" style="position:relative; width:100%; height:420px; background:#080B13; border-radius: var(--radius-lg); overflow:hidden; border: 1px solid var(--color-border);">
        <canvas id="vector-map-canvas" style="width:100%; height:100%; display:block;"></canvas>
        <div id="map-tooltip" class="map-tooltip hidden"></div>
      </div>

      <!-- Map Legend Drawer -->
      <div class="route-map-legend">
        ${participants.map((p, i) => `
          <div class="legend-chip ${activePersonFilter !== 'all' && activePersonFilter !== p.name ? 'dimmed' : ''}" data-legend-person="${escapeHtml(p.name)}">
            <span class="legend-dot" style="background:${PERSON_COLORS_HEX[i % 6]};"></span>
            <span style="font-weight:600;">${escapeHtml(p.name)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const canvas = container.querySelector('#vector-map-canvas');
  const tooltip = container.querySelector('#map-tooltip');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = 800, height = 420;
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || container.clientWidth || 800;
    const h = rect.height || 420;
    width = w * dpr;
    height = h * dpr;
    canvas.width = width;
    canvas.height = height;
  }

  resizeCanvas();

  // Calculate Map Bounds to fit all airports in current flight set
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  let validPointCount = 0;

  flights.forEach(f => {
    const depCode = (f.departure?.code || '').toUpperCase().trim();
    const arrCode = (f.arrival?.code || '').toUpperCase().trim();

    if (AIRPORT_COORDS[depCode]) {
      const [lat, lon] = AIRPORT_COORDS[depCode];
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      validPointCount++;
    }
    if (AIRPORT_COORDS[arrCode]) {
      const [lat, lon] = AIRPORT_COORDS[arrCode];
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      validPointCount++;
    }
  });

  // Strict Fallback Bounds (North America / Atlantic focus)
  if (validPointCount < 2 || maxLat <= minLat || maxLon <= minLon) {
    minLat = 15; maxLat = 60;
    minLon = -130; maxLon = 15;
  } else {
    const latSpan = Math.max(20, maxLat - minLat);
    const lonSpan = Math.max(30, maxLon - minLon);
    minLat -= latSpan * 0.25;
    maxLat += latSpan * 0.25;
    minLon -= lonSpan * 0.25;
    maxLon += lonSpan * 0.25;
  }

  function project(lat, lon) {
    const x = ((lon - minLon) / (maxLon - minLon)) * width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * height;
    return {
      x: isNaN(x) ? width / 2 : x,
      y: isNaN(y) ? height / 2 : y
    };
  }

  let progress = 0;
  let hoverFlight = null;

  // Prepare Route Objects
  const routesList = flights.map(f => {
    const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
    const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
    const pIndex = participants.findIndex(p => p.name === f.addedBy);
    const color = PERSON_COLORS_HEX[pIndex >= 0 ? pIndex % 6 : 0];

    const startCoords = AIRPORT_COORDS[depCode] || [40.6413, -73.7781];
    const endCoords = AIRPORT_COORDS[arrCode] || [33.9416, -118.4085];

    const p1 = project(startCoords[0], startCoords[1]);
    const p2 = project(endCoords[0], endCoords[1]);

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    
    const controlX = midX - dy * 0.25;
    const controlY = midY + dx * 0.25 - Math.min(60 * dpr, dist * 0.2);

    return {
      flight: f,
      depCode,
      arrCode,
      p1,
      p2,
      controlX,
      controlY,
      color,
      dist,
      personName: f.addedBy
    };
  });

  function draw() {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1 * dpr;

    for (let x = 0; x < width; x += 50 * dpr) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50 * dpr) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Draw World Continent Landmass Outlines (Dark Vector World Map Base)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1 * dpr;

    WORLD_CONTINENTS.forEach(polygon => {
      ctx.beginPath();
      polygon.forEach((pt, idx) => {
        const proj = project(pt[0], pt[1]);
        if (idx === 0) ctx.moveTo(proj.x, proj.y);
        else ctx.lineTo(proj.x, proj.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    progress = (progress + 0.005) % 1;

    // 3. Draw Flight Arcs
    routesList.forEach(route => {
      const isFilteredOut = activePersonFilter !== 'all' && activePersonFilter !== route.personName;
      const isHovered = hoverFlight === route.flight;
      const alpha = isFilteredOut ? 0.15 : isHovered ? 1.0 : 0.85;
      const lineWidth = (isHovered ? 4.5 : 2.5) * dpr;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(route.p1.x, route.p1.y);
      ctx.quadraticCurveTo(route.controlX, route.controlY, route.p2.x, route.p2.y);
      
      ctx.strokeStyle = route.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = route.color;
      ctx.shadowBlur = (isHovered ? 18 : 8) * dpr;
      ctx.stroke();
      ctx.restore();

      // 4. Draw Particle Comet Flow Along Arc
      if (!isFilteredOut) {
        const t = (progress + (route.dist % 100) / 100) % 1;
        const u = 1 - t;
        const px = u * u * route.p1.x + 2 * u * t * route.controlX + t * t * route.p2.x;
        const py = u * u * route.p1.y + 2 * u * t * route.controlY + t * t * route.p2.y;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, (isHovered ? 5.5 : 4) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = route.color;
        ctx.shadowBlur = 12 * dpr;
        ctx.fill();
        ctx.restore();
      }
    });

    // 5. Draw Airport Beacons & Avatar Labels
    const airportMap = new Map();
    routesList.forEach(route => {
      if (!airportMap.has(route.depCode)) airportMap.set(route.depCode, { pt: route.p1, people: [] });
      if (!airportMap.has(route.arrCode)) airportMap.set(route.arrCode, { pt: route.p2, people: [] });

      airportMap.get(route.depCode).people.push(route.personName);
    });

    airportMap.forEach((data, code) => {
      const { pt, people } = data;
      const isFiltered = activePersonFilter !== 'all' && !people.includes(activePersonFilter);

      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (8 + Math.sin(progress * 10) * 2) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isFiltered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(10, 132, 255, 0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isFiltered ? '#64748B' : '#0A84FF';
      ctx.shadowColor = '#0A84FF';
      ctx.shadowBlur = 10 * dpr;
      ctx.fill();
      ctx.restore();

      // Airport Code & Name Label Box
      ctx.save();
      const labelText = `${code}${people.length > 0 ? ` (${people[0]})` : ''}`;
      ctx.font = `bold ${10 * dpr}px "DIN Alternate", -apple-system, sans-serif`;
      
      const textWidth = ctx.measureText(labelText).width;
      const boxPadding = 4 * dpr;
      const bx = pt.x + 8 * dpr;
      const by = pt.y - 12 * dpr;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = isFiltered ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, textWidth + boxPadding * 2, 16 * dpr, 4 * dpr) : ctx.rect(bx, by, textWidth + boxPadding * 2, 16 * dpr);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isFiltered ? '#64748B' : '#F8FAFC';
      ctx.fillText(labelText, bx + boxPadding, by + 11 * dpr);
      ctx.restore();
    });

    animReqId = requestAnimationFrame(draw);
  }

  draw();

  // Mousemove Listener for Tooltip
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;

    let found = null;

    for (const route of routesList) {
      const midX = (route.p1.x + route.p2.x) / 2;
      const midY = (route.p1.y + route.p2.y) / 2;
      const distToMid = Math.hypot(mx - midX, my - midY);

      if (distToMid < 50 * dpr) {
        found = route;
        break;
      }
    }

    if (found) {
      hoverFlight = found.flight;
      tooltip.classList.remove('hidden');
      tooltip.style.left = `${e.clientX - rect.left + 15}px`;
      tooltip.style.top = `${e.clientY - rect.top - 10}px`;
      tooltip.innerHTML = `
        <div style="font-weight:800; font-family:var(--font-family-mono); font-size:12px; color:#fff;">
          ${escapeHtml(found.flight.flightNumber)} · ${escapeHtml(found.depCode)} ➔ ${escapeHtml(found.arrCode)}
        </div>
        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">
          Traveler: <strong style="color:${found.color}">${escapeHtml(found.personName)}</strong>
        </div>
        <div style="font-size:10px; color:#64748B; margin-top:2px; font-family:var(--font-family-mono);">
          ${escapeHtml(found.flight.departure?.time || '')} ➔ ${escapeHtml(found.flight.arrival?.time || '')}
        </div>
      `;
    } else {
      hoverFlight = null;
      tooltip.classList.add('hidden');
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hoverFlight = null;
    tooltip.classList.add('hidden');
  });

  // Legend Filter Click Listener
  container.querySelectorAll('.legend-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const personName = chip.dataset.legendPerson;
      const chipBtn = document.querySelector(`.chip[data-person="${personName}"]`);
      if (chipBtn) chipBtn.click();
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
