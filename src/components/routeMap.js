/* ============================================
   PPC: Delay No More — Scalable Algorithmic Flight Route Map Engine
   Zero Hardcoding: Screen Point Collision Auto-Layout + Algorithmic Arc Fan-Out
   ============================================ */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// High-Contrast Neon Palette tuned for Dark Basemaps
const PERSON_COLORS_HEX = [
  '#38BDF8', // Person 1: Sky Cyan
  '#FF2D55', // Person 2: Neon Coral Red
  '#F59E0B', // Person 3: Amber Gold
  '#AF52DE', // Person 4: Electric Violet
  '#34C759', // Person 5: Mint Green
  '#FF9500'  // Person 6: Bright Orange
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

let activeLeafletMap = null;

export function renderRouteMap(container, flights = [], participants = [], trip = {}, activePersonFilter = 'all', phaseName = 'All') {
  if (activeLeafletMap) {
    try {
      activeLeafletMap.remove();
    } catch (e) { }
    activeLeafletMap = null;
  }

  const phaseTitle = phaseName === 'outbound' ? '🛫 Outbound Network' : phaseName === 'return' ? '🛬 Return Network' : '🗺️ Flight Network';

  container.innerHTML = `
    <div class="route-map-hero-card">
      <div class="route-map-header">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--color-accent);">
            ${phaseTitle}
          </span>
          <span style="font-size:11px; color:var(--color-text-tertiary); font-family:var(--font-family-mono);">
            (${flights.length} flights)
          </span>
        </div>
        <div style="font-size: 11px; color: var(--color-text-tertiary); font-family: var(--font-family-mono);">
          CartoDB Dark Basemap · Algorithmic Auto-Layout
        </div>
      </div>

      <div id="hero-leaflet-map" style="width:100%; height:380px; border-radius: var(--radius-md); overflow:hidden; border: 1px solid var(--color-border); z-index:1; background:#090A0F; position:relative;"></div>
    </div>
  `;

  const mapEl = container.querySelector('#hero-leaflet-map');
  if (!mapEl) return;

  // Initialize Leaflet Map
  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false
  }).setView([38, -96], 4);

  activeLeafletMap = map;

  // CartoDB Dark Matter @2x Retina Basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  const bounds = [];
  const airportMap = new Map();

  // Normalized traveler color resolution helper
  const normalizedParticipants = participants.map(p => p.name.trim().toLowerCase());
  const getTravelerColor = (name) => {
    const norm = (name || '').trim().toLowerCase();
    const idx = normalizedParticipants.indexOf(norm);
    if (idx >= 0) return PERSON_COLORS_HEX[idx % PERSON_COLORS_HEX.length];
    // Deterministic Hash Fallback for non-listed participants
    let hash = 0;
    for (let i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
    return PERSON_COLORS_HEX[Math.abs(hash) % PERSON_COLORS_HEX.length];
  };

  // Group flights along route corridors for algorithmic arc fan-out
  const corridorGroups = new Map();

  flights.forEach(f => {
    const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
    const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
    const corridorKey = [depCode, arrCode].sort().join('-');

    if (!corridorGroups.has(corridorKey)) corridorGroups.set(corridorKey, []);
    corridorGroups.get(corridorKey).push(f);
  });

  // Render Flights with Algorithmic Arc Fan-Out
  corridorGroups.forEach((flightList, corridorKey) => {
    const totalInCorridor = flightList.length;

    flightList.forEach((f, idxInCorridor) => {
      const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
      const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
      const color = getTravelerColor(f.addedBy);
      const isFilteredOut = activePersonFilter !== 'all' && activePersonFilter !== f.addedBy;

      const startCoords = AIRPORT_COORDS[depCode] || [40.6413, -73.7781];
      const endCoords = AIRPORT_COORDS[arrCode] || [33.9416, -118.4085];

      bounds.push(startCoords);
      bounds.push(endCoords);

      // Track airports and traveler details
      if (!airportMap.has(depCode)) airportMap.set(depCode, { code: depCode, coords: startCoords, departures: [], arrivals: [] });
      if (!airportMap.has(arrCode)) airportMap.set(arrCode, { code: arrCode, coords: endCoords, departures: [], arrivals: [] });

      airportMap.get(depCode).departures.push({ name: f.addedBy, color, flight: f });
      airportMap.get(arrCode).arrivals.push({ name: f.addedBy, color, flight: f });

      // Algorithmic Arc Fan-out Formula (0 hardcoding)
      const isReversed = depCode > arrCode;
      const fanOffset = totalInCorridor > 1 ? (idxInCorridor - (totalInCorridor - 1) / 2) * 0.16 : 0.12;
      const arcHeightFactor = (isReversed ? -1 : 1) * fanOffset;

      const arcPoints = getGreatCircleArcOffset(startCoords, endCoords, 60, arcHeightFactor);

      // Draw Polyline Arc
      const polyline = L.polyline(arcPoints, {
        color: color,
        weight: isFilteredOut ? 1.5 : 3.5,
        opacity: isFilteredOut ? 0.2 : 0.9,
        lineCap: 'round'
      }).addTo(map);

      // Tooltip on Hover
      polyline.bindTooltip(`
        <div style="padding: 4px 6px;">
          <div style="font-weight:800; font-family:var(--font-family-mono); font-size:12px; color:#fff; display:flex; align-items:center; gap:8px;">
            <span>✈️ ${escapeHtml(f.flightNumber)}</span>
            <span style="color:${color}; font-weight:700;">${escapeHtml(f.addedBy)}</span>
          </div>
          <div style="font-size:11px; color:#94A3B8; margin-top:3px; font-family:var(--font-family-mono);">
            ${escapeHtml(depCode)} ➔ ${escapeHtml(arrCode)} (${escapeHtml(f.departure?.time || '')} ➔ ${escapeHtml(f.arrival?.time || '')})
          </div>
        </div>
      `, { sticky: true, className: 'leaflet-dark-tooltip' });
    });
  });

  // Fit bounds first so Leaflet establishes container pixel coordinates
  if (bounds.length > 0) {
    try {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
    } catch (e) { }
  }

  // ALGORITHMIC DYNAMIC COLLISION AUTO-LAYOUT FOR AIRPORT PINS (Zero Hardcoding!)
  const airportList = Array.from(airportMap.values());
  const pillOffsetsMap = new Map();

  airportList.forEach((ap, i) => {
    pillOffsetsMap.set(ap.code, { dx: 0, dy: -20 });
  });

  // Screen Point Collision Detection Loop
  for (let i = 0; i < airportList.length; i++) {
    for (let j = i + 1; j < airportList.length; j++) {
      const apA = airportList[i];
      const apB = airportList[j];

      const ptA = map.latLngToContainerPoint(apA.coords);
      const ptB = map.latLngToContainerPoint(apB.coords);

      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      const dist = Math.hypot(dx, dy);

      // If screen pixel distance < 50px, compute 2D repulsion vector
      if (dist < 50) {
        const angle = Math.atan2(dy, dx);
        const pushDistance = 32; // px

        // Repel A in opposite angle (-angle), B in angle
        pillOffsetsMap.set(apA.code, {
          dx: Math.round(-Math.cos(angle) * pushDistance),
          dy: Math.round(-Math.sin(angle) * pushDistance)
        });

        pillOffsetsMap.set(apB.code, {
          dx: Math.round(Math.cos(angle) * pushDistance),
          dy: Math.round(Math.sin(angle) * pushDistance)
        });
      }
    }
  }

  // Render UNIFIED Pill Pins with Algorithmic Auto-Layout Offsets
  airportMap.forEach((data, code) => {
    const { coords, departures, arrivals } = data;
    const allTravelers = [...departures, ...arrivals];
    const isFiltered = activePersonFilter !== 'all' && !allTravelers.some(t => t.name === activePersonFilter);

    // Distinct traveler initials for clean badges
    const uniqueTravelers = [];
    const seenNames = new Set();
    allTravelers.forEach(t => {
      if (!seenNames.has(t.name)) {
        seenNames.add(t.name);
        uniqueTravelers.push(t);
      }
    });

    const avatarStackHtml = uniqueTravelers.slice(0, 3).map(t => `
      <span style="width:16px; height:16px; border-radius:50%; background:${t.color}; display:inline-flex; align-items:center; justify-content:center; font-size:8px; font-weight:800; color:#fff; border:1px solid #0F172A; margin-left:-4px;">
        ${escapeHtml(t.name.charAt(0).toUpperCase())}
      </span>
    `).join('');

    const offset = pillOffsetsMap.get(code) || { dx: 0, dy: -20 };
    const pillStyle = `top: ${offset.dy}px; left: ${offset.dx}px; transform: translate(-50%, -50%);`;

    const customIcon = L.divIcon({
      className: 'airport-pill-marker',
      html: `
        <div style="position:relative; cursor:pointer; opacity:${isFiltered ? 0.35 : 1};">
          <!-- Exact Airport Location Dot -->
          <div style="width:8px; height:8px; border-radius:50%; background:#0A84FF; box-shadow:0 0 10px #0A84FF; border:1.5px solid #ffffff; transform:translate(-50%, -50%);"></div>
          
          <!-- Algorithmically Repelled Pill Badge -->
          <div style="position:absolute; ${pillStyle} display:inline-flex; align-items:center; gap:5px; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.22); border-radius:12px; padding:3px 8px; backdrop-filter:blur(10px); box-shadow:0 4px 18px rgba(0,0,0,0.75); white-space:nowrap; z-index:10;">
            <span style="font-size:11px; font-weight:800; font-family:var(--font-family-mono); color:#ffffff;">${code}</span>
            ${uniqueTravelers.length > 0 ? `
              <div style="display:flex; align-items:center; margin-left:4px;">
                ${avatarStackHtml}
              </div>
            ` : ''}
          </div>
        </div>
      `,
      iconSize: [0, 0]
    });

    const marker = L.marker(coords, { icon: customIcon }).addTo(map);

    const namesList = uniqueTravelers.map(t => escapeHtml(t.name)).join(', ');
    marker.bindTooltip(`
      <div style="font-size:11px; font-weight:700; color:#fff; font-family:var(--font-family-mono);">
        📍 Airport ${code}
      </div>
      <div style="font-size:10px; color:#94A3B8; margin-top:2px;">
        Group Travelers: ${namesList || 'None'}
      </div>
    `, { sticky: true, className: 'leaflet-dark-tooltip' });
  });

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);
}

/**
 * Great Circle Arc Interpolation with Curvature Offset
 */
function getGreatCircleArcOffset(start, end, numPoints = 50, arcHeightFactor = 0.15) {
  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
  ));

  if (d === 0) return [start, end];

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    let lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    let lon = Math.atan2(y, x) * 180 / Math.PI;

    // Apply smooth arc curve height
    const curveOffset = Math.sin(f * Math.PI) * arcHeightFactor * 25;
    lat += curveOffset * 0.15;

    points.push([lat, lon]);
  }
  return points;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
