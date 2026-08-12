import fs from 'fs';

// Polyfill env for Node BEFORE dynamic import
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
envText.split('\n').forEach(line => {
    const [k, v] = line.split('=');
    if (k && v) env[k.trim()] = v.trim();
});
globalThis.import = globalThis.import || {};
import.meta.env = env;

// Polyfill localStorage & window for Node script
const storage = {};
globalThis.localStorage = {
    getItem: k => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; }
};

const { createTrip, addParticipant, addFlight, addNote } = await import('../src/data/dataAdapter.js');

async function seed() {
    console.log('Creating Coachella 2026 Trip...');
    const trip = await createTrip({
        name: 'Coachella 2026 🌴',
        startDate: '2026-04-15',
        endDate: '2026-04-19',
        creatorName: 'Yang',
        destinationAirport: 'LAX',
        returnAirport: 'LAX',
        homeAirport: 'JFK'
    });

    if (!trip) {
        console.error('Failed to create trip!');
        return;
    }

    console.log('Created Trip ID:', trip.id, 'PIN:', trip.pin);

    // Add Participants
    const members = [
        { name: 'Ica', home: 'JFK' },
        { name: 'Ryan', home: 'EWR' },
        { name: 'WYY', home: 'JFK' },
        { name: 'Ruisi', home: 'SJC' },
        { name: 'yy', home: 'EWR' },
        { name: 'Yc', home: 'EWR' },
        { name: 'Emma', home: 'SJC' },
        { name: 'Candi', home: 'JFK' }
    ];

    for (const m of members) {
        await addParticipant(trip.id, { name: m.name, homeAirport: m.home });
    }

    // Add Flights
    const flights = [
        { flightNumber: 'DL 707', airline: 'Delta', departure: { code: 'JFK', time: '18:55', city: 'New York' }, arrival: { code: 'LAX', time: '22:20', city: 'Los Angeles' }, date: '2026-04-15', duration: '6h 25m', addedBy: 'Yang', status: 'scheduled' },
        { flightNumber: 'UA 2445', airline: 'United', departure: { code: 'EWR', time: '07:20', city: 'Newark' }, arrival: { code: 'LAX', time: '10:35', city: 'Los Angeles' }, date: '2026-04-16', duration: '6h 15m', addedBy: 'Ryan', status: 'scheduled' },
        { flightNumber: 'B6 423', airline: 'JetBlue', departure: { code: 'JFK', time: '19:00', city: 'New York' }, arrival: { code: 'LAX', time: '22:29', city: 'Los Angeles' }, date: '2026-04-15', duration: '6h 29m', addedBy: 'WYY', status: 'scheduled' },
        { flightNumber: 'WN 1870', airline: 'Southwest', departure: { code: 'SJC', time: '21:00', city: 'San Jose' }, arrival: { code: 'LAX', time: '22:20', city: 'Los Angeles' }, date: '2026-04-15', duration: '1h 20m', addedBy: 'Ruisi', status: 'scheduled' },
        { flightNumber: 'UA 353', airline: 'United', departure: { code: 'EWR', time: '18:30', city: 'Newark' }, arrival: { code: 'LAX', time: '21:33', city: 'Los Angeles' }, date: '2026-04-15', duration: '6h 03m', addedBy: 'yy', status: 'landed' },
        { flightNumber: 'UA 353', airline: 'United', departure: { code: 'EWR', time: '18:30', city: 'Newark' }, arrival: { code: 'LAX', time: '21:33', city: 'Los Angeles' }, date: '2026-04-15', duration: '6h 03m', addedBy: 'Yc', status: 'landed' },
        { flightNumber: 'AA 117', airline: 'American', departure: { code: 'JFK', time: '19:59', city: 'New York' }, arrival: { code: 'LAX', time: '23:28', city: 'Los Angeles' }, date: '2026-04-15', duration: '6h 29m', addedBy: 'Candi', status: 'scheduled' }
    ];

    for (const f of flights) {
        await addFlight(trip.id, f);
    }

    // Add Notes
    await addNote(trip.id, { content: 'Airbnb check-in is 4:00 PM at Indio Hills Manor', author: 'Yang' });
    await addNote(trip.id, { content: 'Rental Van reserved under Ryan (Enterprise Confirmation #78912)', author: 'Ryan' });

    console.log('\n✅ Coachella 2026 Seeded Successfully!');
    console.log('TRIP_ID:', trip.id);
    console.log('TOKENS:', JSON.stringify(storage));
}

seed().catch(console.error);
