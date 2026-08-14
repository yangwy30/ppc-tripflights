/* Coordination Tab — Group Flight Engine */

import { generateGroupOptions } from '../data/coordinationEngine.js';
import { generateConciergeSummary } from '../data/aiService.js';
import { renderRecommendationCard } from './recommendationCard.js';
import { getUserNickname, saveNickname, addFlight, setParticipantHomeAirport } from '../data/dataAdapter.js';
import { showToast } from './toast.js';
import { emit, EVENTS } from '../data/store.js';
import { getIcon } from './icons.js';

// Module-level cache: persists results across tab switches (keyed by trip ID)
const _coordinationCache = {};

/**
 * Main render function for the Coordination Tab.
 * Injected into the `#coordination-tab-content` container in the Dashboard.
 * 
 * @param {HTMLElement} container - The DOM container for this tab
 * @param {Object} trip - The current trip object
 */
export async function renderCoordinationTab(container, trip) {
    // Restore from cache if available
    const cached = _coordinationCache[trip.id];
    let state = cached ? 'results' : 'idle';
    let options = cached?.options || [];
    let aiSummary = cached?.aiSummary || '';
    let searchDate = cached?.searchDate || trip.startDate || new Date().toISOString().split('T')[0];

    // Ensure current nickname is resolved with automatic fallback to trip participants
    let currentNickname = getUserNickname(trip.id, trip);
    
    // Fallback if trip participants exist but none matched
    const participantList = (trip.participants || []).map(p => typeof p === 'string' ? { name: p } : p);
    let currentUser = participantList.find(p => p.name.trim().toLowerCase() === (currentNickname || '').trim().toLowerCase());
    
    if (!currentUser && participantList.length > 0) {
        currentUser = participantList[0];
        currentNickname = currentUser.name;
        saveNickname(trip.id, currentNickname);
    }

    const destination = trip.destinationAirport;
    const origins = participantList.map(p => p.homeAirport).filter(Boolean);
    const hasBookedFlight = trip.flights && trip.flights.some(f => (f.addedBy || '').trim().toLowerCase() === (currentNickname || '').trim().toLowerCase());

    const render = () => {
        container.innerHTML = `
            <div class="coordination-panel">
                ${renderStatusHeader(trip, origins, currentUser, participantList, currentNickname)}
                ${hasBookedFlight ? renderBookedSuccessState(trip, origins, currentNickname) : ''}
                
                ${state === 'idle' ? renderIdleState() : ''}
                ${state === 'loading' ? renderLoadingState() : ''}
                ${state === 'results' ? renderResultsState(options, aiSummary, currentNickname, searchDate) : ''}
            </div>
        `;

        // Switch Active Traveler Profile Trigger
        const travelerSelect = container.querySelector('#select-active-traveler');
        if (travelerSelect) {
            travelerSelect.addEventListener('change', (e) => {
                const newName = e.target.value;
                if (!newName) return;
                saveNickname(trip.id, newName);
                currentNickname = newName;
                currentUser = participantList.find(p => p.name === newName) || { name: newName };
                showToast(`Operating as ${newName}`, 'info');
                render();
            });
        }

        // Home airport save trigger
        const homeSaveBtn = container.querySelector('#btn-save-home-airport');
        const homeInput = container.querySelector('#input-home-airport');
        if (homeSaveBtn && homeInput) {
            homeSaveBtn.addEventListener('click', async () => {
                const val = homeInput.value.trim().toUpperCase();
                if (!val) return;
                homeSaveBtn.disabled = true;
                homeSaveBtn.textContent = 'Saving...';
                await setParticipantHomeAirport(trip.id, currentNickname, val);
                showToast(`Departure airport for ${currentNickname} set to ${val}`, 'success');
                
                // Refresh local participant list
                participantList.forEach(p => {
                    if (p.name === currentNickname) p.homeAirport = val;
                });
                render();
            });
        }

        // Search Group Flights Trigger
        const fetchBtn = container.querySelector('#btn-find-flights');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', async () => {
                delete _coordinationCache[trip.id];
                state = 'loading';
                render();

                try {
                    searchDate = trip.startDate || new Date().toISOString().split('T')[0];
                    options = await generateGroupOptions(trip, currentNickname);

                    if (options.length > 0) {
                        aiSummary = await generateConciergeSummary(options[0], currentNickname);
                    }

                    state = 'results';
                    _coordinationCache[trip.id] = { options, aiSummary, searchDate };
                } catch (error) {
                    console.error("[CoordTab] Engine failed:", error);
                    state = 'error';
                }
                render();
            });
        }

        // Add recommended flights to the trip, then return to the flight board.
        container.querySelectorAll('.btn-add-trip').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const entryStr = btn.dataset.entry;
                if (!entryStr) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Adding...';
                    const entry = JSON.parse(decodeURIComponent(entryStr));
                    const targetTraveler = entry.passengerName || currentNickname;

                    if (entry.outbound && entry.outbound.airline) {
                        await addFlight(trip.id, {
                            flightNumber: entry.outbound.flightNumber,
                            airline: entry.outbound.airline,
                            departure: { code: entry.outbound.origin, time: entry.outbound.departureTime },
                            arrival: { code: entry.outbound.destination, time: entry.outbound.arrivalTime },
                            date: entry.outbound.date || searchDate,
                            duration: entry.outbound.duration,
                            addedBy: targetTraveler,
                            status: 'scheduled'
                        });
                    }

                    if (entry.inbound && entry.inbound.airline) {
                        await addFlight(trip.id, {
                            flightNumber: entry.inbound.flightNumber,
                            airline: entry.inbound.airline,
                            departure: { code: entry.inbound.origin, time: entry.inbound.departureTime },
                            arrival: { code: entry.inbound.destination, time: entry.inbound.arrivalTime },
                            date: entry.inbound.date || searchDate,
                            duration: entry.inbound.duration,
                            addedBy: targetTraveler,
                            status: 'scheduled'
                        });
                    }

                    emit(EVENTS.FLIGHT_ADDED);
                    showToast(`Flight added for ${targetTraveler}!`, 'success');

                    const flightBoardTab = document.querySelector('.tab-btn[data-maintab="tracking"]');
                    if (flightBoardTab) flightBoardTab.click();

                } catch (err) {
                    console.error('Failed to add flights to trip', err);
                    showToast('Failed to add flights', 'error');
                    btn.disabled = false;
                    btn.textContent = 'Add to Trip';
                }
            });
        });
    };

    render();
}

