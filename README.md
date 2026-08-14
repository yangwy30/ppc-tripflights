<div align="center">
  <img src="public/icons/icon-192.png" width="72" alt="PPC app icon" />
  <h1>PPC: Delay No More</h1>
  <p>A shared flight dashboard for getting the whole group to the same place—without the spreadsheet chaos.</p>
  <p><a href="https://ppc-tripflights.vercel.app/">Open the live app</a></p>
</div>

![PPC flight board with route map and arrival timeline](docs/dashboard-flight-board.jpg)

## Core features

- **Shared flight board** — keep every traveler's flight, status, time, gate, and terminal in one trip.
- **Route map & arrival timeline** — see where everyone is coming from and when they land.
- **Inbound / outbound views** — switch direction without losing the context for each traveler.
- **Coordination engine** — surface missing bookings and the group details that still need attention.
- **Live calendar subscription** — subscribe from Apple Calendar, Google Calendar, or Outlook and receive updated flight information.
- **Simple trip sharing** — invite the group with a six-digit PIN; no account setup required.

## Mobile friendly

The dashboard is designed for quick checks while traveling, with compact timelines and expandable traveler details.

<p align="center">
  <img src="docs/mobile-arrival-timeline.jpg" width="390" alt="PPC mobile arrival timeline and traveler details" />
</p>

## Run locally

```bash
git clone https://github.com/yangwy30/ppc-tripflights.git
cd ppc-tripflights
npm install
cp .env.example .env
npm run dev
```

Built with Vite, Supabase, React, and a lightweight PWA shell.
