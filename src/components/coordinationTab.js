/* ============================================
   PPC: Delay No More — Coordination Tab
   The UI for the Phase 3 Flight Coordination Engine
   ============================================ */

import { generateGroupOptions } from '../data/coordinationEngine.js';
import { generateConciergeSummary } from '../data/aiService.js';
import { renderRecommendationCard } from './recommendationCard.js';
import { getUserNickname, addFlight } from '../data/dataAdapter.js';
import { showToast } from './toast.js';
import { emit, EVENTS } from '../data/store.js';

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

    // We need the trip destination and each participant's origin
    const destination = trip.destinationAirport;
    const origins = trip.participants.map(p => p.homeAirport).filter(Boolean); // Filter out empty ones

    const currentNickname = getUserNickname(trip.id);
    const currentUser = trip.participants.find(p => p.name === currentNickname);
    const currentUserOrigin = currentUser ? currentUser.homeAirport : null;

    const hasBookedFlight = trip.flights && trip.flights.some(f => f.addedBy === currentNickname);

    const render = () => {
        if (hasBookedFlight) {
            container.innerHTML = `
                <div class="coordination-panel">
                    ${renderBookedSuccessState(trip, origins, currentNickname)}
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="coordination-panel">
                ${renderStatusHeader(trip, origins)}
                
                ${state === 'idle' ? renderIdleState() : ''}
                ${state === 'loading' ? renderLoadingState() : ''}
                ${state === 'results' ? renderResultsState(options, aiSummary, currentNickname, searchDate) : ''}
            </div>
        `;

        // Attach event listeners after render
        const fetchBtn = container.querySelector('#btn-find-flights');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', async () => {
                console.log('[CoordTab] Button clicked. Setting state to loading.');
                // Clear stale cache for this trip
                delete _coordinationCache[trip.id];
                state = 'loading';
                render();

                try {
                    // Start date of the trip for flight search
                    searchDate = trip.startDate || new Date().toISOString().split('T')[0];

                    console.log('[CoordTab] Calling generateGroupOptions...');
                    options = await generateGroupOptions(trip, currentNickname);
                    console.log('[CoordTab] generateGroupOptions returned:', options.length, 'options');

                    if (options.length > 0) {
                        // Pass the Top Option to the AI with its actual arrival spread
                        console.log('[CoordTab] Calling generateConciergeSummary...');
                        aiSummary = await generateConciergeSummary(options[0], currentNickname);
                        console.log('[CoordTab] AI summary returned:', aiSummary.substring(0, 50) + '...');
                    }

                    state = 'results';
                    // Cache results so they persist across tab switches
                    _coordinationCache[trip.id] = { options, aiSummary, searchDate };
                    console.log('[CoordTab] State set to results. Calling render().');
                } catch (error) {
                    console.error("[CoordTab] Engine failed:", error);
                    state = 'error';
                }
                render();
                console.log('[CoordTab] Final render() called. State:', state);
            });
        }

        // Add to Timeline buttons
        container.querySelectorAll('.btn-add-timeline').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const entryStr = btn.dataset.entry;
                if (!entryStr) return;

                try {
                    btn.disabled = true;
                    btn.textContent = 'Adding...';
                    const entry = JSON.parse(decodeURIComponent(entryStr));

                    if (entry.outbound && entry.outbound.airline) {
                        await addFlight(trip.id, {
                            flightNumber: entry.outbound.flightNumber,
                            airline: entry.outbound.airline,
                            departure: { code: entry.outbound.origin, time: entry.outbound.departureTime },
                            arrival: { code: entry.outbound.destination, time: entry.outbound.arrivalTime },
                            date: entry.outbound.date,
                            duration: entry.outbound.duration,
                            addedBy: currentNickname,
                            status: 'scheduled'
                        });
                    }

                    if (entry.inbound && entry.inbound.airline) {
                        await addFlight(trip.id, {
                            flightNumber: entry.inbound.flightNumber,
                            airline: entry.inbound.airline,
                            departure: { code: entry.inbound.origin, time: entry.inbound.departureTime },
                            arrival: { code: entry.inbound.destination, time: entry.inbound.arrivalTime },
                            date: entry.inbound.date,
                            duration: entry.inbound.duration,
                            addedBy: currentNickname,
                            status: 'scheduled'
                        });
                    }

                    emit(EVENTS.FLIGHT_ADDED);
                    showToast('Flights added to your timeline! ✈️', 'success');

                    // Switch to timeline tab automatically
                    const timelineTabBtn = document.querySelector('.tab-btn[data-tab="timeline"]');
                    if (timelineTabBtn) timelineTabBtn.click();

                } catch (err) {
                    console.error('Failed to add flights to timeline', err);
                    showToast('Failed to add to timeline', 'error');
                    btn.disabled = false;
                    btn.textContent = '✅ Add to Timeline';
                }
            });
        });
    };

    render();
}

