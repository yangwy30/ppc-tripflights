/* ============================================
   PPC: Delay No More — Flight Lookup Service
   
   Uses AeroDataBox API via RapidAPI for real
   flight lookups, with mock data fallback.
   
   Returns ALL route options when a flight number
   has multiple routes (e.g. DL665).
   ============================================ */

// --- AeroDataBox Configuration ---
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'aerodatabox.p.rapidapi.com';
const BASE_URL = `https://${RAPIDAPI_HOST}`;

// --- Mock data fallback ---
const MOCK_FLIGHTS = {
    'AA100': { airline: 'American Airlines', departure: { code: 'JFK', city: 'New York', terminal: 'T8' }, arrival: { code: 'LHR', city: 'London', terminal: 'T5' }, departureTime: '19:00', arrivalTime: '07:15', duration: '7h 15m' },
    'UA901': { airline: 'United Airlines', departure: { code: 'SFO', city: 'San Francisco', terminal: 'T3' }, arrival: { code: 'NRT', city: 'Tokyo Narita', terminal: 'T1' }, departureTime: '11:30', arrivalTime: '15:00+1', duration: '11h 30m' },
    'DL45': { airline: 'Delta Air Lines', departure: { code: 'ATL', city: 'Atlanta', terminal: 'S' }, arrival: { code: 'CDG', city: 'Paris', terminal: 'T2E' }, departureTime: '17:10', arrivalTime: '07:55+1', duration: '8h 45m' },
    'BA178': { airline: 'British Airways', departure: { code: 'LHR', city: 'London', terminal: 'T5' }, arrival: { code: 'JFK', city: 'New York', terminal: 'T7' }, departureTime: '08:25', arrivalTime: '11:35', duration: '8h 10m' },
    'LH401': { airline: 'Lufthansa', departure: { code: 'FRA', city: 'Frankfurt', terminal: 'T1' }, arrival: { code: 'JFK', city: 'New York', terminal: 'T1' }, departureTime: '10:15', arrivalTime: '13:05', duration: '8h 50m' },
    'EK215': { airline: 'Emirates', departure: { code: 'DXB', city: 'Dubai', terminal: 'T3' }, arrival: { code: 'LAX', city: 'Los Angeles', terminal: 'TB' }, departureTime: '08:30', arrivalTime: '13:40', duration: '16h 10m' },
};

// --- API Headers ---
const API_HEADERS = {
    'X-RapidAPI-Key': RAPIDAPI_KEY,
    'X-RapidAPI-Host': RAPIDAPI_HOST,
};

// --- Status Mapping ---
function mapApiStatus(status) {
    if (!status) return 'scheduled';
    const s = status.toLowerCase();
    if (s.includes('landed') || s.includes('arrived')) return 'landed';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('delay')) return 'delayed';
    if (s.includes('active') || s.includes('en route') || s.includes('airborne')) return 'on-time';
    if (s.includes('scheduled') || s.includes('expected')) return 'scheduled';
    if (s.includes('boarding')) return 'boarding';
    return 'on-time';
}

// --- Duration calculation ---
function calcDuration(depTime, arrTime) {
    if (!depTime || !arrTime) return '';
    try {
        const dep = new Date(depTime);
        const arr = new Date(arrTime);
        const diffMs = arr - dep;
        if (diffMs <= 0) return '';
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    } catch {
        return '';
    }
}

// --- Time extraction ---
// Extracts HH:MM directly from the ISO string to preserve the AIRPORT's local time.
// AeroDataBox returns local times like "2026-03-08 19:45+05:00" or "2026-03-08T19:45:00".
// Using new Date() would convert to the browser's timezone, which is wrong for display.
function extractTime(isoString) {
    if (!isoString) return '';
    try {
        // Try to extract HH:MM directly from the string (works for "...T19:45..." or "... 19:45...")
        const timeMatch = isoString.match(/[T ]\s*(\d{2}:\d{2})/);
        if (timeMatch) return timeMatch[1];
        // Fallback: try Date parsing as last resort
        const d = new Date(isoString);
        if (isNaN(d)) return '';
        return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    } catch {
        return '';
    }
}

