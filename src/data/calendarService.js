/* Calendar Service — live iCal subscription UI */

import { showToast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';

const GOOGLE_CALENDAR_ADD_URL = 'https://calendar.google.com/calendar/render';
const OUTLOOK_CALENDAR_ADD_URL = 'https://outlook.live.com/calendar/0/addcalendar';

function getCalendarFeedUrl(trip) {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL?.replace(/\/$/, '');
  if (!supabaseUrl || !trip?.id || !trip?.pin) return null;

  const url = new URL(`${supabaseUrl}/functions/v1/calendar-feed`);
  url.searchParams.set('tripId', trip.id);
  url.searchParams.set('token', trip.pin);
  return url.toString();
}

function getSubscriptionUrls(trip) {
  const feedUrl = getCalendarFeedUrl(trip);
  if (!feedUrl) return null;

  const webcalUrl = feedUrl.replace(/^https:/i, 'webcal:');
  const calendarName = `${trip.name || 'Trip'} Flights`;

  const googleUrl = new URL(GOOGLE_CALENDAR_ADD_URL);
  googleUrl.searchParams.set('cid', feedUrl);

  const outlookUrl = new URL(OUTLOOK_CALENDAR_ADD_URL);
  outlookUrl.searchParams.set('url', feedUrl);
  outlookUrl.searchParams.set('name', calendarName);

  return {
    feedUrl,
    webcalUrl,
    googleUrl: googleUrl.toString(),
    outlookUrl: outlookUrl.toString()
  };
}

function openExternal(url) {
  // Same-tab navigation avoids popup blockers in mobile and in-app browsers.
  window.location.assign(url);
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Some in-app browsers expose Clipboard but block it. Fall through.
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  input.remove();
  return copied;
}

/**
 * Open calendar subscription options for the current trip.
 * The URL points to a server-generated ICS feed, so subscribers receive the
 * latest flight data whenever their calendar application refreshes the feed.
 */
export function exportTripCalendar(trip) {
  if (!trip?.flights?.length) {
    showToast('No flights added to this trip yet!', 'warning');
    return;
  }

  const subscriptionUrls = getSubscriptionUrls(trip);
  if (!subscriptionUrls) {
    showToast('Calendar subscription is not configured yet.', 'error');
    return;
  }

  document.getElementById('calendar-sync-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'calendar-sync-modal';
  overlay.className = 'modal-overlay calendar-sync-overlay';
  overlay.innerHTML = `
    <div class="modal calendar-sync-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-sync-title">
      <header class="calendar-sync-header">
        <span class="calendar-sync-icon" aria-hidden="true">${getIcon('calendar')}</span>
        <span class="calendar-sync-heading">
          <span class="calendar-sync-kicker">LIVE CALENDAR</span>
          <h3 id="calendar-sync-title">Subscribe to trip flights</h3>
          <small>${trip.flights.length} flights · ${escapeHtml(trip.name || 'Trip')}</small>
        </span>
        <button type="button" class="calendar-sync-close" id="modal-cal-close-x" aria-label="Close calendar options">✕</button>
      </header>

      <div class="calendar-sync-status">
        <i aria-hidden="true"></i>
        <span>
          <strong>Live subscription</strong>
          <small>New flights and schedule changes sync whenever your calendar refreshes.</small>
        </span>
      </div>

      <div class="calendar-provider-list">
        <button type="button" class="calendar-provider calendar-provider-primary" id="btn-subscribe-apple">
          <span class="calendar-provider-mark" aria-hidden="true">${getIcon('calendar')}</span>
          <span class="calendar-provider-copy"><strong>Apple Calendar</strong><small>Subscribe on iPhone, iPad or Mac</small></span>
          <span class="calendar-provider-arrow" aria-hidden="true">↗</span>
        </button>

        <button type="button" class="calendar-provider" id="btn-subscribe-google">
          <span class="calendar-provider-mark calendar-provider-letter" aria-hidden="true">G</span>
          <span class="calendar-provider-copy"><strong>Google Calendar</strong><small>Open the live feed in Google Calendar</small></span>
          <span class="calendar-provider-arrow" aria-hidden="true">↗</span>
        </button>

        <button type="button" class="calendar-provider" id="btn-subscribe-outlook">
          <span class="calendar-provider-mark calendar-provider-letter" aria-hidden="true">O</span>
          <span class="calendar-provider-copy"><strong>Outlook</strong><small>Subscribe from Outlook on the web</small></span>
          <span class="calendar-provider-arrow" aria-hidden="true">↗</span>
        </button>
      </div>

      <button type="button" class="calendar-copy-link" id="btn-copy-calendar-link">
        <span aria-hidden="true">${getIcon('copy')}</span>
        <span>Copy subscription URL</span>
      </button>

      <p class="calendar-sync-privacy">Anyone with this private link can view the trip's flight schedule.</p>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  const closeButton = overlay.querySelector('#modal-cal-close-x');

  closeButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  overlay.querySelector('#btn-subscribe-apple').addEventListener('click', () => {
    closeModal();
    window.location.assign(subscriptionUrls.webcalUrl);
  });

  overlay.querySelector('#btn-subscribe-google').addEventListener('click', () => {
    openExternal(subscriptionUrls.googleUrl);
    closeModal();
  });

  overlay.querySelector('#btn-subscribe-outlook').addEventListener('click', () => {
    openExternal(subscriptionUrls.outlookUrl);
    closeModal();
  });

  overlay.querySelector('#btn-copy-calendar-link').addEventListener('click', async () => {
    const copied = await copyText(subscriptionUrls.feedUrl);
    showToast(
      copied ? 'Calendar subscription URL copied!' : 'Could not copy the calendar URL.',
      copied ? 'success' : 'error',
      5000
    );
    if (copied) closeModal();
  });

  closeButton.focus();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
