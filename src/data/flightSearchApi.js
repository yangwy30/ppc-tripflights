/* ============================================
   PPC: Delay No More — Flight Search API
   Priority: SerpAPI (Google Flights) → Amadeus → Mock
   ============================================ */

// --- SerpAPI Credentials (from .env) ---
const SERPAPI_KEY = import.meta.env.VITE_SERPAPI_KEY;

// --- Amadeus Credentials (from .env) ---
const AMADEUS_API_KEY = import.meta.env.VITE_AMADEUS_API_KEY;
const AMADEUS_API_SECRET = import.meta.env.VITE_AMADEUS_API_SECRET;
const AMADEUS_BASE = 'https://test.api.amadeus.com'; // Use test environment

// --- Token Cache ---
let _cachedToken = null;
let _tokenExpiresAt = 0;

// --- Mock Flight Data (fallback when no API keys) ---
const MOCK_FLIGHT_OFFERS = [
    { id: 'mock-1', origin: 'JFK', destination: 'LHR', airline: 'British Airways', flightNumber: 'BA 178', departureTime: '08:25', arrivalTime: '20:25', duration: '7h 0m', price: 450, stops: 0 },
    { id: 'mock-2', origin: 'JFK', destination: 'LHR', airline: 'Virgin Atlantic', flightNumber: 'VS 4', departureTime: '18:30', arrivalTime: '06:30', duration: '7h 0m', price: 520, stops: 0 },
    { id: 'mock-3', origin: 'LAX', destination: 'LHR', airline: 'American Airlines', flightNumber: 'AA 134', departureTime: '17:40', arrivalTime: '11:45', duration: '10h 5m', price: 680, stops: 0 },
    { id: 'mock-4', origin: 'LAX', destination: 'LHR', airline: 'United Airlines', flightNumber: 'UA 934', departureTime: '13:00', arrivalTime: '07:15', duration: '10h 15m', price: 610, stops: 0 },
    { id: 'mock-5', origin: 'DXB', destination: 'LHR', airline: 'Emirates', flightNumber: 'EK 1', departureTime: '07:45', arrivalTime: '11:40', duration: '7h 55m', price: 850, stops: 0 },
    { id: 'mock-6', origin: 'DXB', destination: 'LHR', airline: 'British Airways', flightNumber: 'BA 106', departureTime: '01:15', arrivalTime: '05:55', duration: '7h 40m', price: 790, stops: 0 },
];

/**
 * Search for flights. Priority: SerpAPI → Amadeus → Mock.
 *
 * @param {string} originIata - e.g., 'JFK'
 * @param {string} destinationIata - e.g., 'LHR'
 * @param {string} outboundDate - 'YYYY-MM-DD'
 * @param {string} returnDate - 'YYYY-MM-DD' (Optional)
 * @param {string} returnOriginIata - e.g., 'CDG' (Optional, defaults to destinationIata)
 * @returns {Promise<Object>} { outboundOptions: [], returnOptions: [] }
 */
export async function searchFlights(originIata, destinationIata, outboundDate, returnDate, returnOriginIata) {
    const returnFrom = returnOriginIata || destinationIata;

    // Helper to do both searches concurrently
    const performSearch = async (searchFn) => {
        const fetchOutbound = searchFn(originIata, destinationIata, outboundDate);
        if (returnDate) {
            const fetchReturn = searchFn(returnFrom, originIata, returnDate);
            const [outbound, inbound] = await Promise.all([fetchOutbound, fetchReturn]);
            return { outboundOptions: outbound, returnOptions: inbound };
        } else {
            const outbound = await fetchOutbound;
            return { outboundOptions: outbound, returnOptions: [] };
        }
    };

    // 1. Try SerpAPI (Google Flights) via Supabase Edge Function — most accurate prices
    if (SUPABASE_URL) {
        try {
            const results = await performSearch(_searchSerpApi);
            if (results.outboundOptions.length > 0) return results;
            console.warn('[SerpAPI] No results, falling through to Amadeus...');
        } catch (err) {
            console.error('[SerpAPI] Error:', err.message);
        }
    }

    // 2. Try Amadeus API — secondary
    if (AMADEUS_API_KEY && AMADEUS_API_SECRET) {
        try {
            const results = await performSearch(_searchAmadeus);
            if (results.outboundOptions.length > 0) return results;
        } catch (err) {
            console.error('[Amadeus] Error:', err.message);
        }
    }

    // 3. Mock data fallback
    console.warn('⚠️ All APIs failed or unavailable. Using mock data.');
    const results = await performSearch(_searchMock);
    return results;
}

// =============================================
//  SerpAPI (Google Flights) via Supabase Edge Function
// =============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Search Google Flights via SerpAPI (proxied through Supabase Edge Function to avoid CORS).
 */
