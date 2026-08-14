let AIRPORT_DATA = [];

export async function loadAirports() {
    if (AIRPORT_DATA.length > 0) return;
    try {
        const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './';
        const targetUrl = baseUrl.endsWith('/') ? `${baseUrl}airports.json` : `${baseUrl}/airports.json`;
        const res = await fetch(targetUrl).catch(() => fetch('/airports.json'));
        AIRPORT_DATA = await res.json();
        console.log(`Loaded ${AIRPORT_DATA.length} airport city groups.`);
    } catch (e) {
        console.error('Failed to load airports.json', e);
    }
}

export function searchAirports(query) {
    if (!query || AIRPORT_DATA.length === 0) return [];

    // Performance optimization: return early if query is too short
    if (query.length < 2) return [];

    const lowerQuery = query.toLowerCase().trim();

    // Exact match for airport code first
    const codeMatches = AIRPORT_DATA.filter(item => item.airports.some(a => a.code.toLowerCase() === lowerQuery));
    if (codeMatches.length > 0) return codeMatches;

    // Match actual airport codes, cities, and airport names. Synthetic city
    // codes can look valid while not representing a bookable airport.
    const fuzzyMatches = AIRPORT_DATA.filter(item =>
        item.city.toLowerCase().startsWith(lowerQuery) || // Prefer cities that start with the query
        item.airports.some(a => a.code.toLowerCase().includes(lowerQuery) || a.name.toLowerCase().includes(lowerQuery))
    );

    // Limit to 10 results to not overwhelm the UI
    return fuzzyMatches.slice(0, 10);
}
