/* ============================================
   PPC: Delay No More — Elegant Single Bundled Master Arc Route Map Engine
   Flighty & Linear Aesthetic: Single Master Arc + Avatar Ring Stack
   ============================================ */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PERSON_COLORS_HEX = [
  '#0A84FF', '#34C759', '#F59E0B',
  '#A855F7', '#EC4899', '#38BDF8'
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

  const phaseTitle = phaseName === 'outbound' ? '🛫 Outbound Convergence Map' : phaseName === 'return' ? '🛬 Return Routes Map' : '🗺️ Group Flight Network';

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
          Bundled Master Arcs · CartoDB Dark Basemap
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

  // Single-Layer CartoDB Dark Matter @2x Retina Basemap (Zero double-text overlap!)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  // Add Zoom Control at top right
  L.control.zoom({ position: 'topright' }).addTo(map);

  const bounds = [];

  // Group Flights by Unique Route Pair (e.g. "EWR-LAX", "JFK-LHR")
  const routeMasterMap = new Map();

  flights.forEach(f => {
    const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
    const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
    const routeKey = `${depCode}➔${arrCode}`;

    if (!routeMasterMap.has(routeKey)) {
      routeMasterMap.set(routeKey, {
        depCode,
        arrCode,
        flights: [],
        travelers: []
      });
    }
    const entry = routeMasterMap.get(routeKey);
    entry.flights.push(f);

    const pIndex = participants.findIndex(p => p.name === f.addedBy);
    const color = PERSON_COLORS_HEX[pIndex >= 0 ? pIndex % 6 : 0];
    entry.travelers.push({ name: f.addedBy, color, flight: f });
  });

  const airportMap = new Map();

  // Render ONE Single Bundled Master Arc for Each Route Pair
  routeMasterMap.forEach((entry, routeKey) => {
    const { depCode, arrCode, flights: routeFlights, travelers } = entry;

    const startCoords = AIRPORT_COORDS[depCode] || [40.6413, -73.7781];
    const endCoords = AIRPORT_COORDS[arrCode] || [33.9416, -118.4085];

    bounds.push(startCoords);
    bounds.push(endCoords);

    if (!airportMap.has(depCode)) airportMap.set(depCode, { coords: startCoords, travelers: [] });
    if (!airportMap.has(arrCode)) airportMap.set(arrCode, { coords: endCoords, travelers: [] });

    travelers.forEach(t => {
      if (!airportMap.get(depCode).travelers.some(existing => existing.name === t.name)) {
        airportMap.get(depCode).travelers.push(t);
      }
    });

    // Check if active filter matches any traveler on this master route
    const isMatchedByFilter = activePersonFilter === 'all' || travelers.some(t => t.name === activePersonFilter);
    const mainColor = travelers[0]?.color || '#0A84FF';

    // Compute Single Master Great Circle Arc Points
    const arcPoints = getGreatCircleArc(startCoords, endCoords, 60);

    // Draw One Master Glowing Polyline
    const polyline = L.polyline(arcPoints, {
      color: mainColor,
      weight: isMatchedByFilter ? 3.5 : 1.5,
      opacity: isMatchedByFilter ? 0.9 : 0.25,
      lineCap: 'round'
    }).addTo(map);

    // Construct Elegant Popover Tooltip for All Travelers on this Route
    const travelerRowsHtml = travelers.map(t => `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:4px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="width:7px; height:7px; border-radius:50%; background:${t.color}; display:inline-block;"></span>
          <strong style="color:#ffffff; font-size:11px;">${escapeHtml(t.name)}</strong>
        </div>
        <span style="font-family:var(--font-family-mono); font-size:10px; color:#38BDF8;">
          ${escapeHtml(t.flight.flightNumber)} (${escapeHtml(t.flight.departure?.time || '')})
        </span>
      </div>
    `).join('');

    polyline.bindTooltip(`
      <div style="min-width:180px;">
        <div style="font-weight:800; font-family:var(--font-family-mono); font-size:12px; color:#fff; display:flex; align-items:center; justify-content:space-between;">
          <span>✈️ ${escapeHtml(depCode)} ➔ ${escapeHtml(arrCode)}</span>
          <span style="font-size:10px; color:#94A3B8; font-weight:normal;">${travelers.length} traveler${travelers.length > 1 ? 's' : ''}</span>
        </div>
        ${travelerRowsHtml}
      </div>
    `, { sticky: true, className: 'leaflet-dark-tooltip' });

    // Add Midpoint Avatar Ring Stack Marker on the Arc
    const midIndex = Math.floor(arcPoints.length / 2);
    const midCoords = arcPoints[midIndex];

    const visibleTravelers = travelers.slice(0, 3);
    const overflowCount = Math.max(0, travelers.length - 3);

    const avatarStackHtml = `
      <div class="arc-avatar-pill" style="opacity:${isMatchedByFilter ? 1 : 0.35};">
        <div class="avatar-ring-stack">
          ${visibleTravelers.map((t, idx) => `
            <div class="avatar-ring-mini" style="background:${t.color}; margin-left:${idx > 0 ? '-6px' : '0'};">
              ${escapeHtml(t.name.charAt(0).toUpperCase())}
            </div>
          `).join('')}
          ${overflowCount > 0 ? `<div class="avatar-ring-mini overflow-mini">+${overflowCount}</div>` : ''}
        </div>
        <span style="font-size:10px; font-weight:700; font-family:var(--font-family-mono); color:#ffffff;">
          ${escapeHtml(depCode)}➔${escapeHtml(arrCode)}
        </span>
      </div>
    `;

    const arcMarkerIcon = L.divIcon({
      className: 'arc-avatar-marker',
      html: avatarStackHtml,
      iconSize: [0, 0]
    });

    L.marker(midCoords, { icon: arcMarkerIcon }).addTo(map);
  });

  // Add Clean Airport Node Markers
  airportMap.forEach((data, code) => {
    const { coords, travelers } = data;
    const isFiltered = activePersonFilter !== 'all' && !travelers.some(t => t.name === activePersonFilter);

    const customIcon = L.divIcon({
      className: 'airport-node-marker',
      html: `
        <div style="display:flex; align-items:center; gap:4px; transform: translate(-50%, -50%); cursor:pointer;">
          <div style="width:10px; height:10px; border-radius:50%; background:#0A84FF; box-shadow:0 0 10px #0A84FF; border:2px solid #fff;"></div>
          <div style="font-size:10px; font-weight:800; font-family:var(--font-family-mono); color:${isFiltered ? '#64748B' : '#ffffff'}; text-shadow:0 1px 4px #000; background:rgba(15,23,42,0.9); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.2);">
            ${code}
          </div>
        </div>
      `,
      iconSize: [0, 0]
    });

    L.marker(coords, { icon: customIcon }).addTo(map);
  });

  // Fit bounds if valid points exist
  if (bounds.length > 0) {
    try {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
    } catch (e) { }
  }

  // Trigger resize tick to ensure Leaflet renders tiles to fill container
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);
}

/**
 * Great Circle Arc Geodesic Interpolation
 */
function getGreatCircleArc(start, end, numPoints = 50) {
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

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    const lon = Math.atan2(y, x) * 180 / Math.PI;

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
