/* ============================================
   PPC: Delay No More — AI Concierge Service
   Uses Gemini API to summarize grouped flight
   options for group travel coordination.
   ============================================ */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Calls the Gemini API to generate a helpful "Concierge" summary
 * explaining why a particular group of flights is a good option.
 * 
 * @param {Object} option - The top GroupedFlightPlan object.
 * @param {string} currentNickname - The name of the current user.
 * @returns {Promise<string>} Natural language summary
 */
export async function generateConciergeSummary(option, currentNickname) {
    if (!GEMINI_API_KEY) {
        console.warn('⚠️ No VITE_GEMINI_API_KEY found. Falling back to static summary.');
        return _generateFallbackSummary(option.flights, currentNickname);
    }

    try {
        const promptData = option.flights.map(entry => {
            const isCurrentUser = entry.passengerName === currentNickname;
            const prefix = isCurrentUser ? '(CURRENT USER) ' : '';
            const outStr = entry.outbound ? `[Outbound]: ${entry.outbound.origin} → ${entry.outbound.destination} (${entry.outbound.airline}) ${entry.outbound.departureTime} - ${entry.outbound.arrivalTime}` : '';
            const inStr = entry.inbound ? ` | [Return]: ${entry.inbound.origin} → ${entry.inbound.destination} (${entry.inbound.airline}) ${entry.inbound.departureTime} - ${entry.inbound.arrivalTime}` : '';
            const priceStr = ` | Cost: $${(entry.outbound?.price || 0) + (entry.inbound?.price || 0)}`;
            return `- ${prefix}Traveler "${entry.passengerName}" ${outStr}${inStr}${priceStr}`;
        }).join('\n');

        let spreadsStr = `Arrival spread for the Outbound flight: ${option.maxArrivalDiff}`;
        if (option.maxDepartureDiff && option.inSpreadMinutes > 0) {
            spreadsStr += `\nDeparture spread for the Return flight: ${option.maxDepartureDiff}`;
        } else if (option.maxDepartureDiff) {
            spreadsStr += `\nDeparture spread for the Return flight: Everyone departs at exactly the same time.`;
        }

        const prompt = `
You are a helpful travel concierge. Look at this combination of flights the group is taking to reach their shared destination and return home:
${promptData}

${spreadsStr}

Write a very brief, friendly sentence (under 40 words) addressing the CURRENT USER directly ("you", "your"). Mention THEIR total flight cost and be HONEST about the timing — if the spread is large on arriving or returning, acknowledge the wait or say they can share a cab if it's tight. Do not use bullet points or bold text.
`;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[AiService] Full Gemini response:', JSON.stringify(data, null, 2));

        // gemini-3-flash-preview may return [{ thought: "..." }, { text: "..." }] in parts
        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            console.warn('[AiService] Unexpected response structure, no parts found.');
            return _generateFallbackSummary(option.flights, currentNickname);
        }

        const parts = candidate.content.parts;
        console.log('[AiService] Parts count:', parts.length, 'Part keys:', parts.map(p => Object.keys(p)));

        // Find the last part that has a `text` property (skip `thought` parts)
        const textPart = parts.filter(p => typeof p.text === 'string').pop();

        if (textPart && textPart.text.trim().length > 0) {
            console.log('[AiService] Extracted text:', textPart.text.trim());
            return textPart.text.trim();
        }

        console.warn('[AiService] No usable text part found in response. Falling back.');
        return _generateFallbackSummary(option.flights, currentNickname);

    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return _generateFallbackSummary(option.flights, currentNickname);
    }
}

function _generateFallbackSummary(flights, currentNickname) {
    const userEntry = flights.find(f => f.passengerName === currentNickname) || flights[0];
    const userCost = userEntry ? ((userEntry.outbound?.price || 0) + (userEntry.inbound?.price || 0)) : 0;
    return `This is a solid option. Your round-trip flights cost $${userCost}, and the whole group arrives relatively close together at the destination.`;
}
