/* ============================================
   PPC: Delay No More — Professional Flight Route Map Engine
   Single-Layer CartoDB Dark Matter @2x Retina Basemap + Dynamic Multi-Arc Fan Offset
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
          CartoDB Dark Retina Basemap · Scroll to Zoom · Drag to Pan
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
  const airportMap = new Map();

  // Group Flights by Route Pair to Compute Dynamic Curvature Fan Offsets
  const routeGroups = new Map();
  flights.forEach(f => {
    const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
    const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
    const routeKey = `${depCode}-${arrCode}`;

    if (!routeGroups.has(routeKey)) routeGroups.set(routeKey, []);
    routeGroups.get(routeKey).push(f);
  });

  // Render Flights with Dynamic Arc Fan Offsets
  routeGroups.forEach((flightList, routeKey) => {
    const totalInGroup = flightList.length;

    flightList.forEach((f, idxInGroup) => {
      const depCode = (f.departure?.code || 'JFK').toUpperCase().trim();
      const arrCode = (f.arrival?.code || 'LAX').toUpperCase().trim();
      const pIndex = participants.findIndex(p => p.name === f.addedBy);
      const color = PERSON_COLORS_HEX[pIndex >= 0 ? pIndex % 6 : 0];
      const isFilteredOut = activePersonFilter !== 'all' && activePersonFilter !== f.addedBy;

      const startCoords = AIRPORT_COORDS[depCode] || [40.6413, -73.7781];
      const endCoords = AIRPORT_COORDS[arrCode] || [33.9416, -118.4085];

      bounds.push(startCoords);
      bounds.push(endCoords);

      if (!airportMap.has(depCode)) airportMap.set(depCode, { coords: startCoords, people: new Set() });
      if (!airportMap.has(arrCode)) airportMap.set(arrCode, { coords: endCoords, people: new Set() });
      airportMap.get(depCode).people.add(f.addedBy);

      // Compute Dynamic Fan Offset Factor so lines never overlap!
      // Center the fan: e.g. for 3 flights -> offsets: -0.12, 0, +0.12
      const offsetMultiplier = totalInGroup > 1
        ? (idxInGroup - (totalInGroup - 1) / 2) * 0.14
        : 0;

      const arcPoints = getGreatCircleArcOffset(startCoords, endCoords, 60, offsetMultiplier);

      const polyline = L.polyline(arcPoints, {
        color: color,
        weight: isFilteredOut ? 2 : 4,
        opacity: isFilteredOut ? 0.2 : 0.9,
        lineCap: 'round'
      }).addTo(map);

      polyline.bindTooltip(`
        <div style="font-weight:800; font-family:var(--font-family-mono); font-size:12px; color:#fff;">
          ${escapeHtml(f.flightNumber)} · ${escapeHtml(depCode)} ➔ ${escapeHtml(arrCode)}
        </div>
        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">
          Traveler: <strong style="color:${color}">${escapeHtml(f.addedBy)}</strong>
        </div>
        <div style="font-size:10px; color:#64748B; margin-top:2px; font-family:var(--font-family-mono);">
          ${escapeHtml(f.departure?.time || '')} ➔ ${escapeHtml(f.arrival?.time || '')}
        </div>
      `, { sticky: true, className: 'leaflet-dark-tooltip' });
    });
  });

  // Add Airport Beacons with Clean Aggregated Labels
  airportMap.forEach((data, code) => {
    const { coords, people } = data;
    const peopleArr = Array.from(people);
    const isFiltered = activePersonFilter !== 'all' && !peopleArr.includes(activePersonFilter);
    const peopleLabel = peopleArr.length > 0 ? ` (${peopleArr.join(', ')})` : '';

    const customIcon = L.divIcon({
      className: 'airport-beacon-marker',
      html: `
        <div style="display:flex; align-items:center; gap:5px; transform: translate(-50%, -50%); cursor:pointer;">
          <div style="width:12px; height:12px; border-radius:50%; background:#0A84FF; box-shadow:0 0 12px #0A84FF; border:2px solid #fff;"></div>
          <div style="font-size:11px; font-weight:800; font-family:var(--font-family-mono); color:${isFiltered ? '#64748B' : '#ffffff'}; text-shadow:0 1px 4px #000; white-space:nowrap; background:rgba(15,23,42,0.9); padding:2px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">
            ${code} <span style="font-size:9px; font-weight:500; color:#38BDF8;">${peopleLabel}</span>
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
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
 * Great Circle Arc Geodesic Interpolation with Curvature Offset
 */
function getGreatCircleArcOffset(start, end, numPoints = 50, offsetFactor = 0) {
  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
  ));

  if (d === 0) return [start, end];

  // Perpendicular vector for arc curvature offset
  const dLat = end[0] - start[0];
  const dLon = end[1] - start[1];
  const perpLat = -dLon * 0.15 * offsetFactor;
  const perpLon = dLat * 0.15 * offsetFactor;

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

    // Apply smooth parabolic offset along arc
    const arcHeight = Math.sin(f * Math.PI);
    lat += perpLat * arcHeight;
    lon += perpLon * arcHeight;

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
