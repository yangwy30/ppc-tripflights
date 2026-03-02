/* ============================================
   TripFlights — Data Adapter (localStorage)
   
   The migration key: replace this file with a
   Supabase-backed version to go multi-user.
   Same exported interface, different backend.
   ============================================ */

const STORAGE_KEY = 'tripflights_data';

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { trips: {}, userNicknames: {} };
    } catch {
        return { trips: {}, userNicknames: {} };
    }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generatePin() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Trip Operations ---

export function createTrip({ name, startDate, endDate, creatorName }) {
    const data = loadData();
    const pin = generatePin();
    const id = generateId();
    const trip = {
        id,
        pin,
        name,
        startDate,
        endDate,
        createdAt: new Date().toISOString(),
        participants: [{ name: creatorName, joinedAt: new Date().toISOString(), color: 0 }],
        flights: [],
        notes: []
    };
    data.trips[id] = trip;
    data.userNicknames[id] = creatorName;
    saveData(data);
    return trip;
}

export function joinTrip({ pin, nickname }) {
    const data = loadData();
    const trip = Object.values(data.trips).find(t => t.pin === pin);
    if (!trip) return null;

    const existing = trip.participants.find(p => p.name.toLowerCase() === nickname.toLowerCase());
    if (!existing) {
        trip.participants.push({
            name: nickname,
            joinedAt: new Date().toISOString(),
            color: trip.participants.length % 6
        });
    }
    data.userNicknames[trip.id] = nickname;
    saveData(data);
    return trip;
}

export function getTrip(tripId) {
    const data = loadData();
    return data.trips[tripId] || null;
}

export function getAllTrips() {
    const data = loadData();
    return Object.values(data.trips).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getUserNickname(tripId) {
    const data = loadData();
    return data.userNicknames[tripId] || 'You';
}

export function deleteTrip(tripId) {
    const data = loadData();
    delete data.trips[tripId];
    delete data.userNicknames[tripId];
    saveData(data);
}

export function addParticipant(tripId, name) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return null;

    const existing = trip.participants.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const participant = {
        name,
        joinedAt: new Date().toISOString(),
        color: trip.participants.length % 6
    };
    trip.participants.push(participant);
    saveData(data);
    return participant;
}

// --- Flight Operations ---

export function addFlight(tripId, flight) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return null;

    const flightEntry = {
        id: generateId(),
        ...flight,
        addedAt: new Date().toISOString(),
        status: flight.status || 'scheduled'
    };
    trip.flights.push(flightEntry);
    saveData(data);
    return flightEntry;
}

export function updateFlightStatus(tripId, flightId, status) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return;

    const flight = trip.flights.find(f => f.id === flightId);
    if (flight) {
        flight.status = status;
        saveData(data);
    }
    return flight;
}

export function deleteFlight(tripId, flightId) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return;

    trip.flights = trip.flights.filter(f => f.id !== flightId);
    saveData(data);
}

export function restoreFlight(tripId, flight) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return null;

    trip.flights.push(flight);
    saveData(data);
    return flight;
}

// --- Note Operations ---

export function addNote(tripId, { content, author }) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return null;

    const note = {
        id: generateId(),
        content,
        author,
        createdAt: new Date().toISOString()
    };
    trip.notes.push(note);
    saveData(data);
    return note;
}

export function deleteNote(tripId, noteId) {
    const data = loadData();
    const trip = data.trips[tripId];
    if (!trip) return;

    trip.notes = trip.notes.filter(n => n.id !== noteId);
    saveData(data);
}

// --- Export ---

export function exportTripSummary(tripId) {
    const trip = getTrip(tripId);
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
