<h1 align="center">PPC: Delay No More ✈️</h1>

<p align="center">
  A collaborative, real-time Progressive Web App (PWA) for syncing group travel plans, coordinating multi-leg itineraries, and receiving native Web Push delay alerts.
</p>

---

## 📸 App Demo

> Real data from a **Coachella 2026** group trip — 9 travelers, 12 flights, multiple airlines.

### 1. Home & Trip Overview

<p align="center">
  <img src="./docs/demo_home.png" alt="Home screen with trip list" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*Create a new trip or join an existing one via PIN. Each trip shows the date range, number of travelers, and total flights at a glance.*

### 2. Live Dashboard & Multi-Traveler Tracking

<p align="center">
  <img src="./docs/demo_dashboard.png" alt="Dashboard showing 9 travelers and flight cards" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
  &nbsp;&nbsp;
  <img src="./docs/demo_filter.png" alt="Filtering flights by a single traveler" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*The dashboard shows a shareable PIN (897952), auto-refresh alerts, and color-coded traveler chips. Filter by any traveler (e.g. Ryan) to see only their flights. Each flight card shows real-time status, direction badges (Outbound/Return), terminals, and airline info pulled from AeroDataBox.*

### 3. Outbound & Return Flight Cards

<p align="center">
  <img src="./docs/demo_flights_outbound.png" alt="Outbound flight cards — UA 353, DL 707" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
  &nbsp;&nbsp;
  <img src="./docs/demo_flights_more.png" alt="More outbound flights — B6 423, AA 117" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*All 12 flights across United, Delta, JetBlue, American, and Southwest — auto-tagged as Outbound or Return based on destination airports. Refresh any flight's status individually with the 🔄 button.*

### 4. Interactive Timeline

<p align="center">
  <img src="./docs/demo_timeline.png" alt="Color-coded timeline showing all flights" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*The scrollable, color-coded timeline visualizes how every traveler's flights overlap across the trip. Each bar represents a flight (DL 707, UA 2445, B6 423, WN 1870) mapped to its actual departure and arrival times, making it easy to see who arrives when.*

### 5. Auto-Fill Flight Lookup

<p align="center">
  <img src="./docs/demo_add_flight.png" alt="Add Flight screen with auto-lookup" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*Look up any flight by number (e.g. AA100, DL665) — the app queries the AeroDataBox API to auto-fill airline, airports, terminals, times, and duration. Select which traveler the flight is for, pick the date, and add it in seconds.*

### 6. AI Coordination Engine

<p align="center">
  <img src="./docs/demo_coordination_tab.png" alt="Coordination tab showing group status" width="360" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*The Coordination Engine analyzes everyone's home airports and finds optimal overlapping flights using SerpAPI Google Flights. The group status tracker shows who's set and who still needs to configure their origin airport.*

---

## ✨ Features Built Over 5 Phases

- **Multi-User Sync (Phase 1)**: Powered by a Supabase PostgreSQL backend, data instantly syncs across devices for all travelers in the group.
- **Auto Flight Lookup (Phase 2)**: Just type a flight number (e.g. `AA100`). The app queries the AeroDataBox API to auto-fill airline, airports, times, and durations.
- **Robust Web Push Alerts (Phase 5)**: Instead of draining your battery with client-side polling, a **Supabase Edge Function** wakes up every 15 minutes, checks RapidAPI, and dispatches native OS-level **Web Push Notifications** directly to your device's Service Worker if a flight gets delayed or cancelled.
- **AI Coordination Engine (Phase 4)**: Enter your group's destination, start date, and end date. The web app queries **SerpAPI Google Flights** to find optimal overlapping inbound and outbound legs for every participant based on their home airport, complete with pricing and duration. 
- **Live Calendar Subscription**: Generate a secure, personalized `webcal://` link for your trip. Subscribe on Apple Calendar, Google, or Outlook to get live, auto-updating flight blocks right on your daily itinerary.
- **PIN-Based Sharing & Safety**: Trips are secured by a short, auto-generated PIN (e.g. `1492`). Share the pinned link via Whatsapp or SMS, and friends can instantly join. Strict database policies allow users to securely delete their own profiles and flights if plans change without affecting others.
- **Shared Notes**: Keep a collaborative scratchpad of hotel bookings, meetup spots, and rental car info right next to the flight statuses.
- **PWA Ready**: Install the app directly to your iOS or Android home screen for a native-like app experience.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript + HTML5. Modern, dependency-free UI architecture built entirely from scratch.
- **Styling**: Hand-crafted CSS using CSS Variables, modern flexbox/grid layouts, and sleek micro-animations. Glassmorphism UI with vibrant dynamic colors.
- **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL + REST API)
- **Edge Functions**: Deno + Web Push API (`npm:web-push`)
- **APIs**: 
  - [AeroDataBox API](https://aerodatabox.com/) (Live Flight Status Tracker)
  - [SerpAPI Google Flights](https://serpapi.com/) (Flight Schedule Lookups)
- **Build Tool**: [Vite](https://vitejs.dev/) with `vite-plugin-pwa`
- **Hosting**: [Vercel](https://vercel.com/)

---

## 🚀 Local Development

### Prerequisites
- Node.js (v20+)
- A [Supabase](https://supabase.com) Account
- RapidAPI and SerpAPI Keys

### 1. Database Setup
Create an empty Supabase project. In the **SQL Editor**, run the contents of `supabase_schema.sql` (and the `supabase/migrations/` folder) to generate the tables (`trips`, `participants`, `flights`, `notes`, `push_subscriptions`) and their Row Level Security (RLS) policies.

### 2. Environment Variables
Clone the repository and copy the environment template:
```bash
cp .env.example .env
```
Fill in `.env` with your actual keys (including the VAPID keys you must generate using `npx web-push generate-vapid-keys`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key_here
VITE_RAPIDAPI_KEY=your_rapidapi_key_here
VITE_SERPAPI_KEY=your_serp_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
```

*Note: You must also run `npx supabase secrets set --env-file .env` and deploy the Edge Function to your Supabase cloud environment for notifications to work locally.*

### 3. Run the App
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:5173`. Make edits to the `src/` folder — Vite will hot-reload your changes instantly!

---

## 📝 License

This project is licensed under the MIT License. Feel free to use, modify, and distribute as you see fit.
