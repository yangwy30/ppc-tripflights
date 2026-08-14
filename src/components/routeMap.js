/* Route Map Engine — light convergence-map treatment */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PERSON_COLORS_HEX = [
  '#635BFF', '#1AA7A1', '#53B987',
  '#D4A43A', '#DB6D9A', '#7C8A9E'
];

const AIRPORT_COORDS = {
  JFK: [40.6413, -73.7781], EWR: [40.6895, -74.1745], LGA: [40.7769, -73.8740],
  BOS: [42.3656, -71.0096], MIA: [25.7959, -80.2870], MCO: [28.4312, -81.3081],
  IAD: [38.9531, -77.4565], DCA: [38.8512, -77.0402], ATL: [33.6407, -84.4277],
  ORD: [41.9742, -87.9073], MDW: [41.7868, -87.7522], DFW: [32.8998, -97.0403],
  IAH: [29.9902, -95.3368], MSP: [44.8848, -93.2223], DTW: [42.2162, -83.3554],
  DEN: [39.8561, -104.6737], SLC: [40.7899, -111.9791], PHX: [33.4352, -112.0101],
  LAX: [33.9416, -118.4085], SFO: [37.6213, -122.3790], SJC: [37.3639, -121.9289],
  OAK: [37.7213, -122.2207], SEA: [47.4502, -122.3088], SAN: [32.7338, -117.1933],
  SNA: [33.6757, -117.8674], PSP: [33.8297, -116.5067], LAS: [36.0840, -115.1537],
  HNL: [21.3187, -157.9225], OGG: [20.8986, -156.4305], LHR: [51.4700, -0.4543],
  LGW: [51.1537, -0.1821], CDG: [49.0097, 2.5479], AMS: [52.3105, 4.7683],
  FRA: [50.0379, 8.5622], FCO: [41.8003, 12.2389], MUC: [48.3537, 11.7860],
  ZRH: [47.4582, 8.5622], DXB: [25.2532, 55.3657], SIN: [1.3644, 103.9915],
  HND: [35.5494, 139.7798], NRT: [35.7720, 140.3929], ICN: [37.4602, 126.4407],
  HKG: [22.3080, 113.9185], PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083],
  SYD: [-33.9399, 151.1753], MEL: [-37.8670, 144.9070], BNE: [-27.3842, 153.1175],
  YYZ: [43.6777, -79.6248], YVR: [49.1967, -123.1815], MEX: [19.4361, -99.0719],
  GRU: [-23.4356, -46.4731], MAD: [40.4983, -3.5676], BCN: [41.2974, 2.0833]
};

// Closely spaced metro airports need a small visual fan-out at dashboard zoom levels.
const AIRPORT_MARKER_OFFSETS = {
  EWR: [-22, -12], JFK: [18, 6], LGA: [4, -24],
  SFO: [-16, -14], OAK: [16, -10], SJC: [-18, -18],
  LAX: [10, 8], SNA: [17, 10], PSP: [20, -8],
  LHR: [-16, -11], LGW: [16, 11], HND: [-15, -10], NRT: [17, 10]
};

let activeLeafletMap = null;

export function destroyRouteMap() {
  if (!activeLeafletMap) return;
  try {
    activeLeafletMap.stop();
    activeLeafletMap.off();
    activeLeafletMap.remove();
  } catch (_) {
    // Leaflet can already be detached when the dashboard rerenders.
  }
  activeLeafletMap = null;
}

