/* ============================================
   PPC Trip Tracker — Data Adapter (Supabase)
   
   Multi-user backend replacing localStorage.
   Same exported interface as the original — all
   functions are now async.
   
   userNicknames still use localStorage (they are
   per-device preferences, not shared data).
   ============================================ */

import { supabase } from './supabaseClient.js';

const NICKNAME_KEY = 'ppc-trip-tracker_nicknames';

function getTokens() {
    try {
        const raw = localStorage.getItem('ppc-trip-tracker_tokens');
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveToken(tripId, token) {
    const tokens = getTokens();
    tokens[tripId] = token;
    localStorage.setItem('ppc-trip-tracker_tokens', JSON.stringify(tokens));

    // Set the token for the current session
    supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
    });
}

// --- Local nickname helpers (per-device) ---

function loadNicknames() {
    try {
        const raw = localStorage.getItem(NICKNAME_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveNickname(tripId, nickname) {
    const data = loadNicknames();
    data[tripId] = nickname;
    localStorage.setItem(NICKNAME_KEY, JSON.stringify(data));
}

function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Assemble a trip object from joined data ---

function assembleTrip(tripRow, participants, flights, notes) {
    return {
        id: tripRow.id,
        pin: tripRow.pin,
        name: tripRow.name,
        startDate: tripRow.start_date,
        endDate: tripRow.end_date,
        createdAt: tripRow.created_at,
        participants: (participants || []).map(p => ({
            name: p.name,
            joinedAt: p.joined_at,
            color: p.color
        })),
        flights: (flights || []).map(f => ({
            id: f.id,
            flightNumber: f.flight_number,
            airline: f.airline,
            departure: f.departure || {},
            arrival: f.arrival || {},
            date: f.date,
            duration: f.duration,
            status: f.status,
            aircraft: f.aircraft,
            gate: f.gate,
            addedBy: f.added_by,
            addedAt: f.added_at
        })),
        notes: (notes || []).map(n => ({
            id: n.id,
            content: n.content,
            author: n.author,
            createdAt: n.created_at
        }))
    };
}

// --- Fetch a full trip with related data ---

async function fetchFullTrip(tripId) {
    const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

    if (error || !trip) return null;

    const [
        { data: participants },
        { data: flights },
        { data: notes }
    ] = await Promise.all([
        supabase.from('participants').select('*').eq('trip_id', tripId).order('joined_at'),
        supabase.from('flights').select('*').eq('trip_id', tripId).order('added_at'),
        supabase.from('notes').select('*').eq('trip_id', tripId).order('created_at')
    ]);

    return assembleTrip(trip, participants, flights, notes);
}

// --- Trip Operations ---

export async function createTrip({ name, startDate, endDate, creatorName }) {
    const pin = generatePin();
    const id = generateId();

    const { error: tripError } = await supabase
        .from('trips')
        .insert({ id, pin, name, start_date: startDate, end_date: endDate });

    if (tripError) { console.error('createTrip error:', tripError); return null; }

    // After creating, we must get a valid JWT to proceed reading/writing to the rest of the tables
    // by explicitly "verifying" the pin we just created.
    try {
        const { data: authData, error: authError } = await supabase.functions.invoke('verify-pin', {
            body: { pin }
        });

        if (authError || !authData?.token) {
            console.error('Failed to get token after trip creation', authError);
            return null;
        }

        saveToken(id, authData.token);
    } catch (err) {
        console.error('Edge function error', err);
        return null; // Stop if we can't authenticate
    }

    await supabase.from('participants').insert({
        trip_id: id,
        name: creatorName,
        color: 0
    });

    saveNickname(id, creatorName);

    return fetchFullTrip(id);
}

export async function joinTrip({ pin, nickname }) {
    // 1. Verify PIN via Edge Function (bypasses RLS to check pin and return custom JWT)
    try {
        const { data: authData, error: authError } = await supabase.functions.invoke('verify-pin', {
            body: { pin }
        });

        if (authError || !authData?.token || !authData?.trip_id) {
            console.error('Invalid PIN or no token returned', authError);
            return null; // Invalid PIN
        }

        // 2. Save token and set session so subsequent queries work
        saveToken(authData.trip_id, authData.token);

        // 3. Now we are authenticated for this specific trip_id, we can safely query the trip
        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', authData.trip_id)
            .single();

        if (tripError || !trip) return null;

        // Check if participant already exists (case-insensitive)
        const { data: existing } = await supabase
            .from('participants')
            .select('*')
            .eq('trip_id', trip.id)
            .ilike('name', nickname);

        if (!existing || existing.length === 0) {
            // Get current count for color assignment
            const { data: allParticipants } = await supabase
                .from('participants')
                .select('id')
                .eq('trip_id', trip.id);

            await supabase.from('participants').insert({
                trip_id: trip.id,
                name: nickname,
                color: (allParticipants?.length || 0) % 6
            });
        }

        saveNickname(trip.id, nickname);

        return fetchFullTrip(trip.id);
    } catch (err) {
        console.error('joinTrip edge function error:', err);
        return null;
    }
}

export async function getTrip(tripId) {
    // Attempt to load the token for this trip into the session before fetching
    const tokens = getTokens();
    if (tokens[tripId]) {
        await supabase.auth.setSession({
            access_token: tokens[tripId],
            refresh_token: ''
        });
    }
    return fetchFullTrip(tripId);
}

export async function getAllTrips() {
    const nicknames = loadNicknames();
    const tokens = getTokens(); // Need tokens to read the trips
    const tripIds = Object.keys(nicknames).filter(id => tokens[id]);

    if (tripIds.length === 0) return [];

    // Since RLS requires a specific JWT per trip, we cannot bulk-query trips 
    // with a single `in('id', tripIds)` unless we had a multi-trip JWT or bypassed RLS.
    // For this list view, we will fetch them individually using their respective tokens.

    const trips = [];
    for (const id of tripIds) {
        await supabase.auth.setSession({
            access_token: tokens[id],
            refresh_token: ''
        });

        const { data: trip } = await supabase.from('trips').select('*').eq('id', id).single();
        if (trip) trips.push(trip);
    }

    if (trips.length === 0) return [];

    // Fetch participants and flights counts for each trip
    // We must set the session specifically for each trip we query because
    // the RLS policies now require the specific JWT for that trip.
    const fullTrips = [];

    for (const trip of trips) {
        if (tokens[trip.id]) {
            await supabase.auth.setSession({
                access_token: tokens[trip.id],
                refresh_token: ''
            });

            const [
                { data: participants },
                { data: flights }
            ] = await Promise.all([
                supabase.from('participants').select('*').eq('trip_id', trip.id),
                supabase.from('flights').select('*').eq('trip_id', trip.id)
            ]);

            fullTrips.push(assembleTrip(trip, participants, flights, []));
        }
    }

    return fullTrips;
}

export function getUserNickname(tripId) {
    const data = loadNicknames();
    return data[tripId] || 'You';
}

export async function deleteTrip(tripId) {
    const tokens = getTokens();

    if (tokens[tripId]) {
        await supabase.auth.setSession({
            access_token: tokens[tripId],
            refresh_token: ''
        });
        // CASCADE handles participants, flights, notes
        await supabase.from('trips').delete().eq('id', tripId);
    }

    // Remove local nickname
    const data = loadNicknames();
    delete data[tripId];
    delete tokens[tripId];

    localStorage.setItem(NICKNAME_KEY, JSON.stringify(data));
    localStorage.setItem('ppc-trip-tracker_tokens', JSON.stringify(tokens));
}

export async function addParticipant(tripId, name) {
    // Check if already exists (case-insensitive)
    const { data: existing } = await supabase
        .from('participants')
        .select('*')
        .eq('trip_id', tripId)
        .ilike('name', name);

    if (existing && existing.length > 0) {
        return { name: existing[0].name, joinedAt: existing[0].joined_at, color: existing[0].color };
    }

    // Get count for color
    const { data: all } = await supabase
        .from('participants')
        .select('id')
        .eq('trip_id', tripId);

    const { data: inserted, error } = await supabase
        .from('participants')
        .insert({
            trip_id: tripId,
            name,
            color: (all?.length || 0) % 6
        })
        .select()
        .single();

    if (error) { console.error('addParticipant error:', error); return null; }

    return { name: inserted.name, joinedAt: inserted.joined_at, color: inserted.color };
}

// --- Flight Operations ---

export async function addFlight(tripId, flight) {
    const id = generateId();

    const { data: inserted, error } = await supabase
        .from('flights')
        .insert({
            id,
            trip_id: tripId,
            flight_number: flight.flightNumber || '',
            airline: flight.airline || '',
            departure: flight.departure || {},
            arrival: flight.arrival || {},
            date: flight.date || '',
            duration: flight.duration || '',
            status: flight.status || 'scheduled',
            aircraft: flight.aircraft || '',
            gate: flight.gate || '',
            added_by: flight.addedBy || ''
        })
        .select()
        .single();

    if (error) { console.error('addFlight error:', error); return null; }

    return {
        id: inserted.id,
        flightNumber: inserted.flight_number,
        airline: inserted.airline,
        departure: inserted.departure,
        arrival: inserted.arrival,
        date: inserted.date,
        duration: inserted.duration,
        status: inserted.status,
        aircraft: inserted.aircraft,
        gate: inserted.gate,
        addedBy: inserted.added_by,
        addedAt: inserted.added_at
    };
}

export async function updateFlightStatus(tripId, flightId, status) {
    const { data, error } = await supabase
        .from('flights')
        .update({ status })
        .eq('id', flightId)
        .eq('trip_id', tripId)
        .select()
        .single();

    if (error) { console.error('updateFlightStatus error:', error); return null; }
    return data ? {
        id: data.id,
        flightNumber: data.flight_number,
        status: data.status
    } : null;
}

export async function deleteFlight(tripId, flightId) {
    await supabase.from('flights').delete().eq('id', flightId).eq('trip_id', tripId);
}

export async function restoreFlight(tripId, flight) {
    const { error } = await supabase
        .from('flights')
        .insert({
            id: flight.id,
            trip_id: tripId,
            flight_number: flight.flightNumber || '',
            airline: flight.airline || '',
            departure: flight.departure || {},
            arrival: flight.arrival || {},
            date: flight.date || '',
            duration: flight.duration || '',
            status: flight.status || 'scheduled',
            aircraft: flight.aircraft || '',
            gate: flight.gate || '',
            added_by: flight.addedBy || '',
            added_at: flight.addedAt || new Date().toISOString()
        });

    if (error) { console.error('restoreFlight error:', error); return null; }
    return flight;
}

// --- Note Operations ---

export async function addNote(tripId, { content, author }) {
    const id = generateId();

    const { data: inserted, error } = await supabase
        .from('notes')
        .insert({
            id,
            trip_id: tripId,
            content,
            author
        })
        .select()
        .single();

    if (error) { console.error('addNote error:', error); return null; }

    return {
        id: inserted.id,
        content: inserted.content,
        author: inserted.author,
        createdAt: inserted.created_at
    };
}

export async function deleteNote(tripId, noteId) {
    await supabase.from('notes').delete().eq('id', noteId).eq('trip_id', tripId);
}

// --- Export ---

export async function exportTripSummary(tripId) {
    const trip = await getTrip(tripId);
    if (!trip) return '';

    let summary = `✈️ ${trip.name}\n`;
    summary += `📅 ${trip.startDate} → ${trip.endDate}\n`;
    summary += `📌 PIN: ${trip.pin}\n\n`;

    summary += `👥 Travelers: ${trip.participants.map(p => p.name).join(', ')}\n\n`;

    if (trip.flights.length) {
        summary += `✈️ Flights:\n`;
        trip.flights.forEach(f => {
            summary += `  ${f.flightNumber} — ${f.departure.code} → ${f.arrival.code}\n`;
            summary += `    ${f.date} | ${f.departure.time} → ${f.arrival.time} | ${f.addedBy}\n`;
        });
    }

    if (trip.notes.length) {
        summary += `\n📝 Notes:\n`;
        trip.notes.forEach(n => {
            summary += `  [${n.author}] ${n.content}\n`;
        });
    }

    return summary;
}