function renderStatusHeader(trip, origins, currentUser, participantList, currentNickname) {
    const totalParticipants = participantList.length;
    const originsSet = origins.length;
    const missing = totalParticipants - originsSet;
    const currentHome = currentUser?.homeAirport || '';

    let destHtml = `<strong style="font-family:var(--font-family-mono); color: #38BDF8;">${trip.destinationAirport || 'LAX'}</strong>`;
    let retHtml = trip.returnAirport ? ` • Return: <strong style="font-family:var(--font-family-mono); color: #60A5FA;">${trip.returnAirport}</strong>` : '';

    return `
        <div class="card mb-base" style="padding: 1.25rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom: 0.85rem;">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <span style="color: #38BDF8; display:flex;">${getIcon('sparkles')}</span>
                    <h3 style="margin:0; font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em;">Group Flight Search Engine</h3>
                </div>

                <!-- Traveler Profile Switcher Dropdown -->
                <div style="display:flex; align-items:center; gap: 6px; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 11px; color: var(--color-text-tertiary); font-weight: 600;">Operating as:</span>
                    <select id="select-active-traveler" style="all:unset; cursor:pointer; font-family: var(--font-family-mono); font-size: 12px; font-weight: 800; color: #38BDF8;">
                        ${participantList.map(p => `
                            <option value="${escapeHtml(p.name)}" ${p.name === currentNickname ? 'selected' : ''} style="background:#0F172A; color:#FFF;">
                                ${escapeHtml(p.name)} ${p.homeAirport ? `(${p.homeAirport})` : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <p style="font-size: var(--font-size-sm); margin-bottom: 0.85rem; color: var(--color-text-secondary);">
                Target Destination: ${destHtml} ${retHtml}
            </p>

            <!-- Inline Departure Airport Editor for Currently Selected Traveler -->
            <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 10px 14px; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap: 10px; flex-wrap:wrap;">
                    <div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--color-text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Departure Airport for ${escapeHtml(currentNickname)}</span>
                        <div style="font-family: var(--font-family-mono); font-size: 13px; font-weight: 700; color: #FFFFFF; margin-top: 2px;">
                            ${currentHome ? `<span style="color: #38BDF8;">${escapeHtml(currentHome)}</span>` : '<span style="color: var(--color-warning);">Not Set (Defaulting to JFK)</span>'}
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap: 6px;">
                        <input class="input" type="text" id="input-home-airport" value="${escapeHtml(currentHome)}" placeholder="e.g. SFO or JFK" style="width: 130px; font-family: var(--font-family-mono); font-size: 12px; padding: 4px 8px; text-transform: uppercase;" />
                        <button id="btn-save-home-airport" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 4px 10px;">
                            Set
                        </button>
                    </div>
                </div>
            </div>

            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-bottom: 0.85rem;">
                ${missing === 0
                    ? `All ${totalParticipants} travelers have designated their departure airport or booked a flight.`
                    : `<strong style="color:#38BDF8;">${originsSet} travelers ready for coordination.</strong> <span style="color:var(--color-warning);">(${missing} traveler(s) without origin info will be skipped until set)</span>`}
            </div>
            
            <button id="btn-find-flights" class="btn btn-primary" style="width: 100%; font-size: var(--font-size-sm); padding: 0.75rem var(--space-base);">
                <span style="display:flex;">${getIcon('sparkles')}</span> Find Coordinated Flights (${originsSet} Ready Travelers)
            </button>
        </div>
    `;
}

function renderIdleState() {
    return `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div class="empty-state-icon" style="display:flex; justify-content:center; color: #38BDF8;">${getIcon('sparkles')}</div>
            <h3>Ready to Coordinate</h3>
            <p>Click the button above to search flight combinations for all group travelers.</p>
        </div>
    `;
}

function renderBookedSuccessState(trip, origins, currentNickname) {
    return `
        <div class="card mb-base" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); border-left: 3px solid var(--color-success);">
            <div style="display:flex; align-items:center; gap: 12px;">
                <span style="color: var(--color-success); display:flex;">${getIcon('plane')}</span>
                <div>
                    <div style="font-weight: 700; font-size: var(--font-size-sm); color: var(--color-text-primary);">Flight Booked / Added for ${escapeHtml(currentNickname)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px;">
                        Check the Flights tab to view your active boarding pass.
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLoadingState() {
    return `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div style="font-size: 2rem; animation: pulse 1.5s infinite; display:flex; justify-content:center; color: #38BDF8;">${getIcon('sparkles')}</div>
            <h3 style="margin-top: var(--space-md); font-weight: 800;">Analyzing Flight Combinations...</h3>
            <p style="color: var(--color-text-secondary);">Fetching live flight schedules and calculating optimal group arrival alignment.</p>
        </div>
    `;
}

function renderResultsState(options, aiSummary, currentNickname, searchDate) {
    if (options.length === 0) {
        return `
            <div class="empty-state" style="padding: var(--space-xl) 0;">
                <div class="empty-state-icon" style="display:flex; justify-content:center; color: var(--color-warning);">${getIcon('plane')}</div>
                <h3>No Group Matches Found</h3>
                <p>We couldn't find flight combinations for all travelers on the specified date.</p>
            </div>
        `;
    }

    return `
        <!-- AI Concierge Summary -->
        <div class="card mb-base" style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); padding: 1rem 1.25rem;">
            <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 6px;">
                <span style="display:flex; color: #38BDF8;">${getIcon('sparkles')}</span>
                <strong style="color: #38BDF8; font-weight:700; font-size: 13px;">AI Concierge Summary</strong>
            </div>
            <p style="font-size: var(--font-size-sm); font-style: italic; color: var(--color-text-primary); margin: 0;">
                "${aiSummary}"
            </p>
        </div>

        <h3 style="margin-bottom: var(--space-md); font-weight: 800; letter-spacing: -0.02em;">Top Coordinated Flight Combinations</h3>
        
        <div class="recommendations-list" style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${options.map((opt, i) => renderRecommendationCard(opt, i + 1, currentNickname, searchDate)).join('')}
        </div>
    `;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
