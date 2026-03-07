import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"
import * as jwt from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pin } = await req.json()
    if (!pin) {
      return new Response(JSON.stringify({ error: 'PIN is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Initialize Supabase admin client to bypass RLS and find the trip
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // Supabase automatically injects SUPABASE_ANON_KEY, but for Edge Functions accessing the DB directly,
    // we use the injected SUPABASE_SERVICE_ROLE_KEY (if configured), or we can use the anon key.
    // However, since we MUST bypass RLS to lookup a PIN when the user isn't authenticated yet,
    // we need the service_role key. 
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    // The JWT Secret is also injected by Supabase automatically in production
    const jwtSecret = Deno.env.get('CUSTOM_JWT_SECRET') ?? ''

    if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
      console.error("Missing ENV configuration:", { url: !!supabaseUrl, key: !!supabaseServiceKey, secret: !!jwtSecret });
      throw new Error("Missing environment variables configuration")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Lookup trip by PIN
    const { data: trip, error } = await supabase
      .from('trips')
      .select('id')
      .eq('pin', pin)
      .single()

    if (error || !trip) {
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Sign a custom JWT containing the trip_id
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const token = await jwt.create({ alg: "HS256", typ: "JWT" }, {
      role: 'authenticated', // Required for Supabase to accept the token
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days expiration
      trip_id: trip.id // Our custom claim
    }, key)

    return new Response(
      JSON.stringify({ token, trip_id: trip.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
