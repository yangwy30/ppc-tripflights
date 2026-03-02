-- ============================================
-- PPC Trip Tracker — Supabase Schema
--
-- Run this in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================

-- 1. Trips table
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    pin TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_pin ON trips (pin);

-- 2. Participants table
CREATE TABLE IF NOT EXISTS participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, name)
);

CREATE INDEX IF NOT EXISTS idx_participants_trip ON participants (trip_id);

-- 3. Flights table
CREATE TABLE IF NOT EXISTS flights (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    flight_number TEXT NOT NULL,
    airline TEXT DEFAULT '',
    departure JSONB DEFAULT '{}',
    arrival JSONB DEFAULT '{}',
    date TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    status TEXT DEFAULT 'scheduled',
    aircraft TEXT DEFAULT '',
    gate TEXT DEFAULT '',
    added_by TEXT DEFAULT '',
    added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flights_trip ON flights (trip_id);

-- 4. Notes table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_trip ON notes (trip_id);

-- ============================================
-- Row Level Security (RLS)
--
-- Using anon key with open policies since
-- auth is PIN-based, not user-account-based.
-- ============================================

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Allow all operations via anon key
CREATE POLICY "Allow all on trips" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on participants" ON participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on flights" ON flights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notes" ON notes FOR ALL USING (true) WITH CHECK (true);
