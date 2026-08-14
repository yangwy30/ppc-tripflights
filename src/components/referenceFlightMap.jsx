import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoAlbersUsa } from 'd3-geo';

const US_GEOGRAPHY = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const ROUTE_COLORS = [
  'oklch(0.55 0.22 277)',
  'oklch(0.68 0.16 200)',
  'oklch(0.67 0.17 154)',
  'oklch(0.72 0.16 70)',
  'oklch(0.63 0.19 330)',
  'oklch(0.62 0.12 245)'
];

// d3 projections use [longitude, latitude].
const AIRPORT_COORDS = {
  JFK: [-73.7781, 40.6413], EWR: [-74.1745, 40.6895], LGA: [-73.8740, 40.7769],
  BOS: [-71.0096, 42.3656], MIA: [-80.2870, 25.7959], MCO: [-81.3081, 28.4312],
  IAD: [-77.4565, 38.9531], DCA: [-77.0402, 38.8512], ATL: [-84.4277, 33.6407],
  ORD: [-87.9073, 41.9742], MDW: [-87.7522, 41.7868], DFW: [-97.0403, 32.8998],
  IAH: [-95.3368, 29.9902], MSP: [-93.2223, 44.8848], DTW: [-83.3554, 42.2162],
  DEN: [-104.6737, 39.8561], SLC: [-111.9791, 40.7899], PHX: [-112.0101, 33.4352],
  LAX: [-118.4085, 33.9416], SFO: [-122.3790, 37.6213], SJC: [-121.9289, 37.3639],
  OAK: [-122.2207, 37.7213], SEA: [-122.3088, 47.4502], SAN: [-117.1933, 32.7338],
  SNA: [-117.8674, 33.6757], PSP: [-116.5067, 33.8297], LAS: [-115.1537, 36.0840],
  HNL: [-157.9225, 21.3187], OGG: [-156.4305, 20.8986],
  YYZ: [-79.6248, 43.6777], YVR: [-123.1815, 49.1967], MEX: [-99.0719, 19.4361]
};

const projection = geoAlbersUsa()
  .translate([400, 230])
  .scale(950);

function buildRoutePath(from, to) {
  const [startX, startY] = from;
  const [endX, endY] = to;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const curve = 0.22 * distance;

  return `M ${startX} ${startY} Q ${(startX + endX) / 2 + (-deltaY / (distance || 1)) * curve} ${(startY + endY) / 2 + (deltaX / (distance || 1)) * curve - 0.35 * curve} ${endX} ${endY}`;
}

function getAirportCode(endpoint) {
  return (endpoint?.code || '').trim().toUpperCase();
}

function getAirportCity(endpoint, fallbackCode) {
  return endpoint?.city || endpoint?.name || fallbackCode;
}

function uniqueEndpoints(routes) {
  const seen = new Set();
  return routes.filter(route => {
    if (seen.has(route.toCode)) return false;
    seen.add(route.toCode);
    return true;
  });
}

