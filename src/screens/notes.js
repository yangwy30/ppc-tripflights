/* Notes screen */

import { getTrip, getUserNickname, addNote, deleteNote, exportTripSummary } from '../data/dataAdapter.js';
import { subscribe, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';
import { getIcon } from '../components/icons.js';

export async function renderNotes(container, tripId) {
  let disposed = false;
  let renderGeneration = 0;
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);

  // Keep the list current when this trip's notes change.
  const noteUnsubscribers = [EVENTS.NOTE_ADDED, EVENTS.NOTE_DELETED].map(eventName =>
    subscribe(eventName, payload => {
      if (payload?.tripId === tripId) render();
    })
  );
  const unsubscribe = () => {
    if (disposed) return;
    disposed = true;
    renderGeneration += 1;
    noteUnsubscribers.forEach(stop => stop());
  };

  async function render() {
    if (disposed) return;
    const generation = ++renderGeneration;
    const currentTrip = await getTrip(tripId);
    if (!currentTrip || disposed || generation !== renderGeneration) return;

    const notes = [...(currentTrip.notes || [])].reverse();

    container.innerHTML = `
      <div class="screen" style="max-width: 680px; margin: 0 auto;">
        <div class="topbar">
          <button class="topbar-back" id="btn-back">
            <span style="display:flex;">${getIcon('arrowLeft')}</span> Dashboard
          </button>
          <div class="topbar-actions">
            <button class="btn btn-sm btn-ghost" id="btn-export">
              <span style="display:flex;">${getIcon('share')}</span> Export
            </button>
          </div>
        </div>

        <div class="screen-header">
          <h2>Trip Notes</h2>
          <p>Shared notes for ${escapeHtml(currentTrip.name)}</p>
        </div>

        <div class="card mb-base">
          <textarea class="textarea" id="note-input" placeholder="Add a note (hotel info, meetup points, car rentals...)" rows="3"></textarea>
          <button class="btn btn-primary btn-sm mt-sm" id="btn-add-note" style="width: auto; float: right;">Add Note</button>
          <div style="clear: both;"></div>
        </div>

        <div id="notes-list">
          ${notes.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon" style="display:flex; justify-content:center;">${getIcon('notes')}</div>
              <h3>No notes yet</h3>
              <p>Add shared notes about hotels, meetup points, or anything useful</p>
            </div>
          ` : notes.map((note) => `
            <div class="note-card">
              <div class="note-card-header">
                <span class="note-card-author">${escapeHtml(note.author)}</span>
                <div style="display:flex; align-items:center; gap: var(--space-sm);">
                  <span class="note-card-time">${formatTime(note.createdAt)}</span>
                  <button class="btn btn-icon btn-ghost note-delete" data-note-id="${note.id}" title="Delete" style="width:24px;height:24px;color:var(--color-danger);">${getIcon('trash')}</button>
                </div>
              </div>
              <div class="note-card-content">${escapeHtml(note.content)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelector('#btn-back').addEventListener('click', () => {
      unsubscribe();
      navigate(`trip/${tripId}`);
    });

    container.querySelector('#btn-add-note').addEventListener('click', async () => {
      const input = container.querySelector('#note-input');
      const content = input.value.trim();
      if (!content) return;

      const added = await addNote(tripId, { content, author: nickname });
      showToast(added ? 'Note added' : 'Could not add note', added ? 'success' : 'error');
    });

    container.querySelector('#btn-export').addEventListener('click', async () => {
      const summary = await exportTripSummary(tripId);
      if (navigator.share) {
        try {
          await navigator.share({ title: currentTrip.name, text: summary });
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      const copied = await copyText(summary);
      showToast(copied ? 'Itinerary copied to clipboard!' : 'Could not export the itinerary', copied ? 'success' : 'error');
    });

    container.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const deleted = await deleteNote(tripId, btn.dataset.noteId);
        showToast(deleted ? 'Note deleted' : 'Could not delete note', deleted ? 'info' : 'error');
      });
    });
  }

  await render();
  return unsubscribe;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back for embedded browsers that expose but block Clipboard.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  textarea.remove();
  return copied;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return isoStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
