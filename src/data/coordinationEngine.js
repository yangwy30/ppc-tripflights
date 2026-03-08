import { searchFlights } from './flightSearchApi.js';

/**
 * Coordination Engine
 * Groups individual flights from multiple origins to a single destination
 * into "Grouped Options" based on arrival proximity.
 */

/**
 * @typedef GroupedFlightPlan
 * @property {string} id
 * @property {Array} flights - Array of individual flight objects
 * @property {number} totalCost
 * @property {string} maxArrivalDiff - Friendly string describing the arrival spread
 */

/**
 * Generates round-trip options for the group.
 * @param {Object} trip - The current trip object
 * @param {string} currentUserName - The current user's nickname
 * @returns {Promise<Array<GroupedFlightPlan>>}
 */
export async function generateGroupOptions(trip, currentUserName) {
    const { destinationAirport, returnAirport, startDate, endDate, participants, flights: existingFlights = [] } = trip;
    const destIata = _extractPrimaryIata(destinationAirport);
    const returnIata = _extractPrimaryIata(returnAirport) || destIata; // fallback to dest

    // Infer actual travel dates from booked flights (they may differ from trip start/end)
    const outboundFlights = existingFlights.filter(f => {
        const arrCode = (f.arrival?.code || '').toUpperCase().trim();
        return arrCode === destIata.toUpperCase();
    });
    const returnFlights = existingFlights.filter(f => {
        const depCode = (f.departure?.code || '').toUpperCase().trim();
        return depCode === destIata.toUpperCase() || depCode === returnIata.toUpperCase();
    });

    // Use booked flight dates if available, otherwise fall back to trip dates
    const outboundDate = (outboundFlights.length > 0 && outboundFlights[0].date) ? outboundFlights[0].date : startDate;
    const returnDate = (returnFlights.length > 0 && returnFlights[0].date) ? returnFlights[0].date : endDate;

    if (!destIata || !outboundDate) return [];

    const validParticipants = participants.filter(p => p.homeAirport);
    if (!validParticipants || validParticipants.length === 0) return [];

    // Only include participants who have booked OR are the current user
    const relevantParticipants = validParticipants.filter(p => {
        const hasBooked = existingFlights.some(f => f.addedBy === p.name);
        const isCurrentUser = p.name === currentUserName;
        if (!hasBooked && !isCurrentUser) {
            console.log(`[CoordinationEngine] Skipping ${p.name} — no booked flight and not the coordinating user.`);
        }
        return hasBooked || isCurrentUser;
    });

    if (relevantParticipants.length === 0) return [];

    console.log(`[CoordinationEngine] Finding options for ${relevantParticipants.map(p => `${p.name}(${p.homeAirport})`).join(', ')} -> ${destIata} (Return from ${returnIata})`);


    // 2. Fetch flights for each participant
    const flightPromises = relevantParticipants.map(async participant => {
        const primaryOrigin = _extractPrimaryIata(participant.homeAirport);

        // Per-person destination override: use participant's preferred airport if set
        const personDest = _extractPrimaryIata(participant.destinationAirport) || destIata;
        const personReturnIata = _extractPrimaryIata(participant.destinationAirport) || returnIata;

        // Find existing outbound and return flights for this person
        const personFlights = existingFlights.filter(f => f.addedBy === participant.name);
        const bookedOutbound = personFlights.find(f => (f.arrival?.code || '').toUpperCase() === personDest);
        const bookedReturn = personFlights.find(f => (f.departure?.code || '').toUpperCase() === personReturnIata);

        // Prepare outbound options
        let outboundOptions = [];
        if (bookedOutbound) {
            console.log(`[CoordinationEngine] Using existing outbound flight for ${participant.name}`);
            const depTime = bookedOutbound.departure?.time || '00:00';
            const arrTime = bookedOutbound.arrival?.time || '00:00';
            outboundOptions = [{
                id: bookedOutbound.id,
                passengerName: participant.name,
                origin: bookedOutbound.departure?.code || primaryOrigin,
                destination: personDest,
                airline: bookedOutbound.airline,
                flightNumber: bookedOutbound.flightNumber,
                departureTime: depTime,
                arrivalTime: arrTime,
                duration: bookedOutbound.duration || _calculateDuration(depTime, arrTime),
                price: 0,
                stops: 0,
                isBooked: true,
                date: bookedOutbound.date || outboundDate
            }];
        }

        // Prepare return options
        let returnOptions = [];
        if (returnDate) {
            if (bookedReturn) {
                console.log(`[CoordinationEngine] Using existing return flight for ${participant.name}`);
                const depTime = bookedReturn.departure?.time || '00:00';
                const arrTime = bookedReturn.arrival?.time || '00:00';
                returnOptions = [{
                    id: bookedReturn.id,
                    passengerName: participant.name,
                    origin: personReturnIata,
                    destination: bookedReturn.arrival?.code || primaryOrigin,
                    airline: bookedReturn.airline,
                    flightNumber: bookedReturn.flightNumber,
                    departureTime: depTime,
                    arrivalTime: arrTime,
                    duration: bookedReturn.duration || _calculateDuration(depTime, arrTime),
                    price: 0,
                    stops: 0,
                    isBooked: true,
                    date: bookedReturn.date || returnDate
                }];
            }
        }

        // If BOTH are booked (or outbound booked and no return date), just return them
        if (bookedOutbound && (bookedReturn || !returnDate)) {
            return { outboundOptions, returnOptions };
        }

        // Otherwise, run API search for whatever is missing
        const searchOrigin = bookedOutbound ? null : primaryOrigin;
        const searchDest = bookedOutbound ? null : personDest;
        const searchReturnOrigin = (returnDate && !bookedReturn) ? personReturnIata : null;

        // We only call the API if we actually need to search for something
        if (searchOrigin || searchReturnOrigin) {
            const { outboundOptions: apiOut, returnOptions: apiRet } = await searchFlights(
                searchOrigin || primaryOrigin, // fallback to valid IATA just in case, though it will be ignored if null
                searchDest || personDest,
                searchOrigin ? outboundDate : null,
                searchReturnOrigin ? returnDate : null,
                searchReturnOrigin
            );

            if (!bookedOutbound && apiOut) {
                outboundOptions = apiOut.map(f => ({ ...f, passengerName: participant.name, date: f.date || outboundDate }));
            }
            if (!bookedReturn && apiRet) {
                returnOptions = apiRet.map(f => ({ ...f, passengerName: participant.name, date: f.date || returnDate }));
            }
        }

        return {
            outboundOptions,
            returnOptions
        };
    });

    const flightResults = await Promise.all(flightPromises);

    // Pre-sort each person's options to favor nonstop and cheap flights 
    // before taking the top N, ensuring direct flights make it into the coordination pool.
    flightResults.forEach(res => {
        res.outboundOptions.sort((a, b) => (a.stops - b.stops) || (a.price - b.price));
        res.returnOptions.sort((a, b) => (a.stops - b.stops) || (a.price - b.price));
    });

    // Filter down to the top N flights per person to prevent massive Cartesian products
    const limitPerPerson = 10;
    const outboundBuckets = flightResults.map(res => res.outboundOptions.slice(0, limitPerPerson));

    // Only build return combinations if we actually have a return date and results
    const hasReturnFlights = returnDate && flightResults.some(res => res.returnOptions.length > 0);
    const returnBuckets = hasReturnFlights
        ? flightResults.map(res => res.returnOptions.slice(0, limitPerPerson))
        : null;

    // 3. Generate combinations separately
    const outboundCombinations = cartesianProduct(outboundBuckets);
    const returnCombinations = returnBuckets ? cartesianProduct(returnBuckets) : [[]];

    if (outboundCombinations.length === 0 || outboundCombinations[0].length === 0) return [];

    // 4. Pair combinations and score them
    const groupedOptions = [];

    // To limit UI output, we don't need a full combo × combo product, just pair top ones or pair randomly and sort.
    // For performance, we'll try evaluating up to N^2 combinations
    for (const outCombo of outboundCombinations) {
        for (const inCombo of returnCombinations) {
            // Calculate total stops
            const totalStops = outCombo.reduce((sum, f) => sum + (f.stops || 0), 0) + inCombo.reduce((sum, f) => sum + (f.stops || 0), 0);

            // Outbound spread (Arrival Proximity)
            const sortedOut = [...outCombo].sort((a, b) => timeToMinutes(a.arrivalTime) - timeToMinutes(b.arrivalTime));
            const outSpread = timeToMinutes(sortedOut[sortedOut.length - 1].arrivalTime) - timeToMinutes(sortedOut[0].arrivalTime);

            // Return spread (Departure Proximity)
            let inSpread = 0;
            if (inCombo.length > 0) {
                const sortedIn = [...inCombo].sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime));
                inSpread = timeToMinutes(sortedIn[sortedIn.length - 1].departureTime) - timeToMinutes(sortedIn[0].departureTime);
            }

            const totalCost = outCombo.reduce((sum, f) => sum + f.price, 0) + inCombo.reduce((sum, f) => sum + f.price, 0);

            // Re-map per participant so UI can render them cleanly: { passengerName, outbound, return }
            const flightsPerPerson = [];
            for (const p of relevantParticipants) {
                const pOut = outCombo.find(f => f.passengerName === p.name);
                const pIn = inCombo.find(f => f.passengerName === p.name);
                if (pOut) {
                    flightsPerPerson.push({
                        passengerName: p.name,
                        outbound: pOut,
                        inbound: pIn
                    });
                }
            }

            groupedOptions.push({
                id: `option-${Math.random().toString(36).substr(2, 9)}`,
                flights: flightsPerPerson,
                totalCost,
                outSpreadMinutes: outSpread,
                inSpreadMinutes: inSpread,
                maxArrivalDiff: formatSpread(outSpread),
                maxDepartureDiff: formatSpread(inSpread),
                blendedScore: (outSpread * 2) + (inSpread * 2) + totalCost + (totalStops * 150) // heavily penalize stops
            });
        }
    }

    // 5. Sort by blended score
    groupedOptions.sort((a, b) => a.blendedScore - b.blendedScore);

    return groupedOptions.slice(0, 5); // Return top 5 options
}

