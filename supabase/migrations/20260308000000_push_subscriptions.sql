-- Create push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    subscription_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user only has one active subscription per trip
    UNIQUE(trip_id, participant_name)
);

-- Enable RLS but allow open access just like the other tables
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on push_subscriptions" 
ON push_subscriptions FOR ALL 
USING (true);
