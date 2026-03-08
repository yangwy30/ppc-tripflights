/* ============================================
   PPC: Delay No More — Recommendation Card
   Renders a beautiful grouped flight option
   ============================================ */

/**
 * Renders a single grouped option containing multiple flights.
 * 
 * @param {Object} option - A GroupedFlightPlan object
 * @param {number} index - The rank (1, 2, 3...)
 * @param {string} currentUserOrigin - The airport code of the current user
 */
export function renderRecommendationCard(option, index, currentNickname, searchDate) {
    const flights = option.flights || [];

    // Find the current user's entry
    const userEntry = flights.find(f => f.passengerName === currentNickname) || flights[0];
    const userCost = userEntry ? ((userEntry.outbound?.price || 0) + (userEntry.inbound?.price || 0)) : option.totalCost;

    // Header summarizes the option
    return `
        <div class="card recommendation-card" style="padding: var(--space-md); border: 1px solid var(--color-border); box-shadow: var(--shadow-sm); border-radius: var(--radius-md); background: var(--color-surface); transition: transform var(--transition-fast);">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-light); padding-bottom: var(--space-sm);">
                <div>
                    <div style="display: flex; align-items: center; gap: var(--space-sm);">
                        <span style="background: var(--color-accent); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">${index}</span>
                        <h4 style="margin: 0; font-size: var(--font-size-md);">Group Option ${index}</h4>
                    </div>
                    <div style="margin: 8px 0 0 0; font-size: var(--font-size-sm); display: flex; flex-direction: column; gap: 4px;">
                        <span style="color: var(--color-success); font-weight: 500;">🛫 Outbound Spread: ${option.maxArrivalDiff}</span>
                        ${option.maxDepartureDiff ? `<span style="color: var(--color-primary); font-weight: 500;">🛬 Return Spread: ${option.maxDepartureDiff}</span>` : ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="display: block; font-size: var(--font-size-lg); font-weight: bold; color: var(--color-text-primary);">
                        $${userCost}
                    </span>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Your flight cost</span>
                </div>
            </div>

            <!-- Grouped by Leg -->
            ${_renderFlightSection('🛫 Outbound', option.maxArrivalDiff, flights, currentNickname, 'outbound')}
            
            ${flights.some(e => e.inbound && e.inbound.airline) ?
            _renderFlightSection('🛬 Return', option.maxDepartureDiff, flights, currentNickname, 'inbound')
            : ''}
            
            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end; gap: var(--space-sm);">
                <button class="btn btn-sm btn-success btn-add-timeline" 
                        data-entry="${encodeURIComponent(JSON.stringify(userEntry))}"
                        style="display: inline-flex; align-items: center; gap: 6px;">
                    ✅ Add to Timeline
                </button>
                <a href="${_buildGoogleFlightsUrl(userEntry?.outbound, userEntry?.inbound)}" 
                   target="_blank" rel="noopener noreferrer"
                   class="btn btn-sm btn-primary"
                   style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                    ✈️ Book on Google Flights
                </a>
            </div>
        </div>
    `;
}

/**
 * Build a Google Flights search URL from flight objects (round trip supported).
 */
function _buildGoogleFlightsUrl(outFlight, inFlight) {
    if (!outFlight) return 'https://www.google.com/travel/flights';

    const origin = (outFlight.origin || '').substring(0, 3).toUpperCase();
    const dest = (outFlight.destination || '').substring(0, 3).toUpperCase();
    const date = outFlight.date || new Date().toISOString().split('T')[0];

    if (!origin || !dest) return 'https://www.google.com/travel/flights';

    if (inFlight && inFlight.date) {
        const retDate = inFlight.date;
        return `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${dest}%20on%20${date}%20through%20${retDate}`;
    }

    return `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${dest}%20on%20${date}`;
}

/** Simple HTML entity escaper to prevent XSS in user-provided names */
function _escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _renderFlightSection(title, diffText, flights, currentNickname, legKey) {
    return `
        <div style="margin-top: var(--space-sm);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-weight: 600; font-size: var(--font-size-sm); color: var(--color-text-primary);">${title}</span>
                <span style="font-size: var(--font-size-xs); font-weight: 500; color: ${legKey === 'outbound' ? 'var(--color-success)' : 'var(--color-primary)'};">${diffText ? `Spread: ${diffText}` : ''}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${flights.filter(e => e[legKey] && e[legKey].airline).map(entry => {
        const isCurrentUser = entry.passengerName === currentNickname;
        const safeName = _escapeHtml(entry.passengerName || 'Traveler');
        const f = entry[legKey];
        return `
                        <div style="background: ${isCurrentUser ? 'var(--color-primary-light)' : 'var(--color-surface-secondary)'}; padding: 6px 10px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; ${isCurrentUser ? 'border: 1px solid var(--color-primary);' : 'border: 1px solid transparent;'}">
                            <div style="flex: 0 0 70px; font-weight: 500; font-size: var(--font-size-xs); color: ${isCurrentUser ? 'var(--color-primary-dark)' : 'var(--color-text-primary)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${safeName}
                            </div>
                            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); width: 75px;">
                                ${f.origin} → ${f.destination}
                            </div>
                            <div style="font-weight: 600; font-size: var(--font-size-sm); color: var(--color-text-primary); flex: 1; text-align: center;">
                                ${_formatTime(f.departureTime)} — ${_formatTime(f.arrivalTime)}
                            </div>
                            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); width: 90px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${f.airline}
                            </div>
                            <div style="font-size: var(--font-size-xs); font-weight: 600; width: 45px; text-align: right; color: ${isCurrentUser ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)'};">
                                ${isCurrentUser && f.price > 0 ? `$${f.price}` : '-'}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

/**
 * Format time to display day offsets as superscript (e.g., 00:57+1 -> 00:57⁺¹)
 */
function _formatTime(timeStr) {
    if (!timeStr) return '';
    if (timeStr.includes('+')) {
        const [time, offset] = timeStr.split('+');
        return `${time}<sup style="font-size: 0.7em; margin-left: 2px;">+${offset}</sup>`;
    }
    if (timeStr.includes('-')) {
        const [time, offset] = timeStr.split('-');
        return `${time}<sup style="font-size: 0.7em; margin-left: 2px;">-${offset}</sup>`;
    }
    return timeStr;
}
