/* Calendar Service — iCal / ICS Calendar Export & Sync Engine */

import { showToast } from '../components/toast.js';

/**
 * Generates and downloads an RFC 5545 compliant .ics calendar file for the trip.
 * Compatible with Apple Calendar, Google Calendar, and Microsoft Outlook.
 * 
 * @param {Object} trip - The current trip object containing flights
 */
export function exportTripCalendar(trip) {
  if (!trip || !trip.flights || trip.flights.length === 0) {
    showToast('No flights in trip to export to Calendar', 'warning');
    return;
  }

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PPC Trip Tracker//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(trip.name)} Flights`,
    'X-WR-TIMEZONE:UTC',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H'
  ];

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  trip.flights.forEach(f => {
    if (!f.date) return;
    const uid = `${f.id || Math.random().toString(36).substring(2)}@ppc-trip-tracker.app`;
    
    // Parse departure time
    const depTimeStr = f.departure?.time || '12:00';
    const arrTimeStr = f.arrival?.time || '14:00';
    
    const depClean = depTimeStr.replace(/[^0-9]/g, '').padStart(4, '0') + '00';
    const arrClean = arrTimeStr.replace(/[^0-9]/g, '').padStart(4, '0') + '00';
    const dateClean = f.date.replace(/[^0-9]/g, '');

    const startStr = `${dateClean}T${depClean}`;
    const endStr = `${dateClean}T${arrClean}`;

    const depCode = (f.departure?.code || 'DEP').toUpperCase();
    const arrCode = (f.arrival?.code || 'ARR').toUpperCase();
    const airline = f.airline || '';
    const fn = f.flightNumber || '';
    const traveler = f.addedBy || 'Traveler';

    const summary = `[${depCode} ✈️ ${arrCode}] ${airline} ${fn} (${traveler})`;
    const location = `${depCode} to ${arrCode}`;
    const description = `✈️ FLIGHT DETAILS\\n• Airline: ${airline}\\n• Flight: ${fn}\\n• Traveler: ${traveler}\\n• Date: ${f.date}\\n• Times: ${depTimeStr} - ${arrTimeStr}`;

    icsLines.push(
      'BEGIN:VEVENT',
      `DTSTAMP:${now}`,
      `UID:${uid}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      'END:VEVENT'
    );
  });

  icsLines.push('END:VCALENDAR');

  const icsContent = icsLines.join('\r\n') + '\r\n';
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(trip.name || 'Trip').replace(/[^a-zA-Z0-9]/g, '_')}_Flights.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`📅 Calendar synced! Import .ics file to Apple or Google Calendar`, 'success', 4000);
}

function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
