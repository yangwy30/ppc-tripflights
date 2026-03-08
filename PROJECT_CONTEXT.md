# PPC: Delay No More - Project Context

This document serves as the core source of truth for the **PPC: Delay No More** (formerly TripFlights) architecture, technology stack, and business logic. It helps maintain context across development sessions.

## 1. Project Overview
PPC: Delay No More is a collaborative, real-time Progressive Web App (PWA) designed for syncing group travel plans, tracking flights, and receiving delay alerts. It allows multiple users to join a shared trip via a PIN and see a unified interactive timeline of everyone's flights.

## 2. Technology Stack
- **Frontend Core**: Vanilla JavaScript (ES modules) and HTML5. No heavy UI frameworks (React/Vue/etc.) are used. 
- **Styling**: Hand-crafted vanilla CSS using CSS Variables, Flexbox/Grid, and micro-animations. Glassmorphism aesthetic.
- **Build Tool**: Vite (with `vite-plugin-pwa` for progressive web app features).
- **Backend / Database**: Supabase (PostgreSQL + Auto-generated REST API).
- **Third-Party APIs**: AeroDataBox (via RapidAPI) for fetching live flight schedules, delays, and aircraft information.
- **Hosting**: Vercel (zero-config Vite deployment).

## 3. Core Architecture & Data Model
The backend relies on Supabase PostgreSQL with the following core entities:

- **`trips`**: Represents a shared travel workspace. Identified by an `id` and secured/shared via a short, textual `pin`.
- **`participants`**: Users who have joined a trip. A participant is unique by `(trip_id, name)` and has a designated color.
- **`flights`**: Shared flight segments attached to a trip. Includes details fetched from AeroDataBox (departure, arrival, duration, status, gate).
- **`notes`**: A shared scratchpad / text storage associated with a trip for collaborative trip planning.

### Security / Auth Model
The app does **not** use traditional account-based user authentication (no email/password logins). Instead, authorization is entirely "PIN-based":
- Row Level Security (RLS) on Supabase tables is set to `true` but with open policies (`USING (true)`).
- Anyone with the trip `pin` can fetch or modify the trip's data via the frontend client.

## 4. Key Features & Business Logic
1. **Multi-User Sync**: Data is synced instantly to all connected users inside a trip view via Supabase real-time updates.
2. **Auto Flight Lookup**: When a user inputs a flight number (e.g., `AA100`), the frontend requests data from the AeroDataBox API to auto-fill airline and terminal/gate details.
3. **Timeline Visualization**: An interactive UI element that plots overlapping flights chronologically to see who is arriving when.
4. **Live Status & Alerting**: The app polls the AeroDataBox API periodically (every 15 minutes) for active flights. If it detects a delay or cancellation, it dispatches browser notifications to the user.
5. **PWA Capable**: Configured to be installed on mobile (iOS/Android) and desktop homescreens (manifest/service worker enabled via Vite PWA plugin).

## 5. Development Guidelines
- Always prioritize vanilla JS and CSS over adding third-party dependencies. 
- Maintain the "Glassmorphism" design aesthetic, ensuring smooth CSS animations and modern layouts.
- Environment variables required for local run: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_RAPIDAPI_KEY`.
