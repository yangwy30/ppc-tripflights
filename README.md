<h1 align="center">PPC Trip Tracker ✈️</h1>

<p align="center">
  A collaborative, real-time Progressive Web App (PWA) for syncing group travel plans, tracking flights, and receiving delay alerts.
</p>

---

## 📸 App Demo

<p align="center">
  <img src="./docs/demo.webp" alt="App Demo" width="350" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);"/>
</p>

*(A walkthrough of creating a trip, picking a flight via AeroDataBox, and sharing it to the dashboard)*

---

## ✨ Features

- **Multi-User Sync**: Powered by a Supabase PostgreSQL backend, data instantly syncs across devices for all travelers in the group.
- **Auto Flight Lookup**: Just type a flight number (e.g. `AA100`). The app queries the AeroDataBox API to auto-fill airline, airports, times, and durations.
- **Live Status & Alerts**: The app polls the API every 15 minutes. It will gracefully notify the group via browser notifications if a flight is delayed or cancelled.
- **PIN-Based Sharing**: Trips are secured by a short, auto-generated PIN (e.g. `1492`). Share the pinned link via Whatsapp or SMS, and friends can instantly join.
- **Shared Notes**: Keep a collaborative scratchpad of hotel bookings, meetup spots, and rental car info right next to the flight statuses.
- **PWA Ready**: Install the app directly to your iOS or Android home screen for a native-like app experience.
- **Interactive Timeline**: Visualizes overlapping flights beautifully, so everyone knows exactly when everyone else is landing.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript + HTML5. Modern, dependency-free UI architecture built entirely from scratch.
- **Styling**: Hand-crafted CSS using CSS Variables, modern flexbox/grid layouts, and sleek micro-animations. Glassmorphism UI with vibrant dynamic colors.
- **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL + REST API)
- **Flight Data**: [AeroDataBox API](https://aerodatabox.com/) via RapidAPI.
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Hosting**: [Vercel](https://vercel.com/)

---

## 🚀 Local Development

### Prerequisites
- Node.js (v20+)
- A [Supabase](https://supabase.com) Account
- A [RapidAPI](https://rapidapi.com/) Account (for AeroDataBox)

### 1. Database Setup
Create an empty Supabase project. In the **SQL Editor**, run the contents of `supabase_schema.sql` to generate the required tables (`trips`, `participants`, `flights`, `notes`) and their Row Level Security (RLS) policies.

### 2. Environment Variables
Clone the repository and copy the environment template:
```bash
cp .env.example .env
```
Fill in `.env` with your actual keys:
```env
# Supabase (Project Settings -> API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key_here

# RapidAPI (AeroDataBox)
VITE_RAPIDAPI_KEY=your_rapidapi_key_here
```

### 3. Run the App
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:5173`. Make edits to the `src/` folder — Vite will hot-reload your changes instantly!

---

## 🚢 Deployment

This application is configured for standard, zero-config deployment to Vercel. 

1. **Push your code to GitHub.**
2. **Import the repository into Vercel**. Vercel will auto-detect Vite.
3. Add the exact same **Environment Variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAPIDAPI_KEY`) to the Vercel project settings.
4. Deploy! Any subsequent push to the `main` branch will seamlessly trigger a new build.

---

## 📝 License

This project is licensed under the MIT License. Feel free to use, modify, and distribute as you see fit.
