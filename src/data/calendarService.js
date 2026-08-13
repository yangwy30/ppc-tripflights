/* Calendar Service — iCal / ICS Calendar Export & Sync Engine */

import { showToast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';

/**
 * Pops open an interactive modal explaining Calendar sync options
 * and provides 1-click .ics download for Apple Calendar, Google Calendar, and Outlook.
 * 
 * @param {Object} trip - The current trip object containing flights
 */
export function exportTripCalendar(trip) {
  if (!trip || !trip.flights || trip.flights.length === 0) {
    showToast('No flights in trip to export to Calendar', 'warning');
    return;
  }

  const existingModal = document.getElementById('calendar-sync-modal');
  if (existingModal) existingModal.remove();

  const flightCount = trip.flights.length;
  const webcalUrl = `${window.location.origin}/api/subscribe-ics?tripId=${trip.id}&pin=${trip.pin}`;

  const overlay = document.createElement('div');
  overlay.id = 'calendar-sync-modal';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="animation: scaleIn var(--transition-fast) ease-out; max-width: 480px; padding: 1.5rem; background: linear-gradient(145deg, #0F172A 0%, #0B101D 100%); border: 1px solid rgba(56, 189, 248, 0.25); box-shadow: 0 25px 60px rgba(0,0,0,0.8);">
      
      <!-- Header -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem; border-bottom: 1px dashed rgba(255, 255, 255, 0.1); padding-bottom: 0.85rem;">
        <div style="display:flex; align-items:center; gap: 10px;">
          <span style="color: #38BDF8; font-size: 1.4rem; display:flex;">${getIcon('calendar')}</span>
          <div>
            <h3 style="margin:0; font-size: 1.2rem; font-weight: 800; color: #FFF;">Add to Calendar</h3>
            <span style="font-size: 11px; color: var(--color-text-secondary);">Sync ${flightCount} flights with Apple, Google & Outlook</span>
          </div>
        </div>
        <button id="modal-cal-close-x" style="all:unset; cursor:pointer; color: #94A3B8; font-weight:800; font-size: 1.1rem;">✕</button>
      </div>

      <p style="font-size: 13px; color: #94A3B8; margin-bottom: 1.25rem; line-height: 1.5;">
        Export all group flight itineraries directly into your device calendar. Choose your preferred sync method below:
      </p>

      <!-- Option 1: .ics File Download -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; margin-bottom: 1rem;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap: 10px; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 13px; color: #FFF; display:block;">Option 1: Download .ics File</strong>
            <span style="font-size: 11px; color: #94A3B8;">Best for Apple Calendar & iPhone/Mac Calendar app</span>
          </div>
          <span style="font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38BDF8; padding: 2px 6px; border-radius: 4px; font-weight:700;">RECOMMENDED</span>
        </div>
        <button id="btn-download-ics-file" class="btn btn-primary" style="width:100%; font-size: 12px; padding: 8px 12px; margin-top: 6px;">
          📥 Download .ics Calendar File (${flightCount} Flights)
        </button>
      </div>

      <!-- Option 2: Live Webcal Subscription -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px; margin-bottom: 1.25rem;">
        <div style="margin-bottom: 8px;">
          <strong style="font-size: 13px; color: #FFF; display:block;">Option 2: Live Calendar Auto-Sync Link</strong>
          <span style="font-size: 11px; color: #94A3B8;">Subscribes via URL so updates automatically reflect in Google Calendar</span>
        </div>
        <button id="btn-copy-webcal-link" class="btn btn-secondary" style="width:100%; font-size: 12px; padding: 8px 12px; margin-top: 6px;">
          🔗 Copy Live iCal Subscription Link
        </button>
      </div>

      <button id="modal-cal-close-btn" class="btn btn-ghost" style="width:100%; font-size: 12px; color: #94A3B8;">Close</button>
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
      showToast('🔗 Live iCal Subscription link copied! Paste into Google Calendar / Outlook', 'success', 5000);
    } else {
      showToast(`WebCal Link: ${webcalUrl}`, 'info', 5000);
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

  showToast(`📅 "${trip.name}_Flights.ics" downloaded! Tap file to add flights to Apple Calendar`, 'success', 5000);
}

function escapeIcsText(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