// --- Parse a SINGLE flight object from API ---
function parseSingleFlight(flight, flightNumber) {
    if (!flight) return null;
    const dep = flight.departure || {};
    const arr = flight.arrival || {};

    const depCode = dep.airport?.iata || dep.airport?.icao || '';
    const arrCode = arr.airport?.iata || arr.airport?.icao || '';
    const depCity = dep.airport?.municipalityName || dep.airport?.name || '';
    const arrCity = arr.airport?.municipalityName || arr.airport?.name || '';

    return {
        flightNumber: flight.number || flightNumber,
        airline: flight.airline?.name || '',
        departure: {
            code: depCode,
            city: depCity,
            time: extractTime(dep.scheduledTime?.local || dep.scheduledTime?.utc),
            terminal: dep.terminal || '',
        },
        arrival: {
            code: arrCode,
            city: arrCity,
            time: extractTime(arr.scheduledTime?.local || arr.scheduledTime?.utc),
            terminal: arr.terminal || '',
        },
        duration: calcDuration(
            dep.scheduledTime?.utc || dep.scheduledTime?.local,
            arr.scheduledTime?.utc || arr.scheduledTime?.local
        ),
        status: mapApiStatus(flight.status),
        aircraft: flight.aircraft?.model || '',
        gate: dep.gate || '',
        routeLabel: `${depCode} → ${arrCode} (${depCity} → ${arrCity})`,
    };
}

// --- Parse ALL unique routes from API response ---
function parseAllApiRoutes(data, flightNumber) {
    const flights = Array.isArray(data) ? data : [data];
    const parsed = flights.map(f => parseSingleFlight(f, flightNumber)).filter(Boolean);

    // Deduplicate by route (same dep+arr codes)
    const seen = new Set();
    const unique = [];
    for (const f of parsed) {
        const routeKey = `${f.departure.code}-${f.arrival.code}`;
        if (!seen.has(routeKey)) {
            seen.add(routeKey);
            unique.push(f);
        }
    }
    return unique;
}

/**
 * Look up a flight by number using AeroDataBox API.
 * Returns an ARRAY of route options (may be 1 or more).
 * Falls back to mock data if the API call fails.
 * 
 * @param {string} flightNumber - e.g. "AA100", "DL665"
 * @param {string} [date] - YYYY-MM-DD format, defaults to today
 * @returns {Promise<Array|null>} Array of flight route options, or null
 */
export async function lookupFlight(flightNumber, date) {
    const cleanNumber = flightNumber.toUpperCase().replace(/\s/g, '');
    const lookupDate = date || new Date().toISOString().split('T')[0];

    // Try the real API first
    try {
        const url = `${BASE_URL}/flights/number/${encodeURIComponent(cleanNumber)}/${lookupDate}?withAircraftImage=false&withLocation=false`;
        const response = await fetch(url, { method: 'GET', headers: API_HEADERS });

        if (response.ok) {
            const data = await response.json();
            const routes = parseAllApiRoutes(data, cleanNumber);
            if (routes.length > 0) {
                console.log(`✈️ AeroDataBox: Found ${routes.length} route(s) for ${cleanNumber}`);
                return routes;
            }
        } else if (response.status === 402 || response.status === 429) {
            console.warn('⚠️ AeroDataBox: API quota exceeded, falling back to mock data');
        } else if (response.status === 404) {
            console.log(`✈️ AeroDataBox: Flight ${cleanNumber} not found in API`);
        } else {
            console.warn(`⚠️ AeroDataBox: API returned ${response.status}`);
        }
    } catch (error) {
        console.warn('⚠️ AeroDataBox API unavailable, using mock data:', error.message);
    }

    // Fallback to mock data
    const mock = MOCK_FLIGHTS[cleanNumber];
    if (!mock) return null;

    return [{
        flightNumber: cleanNumber,
        airline: mock.airline,
        departure: { ...mock.departure, time: mock.departureTime },
        arrival: { ...mock.arrival, time: mock.arrivalTime },
        duration: mock.duration,
        status: 'scheduled',
        routeLabel: `${mock.departure.code} → ${mock.arrival.code} (${mock.departure.city} → ${mock.arrival.city})`,
        _source: 'mock'
    }];
}

/**
 * Refresh flight status using the API.
 */
export async function refreshFlightStatus(flightNumber) {
    const cleanNumber = flightNumber.toUpperCase().replace(/\s/g, '');
    const today = new Date().toISOString().split('T')[0];

    try {
        const url = `${BASE_URL}/flights/number/${encodeURIComponent(cleanNumber)}/${today}?withAircraftImage=false&withLocation=false`;
        const response = await fetch(url, { method: 'GET', headers: API_HEADERS });

        if (response.ok) {
            const data = await response.json();
            const flight = Array.isArray(data) ? data[0] : data;
            if (flight) return mapApiStatus(flight.status);
        }
    } catch (error) {
        console.warn('⚠️ Status refresh failed:', error.message);
    }
    return 'scheduled';
}

/**
 * Get demo flight numbers for the lookup hints.
 */
export function getDemoFlightNumbers() {
    return Object.keys(MOCK_FLIGHTS);
}
