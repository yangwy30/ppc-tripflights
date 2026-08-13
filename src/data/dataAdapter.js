/* Data Adapter (Supabase) */

import { supabase } from './supabaseClient.js';
import { emit, EVENTS } from './store.js';

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
    supabase.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
}

export function getTokenForTrip(tripId) {
    const tokens = getTokens();
    return tokens[tripId] || null;
}

export function getUserNickname(tripId, trip = null) {
    try {
        const raw = localStorage.getItem(NICKNAME_KEY);
        const map = raw ? JSON.parse(raw) : {};
        if (map[tripId]) return map[tripId];
        
        if (trip && trip.participants && trip.participants.length > 0) {
            const first = trip.participants[0];
            const fallback = typeof first === 'string' ? first : first.name;
            if (fallback) {
                saveNickname(tripId, fallback);
                return fallback;
            }
        }
        return '';
    } catch {
        return '';
    }
}

export function saveNickname(tripId, nickname) {
    try {
        const raw = localStorage.getItem(NICKNAME_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[tripId] = nickname;
        localStorage.setItem(NICKNAME_KEY, JSON.stringify(map));
    } catch {}
}

function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId() {
    return 't_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// --- DB Row Assembler ---

function assembleTrip(tripRow, participantRows, flightRows, noteRows) {
    if (!tripRow) return null;

    return {
        id: tripRow.id,
        pin: tripRow.pin,
        name: tripRow.name,
        startDate: tripRow.start_date,
        endDate: tripRow.end_date,
        destinationAirport: tripRow.destination_airport || null,
        returnAirport: tripRow.return_airport || null,
        createdAt: tripRow.created_at,
        participants: (participantRows || []).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            joinedAt: p.joined_at,
            homeAirport: p.home_airport || null,
            destinationAirport: p.destination_airport || null
        })),
        flights: (flightRows || []).map(f => ({
            id: f.id,
            flightNumber: f.flight_number,
            airline: f.airline,
            departure: f.departure,
            arrival: f.arrival,
            date: f.date,
            duration: f.duration,
            status: f.status,
            aircraft: f.aircraft,
            gate: f.gate,
            addedBy: f.added_by,
            addedAt: f.added_at
        })),
        notes: (noteRows || []).map(n => ({
            id: n.id,
            content: n.content,
            author: n.author,
            createdAt: n.created_at
        }))
    };
}

// Helper: set auth header for a specific trip (uses saved token)
async function setAuthForTrip(tripId) {
    const token = getTokenForTrip(tripId);
    if (token) {
        await supabase.auth.setSession({ access_token: token, refresh_token: '' }).catch(() => {});
    }
}

// --- Fetching Data ---

export async function fetchFullTrip(tripId) {
    await setAuthForTrip(tripId);

    const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

    if (tripError || !trip) return null;

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

export async function createTrip({ name, startDate, endDate, creatorName, destinationAirport, returnAirport, homeAirport }) {
    const pin = generatePin();
    const id = generateId();

    const { error: tripError } = await supabase
        .from('trips')
        .insert({
            id, pin, name, start_date: startDate, end_date: endDate,
            destination_airport: destinationAirport || null,
            return_airport: returnAirport || null
        });

    if (tripError) { console.error('createTrip error:', tripError); return null; }

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
        return null;
    }

    await supabase.from('participants').insert({
        trip_id: id,
        name: creatorName,
        color: 0,
        home_airport: homeAirport || null,
        destination_airport: null
    });

    saveNickname(id, creatorName);
    const newTrip = await fetchFullTrip(id);
    emit(EVENTS.TRIP_CREATED, newTrip);
    return newTrip;
}

export async function joinTrip({ pin, nickname, homeAirport }) {
    try {
        const { data: authData, error: authError } = await supabase.functions.invoke('verify-pin', {
            body: { pin }
        });

        if (authError || !authData?.token || !authData?.trip_id) {
            console.error('Invalid PIN or no token returned', authError);
            return null;
        }

        saveToken(authData.trip_id, authData.token);

        const { data: trip, error: tripError } = await supabase
            .from('trips')
            .select('*')
            .eq('id', authData.trip_id)
            .single();

        if (tripError || !trip) return null;

        const { data: existing } = await supabase
            .from('participants')
            .select('*')
            .eq('trip_id', authData.trip_id)
            .ilike('name', nickname);

        if (!existing || existing.length === 0) {
            const { data: allParts } = await supabase
                .from('participants')
                .select('color')
                .eq('trip_id', authData.trip_id);

            const colorIndex = (allParts || []).length % 6;

            await supabase.from('participants').insert({
                trip_id: authData.trip_id,
                name: nickname,
                color: colorIndex,
                home_airport: homeAirport || null,
                destination_airport: null
            });
        }

        saveNickname(authData.trip_id, nickname);
        const joinedTrip = await fetchFullTrip(authData.trip_id);
        emit(EVENTS.TRIP_JOINED, joinedTrip);
        return joinedTrip;

    } catch (err) {
        console.error('joinTrip exception:', err);
        return null;
    }
}

export async function getTrip(tripId) {
    return fetchFullTrip(tripId);
}

export async function getAllTrips() {
    const tokens = getTokens();
    const tripIds = Object.keys(tokens);
    if (tripIds.length === 0) return [];

    const trips = [];
    for (const id of tripIds) {
        try {
            const trip = await fetchFullTrip(id);
            if (trip) trips.push(trip);
        } catch {
            // Invalid/expired token for this trip, continue
        }
    }
    return trips;
}

