/* Calendar Service — iCal / ICS Calendar Export & Sync Engine */

import { showToast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';

/**
 * Pops open an interactive modal explaining Calendar sync options
 * and provides 1-click sync for Apple Calendar, Google Calendar, and Outlook.
 * 
 * @param {Object} trip - The current trip object containing flights
 */
export function exportTripCalendar(trip) {
  if (!trip || !trip.flights || trip.flights.length === 0) {
    showToast('No flights added to this trip yet!', 'warning');
    return;
  }

  const existingModal = document.getElementById('calendar-sync-modal');
  if (existingModal) existingModal.remove();

  const flightCount = trip.flights.length;
  const webcalUrl = `${window.location.origin}/api/subscribe-ics?tripId=${trip.id}&pin=${trip.pin}`;

  // Build 1-click Google Calendar Link for the first flight or primary itinerary
  const firstFlight = trip.flights[0];
  const gcalTitle = encodeURIComponent(`[${firstFlight.departure?.code || 'DEP'} ✈ ${firstFlight.arrival?.code || 'ARR'}] ${firstFlight.airline || ''} ${firstFlight.flightNumber || ''} (${trip.name})`);
  const gcalDetails = encodeURIComponent(`Group Trip: ${trip.name}\nFlight: ${firstFlight.flightNumber}\nTraveler: ${firstFlight.addedBy || ''}`);
  const gcalLocation = encodeURIComponent(`${firstFlight.departure?.code || ''} to ${firstFlight.arrival?.code || ''}`);
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&details=${gcalDetails}&location=${gcalLocation}`;

  const overlay = document.createElement('div');
  overlay.id = 'calendar-sync-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="animation: scaleIn var(--transition-fast) ease-out; max-width: 480px; padding: 1.5rem; background: linear-gradient(145deg, #0F172A 0%, #0B101D 100%); border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 25px 60px rgba(0,0,0,0.85); z-index: 1000000;">
      
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem; border-bottom: 1px dashed rgba(255, 255, 255, 0.1); padding-bottom: 0.85rem;">
        <div style="display:flex; align-items:center; gap: 10px;">
          <span style="color: #38BDF8; font-size: 1.4rem; display:flex;">${getIcon('calendar')}</span>
          <div>
            <h3 style="margin:0; font-size: 1.2rem; font-weight: 800; color: #FFF;">Add to Calendar</h3>
            <span style="font-size: 11px; color: var(--color-text-secondary);">${flightCount} Flights in Trip "${escapeHtml(trip.name)}"</span>
          </div>
        </div>
        <button id="modal-cal-close-x" style="all:unset; cursor:pointer; color: #94A3B8; font-weight:800; font-size: 1.1rem; padding: 4px;">✕</button>
      </div>

      <p style="font-size: 13px; color: #94A3B8; margin-bottom: 1.25rem; line-height: 1.5;">
        Sync all group flights directly to your phone or computer calendar app (Apple Calendar, Google Calendar, or Outlook).
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.25rem;">
        
        <!-- Apple Calendar / iPhone / Mac -->
        <button id="btn-download-ics-file" class="btn btn-primary" style="width:100%; font-size: 13px; padding: 10px 14px; justify-content: flex-start;">
          <span>🍎</span>
          <span style="flex:1; text-align:left; font-weight:700;">Add to Apple Calendar / iPhone (.ics)</span>
        </button>

        <!-- Google Calendar Web -->
        <a href="${gcalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="width:100%; font-size: 13px; padding: 10px 14px; justify-content: flex-start; text-decoration:none;">
          <span>🌐</span>
          <span style="flex:1; text-align:left; font-weight:700;">Add to Google Calendar (Web)</span>
        </a>

        <!-- Copy Calendar Link -->
        <button id="btn-copy-webcal-link" class="btn btn-ghost" style="width:100%; font-size: 12px; padding: 8px 14px; justify-content: flex-start; color: #94A3B8; border: 1px solid rgba(255,255,255,0.08);">
          <span>🔗</span>
          <span style="flex:1; text-align:left;">Copy iCal Subscription Link</span>
        </button>

      </div>

      <button id="modal-cal-close-btn" class="btn btn-ghost" style="width:100%; font-size: 12px; color: #64748B;">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();

  overlay.querySelector('#modal-cal-close-x').addEventListener('click', closeModal);
  overlay.querySelector('#modal-cal-close-btn').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Download .ics File Event Handler
  overlay.querySelector('#btn-download-ics-file').addEventListener('click', () => {
    triggerIcsDownload(trip);
    closeModal();
  });

  // Copy Webcal Link Event Handler
  overlay.querySelector('#btn-copy-webcal-link').addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(webcalUrl);
      showToast('🔗 iCal Subscription URL copied to clipboard!', 'success', 5000);
    } else {
      showToast(`Subscription URL: ${webcalUrl}`, 'info', 5000);
    }
    closeModal();
  });
}

function triggerIcsDownload(trip) {
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

  showToast(`📅 Calendar file downloaded! Tap file to open in Apple Calendar`, 'success', 5000);
}

function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
