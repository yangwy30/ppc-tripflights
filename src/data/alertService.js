/* Smart flight status refresh — active only around the trip window. */

import { getTrip, updateFlightStatus } from './dataAdapter.js';
import { refreshFlightStatus } from './flightService.js';

const HOUR = 60 * 60 * 1000;
const PRE_TRIP_WINDOW = 48 * HOUR;
const PRE_FLIGHT_WINDOW = 24 * HOUR;
const POST_FLIGHT_WINDOW = 2 * HOUR;
const NEAR_FLIGHT_WINDOW = 3 * HOUR;
const NEAR_FLIGHT_INTERVAL = 60 * 1000;
const ACTIVE_TRIP_INTERVAL = 5 * 60 * 1000;
const activePollers = new Map();
const TERMINAL_STATUSES = new Set(['landed', 'arrived', 'cancelled']);

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00';
  const timestamp = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseClock(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function combineDateAndTime(dateValue, timeValue, endOfDay = false) {
  if (!dateValue) return null;
  const clock = parseClock(timeValue);
  if (!clock) return parseDate(dateValue, endOfDay);
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(clock.hours, clock.minutes, 0, 0);
  return date.getTime();
}

function getFlightMoments(flight) {
  const date = flight.date || flight.departure?.date || flight.arrival?.date;
  if (!date) return { departure: null, arrival: null };

  const departure = combineDateAndTime(date, flight.departure?.time);
  let arrival = combineDateAndTime(date, flight.arrival?.time, true);
  if (departure && arrival && arrival < departure) arrival += 24 * HOUR;

  return { departure, arrival };
}

function getTripMoments(trip) {
  const flightMoments = (trip.flights || []).map(getFlightMoments);
  const departures = flightMoments.map(moment => moment.departure).filter(Number.isFinite);
  const arrivals = flightMoments.map(moment => moment.arrival).filter(Number.isFinite);
  const datedStart = parseDate(trip.startDate);
  const datedEnd = parseDate(trip.endDate || trip.startDate, true);

  const firstDeparture = departures.length ? Math.min(...departures) : datedStart;
  const lastArrival = arrivals.length ? Math.max(...arrivals) : datedEnd;
  const starts = [datedStart, firstDeparture].filter(Number.isFinite);
  const ends = [datedEnd, lastArrival].filter(Number.isFinite);

  return {
    start: starts.length ? Math.min(...starts) - PRE_TRIP_WINDOW : null,
    end: ends.length ? Math.max(...ends) : null
  };
}

export function getTripRefreshState(trip, now = Date.now()) {
  const moments = getTripMoments(trip || {});
  if (!moments.start || !moments.end) return 'inactive';
  if (now < moments.start) return 'upcoming';
  if (now > moments.end) return 'complete';
  return 'active';
}

function isFlightEligible(flight, now) {
  const currentStatus = String(flight.status || '').toLowerCase();
  if (TERMINAL_STATUSES.has(currentStatus)) return false;

  const { departure, arrival } = getFlightMoments(flight);
  if (!departure || !arrival) return false;
  return now >= departure - PRE_FLIGHT_WINDOW && now <= arrival + POST_FLIGHT_WINDOW;
}

function getRefreshInterval(trip, now) {
  const hasNearFlight = (trip.flights || []).some(flight => {
    const { departure, arrival } = getFlightMoments(flight);
    if (!departure || !arrival) return false;
    return now >= departure - NEAR_FLIGHT_WINDOW && now <= arrival + POST_FLIGHT_WINDOW;
  });
  return hasNearFlight ? NEAR_FLIGHT_INTERVAL : ACTIVE_TRIP_INTERVAL;
}

async function refreshEligibleFlights(trip, now) {
  for (const flight of trip.flights || []) {
    if (!isFlightEligible(flight, now) || !flight.flightNumber) continue;

    const nextStatus = await refreshFlightStatus(flight.flightNumber, flight.date);
    if (!nextStatus) continue;

    const currentStatus = String(flight.status || 'scheduled').toLowerCase();
    if (nextStatus === currentStatus) continue;
    if (nextStatus === 'scheduled' && !['scheduled', 'on-time'].includes(currentStatus)) continue;

    await updateFlightStatus(trip.id, flight.id, nextStatus);
  }
}

/**
 * Starts a self-adjusting refresh loop when the trip is within 48 hours of
 * departure. Near a flight it checks every minute, otherwise every five
 * minutes, and permanently stops after the trip's final arrival/end date.
 */
export function startPolling(tripId, initialTrip = null) {
  stopPolling(tripId);
  let stopped = false;
  let timer = null;

  const stop = () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    timer = null;
    if (activePollers.get(tripId) === stop) activePollers.delete(tripId);
  };

  const schedule = async (tripSnapshot = null) => {
    if (stopped) return;
    try {
      const trip = tripSnapshot || await getTrip(tripId);
      if (!trip || getTripRefreshState(trip) !== 'active') {
        stop();
        return;
      }

      await refreshEligibleFlights(trip, Date.now());
      if (stopped) return;
      timer = window.setTimeout(() => schedule(), getRefreshInterval(trip, Date.now()));
    } catch (error) {
      console.warn('Smart flight refresh paused after an error:', error);
      if (!stopped) timer = window.setTimeout(() => schedule(), ACTIVE_TRIP_INTERVAL);
    }
  };

  if (initialTrip && getTripRefreshState(initialTrip) !== 'active') return stop;

  activePollers.set(tripId, stop);
  schedule(initialTrip);
  return stop;
}

export function stopPolling(tripId) {
  activePollers.get(tripId)?.();
}

export function stopAllPolling() {
  [...activePollers.values()].forEach(stop => stop());
}

export function isPolling(tripId) {
  return activePollers.has(tripId);
}