export async function deleteTrip(tripId) {
    await setAuthForTrip(tripId);
    await supabase.from('notes').delete().eq('trip_id', tripId);
    await supabase.from('flights').delete().eq('trip_id', tripId);
    await supabase.from('participants').delete().eq('trip_id', tripId);
    await supabase.from('trips').delete().eq('id', tripId);

    const tokens = getTokens();
    delete tokens[tripId];
    localStorage.setItem('ppc-trip-tracker_tokens', JSON.stringify(tokens));

    const nickRaw = localStorage.getItem(NICKNAME_KEY);
    if (nickRaw) {
        try {
            const map = JSON.parse(nickRaw);
            delete map[tripId];
            localStorage.setItem(NICKNAME_KEY, JSON.stringify(map));
        } catch {}
    }

    emit(EVENTS.TRIP_DELETED, tripId);
}

export async function setParticipantHomeAirport(tripId, nickname, homeAirport) {
    await setAuthForTrip(tripId);
    const { data, error } = await supabase
        .from('participants')
        .update({ home_airport: homeAirport || null })
        .eq('trip_id', tripId)
        .ilike('name', nickname)
        .select();

    if (error) {
        console.error('setParticipantHomeAirport error:', error);
        return false;
    }
    emit(EVENTS.PARTICIPANT_ADDED, { tripId, nickname, homeAirport });
    return true;
}

export async function setParticipantDestinationAirport(tripId, nickname, destinationAirport) {
    await setAuthForTrip(tripId);
    const { data, error } = await supabase
        .from('participants')
        .update({ destination_airport: destinationAirport || null })
        .eq('trip_id', tripId)
        .ilike('name', nickname)
        .select();

    if (error) {
        console.error('setParticipantDestinationAirport error:', error);
        return false;
    }
    emit(EVENTS.PARTICIPANT_ADDED, { tripId, nickname, destinationAirport });
    return true;
}

export async function savePushSubscription(tripId, subscription) {
    try {
        await supabase.from('push_subscriptions').upsert({
            trip_id: tripId,
            subscription: JSON.stringify(subscription),
            updated_at: new Date().toISOString()
        });
    } catch (e) {
        console.warn('Push subscription save skipped:', e);
    }
}

export async function addParticipant(tripId, { name, homeAirport, destinationAirport, color }) {
    await setAuthForTrip(tripId);
    const { data: inserted, error } = await supabase
        .from('participants')
        .insert({
            trip_id: tripId,
            name,
            color: color !== undefined ? color : 0,
            home_airport: homeAirport || null,
            destination_airport: destinationAirport || null
        })
        .select()
        .single();

    if (error) {
        console.error('addParticipant error:', error);
        return null;
    }
    const partObj = {
        id: inserted.id,
        name: inserted.name,
        color: inserted.color,
        homeAirport: inserted.home_airport,
        destinationAirport: inserted.destination_airport,
        joinedAt: inserted.joined_at
    };
    emit(EVENTS.PARTICIPANT_ADDED, { tripId, participant: partObj });
    return partObj;
}

export const updateParticipantDestination = setParticipantDestinationAirport;
export const updateParticipantHome = setParticipantHomeAirport;

export async function deleteParticipant(tripId, participantName) {
    await setAuthForTrip(tripId);
    await supabase.from('participants').delete().eq('trip_id', tripId).eq('name', participantName);
    await supabase.from('flights').delete().eq('trip_id', tripId).eq('added_by', participantName);
    emit(EVENTS.PARTICIPANT_DELETED, { tripId, participantName });
}

// --- Flight Operations ---

export async function addFlight(tripId, flight) {
    await setAuthForTrip(tripId);
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

    const flightObj = {
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

    emit(EVENTS.FLIGHT_ADDED, { tripId, flight: flightObj });
    return flightObj;
}

export async function updateFlightStatus(tripId, flightId, status) {
    await setAuthForTrip(tripId);
    const { data, error } = await supabase
        .from('flights')
        .update({ status })
        .eq('id', flightId)
        .eq('trip_id', tripId)
        .select()
        .single();

    if (error) { console.error('updateFlightStatus error:', error); return null; }
    
    const updated = data ? {
        id: data.id,
        flightNumber: data.flight_number,
        status: data.status
    } : null;

    if (updated) {
        emit(EVENTS.FLIGHT_UPDATED, { tripId, flightId, status });
    }
    return updated;
}

export async function deleteFlight(tripId, flightId) {
    await setAuthForTrip(tripId);
    await supabase.from('flights').delete().eq('id', flightId).eq('trip_id', tripId);
    emit(EVENTS.FLIGHT_DELETED, { tripId, flightId });
}

export async function restoreFlight(tripId, flight) {
    await setAuthForTrip(tripId);
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
    emit(EVENTS.FLIGHT_ADDED, { tripId, flight });
    return flight;
}

// --- Note Operations ---

export async function addNote(tripId, { content, author }) {
    await setAuthForTrip(tripId);
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

    const noteObj = {
        id: inserted.id,
        content: inserted.content,
        author: inserted.author,
        createdAt: inserted.created_at
    };

    emit(EVENTS.NOTE_ADDED, { tripId, note: noteObj });
    return noteObj;
}

export async function deleteNote(tripId, noteId) {
    await setAuthForTrip(tripId);
    await supabase.from('notes').delete().eq('id', noteId).eq('trip_id', tripId);
    emit(EVENTS.NOTE_DELETED, { tripId, noteId });
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
