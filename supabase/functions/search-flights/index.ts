import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const origin = url.searchParams.get('origin')
        const destination = url.searchParams.get('destination')
        const date = url.searchParams.get('date')

        if (!origin || !destination || !date) {
            return new Response(JSON.stringify({ error: 'origin, destination, and date are required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // SerpAPI key stored as an Edge Function secret
        const serpApiKey = Deno.env.get('SERPAPI_KEY')
        if (!serpApiKey) {
            return new Response(JSON.stringify({ error: 'SERPAPI_KEY not configured' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            })
        }

        const params = new URLSearchParams({
            engine: 'google_flights',
            departure_id: origin,
            arrival_id: destination,
            outbound_date: date,
            type: '2',           // One way
            currency: 'USD',
            hl: 'en',
            gl: 'us',
            show_hidden: 'true', // Include hidden flight results
            deep_search: 'true', // Match browser results exactly
            api_key: serpApiKey,
        })

        console.log(`[search-flights] Calling SerpAPI: ${origin} → ${destination} on ${date}`)

        const serpResponse = await fetch(`https://serpapi.com/search.json?${params}`)

        if (!serpResponse.ok) {
            const errText = await serpResponse.text()
            console.error(`[search-flights] SerpAPI error (${serpResponse.status}):`, errText)
            return new Response(JSON.stringify({ error: 'SerpAPI request failed', details: errText }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: serpResponse.status,
            })
        }

        const data = await serpResponse.json()

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('[search-flights] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