async function _searchSerpApi(origin, destination, date) {
    console.log(`✈️ [SerpAPI] Searching Google Flights: ${origin} → ${destination} on ${date}...`);

    if (!SUPABASE_URL) {
        throw new Error('SUPABASE_URL not configured');
    }

    const params = new URLSearchParams({ origin, destination, date });
    const response = await fetch(
        `${SUPABASE_URL}/functions/v1/search-flights?${params}`,
        { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SerpAPI proxy failed (${response.status}): ${errText}`);
    }

    const data = await response.json();

    // Combine best_flights and other_flights
    const bestFlights = data.best_flights || [];
    const otherFlights = data.other_flights || [];
    const allFlightGroups = [...bestFlights, ...otherFlights];

    console.log(`[SerpAPI] Found ${bestFlights.length} best + ${otherFlights.length} other = ${allFlightGroups.length} total`);

    // Debug: log all flights returned by SerpAPI
    allFlightGroups.forEach((g, i) => {
        const segs = g.flights || [];
        const first = segs[0];
        const last = segs[segs.length - 1];
        console.log(`[SerpAPI] #${i}: ${first?.airline} ${first?.flight_number} | ${first?.departure_airport?.id} ${first?.departure_airport?.time} → ${last?.arrival_airport?.id} ${last?.arrival_airport?.time} | $${g.price} | ${segs.length - 1} stop(s)`);
    });

    return _mapSerpApiResponse(allFlightGroups, origin, destination, date);
}

/**
 * Map SerpAPI Google Flights response to our internal flight format.
 */
function _mapSerpApiResponse(flightGroups, requestedOrigin, requestedDest, date) {
    return flightGroups.map((group, idx) => {
        const segments = group.flights || [];
        if (segments.length === 0) return null;

        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];

        // Origin and destination from actual segments
        const actualOrigin = firstSeg.departure_airport?.id || requestedOrigin;
        const actualDest = lastSeg.arrival_airport?.id || requestedDest;

        // Filter out results not matching destination
        if (actualDest !== requestedDest) {
            console.log(`[SerpAPI] Filtered: arrives at ${actualDest}, not ${requestedDest}`);
            return null;
        }

        // Airline & flight number from first segment
        const airline = firstSeg.airline || '';
        const flightNumber = firstSeg.flight_number || '';

        // Times – include day offsets (e.g., +1) for cross-midnight flights
        const depTime = _extractTime(firstSeg.departure_airport?.time, date);
        const arrTime = _extractTime(lastSeg.arrival_airport?.time, date);

        // Duration – SerpAPI gives total_duration in minutes
        const totalMins = group.total_duration || 0;
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const duration = `${hrs}h ${String(mins).padStart(2, '0')}m`;

        // Price – direct from Google Flights (most accurate)
        const price = group.price || 0;

        // Stops
        const stops = segments.length - 1;

        return {
            id: `serp-${idx}`,
            origin: actualOrigin,
            destination: actualDest,
            airline,
            flightNumber,
            departureTime: depTime,
            arrivalTime: arrTime,
            duration,
            price: Math.round(price),
            stops,
        };
    }).filter(Boolean); // Return all valid flights
}

// =============================================
//  Amadeus API Implementation
// =============================================

/**
 * Authenticate with Amadeus using OAuth2 Client Credentials flow.
 * Caches the token until it expires.
 */