export function renderRouteMap(container, flights = [], participants = [], trip = {}, activePersonFilter = 'all', phaseName = 'outbound') {
  destroyRouteMap();

  const normalizedParticipants = participants.map(person => typeof person === 'string' ? { name: person } : person);
  const destinationCodes = (trip.destinationAirport || '')
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(Boolean);
  const phaseLabel = phaseName === 'return' ? 'Return routes' : 'Inbound routes';

  container.innerHTML = `
    <section class="route-map-hero-card" aria-label="${escapeHtml(phaseLabel)} map">
      <header class="route-map-header">
        <div>
          <span class="section-kicker">CONVERGENCE MAP</span>
          <h2>${escapeHtml(phaseLabel)}</h2>
          <p>${flights.length} ${flights.length === 1 ? 'flight' : 'flights'} ${phaseName === 'return' ? 'heading home' : `converging on ${escapeHtml(destinationCodes.join(' / ') || 'the destination')}`}</p>
        </div>
        <div class="route-map-header-meta">
          ${destinationCodes.length ? `<span class="destination-map-badge"><i></i>${escapeHtml(destinationCodes.join(' / '))}</span>` : ''}
          <span class="route-live-label"><i></i> LIVE RADAR</span>
        </div>
      </header>
      <div id="hero-leaflet-map" class="route-map-canvas"></div>
      <footer class="route-map-legend" aria-label="Traveler route colors">
        ${renderLegend(flights, normalizedParticipants, activePersonFilter)}
      </footer>
    </section>
  `;

  const mapElement = container.querySelector('#hero-leaflet-map');
  if (!mapElement) return;

  const map = L.map(mapElement, {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false
  }).setView([38, -96], 4);
  activeLeafletMap = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png', {
    maxZoom: 18,
    subdomains: 'abcd'
  }).addTo(map);

  const bounds = [];
  const airportGroups = new Map();
  const participantNames = normalizedParticipants.map(person => (person.name || '').trim().toLowerCase());
  const fallbackCoord = destinationCodes.map(code => AIRPORT_COORDS[code]).find(Boolean) || [38, -96];

  const getTravelerColor = (name) => {
    const normalizedName = (name || '').trim().toLowerCase();
    const participantIndex = participantNames.indexOf(normalizedName);
    if (participantIndex >= 0) return PERSON_COLORS_HEX[participantIndex % PERSON_COLORS_HEX.length];
    let hash = 0;
    for (let index = 0; index < normalizedName.length; index += 1) {
      hash = normalizedName.charCodeAt(index) + ((hash << 5) - hash);
    }
    return PERSON_COLORS_HEX[Math.abs(hash) % PERSON_COLORS_HEX.length];
  };

  flights.forEach((flight, routeIndex) => {
    const departureCode = (flight.departure?.code || '').trim().toUpperCase();
    const arrivalCode = (flight.arrival?.code || '').trim().toUpperCase();
    if (!departureCode || !arrivalCode) return;

    const start = AIRPORT_COORDS[departureCode] || fallbackCoord;
    const end = AIRPORT_COORDS[arrivalCode] || fallbackCoord;
    const color = getTravelerColor(flight.addedBy);
    const isDimmed = activePersonFilter !== 'all' && activePersonFilter !== flight.addedBy;
    const arc = getGreatCircleArc(start, end, 80, routeIndex);

    bounds.push(start, end);
    addAirportTraveler(airportGroups, departureCode, start, flight, color, 'departure');
    addAirportTraveler(airportGroups, arrivalCode, end, flight, color, 'arrival');

    const route = L.polyline(arc, {
      color,
      weight: isDimmed ? 1.5 : 2.35,
      opacity: isDimmed ? 0.14 : 0.68,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: true
    }).addTo(map);

    route.getElement()?.classList.add('map-route-line');
    route.bindTooltip(`
      <div class="map-tooltip-route">
        <strong>${escapeHtml(flight.addedBy || 'Traveler')} · ${escapeHtml(flight.flightNumber || 'Flight')}</strong>
        <span>${escapeHtml(departureCode)} ${escapeHtml(flight.departure?.time || '')} → ${escapeHtml(arrivalCode)} ${escapeHtml(flight.arrival?.time || '')}</span>
      </div>
    `, { sticky: true, className: 'leaflet-route-tooltip' });
  });

  airportGroups.forEach((airport, code) => {
    const allTravelers = uniqueByName([...airport.departures, ...airport.arrivals]);
    const isDestination = destinationCodes.includes(code) || (phaseName === 'return' && airport.arrivals.length > 0);
    const isDimmed = activePersonFilter !== 'all' && !allTravelers.some(person => person.name === activePersonFilter);
    const markerColor = isDestination ? '#161719' : (allTravelers[0]?.color || '#635BFF');
    const [offsetX, offsetY] = AIRPORT_MARKER_OFFSETS[code] || [0, 0];

    if (isDestination) {
      L.circleMarker(airport.coords, {
        radius: 13,
        color: '#D9FF43',
        weight: 1,
        opacity: 0.7,
        fillColor: '#D9FF43',
        fillOpacity: 0.16,
        interactive: false,
        className: 'destination-map-halo'
      }).addTo(map);
    }

    const travelersForLabel = phaseName === 'return' ? airport.arrivals : airport.departures;
    const icon = L.divIcon({
      className: 'airport-map-marker',
      iconSize: [1, 1],
      html: `
        <div class="airport-marker-shell ${isDestination ? 'is-destination' : ''}" style="--marker-color:${markerColor}; --marker-offset-x:${offsetX}px; --marker-offset-y:${offsetY}px; opacity:${isDimmed ? 0.3 : 1}">
          <span class="airport-marker-pulse"></span>
          <span class="airport-marker-dot"></span>
          <span class="airport-marker-label">${escapeHtml(code)}</span>
          ${renderMiniAvatars(uniqueByName(travelersForLabel))}
        </div>
      `
    });

    const marker = L.marker(airport.coords, { icon }).addTo(map);
    marker.bindTooltip(`
      <div class="map-tooltip-route">
        <strong>${escapeHtml(code)}</strong>
        <span>${allTravelers.length ? allTravelers.map(person => escapeHtml(person.name)).join(', ') : 'Trip airport'}</span>
      </div>
    `, { sticky: true, className: 'leaflet-route-tooltip' });
  });

  if (bounds.length) {
    map.fitBounds(bounds, {
      padding: window.innerWidth < 640 ? [34, 34] : [64, 64],
      maxZoom: 6,
      animate: false
    });
  }

  window.setTimeout(() => {
    if (activeLeafletMap === map) map.invalidateSize();
  }, 120);
}

