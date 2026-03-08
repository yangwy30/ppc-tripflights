/* ============================================
   PPC: Delay No More — Notes Screen
   ============================================ */

import { getTrip, getUserNickname, addNote, deleteNote, exportTripSummary } from '../data/dataAdapter.js';
import { emit, EVENTS } from '../data/store.js';
import { navigate } from '../app.js';
import { showToast } from '../components/toast.js';

export async function renderNotes(container, tripId) {
  const trip = await getTrip(tripId);
  if (!trip) {
    navigate('');
    return;
  }

  const nickname = getUserNickname(tripId);

  async function render() {
    const currentTrip = await getTrip(tripId);
    if (!currentTrip) return;

    const notes = [...currentTrip.notes].reverse(); // newest first

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="topbar-back" id="btn-back">← Dashboard</button>
          <div class="topbar-actions">
            <button class="btn btn-sm btn-ghost" id="btn-export" title="Export Itinerary">📤 Export</button>
          </div>
        </div>

        <div class="screen-header">
          <h2>Trip Notes</h2>
          <p>Shared notes for ${escapeHtml(currentTrip.name)}</p>
        </div>

        <!-- Add Note -->
        <div class="card mb-base">
          <textarea class="textarea" id="note-input" placeholder="Add a note (hotel info, meetup points, car rentals...)" rows="3"></textarea>
          <button class="btn btn-primary btn-sm mt-sm" id="btn-add-note" style="width: auto; float: right;">Add Note</button>
          <div style="clear: both;"></div>
        </div>

        <!-- Notes List -->
        <div id="notes-list">
          ${notes.length === 0 ? `
            <div class="empty-state" style="padding: var(--space-xl);">
              <div class="empty-state-icon">📝</div>
              <h3>No notes yet</h3>
              <p>Add shared notes about hotels, meetup points, or anything useful</p>
            </div>
          ` : notes.map((note, i) => `
            <div class="note-card stagger-${Math.min(i + 1, 6)}">
              <div class="note-card-header">
                <span class="note-card-author">${escapeHtml(note.author)}</span>
                <div style="display:flex; align-items:center; gap: var(--space-sm);">
                  <span class="note-card-time">${formatTime(note.createdAt)}</span>
                  <button class="btn btn-icon btn-ghost note-delete" data-note-id="${note.id}" title="Delete" style="width:24px;height:24px;font-size:var(--font-size-xs);color:var(--color-danger);">✕</button>
                </div>
              </div>
              <div class="note-card-content">${escapeHtml(note.content)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // --- Event Listeners ---
    container.querySelector('#btn-back').addEventListener('click', () => navigate(`trip/${tripId}`));

    container.querySelector('#btn-add-note').addEventListener('click', async () => {
      const input = container.querySelector('#note-input');
      const content = input.value.trim();
      if (!content) return;

      await addNote(tripId, { content, author: nickname });
      showToast('Note added', 'success');
      render();
    });

    container.querySelector('#btn-export').addEventListener('click', async () => {
      const summary = await exportTripSummary(tripId);
      if (navigator.share) {
        navigator.share({ title: currentTrip.name, text: summary }).catch(() => { });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(summary).then(() => {
          showToast('Itinerary copied to clipboard!', 'success');
        });
      }
    });

    container.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteNote(tripId, btn.dataset.noteId);
        showToast('Note deleted', 'info');
        render();
      });
    });
  }

  render();
}

function formatTime(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
