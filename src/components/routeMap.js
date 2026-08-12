/* ============================================
   PPC: Delay No More — Group Multi-Origin Flight Route Map Engine
   Aero Precision Commercial Dark Canvas Renderer (Flighty Aesthetic)
   ============================================ */

const PERSON_COLORS_HEX = [
  '#0A84FF', '#34C759', '#F59E0B',
  '#A855F7', '#EC4899', '#38BDF8'
];

// Comprehensive airport coordinates database (lat, lon)
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
          Hover/Tap Arcs for Details
        </div>
      </div>

      <div class="canvas-container" style="position:relative; width:100%; height:380px; background:#07090E; border-radius: var(--radius-lg); overflow:hidden; border: 1px solid var(--color-border);">
        <canvas id="route-canvas" style="width:100%; height:100%; display:block;"></canvas>
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

  const canvas = container.querySelector('#route-canvas');
  const tooltip = container.querySelector('#map-tooltip');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = 800, height = 380;
  const dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || container.clientWidth || 800;
    const h = rect.height || 380;
    width = w * dpr;
    height = h * dpr;
    canvas.width = width;
    canvas.height = height;
  }

  resizeCanvas();

  // Determine bounding box of airports
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

  // Strict Fallback Bounds if missing or invalid
  if (validPointCount < 2 || maxLat <= minLat || maxLon <= minLon) {
    minLat = 20; maxLat = 55;
    minLon = -125; maxLon = 10;
  } else {
    const latSpan = Math.max(15, maxLat - minLat);
    const lonSpan = Math.max(25, maxLon - minLon);
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1 * dpr;

    for (let x = 0; x < width; x += 40 * dpr) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40 * dpr) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    progress = (progress + 0.005) % 1;

    // 2. Draw Flight Arcs
    routesList.forEach(route => {
      const isFilteredOut = activePersonFilter !== 'all' && activePersonFilter !== route.personName;
      const isHovered = hoverFlight === route.flight;
      const alpha = isFilteredOut ? 0.15 : isHovered ? 1.0 : 0.75;
      const lineWidth = (isHovered ? 4 : 2) * dpr;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(route.p1.x, route.p1.y);
      ctx.quadraticCurveTo(route.controlX, route.controlY, route.p2.x, route.p2.y);
      
      ctx.strokeStyle = route.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = route.color;
      ctx.shadowBlur = (isHovered ? 16 : 6) * dpr;
      ctx.stroke();
      ctx.restore();

      // 3. Draw Particle Comet Flow
      if (!isFilteredOut) {
        const t = (progress + (route.dist % 100) / 100) % 1;
        const u = 1 - t;
        const px = u * u * route.p1.x + 2 * u * t * route.controlX + t * t * route.p2.x;
        const py = u * u * route.p1.y + 2 * u * t * route.controlY + t * t * route.p2.y;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, (isHovered ? 5 : 3.5) * dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = route.color;
        ctx.shadowBlur = 10 * dpr;
        ctx.fill();
        ctx.restore();
      }
    });

    // 4. Draw Airport Beacons & Avatar Labels
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
      ctx.arc(pt.x, pt.y, (7 + Math.sin(progress * 10) * 2) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isFiltered ? 'rgba(255, 255, 255, 0.05)' : 'rgba(10, 132, 255, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isFiltered ? '#64748B' : '#0A84FF';
      ctx.shadowColor = '#0A84FF';
      ctx.shadowBlur = 8 * dpr;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font = `bold ${10 * dpr}px "DIN Alternate", -apple-system, sans-serif`;
      ctx.fillStyle = isFiltered ? 'rgba(255, 255, 255, 0.3)' : '#ffffff';
      ctx.fillText(code, pt.x + 8 * dpr, pt.y - 4 * dpr);

      if (people.length > 0 && !isFiltered) {
        ctx.font = `500 ${9 * dpr}px -apple-system, sans-serif`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`(${people[0]})`, pt.x + 8 * dpr, pt.y + 8 * dpr);
      }
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
