import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple hash function for basic auth check
async function hashPin(pin: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + "PPC_TRIP_SALT");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ICS formatting helpers
function formatIcsDate(dateStr: string, timeStr?: string) {
    if (!timeStr) {
        // All-day event if no time
        return dateStr.replace(/-/g, '');
    }

    // Attempt to create a valid ISO string
    // This is a naive parsing assuming the local timezone of the departure,
    // which for flights is usually acceptable for basic display.
    let cleanTime = timeStr.trim();
    let isPm = cleanTime.toLowerCase().includes('pm');
    let isAm = cleanTime.toLowerCase().includes('am');
    
    cleanTime = cleanTime.replace(/am|pm/i, '').trim();
    
    let [hours, minutes] = cleanTime.split(':').map(Number);
    
    if (isNaN(hours)) hours = 12;
    if (isNaN(minutes)) minutes = 0;

    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;

    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMins = minutes.toString().padStart(2, '0');

    // Return in local time (floating) format for ICS: YYYYMMDDTHHMMSS
    return `${dateStr.replace(/-/g, '')}T${formattedHours}${formattedMins}00`;
}

// Helper to add duration to a date string and return an ICS formatted end date
function calculateEndTime(dateStr: string, timeStr: string, durationStr?: string) {
    if (!durationStr || !timeStr) {
        // Fallback to naive same-day if duration is busted
        return formatIcsDate(dateStr, timeStr);
    }
    
    // Parse start date
    let [year, month, day] = dateStr.split('-').map(Number);
    
    let cleanTime = timeStr.trim().toLowerCase();
    let isPm = cleanTime.includes('pm');
    let isAm = cleanTime.includes('am');
    cleanTime = cleanTime.replace(/am|pm/g, '').trim();
    let [hours, minutes] = cleanTime.split(':').map(Number);
    if (isNaN(hours)) hours = 12;
    if (isNaN(minutes)) minutes = 0;
    if (isPm && hours < 12) hours += 12;
    if (isAm && hours === 12) hours = 0;

    // Build base JS date explicitly in UTC to avoid any obscure server local-time DST shifts during addition
    const startDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    // Parse duration (e.g. "6h 40m", "12h", "45m")
    let durHours = 0;
    let durMins = 0;
    const hMatch = durationStr.match(/(\d+)\s*h/i);
    const mMatch = durationStr.match(/(\d+)\s*m/i);
    if (hMatch) durHours = parseInt(hMatch[1], 10);
    if (mMatch) durMins = parseInt(mMatch[1], 10);

    // Add duration purely in UTC math
    startDate.setUTCHours(startDate.getUTCHours() + durHours);
    startDate.setUTCMinutes(startDate.getUTCMinutes() + durMins);

    // Format back to ICS string YYYYMMDDTHHMMSS
    const outYear = startDate.getUTCFullYear().toString();
    const outMonth = (startDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const outDay = startDate.getUTCDate().toString().padStart(2, '0');
    const outHours = startDate.getUTCHours().toString().padStart(2, '0');
    const outMins = startDate.getUTCMinutes().toString().padStart(2, '0');

    return `${outYear}${outMonth}${outDay}T${outHours}${outMins}00`;
}

// Helper to escape text fields inside VEVENTs per RFC 5545
function escapeIcsText(str: string) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

// RFC 5545 specifies lines SHOULD NOT be longer than 75 octets.
// We fold at 70 characters to be safe with multi-byte chars.
function foldLine(line: string) {
    if (line.length <= 70) return line;
    let folded = '';
    let curr = 0;
    while (curr < line.length) {
        let chunk = line.substring(curr, curr + 70);
        if (curr > 0) {
            folded += '\r\n ' + chunk;
        } else {
            folded += chunk;
        }
        curr += 70;
    }
    return folded;
}

// Fallback duration calculator if missing from database
function guessDuration(depTime?: string, arrTime?: string) {
    if (!depTime || !arrTime) return 'Unknown';
    try {
        let cleanDep = depTime.toLowerCase().replace(/am|pm/g, '').trim();
        let cleanArr = arrTime.toLowerCase().replace(/am|pm/g, '').trim();
        
        let [dHours, dMins] = cleanDep.split(':').map(Number);
        let [aHours, aMins] = cleanArr.split(':').map(Number);
        if (isNaN(dHours) || isNaN(aHours)) return 'Unknown';
        
        let diffMins = (aHours * 60 + aMins) - (dHours * 60 + dMins);
        if (diffMins <= 0) diffMins += 24 * 60; // Assume cross overnight
        
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        return `${h}h ${String(m).padStart(2, '0')}m`;
    } catch {
        return 'Unknown';
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const tripId = url.searchParams.get('tripId');
        const token = url.searchParams.get('token'); // Hashed PIN

        if (!tripId || !token) {
            return new Response('Missing parameters', { status: 400 });
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Fetch the trip and verify token
        const { data: trip, error: tripError } = await supabaseClient
            .from('trips')
            .select('id, name, pin')
            .eq('id', tripId)
            .single();

        if (tripError || !trip) {
            return new Response('Trip not found', { status: 404 });
        }

        const expectedHash = await hashPin(trip.pin);
        if (token !== expectedHash && token !== trip.pin) { // Fallback allow raw pin just in case
            return new Response('Unauthorized', { status: 401 });
        }

        // 2. Fetch Flights
        const { data: flights, error: flightError } = await supabaseClient
            .from('flights')
            .select('*')
            .eq('trip_id', tripId)
            .order('date');

        if (flightError) {
            throw flightError;
        }

        // 3. Generate ICS Content (strictly enforcing \r\n line endings)
        const icsLines: string[] = [];
        icsLines.push(
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//PPC Trip Tracker//Calendar Feed//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            `X-WR-CALNAME:${escapeIcsText(trip.name)} Flights`,
            'X-WR-TIMEZONE:UTC',
            'X-PUBLISHED-TTL:PT1H',
            'REFRESH-INTERVAL;VALUE=DURATION:PT1H'
        );

        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        if (flights && flights.length > 0) {
            flights.forEach(f => {
                if (!f.date) return; // Skip if no date

                const uid = `${f.id}@ppc-trip-tracker.app`;
                const startStr = formatIcsDate(f.date, f.departure?.time);
                
                let endStr = startStr;
                if (f.duration) {
                     // Add duration to start to safely calculate cross-day arrivals
                     endStr = calculateEndTime(f.date, f.departure?.time, f.duration);
                } else if (f.arrival?.time) {
                     // Fallback string parsing for legacy entries without duration
                     endStr = formatIcsDate(f.date, f.arrival?.time);
                }

                const fromCity = f.departure?.city ? ` (${f.departure.city})` : '';
                const toCity = f.arrival?.city ? ` (${f.arrival.city})` : '';
                const fromTerm = f.departure?.terminal ? ` - Terminal ${f.departure.terminal}` : '';
                const toTerm = f.arrival?.terminal ? ` - Terminal ${f.arrival.terminal}` : '';

                const finalDuration = f.duration || guessDuration(f.departure?.time, f.arrival?.time);

                // Summary looks like: "[JFK ✈️ LAX] Delta DL100 (Yang)"
                const summaryRaw = `[${f.departure?.code || '?'} ✈️ ${f.arrival?.code || '?'}] ${f.airline || ''} ${f.flight_number || ''} (${f.added_by || 'Unknown'})`.replace(/\s+/g, ' ').trim();
                const locationRaw = `${f.departure?.code || '?'}${fromTerm} to ${f.arrival?.code || '?'}${toTerm}`;
                const descriptionRaw = `✈️ FLIGHT INFO\n• Airline: ${f.airline || 'Unknown'}\n• Flight: ${f.flight_number || 'Unknown'}\n• Status: ${f.status || 'unknown'}\n• Duration: ${finalDuration}\n\n📍 ROUTE\n• From: ${f.departure?.code || '?'}${fromCity}${fromTerm}\n• To: ${f.arrival?.code || '?'}${toCity}${toTerm}\n\n👤 Added by: ${f.added_by || 'Unknown'}`;

                icsLines.push(
                    'BEGIN:VEVENT',
                    `DTSTAMP:${now}`,
                    `UID:${uid}`
                );

                // Handle formatting of all-day vs timed events
                if (startStr.includes('T')) {
                    icsLines.push(`DTSTART:${startStr}`);
                    if (endStr.includes('T')) {
                        icsLines.push(`DTEND:${endStr}`);
                    } else {
                        icsLines.push(`DTEND:${startStr}`);
                    }
                } else {
                    icsLines.push(`DTSTART;VALUE=DATE:${startStr}`);
                }

                icsLines.push(
                    `SUMMARY:${escapeIcsText(summaryRaw)}`,
                    `LOCATION:${escapeIcsText(locationRaw)}`,
                    `DESCRIPTION:${escapeIcsText(descriptionRaw)}`,
                    'END:VEVENT'
                );
            });
        }

        icsLines.push('END:VCALENDAR');
        
        // Final string assembly guaranteeing exact RFC standard CRLF and folded lines
        const ics = icsLines.map(foldLine).join('\r\n') + '\r\n';

        return new Response(ics, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="trip-${tripId}-flights.ics"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            },
        });
    } catch (error) {
        console.error('ICS Export Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
