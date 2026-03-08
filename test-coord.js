import { searchFlights } from './src/data/flightSearchApi.js';
(async () => {
  try {
    const { outboundOptions } = await searchFlights('JFK', 'LAX', '2026-04-15');
    console.log('Outbound flights:');
    outboundOptions.forEach((f, i) => {
      console.log(`[${i}] ${f.airline} ${f.flightNumber}: $${f.price}, ${f.stops} stops, duration: ${f.duration}`);
    });
  } catch (e) {
    console.error(e);
  }
})();