/**
 * Helper: Cartesian Product of arrays (all possible combinations)
 */
function cartesianProduct(arr) {
    return arr.reduce((a, b) => {
        return a.map(x => b.map(y => x.concat([y]))).reduce((c, d) => c.concat(d), []);
    }, [[]]);
}

/**
 * Helper: Convert HH:MM (or HH:MM+1) to minutes from midnight (plus days offset)
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;

    // Parse possible day offset like "00:57+1" or "23:00-1"
    let daysOffset = 0;
    let cleanTimeStr = timeStr;

    if (timeStr.includes('+')) {
        const parts = timeStr.split('+');
        cleanTimeStr = parts[0];
        daysOffset = Number(parts[1]) || 0;
    } else if (timeStr.includes('-')) {
        const parts = timeStr.split('-');
        cleanTimeStr = parts[0];
        daysOffset = -(Number(parts[1]) || 0);
    }

    const [hh, mm] = cleanTimeStr.split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0) + (daysOffset * 1440);
}

/**
 * Helper: Format minutes into human readable spread
 */
function formatSpread(minutes) {
    if (minutes === 0) return "Everyone arrives at the exact same time";
    if (minutes < 60) return `Everyone arrives within ${minutes} mins`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `Arrivals spread over ${hrs} hr${hrs > 1 ? 's' : ''}`;
    return `Arrivals spread over ${hrs}h ${mins}m`;
}