async function _getAmadeusToken() {
    // Return cached token if still valid (with 60s buffer)
    if (_cachedToken && Date.now() < _tokenExpiresAt - 60000) {
        return _cachedToken;
    }

    console.log('[Amadeus] Requesting new OAuth2 token...');
    const response = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: AMADEUS_API_KEY,
            client_secret: AMADEUS_API_SECRET,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`[Amadeus] Token request failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    _cachedToken = data.access_token;
    _tokenExpiresAt = Date.now() + data.expires_in * 1000;
    console.log(`[Amadeus] Token acquired, expires in ${data.expires_in}s`);
    return _cachedToken;
}

/**
 * Search Amadeus Flight Offers API v2.
 * Fetches nonstop flights first, then supplements with connecting flights.
 */
async function _searchAmadeus(origin, destination, date) {
    console.log(`✈️ [Amadeus API] Searching ${origin} → ${destination} on ${date}...`);

    try {
        const token = await _getAmadeusToken();

        // First: fetch nonstop flights
        const nonstopResults = await _fetchAmadeusOffers(token, origin, destination, date, true, 5);
        console.log(`[Amadeus] Nonstop offers: ${nonstopResults.length}`);

        // Second: fetch all flights (including with stops) to fill out options
        const allResults = await _fetchAmadeusOffers(token, origin, destination, date, false, 5);
        console.log(`[Amadeus] All offers (incl. stops): ${allResults.length}`);

        // Combine: nonstop first, then connecting (deduplicate by ID)
        const seenIds = new Set();
        const combined = [];
        for (const flight of [...nonstopResults, ...allResults]) {
            if (!seenIds.has(flight.id)) {
                seenIds.add(flight.id);
                combined.push(flight);
            }
        }

        if (combined.length === 0) {
            console.warn(`[Amadeus] No offers matched destination ${destination}. Falling back to mock.`);
            return _searchMock(origin, destination);
        }
        return combined;
    } catch (error) {
        console.error('[Amadeus] Error:', error);
        console.warn('[Amadeus] Falling back to mock data.');
        return _searchMock(origin, destination);
    }
}

/**
 * Fetch offers from Amadeus API with given parameters.
 */
async function _fetchAmadeusOffers(token, origin, destination, date, nonStop, max) {
    const params = new URLSearchParams({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: date,
        adults: '1',
        nonStop: nonStop ? 'true' : 'false',
        max: String(max),
        currencyCode: 'USD',
    });

    const response = await fetch(`${AMADEUS_BASE}/v2/shopping/flight-offers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[Amadeus] Search failed (${response.status}):`, errText);
        return [];
    }

    const data = await response.json();
    return _mapAmadeusResponse(data, origin, destination, date);
}

/**
 * Map Amadeus API response to our internal flight format.
 * Filters to only include flights matching the exact origin and destination.
 */
function _mapAmadeusResponse(amadeusData, requestedOrigin, requestedDest, date) {
    const offers = amadeusData.data || [];
    const dictionaries = amadeusData.dictionaries || {};
    const carriers = dictionaries.carriers || {};

    return offers.map((offer, idx) => {
        // Take the first itinerary (one-way)
        const itinerary = offer.itineraries?.[0];
        if (!itinerary) return null;

        const segments = itinerary.segments || [];
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];

        // Airline info
        const carrierCode = firstSegment?.carrierCode || '';
        const airlineName = carriers[carrierCode] || carrierCode;
        const flightNumber = `${carrierCode} ${firstSegment?.number || ''}`;

        // Times
        const depTime = _extractTime(firstSegment?.departure?.at, date);
        const arrTime = _extractTime(lastSegment?.arrival?.at, date);

        // Duration: Amadeus provides ISO 8601 duration (e.g., "PT7H15M")
        const duration = _parseIsoDuration(itinerary.duration);

        // Price — use grandTotal (includes taxes/fees) for accuracy
        const price = parseFloat(offer.price?.grandTotal) || parseFloat(offer.price?.total) || 0;

        // Stops
        const stops = segments.length - 1;

        const actualOrigin = firstSegment?.departure?.iataCode || '';
        const actualDest = lastSegment?.arrival?.iataCode || '';

        // Skip flights that don't match the exact destination
        if (requestedDest && actualDest !== requestedDest) {
            console.log(`[Amadeus] Filtered out offer ${offer.id}: arrives at ${actualDest}, not ${requestedDest}`);
            return null;
        }

        return {
            id: offer.id || `amadeus-${idx}`,
            origin: actualOrigin,
            destination: actualDest,
            airline: airlineName,
            flightNumber,
            departureTime: depTime,
            arrivalTime: arrTime,
            duration,
            price: Math.round(price),
            stops,
        };
    }).filter(Boolean);
}

/**
 * Extract HH:MM from an ISO datetime string (e.g., "2026-03-15T08:25:00").
 */
function _extractTime(datetime, baseDateStr) {
    if (!datetime) return '00:00';

    const targetDateRaw = datetime.includes('T') ? datetime.split('T')[0] : datetime.split(' ')[0];
    const timePart = datetime.includes('T') ? datetime.split('T')[1] : datetime.split(' ')[1];
    const hhmm = timePart ? timePart.substring(0, 5) : '00:00'; // "HH:MM"

    if (!baseDateStr || !targetDateRaw) return hhmm;

    // Calculate day offset
    const d1 = new Date(baseDateStr);
    const d2 = new Date(targetDateRaw);
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `${hhmm}+${diffDays}`;
    if (diffDays < 0) return `${hhmm}${diffDays}`; // e.g. -1
    return hhmm;
}

/**
 * Parse ISO 8601 duration (e.g., "PT7H15M") to "7h 15m".
 */
function _parseIsoDuration(isoDuration) {
    if (!isoDuration) return '';
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return isoDuration;
    const hours = match[1] || '0';
    const minutes = match[2] || '0';
    return `${hours}h ${minutes}m`;
}

// =============================================
//  Mock Fallback Implementation
// =============================================

/**
 * Mock flight search using static data.
 */
function _searchMock(originIata, destinationIata) {
    console.log(`🔍 [Mock API] Searching flights from ${originIata} to ${destinationIata}...`);

    const results = MOCK_FLIGHT_OFFERS.filter(
        f => f.origin === originIata && f.destination === destinationIata
    );

    // If no exact match in mocks, generate a plausible random flight
    if (results.length === 0) {
        console.warn(`[Mock API] No static mock for ${originIata} → ${destinationIata}. Generating fallback.`);
        return [{
            id: `mock-gen-${Date.now()}`,
            origin: originIata,
            destination: destinationIata,
            airline: 'Global Airways',
            flightNumber: `GA ${Math.floor(Math.random() * 900) + 100}`,
            departureTime: '10:00',
            arrivalTime: '14:30',
            duration: '4h 30m',
            price: Math.floor(Math.random() * 400) + 200,
            stops: 0
        }];
    }

    return results;
}
