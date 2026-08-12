/* Coordination Tab */

import { generateGroupOptions } from '../data/coordinationEngine.js';
import { generateConciergeSummary } from '../data/aiService.js';
import { renderRecommendationCard } from './recommendationCard.js';
import { getUserNickname, addFlight } from '../data/dataAdapter.js';
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

    // We need the trip destination and each participant's origin
    const destination = trip.destinationAirport;
    const origins = trip.participants.map(p => p.homeAirport).filter(Boolean); // Filter out empty ones

    const currentNickname = getUserNickname(trip.id);
    const currentUser = trip.participants.find(p => p.name === currentNickname);

    const hasBookedFlight = trip.flights && trip.flights.some(f => f.addedBy === currentNickname);

    const render = () => {
        container.innerHTML = `
            <div class="coordination-panel">
                ${renderStatusHeader(trip, origins)}
                ${hasBookedFlight ? renderBookedSuccessState(trip, origins, currentNickname) : ''}
                
                ${state === 'idle' ? renderIdleState() : ''}
                ${state === 'loading' ? renderLoadingState() : ''}
                ${state === 'results' ? renderResultsState(options, aiSummary, currentNickname, searchDate) : ''}
            </div>
        `;

        // Attach event listeners after render
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
                    showToast('Flights added to your timeline!', 'success');

                    // Switch to timeline tab automatically
                    const timelineTabBtn = document.querySelector('.tab-btn[data-tab="timeline"]');
                    if (timelineTabBtn) timelineTabBtn.click();

                } catch (err) {
                    console.error('Failed to add flights to timeline', err);
                    showToast('Failed to add to timeline', 'error');
                    btn.disabled = false;
                    btn.textContent = 'Add to Timeline';
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

    let destHtml = `<strong style="font-family:var(--font-family-mono);">${trip.destinationAirport || 'Not set'}</strong>`;
    let retHtml = trip.returnAirport ? ` • Return from: <strong style="font-family:var(--font-family-mono);">${trip.returnAirport}</strong>` : '';

    if (overrides.length > 0) {
        const overrideStr = `<span style="font-size: 0.9em; color: var(--color-text-secondary); margin-left: 4px;">(${overrides.join(', ')})</span>`;
        destHtml += overrideStr;
        if (trip.returnAirport) retHtml += overrideStr;
    }

    return `
        <div class="card mb-base" style="padding: var(--space-md);">
            <div style="display:flex; align-items:center; gap: 8px; margin-bottom: var(--space-xs);">
                <span style="color: var(--color-accent); display:flex;">${getIcon('sparkles')}</span>
                <h3 style="margin:0; font-size: 1.1rem; font-weight: 700; letter-spacing: -0.02em;">Group Coordination</h3>
            </div>
            <p style="font-size: var(--font-size-sm); margin-bottom: var(--space-sm);">
                Destination: ${destHtml}
                ${retHtml}
            </p>
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-md);">
                ${missing === 0
            ? `All ${totalParticipants} travelers have set their home airport.`
            : `Waiting on ${missing} traveler(s) to set home airport.`}
            </div>
            
            <button id="btn-find-flights" class="btn btn-primary" style="width: 100%; font-size: var(--font-size-sm);" ${!isReady ? 'disabled' : ''}>
                <span style="display:flex;">${getIcon('sparkles')}</span> Find Coordinated Flights
            </button>
        </div>
    `;
}

function renderIdleState() {
    return `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div class="empty-state-icon" style="display:flex; justify-content:center;">${getIcon('sparkles')}</div>
            <h3>Ready to Coordinate</h3>
            <p>Click the button above to search group flight options.</p>
        </div>
    `;
}

function renderBookedSuccessState(trip, origins, currentNickname) {
    const totalParticipants = trip.participants.length;
    const originsSet = origins.length;
    const missing = totalParticipants - originsSet;

    return `
        <div class="card mb-base" style="padding: var(--space-lg); display: flex; align-items: center; justify-content: space-between; gap: var(--space-md);">
            <div style="display:flex; align-items:center; gap: 12px;">
                <span style="color: var(--color-success); display:flex;">${getIcon('plane')}</span>
                <div>
                    <div style="font-weight: 700; font-size: var(--font-size-base); color: var(--color-text-primary);">Flight Added (${escapeHtml(currentNickname)})</div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px;">
                        ${missing === 0 ? 'All traveler home airports set' : `Waiting on ${missing} traveler(s)`}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLoadingState() {
    return `
        <div class="empty-state" style="padding: var(--space-xl) 0;">
            <div style="font-size: 2rem; animation: pulse 1.5s infinite; display:flex; justify-content:center;">${getIcon('sparkles')}</div>
            <h3 style="margin-top: var(--space-md); font-weight: 800;">Analyzing Flight Combinations...</h3>
            <p>Fetching flights and calculating optimal arrival alignments.</p>
        </div>
    `;
}

function renderResultsState(options, aiSummary, currentNickname, searchDate) {
    if (options.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon" style="display:flex; justify-content:center;">${getIcon('plane')}</div>
                <h3>No Group Matches Found</h3>
                <p>We couldn't find flights that get everyone to the destination on the same day.</p>
            </div>
        `;
    }

    return `
        <!-- AI Concierge Summary -->
        <div class="card mb-base" style="background: var(--color-accent-light); border: 1px solid rgba(10, 132, 255, 0.2); padding: var(--space-md);">
            <div style="display:flex; align-items:center; gap: 8px; margin-bottom: var(--space-sm);">
                <span style="display:flex; color: var(--color-accent);">${getIcon('sparkles')}</span>
                <strong style="color: var(--color-accent); font-weight:700;">AI Concierge Summary</strong>
            </div>
            <p style="font-size: var(--font-size-sm); font-style: italic; color: var(--color-text-primary);">
                "${aiSummary}"
            </p>
        </div>

        <h3 style="margin-bottom: var(--space-sm); font-weight: 800; letter-spacing: -0.02em;">Top Options for your Group</h3>
        
        <div class="recommendations-list" style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${options.map((opt, i) => renderRecommendationCard(opt, i + 1, currentNickname, searchDate)).join('')}
        </div>
    `;
}