export function ReferenceFlightMap({ flights = [], participants = [], trip = {}, phaseName = 'outbound' }) {
  const participantNames = useMemo(
    () => participants.map(person => (typeof person === 'string' ? person : person.name || '').trim().toLowerCase()),
    [participants]
  );

  const routes = useMemo(() => flights.map((flight, index) => {
    const fromCode = getAirportCode(flight.departure);
    const toCode = getAirportCode(flight.arrival);
    const fromCoords = AIRPORT_COORDS[fromCode];
    const toCoords = AIRPORT_COORDS[toCode];
    if (!fromCoords || !toCoords) return null;
    const from = projection(fromCoords);
    const to = projection(toCoords);
    if (!from || !to) return null;

    const participantIndex = participantNames.indexOf((flight.addedBy || '').trim().toLowerCase());
    const colorIndex = participantIndex >= 0 ? participantIndex : index;

    return {
      id: String(flight.id || `${fromCode}-${toCode}-${index}`).replace(/[^a-zA-Z0-9_-]/g, '-'),
      traveler: flight.addedBy || 'Traveler',
      flightNumber: flight.flightNumber || '',
      fromCode,
      fromCity: getAirportCity(flight.departure, fromCode),
      toCode,
      toCity: getAirportCity(flight.arrival, toCode),
      color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
      from,
      to,
      path: buildRoutePath(from, to),
      delay: 0.6 * index
    };
  }).filter(Boolean), [flights, participantNames]);

  const isInbound = phaseName === 'return';
  const title = isInbound ? 'Inbound routes' : 'Outbound routes';
  const destinationLabel = isInbound
    ? 'HOMEBOUND'
    : (trip.destinationAirport || routes[0]?.toCode || 'DEST').split(',').join(' / ');
  const subtitle = isInbound
    ? `${routes.length} ${routes.length === 1 ? 'flight' : 'flights'} heading home`
    : `${routes.length} ${routes.length === 1 ? 'flight' : 'flights'} converging on ${destinationLabel}`;
  const legendRoutes = isInbound ? routes : routes;

  return (
    <section className="reference-flight-map" aria-label={`${title} map`}>
      <header className="reference-flight-map-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="reference-map-destination">
          <i />
          {destinationLabel}
        </span>
      </header>

      <div className="reference-flight-map-stage">
        {routes.length ? (
          <ComposableMap projection={projection} width={800} height={460} className="reference-map-svg">
            <defs>
              {routes.map(route => (
                <linearGradient
                  id={`route-${route.id}`}
                  key={`gradient-${route.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={route.from[0]}
                  y1={route.from[1]}
                  x2={route.to[0]}
                  y2={route.to[1]}
                >
                  <stop offset="0%" stopColor={route.color} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={route.color} stopOpacity="1" />
                </linearGradient>
              ))}
            </defs>

            <Geographies geography={US_GEOGRAPHY}>
              {({ geographies }) => geographies.map(geography => (
                <Geography
                  key={geography.rsmKey}
                  geography={geography}
                  className="reference-map-geography"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: 'var(--reference-map-hover)' },
                    pressed: { outline: 'none' }
                  }}
                />
              ))}
            </Geographies>

            {routes.map(route => (
              <g key={`route-${route.id}`}>
                <path
                  d={route.path}
                  fill="none"
                  stroke={`url(#route-${route.id})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  className="route-arc"
                  style={{ animationDelay: `${route.delay}s` }}
                />
                <circle r={3.5} fill={route.color} className="route-plane">
                  <animateMotion
                    dur="3.2s"
                    begin={`${route.delay}s`}
                    repeatCount="indefinite"
                    path={route.path}
                    rotate="auto"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              </g>
            ))}

            {routes.map(route => (
              <g key={`origin-${route.id}`} transform={`translate(${route.from[0]}, ${route.from[1]})`}>
                <circle r={9} fill={route.color} opacity={0.18} />
                <circle r={4} fill={route.color} stroke="var(--reference-map-card)" strokeWidth={1.5} />
              </g>
            ))}

            {uniqueEndpoints(routes).map(route => (
              <g key={`destination-${route.toCode}`} transform={`translate(${route.to[0]}, ${route.to[1]})`}>
                <circle r={14} className="reference-destination-pulse dest-pulse" style={{ transformOrigin: 'center' }} />
                <circle r={6} className="reference-destination-dot" stroke="var(--reference-map-card)" strokeWidth={2} />
              </g>
            ))}
          </ComposableMap>
        ) : (
          <div className="reference-map-empty">No supported U.S. routes in this view</div>
        )}
      </div>

      <footer className="reference-flight-map-legend">
        {legendRoutes.map(route => (
          <div className="reference-map-legend-item" key={`legend-${route.id}`}>
            <span style={{ backgroundColor: route.color }} />
            <small>
              <strong>{isInbound ? route.toCode : route.fromCode}</strong>{' '}
              {isInbound ? route.toCity : route.fromCity}
            </small>
          </div>
        ))}
      </footer>
    </section>
  );
}