/**
 * Helper: Calculate approximate flight duration from departure and arrival times.
 * Handles overnight flights (arrival time < departure time => assume next day).
 */
function _calculateDuration(depTime, arrTime) {
    const depMins = timeToMinutes(depTime);
    const arrMins = timeToMinutes(arrTime);
    let diff = arrMins - depMins;
    if (diff <= 0) diff += 24 * 60; // Overnight: add 24 hours

    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins}m`;
}

/**
 * Helper: Extract the primary IATA code from a possibly comma-separated string.
 * e.g. "SJC,SFO" → "SFO", "NYS,JFK,LGA" → "JFK", "ORD" → "ORD"
 * Prefers major hub airports when multiple codes are present.
 */
const MAJOR_HUBS = new Set(['JFK', 'LAX', 'SFO', 'ORD', 'ATL', 'DFW', 'DEN', 'MIA', 'SEA', 'BOS', 'EWR', 'IAD', 'IAH', 'PHX', 'LGA', 'MCO', 'CLT', 'MSP', 'DTW', 'FLL', 'PHL', 'BWI', 'SLC', 'SAN', 'TPA', 'PDX', 'STL', 'AUS', 'RDU', 'BNA', 'HNL', 'SMF', 'OAK', 'SJC', 'LHR', 'CDG', 'FRA', 'AMS', 'DXB', 'SIN', 'HND', 'NRT', 'ICN', 'HKG', 'PEK', 'PVG', 'SYD', 'MEL']);

function _extractPrimaryIata(airportStr) {
    if (!airportStr) return '';
    const codes = airportStr.split(',').map(c => c.trim().toUpperCase()).filter(c => c.length === 3);
    if (codes.length === 0) return airportStr.trim().toUpperCase();
    if (codes.length === 1) return codes[0];
    // Prefer a major hub
    const hub = codes.find(c => MAJOR_HUBS.has(c));
    return hub || codes[0];
}
