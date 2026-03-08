// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BIoqfy-ZvbxwKNHdnVWBKrQXQBF7I5AISuYlrQqAaj952KpkpKBP51NSajOVS3AHKMFP824NB5JybtLW1noQK3E";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "s2tufkW7E1a5SUP-fCYKKN0e9RZ8uSJrHlCL1O82HhI";
const VAPID_SUBJECT = "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

async function fetchFlightStatus(flightNumber: string) {
    if (!flightNumber || !RAPIDAPI_KEY) return null;

    // For demo/edge function limits, we'll implement a simple fetch wrapper. 
    // In a production app you'd add exponential backoff here.
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
            }
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (!data || data.length === 0) return null;

        let targetFlight = data[0];

        const status = (targetFlight.status || '').toLowerCase();
        if (status === 'expected' || status === 'scheduled') return 'scheduled';
        if (status === 'delayed') return 'delayed';
        if (status === 'canceled' || status === 'cancelled') return 'cancelled';
        if (status === 'arrived') return 'landed';
        return status;
    } catch (e) {
        console.error("Error fetching", flightNumber, e);
        return null;
    }
}

async function handleCron() {
    console.log("flight-monitor: Waking up to check flights...");

    // 1. Get all active active push subscriptions
    const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("trip_id, participant_name, subscription_json");

    if (subsError || !subs || subs.length === 0) {
        return new Response("No subscribers.", { status: 200 });
    }

    // 2. Get unique trips we need to monitor
    const uniqueTripIds = [...new Set(subs.map(s => s.trip_id))];

    // 3. Check flights for each trip
    for (const tripId of uniqueTripIds) {
        const { data: flights, error } = await supabase
            .from("flights")
            .select("*")
            .eq("trip_id", tripId);

        if (error || !flights) continue;

        for (const flight of flights) {
            // Only check flights that are scheduled or delayed
            if (flight.status === 'landed' || flight.status === 'cancelled') continue;

            const newStatus = await fetchFlightStatus(flight.flight_number);

            if (newStatus && newStatus !== flight.status) {
                console.log(`Flight ${flight.flight_number} changed from ${flight.status} to ${newStatus}`);

                // Update DB
                await supabase
                    .from("flights")
                    .update({ status: newStatus })
                    .eq("id", flight.id);

                // If delayed or cancelled, notify subscribers in this trip
                if (newStatus === 'delayed' || newStatus === 'cancelled' || newStatus === 'landed') {
                    const tripSubs = subs.filter(s => s.trip_id === tripId);

                    let title = `✈️ Flight Update: ${flight.flight_number}`;
                    if (newStatus === 'delayed') title = `⚠️ Delayed: ${flight.flight_number}`;
                    if (newStatus === 'cancelled') title = `❌ Cancelled: ${flight.flight_number}`;
                    if (newStatus === 'landed') title = `🛬 Landed: ${flight.flight_number}`;

                    const payload = JSON.stringify({
                        title,
                        body: `${flight.departure?.code || '?'} to ${flight.arrival?.code || '?'} (${flight.added_by || ''}) update. `,
                        tag: `flight-${flight.id}`
                    });

                    for (const sub of tripSubs) {
                        try {
                            await webpush.sendNotification(sub.subscription_json, payload);
                            console.log("Push sent to", sub.participant_name);
                        } catch (err) {
                            console.error("Failed push to", sub.participant_name, err);
                            // Optionally delete expired subscriptions here
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await supabase.from('push_subscriptions').delete().eq('subscription_json->>endpoint', sub.subscription_json.endpoint);
                            }
                        }
                    }
                }
            }
        }
    }
    return new Response("Done.", { status: 200 });
}

serve(async (req) => {
    // Basic auth check using auth header could be added here if not using Supabase pg_cron
    try {
        return await handleCron();
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
});
