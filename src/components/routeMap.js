/* Route Map Engine */

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
let animFrameId = null;

export function destroyRouteMap() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (activeLeafletMap) {
    try {
      activeLeafletMap.remove();
    } catch (e) { }
    activeLeafletMap = null;
  }
}

export function renderRouteMap(container, flights = [], participants = [], trip = {}, activePersonFilter = 'all', phaseName = 'All') {
  destroyRouteMap();

  container.innerHTML = `
    <div class="route-map-hero-card">
      <div id="hero-leaflet-map" style="width:100%; height: var(--map-height, 340px); border-radius: var(--radius-md); overflow:hidden; border: 1px solid var(--color-border); z-index:1; background:#090A0F; position:relative;"></div>
    </div>
  `;

  const mapEl = container.querySelector('#hero-leaflet-map');
  if (!mapEl) return;

  // Set responsive map height variable
  if (window.innerWidth < 640) {
    mapEl.style.height = '260px';
  } else {
    mapEl.style.height = '360px';
  }

  // Initialize Leaflet Map with NO zoom controls
  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false
  }).setView([38, -96], 4);

  activeLeafletMap = map;

  // CartoDB Dark Matter @2x Retina Basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png', {
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  const bounds = [];
  const airportMap = new Map();
  const activeCorridors = [];

  // Normalized traveler color resolution helper
  const normalizedParticipants = participants.map(p => p.name.trim().toLowerCase());
  const getTravelerColor = (name) => {
    const norm = (name || '').trim().toLowerCase();
    const idx = normalizedParticipants.indexOf(norm);
    if (idx >= 0) return PERSON_COLORS_HEX[idx % PERSON_COLORS_HEX.length];
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

      if (!airportMap.has(depCode)) airportMap.set(depCode, { code: depCode, coords: startCoords, departures: [], arrivals: [] });
      if (!airportMap.has(arrCode)) airportMap.set(arrCode, { code: arrCode, coords: endCoords, departures: [], arrivals: [] });

      airportMap.get(depCode).departures.push({ name: f.addedBy, color, flight: f });
      airportMap.get(arrCode).arrivals.push({ name: f.addedBy, color, flight: f });

      // Algorithmic Arc Fan-out Formula
      const isReversed = depCode > arrCode;
      const fanOffset = totalInCorridor > 1 ? (idxInCorridor - (totalInCorridor - 1) / 2) * 0.16 : 0.12;
      const arcHeightFactor = (isReversed ? -1 : 1) * fanOffset;

      const arcPoints = getGreatCircleArcOffset(startCoords, endCoords, 100, arcHeightFactor);

      // Draw Polyline Arc
      const polyline = L.polyline(arcPoints, {
        color: color,
        weight: isFilteredOut ? 1.5 : 3.5,
        opacity: isFilteredOut ? 0.2 : 0.85,
        lineCap: 'round'
      }).addTo(map);

      // Store flow corridor data with geodesic distance for constant-velocity movement
      if (!isFilteredOut && phaseName !== 'all') {
        const distKm = getGeodesicDistanceKm(startCoords, endCoords);
        activeCorridors.push({
          points: arcPoints,
          color,
          distKm,
          depCode,
          arrCode
        });
      }

      polyline.bindTooltip(`
        <div style="padding: 4px 6px;">
          <div style="font-weight:800; font-family:var(--font-family-mono); font-size:12px; color:#fff; display:flex; align-items:center; gap:8px;">
            <span>${escapeHtml(f.flightNumber)}</span>
            <span style="color:${color}; font-weight:700;">${escapeHtml(f.addedBy)}</span>
          </div>
          <div style="font-size:11px; color:#94A3B8; margin-top:3px; font-family:var(--font-family-mono);">
            ${escapeHtml(depCode)} ➔ ${escapeHtml(arrCode)} (${escapeHtml(f.departure?.time || '')} ➔ ${escapeHtml(f.arrival?.time || '')})
          </div>
        </div>
      `, { sticky: true, className: 'leaflet-dark-tooltip' });
    });
  });

  if (bounds.length > 0) {
    try {
      const isMobile = window.innerWidth < 640;
      const fitPadding = isMobile ? [24, 24] : [45, 45];
      map.fitBounds(bounds, { padding: fitPadding, maxZoom: 6 });
    } catch (e) { }
  }

  // ALGORITHMIC DYNAMIC COLLISION AUTO-LAYOUT FOR AIRPORT PINS
  const airportList = Array.from(airportMap.values());
  const pillOffsetsMap = new Map();

  airportList.forEach((ap) => {
    pillOffsetsMap.set(ap.code, { dx: 0, dy: -20 });
  });

  const isMobileScreen = window.innerWidth < 640;
  const collisionThreshold = isMobileScreen ? 70 : 55;
  const pushDistance = isMobileScreen ? 46 : 36;

  for (let i = 0; i < airportList.length; i++) {
    for (let j = i + 1; j < airportList.length; j++) {
      const apA = airportList[i];
      const apB = airportList[j];

      const ptA = map.latLngToContainerPoint(apA.coords);
      const ptB = map.latLngToContainerPoint(apB.coords);

      const dx = ptB.x - ptA.x;
      const dy = ptB.y - ptA.y;
      const dist = Math.hypot(dx, dy);

      if (dist < collisionThreshold) {
        const angle = Math.atan2(dy, dx);

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

  const totalGroupCount = participants.length || 1;

  // Render Clean Airport Pins (ZERO EMOJIS)
  airportMap.forEach((data, code) => {
    const { coords, departures, arrivals } = data;
    const allTravelers = [...departures, ...arrivals];
    const isFiltered = activePersonFilter !== 'all' && !allTravelers.some(t => t.name === activePersonFilter);

    let travelerList = [];

    if (phaseName === 'outbound') {
      if (departures.length > 0 && arrivals.length === 0) {
        travelerList = departures;
      } else if (arrivals.length > 0 && departures.length === 0) {
        travelerList = [];
      }
    } else if (phaseName === 'return') {
      if (departures.length > 0 && arrivals.length === 0) {
        travelerList = [];
      } else if (arrivals.length > 0 && departures.length === 0) {
        travelerList = arrivals;
      }
    } else {
      travelerList = allTravelers;
    }

    const uniqueTravelers = [];
    const seenNames = new Set();
    travelerList.forEach(t => {
      if (!seenNames.has(t.name)) {
        seenNames.add(t.name);
        uniqueTravelers.push(t);
      }
    });

    const isSharedByEveryone = uniqueTravelers.length >= totalGroupCount;

    const avatarStackHtml = (!isSharedByEveryone && uniqueTravelers.length > 0)
      ? uniqueTravelers.slice(0, 3).map(t => `
        <span style="width:16px; height:16px; border-radius:50%; background:${t.color}; display:inline-flex; align-items:center; justify-content:center; font-size:8px; font-weight:800; color:#fff; border:1px solid #0F172A; margin-left:-4px;">
          ${escapeHtml(t.name.charAt(0).toUpperCase())}
        </span>
      `).join('')
      : '';

    const offset = pillOffsetsMap.get(code) || { dx: 0, dy: -20 };
    const pillStyle = `top: ${offset.dy}px; left: ${offset.dx}px; transform: translate(-50%, -50%);`;

    // ZERO EMOJI — Clean Minimalist Dark Pill Marker
    const customIcon = L.divIcon({
      className: 'airport-pill-marker',
      html: `
        <div style="position:relative; cursor:pointer; opacity:${isFiltered ? 0.35 : 1};">
          <div style="width:8px; height:8px; border-radius:50%; background:#0A84FF; box-shadow:0 0 10px #0A84FF; border:1.5px solid #ffffff; transform:translate(-50%, -50%);"></div>
          
          <div style="position:absolute; ${pillStyle} display:inline-flex; align-items:center; gap:5px; background:rgba(15,23,42,0.95); border:1px solid rgba(255,255,255,0.22); border-radius:12px; padding:3px 10px; backdrop-filter:blur(10px); box-shadow:0 4px 18px rgba(0,0,0,0.75); white-space:nowrap; z-index:10;">
            <span style="font-size:11px; font-weight:800; font-family:var(--font-family-mono); color:#ffffff; letter-spacing:0.5px;">${code}</span>
            ${avatarStackHtml ? `
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

    const namesList = Array.from(new Set(allTravelers.map(t => escapeHtml(t.name)))).join(', ');
    marker.bindTooltip(`
      <div style="font-size:11px; font-weight:700; color:#fff; font-family:var(--font-family-mono);">
        Airport ${code}
      </div>
      <div style="font-size:10px; color:#94A3B8; margin-top:2px;">
        Travelers: ${namesList || 'None'}
      </div>
    `, { sticky: true, className: 'leaflet-dark-tooltip' });
  });

  // CONSTANT VELOCITY SMOOTH ARROW MARKERS WITH DOM REFERENCE CACHING (HIGH PERFORMANCE 60 FPS LOOP)
  if (phaseName !== 'all' && activeCorridors.length > 0) {
    const flowMarkers = [];
    activeCorridors.forEach(corridor => {
      const icon = L.divIcon({
        className: 'flow-arrow-marker',
        html: `
          <div class="arrow-wrapper" style="position:relative; width:16px; height:16px; display:flex; align-items:center; justify-content:center; opacity:0; transition: opacity 0.15s ease-out;">
            <span class="arrow-inner" style="display:inline-block; color:${corridor.color}; font-size:11px; font-weight:900; line-height:1; filter:drop-shadow(0 0 6px ${corridor.color}); transform-origin: center center;">
              ▶
            </span>
          </div>
        `,
        iconSize: [0, 0]
      });

      const flowMarker = L.marker(corridor.points[0], { icon }).addTo(map);
      
      // Cache DOM references inside flowMarkers upon creation! (Eliminates querySelector inside 60 FPS loop!)
      const el = flowMarker.getElement();
      flowMarkers.push({
        marker: flowMarker,
        wrapperEl: el?.querySelector('.arrow-wrapper'),
        innerEl: el?.querySelector('.arrow-inner'),
        points: corridor.points,
        distKm: corridor.distKm || 1000
      });
    });

    let globalTime = 0;
    function animateFlow() {
      if (!activeLeafletMap) return;

      globalTime += 0.016;

      flowMarkers.forEach((item, idx) => {
        const pts = item.points;
        if (!pts || pts.length < 2) return;

        const totalPts = pts.length;
        const travelRate = 400; // km/sec
        const cycleDuration = Math.max(2.5, item.distKm / travelRate);
        const offsetProgress = ((globalTime / cycleDuration) + (idx * 0.35)) % 1;

        // Sub-pixel continuous LERP coordinate calculation
        const exactIndex = offsetProgress * (totalPts - 1);

        const i1 = Math.min(totalPts - 2, Math.floor(exactIndex));
        const i2 = i1 + 1;
        const weight = exactIndex - Math.floor(exactIndex);

        const lat1 = pts[i1][0], lon1 = pts[i1][1];
        const lat2 = pts[i2][0], lon2 = pts[i2][1];

        const currentLat = lat1 + (lat2 - lat1) * weight;
        const currentLon = lon1 + (lon2 - lon1) * weight;

        item.marker.setLatLng([currentLat, currentLon]);

        // Compute Tangent Vector Angle
        const pt1 = map.latLngToContainerPoint(pts[i1]);
        const pt2 = map.latLngToContainerPoint(pts[i2]);
        const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * (180 / Math.PI);

        // Smooth Alpha Fade near endpoints (Fade-in on takeoff <0.08, Fade-out on landing >0.92)
        let alpha = 1.0;
        if (offsetProgress < 0.08) {
          alpha = offsetProgress / 0.08;
        } else if (offsetProgress > 0.92) {
          alpha = (1.0 - offsetProgress) / 0.08;
        }

        // Direct cached DOM reference manipulation (0 querySelector calls in animation loop!)
        if (item.wrapperEl) {
          item.wrapperEl.style.opacity = alpha.toFixed(2);
        } else {
          const el = item.marker.getElement();
          if (el) item.wrapperEl = el.querySelector('.arrow-wrapper');
        }

        if (item.innerEl) {
          item.innerEl.style.transform = `rotate(${angle}deg)`;
        } else {
          const el = item.marker.getElement();
          if (el) item.innerEl = el.querySelector('.arrow-inner');
        }
      });

      animFrameId = requestAnimationFrame(animateFlow);
    }

    animateFlow();
  }

  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);
}

/**
 * Geodesic Distance Calculation in Kilometers (Haversine formula)
 */
function getGeodesicDistanceKm(start, end) {
  const R = 6371; // Earth radius in km
  const dLat = (end[0] - start[0]) * Math.PI / 180;
  const dLon = (end[1] - start[1]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Great Circle Arc Interpolation with Curvature Offset
 */
function getGreatCircleArcOffset(start, end, numPoints = 100, arcHeightFactor = 0.15) {
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