function renderLegend(flights, participants, activePersonFilter) {
  const namesWithFlights = new Set(flights.map(flight => flight.addedBy));
  const entries = participants
    .map((person, index) => ({ ...person, color: PERSON_COLORS_HEX[index % PERSON_COLORS_HEX.length] }))
    .filter(person => namesWithFlights.has(person.name));

  if (!entries.length) return '<span class="route-map-empty-legend">Add a flight to draw its route</span>';

  return entries.map(person => `
    <span class="legend-chip ${activePersonFilter !== 'all' && activePersonFilter !== person.name ? 'dimmed' : ''}">
      <i class="legend-dot" style="background:${person.color}"></i>${escapeHtml(person.name)}
    </span>
  `).join('');
}

function addAirportTraveler(groups, code, coords, flight, color, type) {
  if (!groups.has(code)) groups.set(code, { coords, departures: [], arrivals: [] });
  groups.get(code)[type === 'departure' ? 'departures' : 'arrivals'].push({
    name: flight.addedBy || 'Traveler',
    color
  });
}

function uniqueByName(travelers) {
  const seen = new Set();
  return travelers.filter(traveler => {
    if (seen.has(traveler.name)) return false;
    seen.add(traveler.name);
    return true;
  });
}

function renderMiniAvatars(travelers) {
  if (!travelers.length) return '';
  return `
    <span class="airport-traveler-stack">
      ${travelers.slice(0, 3).map(traveler => `
        <i style="--traveler-color:${traveler.color}" title="${escapeHtml(traveler.name)}">${escapeHtml(traveler.name.charAt(0).toUpperCase())}</i>
      `).join('')}
      ${travelers.length > 3 ? `<i class="airport-traveler-more">+${travelers.length - 3}</i>` : ''}
    </span>
  `;
}

function getGreatCircleArc(start, end, pointCount = 80, routeIndex = 0) {
  const lat1 = start[0] * Math.PI / 180;
  const lon1 = start[1] * Math.PI / 180;
  const lat2 = end[0] * Math.PI / 180;
  const lon2 = end[1] * Math.PI / 180;
  const distance = 2 * Math.asin(Math.sqrt(
    Math.sin((lat1 - lat2) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon1 - lon2) / 2) ** 2
  ));

  if (!distance) return [start, end];

  const points = [];
  const fanOffset = ((routeIndex % 5) - 2) * 0.18;
  for (let index = 0; index <= pointCount; index += 1) {
    const progress = index / pointCount;
    const a = Math.sin((1 - progress) * distance) / Math.sin(distance);
    const b = Math.sin(progress * distance) / Math.sin(distance);
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2);
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2);
    const z = a * Math.sin(lat1) + b * Math.sin(lat2);
    let latitude = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    const longitude = Math.atan2(y, x) * 180 / Math.PI;
    latitude += Math.sin(progress * Math.PI) * fanOffset;
    points.push([latitude, longitude]);
  }
  return points;
}

function escapeHtml(value) {
  if (!value) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}