function renderStatusHeader(trip, origins) {
    const totalParticipants = trip.participants.length;
    const originsSet = origins.length;
    const missing = totalParticipants - originsSet;

    const isReady = missing === 0 && trip.destinationAirport;

    const overrides = trip.participants
        .filter(p => p.destinationAirport && p.destinationAirport !== trip.destinationAirport)
        .map(p => `${p.name} → ${p.destinationAirport}`);

    let destHtml = `<strong>${trip.destinationAirport || 'Not set'}</strong>`;
    let retHtml = trip.returnAirport ? ` • Return from: <strong>${trip.returnAirport}</strong>` : '';

    if (overrides.length > 0) {
        const overrideStr = `<span style="font-size: 0.9em; color: var(--color-text-secondary); margin-left: 4px;">(${overrides.join(', ')})</span>`;
        destHtml += overrideStr;
        if (trip.returnAirport) retHtml += overrideStr; // apply overrides to return side too
    }

    return `
        <div class="card mb-base" style="padding: var(--space-md); border-left: 4px solid var(--color-accent);">
            <h3 style="margin-bottom: var(--space-xs);">Flight Coordination Engine</h3>
            <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-sm);">
                Destination: ${destHtml}
                ${retHtml}
            </p>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-md);">
                ${missing === 0
            ? `✅ All ${totalParticipants} travelers have set their origin airport.`
            : `⚠️ Waiting on ${missing} traveler(s) to set an origin airport.`}
            </div>
            
            <button id="btn-find-flights" class="btn btn-primary" style="width: 100%;" ${!isReady ? 'disabled' : ''}>
                🪄 Find Coordinated Flights
            </button>
        </div>
    `;
}

function renderIdleState() {
    return `
        <div class="empty-state" style="padding: var(--space-2xl) 0;">
            <div class="empty-state-icon">🗓️</div>
            <h3>Ready to Coordinate</h3>
            <p>Click the button above to search the Amadeus API and find the best group flight combinations.</p>
        </div>
    `;
}

function renderBookedSuccessState(trip, origins, currentNickname) {
    const totalParticipants = trip.participants.length;
    const originsSet = origins.length;
    const missing = totalParticipants - originsSet;

    return `
        <div class="card mb-base" style="padding: var(--space-xl); text-align: center; border: 1px solid var(--color-border); box-shadow: var(--shadow-md);">
            <div style="font-size: 3rem; margin-bottom: var(--space-md);">🎉</div>
            <h3 style="margin-bottom: var(--space-sm);">You're all set, ${currentNickname}!</h3>
            <p style="color: var(--color-text-secondary); margin-bottom: var(--space-lg); max-width: 400px; margin-left: auto; margin-right: auto;">
                You've already added your flight to the itinerary. The rest of the group will use this tool to coordinate their arrivals around your schedule.
            </p>
            
            <div style="background: var(--color-surface-secondary); padding: var(--space-md); border-radius: var(--radius-sm); font-size: var(--font-size-sm); display: inline-block; text-align: left;">
                <div style="font-weight: 500; margin-bottom: 4px;">Group Coordination Status:</div>
                <div style="color: var(--color-text-secondary);">
                    ${missing === 0 ? '✓ Checking exact syncing options' : `⏳ Waiting on ${missing} traveler(s) to set their origins.`}
                </div>
            </div>
        </div>
    `;
}

function renderLoadingState() {
    return `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div style="font-size: 2rem; animation: pulse 1.5s infinite;">⏳</div>
            <h3 style="margin-top: var(--space-md);">Analyzing 1,000+ Combinations...</h3>
            <p>Fetching flights and calculating optimal arrival alignments.</p>
        </div>
        <style>
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); }
            }
        </style>
    `;
}

function renderResultsState(options, aiSummary, currentNickname, searchDate) {
    if (options.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <h3>No Group Matches Found</h3>
                <p>We couldn't find flights that get everyone to the destination on the same day.</p>
            </div>
        `;
    }

    return `
        <!-- AI Concierge Summary -->
        <div class="card mb-base" style="background: var(--color-accent-light); border: 1px solid rgba(10, 132, 255, 0.2); padding: var(--space-md);">
            <div style="display:flex; align-items:center; gap: 8px; margin-bottom: var(--space-sm);">
                <span style="font-size: 1.25rem;">✨</span>
                <strong style="color: var(--color-accent-dark);">AI Concierge</strong>
            </div>
            <p style="font-size: var(--font-size-sm); font-style: italic; color: var(--color-text-primary);">
                "${aiSummary}"
            </p>
        </div>

        <h3 style="margin-bottom: var(--space-sm);">Top Options for your Group</h3>
        
        <div class="recommendations-list" style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${options.map((opt, i) => renderRecommendationCard(opt, i + 1, currentNickname, searchDate)).join('')}
        </div>
    `;
}
