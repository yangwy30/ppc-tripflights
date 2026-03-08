#!/bin/bash
# test-push.sh
# Mocks the flight-monitor edge function

echo "✈️  Starting Web Push Alert Simulation..."
echo ""

# We'll hit the deployed Edge Function directly which forces it to wake up
# out-of-band of its normal 15 minute pg_cron schedule.
curl -X POST "https://zgqjctiuycrhwrstorxw.supabase.co/functions/v1/flight-monitor" \
  -H "Authorization: Bearer sb_publishable_LiQUs7AVqdnawp6nhPILMA_qWZyTRiE"

echo ""
echo "✅ Finished running edge function check."
echo "If any flights in your database changed to 'delayed' or 'cancelled', your Service Worker should be displaying a notification right now!"
