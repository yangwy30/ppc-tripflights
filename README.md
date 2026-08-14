<div align="center">
  <img src="public/icons/icon-192.png" width="76" alt="PPC app icon" />
  <h1>PPC: Delay No More</h1>
  <p><strong>One trip. Every traveler. Every flight—finally in sync.</strong></p>
  <p>A shared flight command center for groups arriving from different cities.</p>

  <a href="https://ppc-tripflights.vercel.app/">
    <img src="https://img.shields.io/badge/OPEN_LIVE_APP-D7FF3F?style=for-the-badge&logo=vercel&logoColor=050609&labelColor=D7FF3F" alt="Open the live PPC app" />
  </a>

  <br /><br />

  <img src="https://img.shields.io/badge/PWA-installable-38BDF8?style=flat-square&labelColor=111318" alt="Installable PWA" />
  <img src="https://img.shields.io/badge/live-flight_tracking-10B981?style=flat-square&labelColor=111318" alt="Live flight tracking" />
  <img src="https://img.shields.io/badge/group_coordination-built_in-A855F7?style=flat-square&labelColor=111318" alt="Group coordination" />
</div>

<br />

![Colorful flight routes converging on one destination](docs/readme-hero.png)

## See the trip move

![Animated walkthrough of the live flight board, inbound view, invite flow, and coordination engine](docs/readme-demo.webp)

<p align="center"><sub>Real product UI from the live app—no mock screens.</sub></p>

## The whole trip, at a glance

PPC replaces scattered confirmations, spreadsheets, and group-chat check-ins with one live view of the journey. See who is flying, where everyone is, when they land, and who still needs a plan.

![Desktop flight dashboard showing trip readiness, traveler filters, direction tabs, and the shared route map](docs/readme-dashboard.jpg)

<table>
  <tr>
    <td width="50%"><strong>✈️ Shared flight board</strong><br />Every traveler's outbound and inbound flights in one place.</td>
    <td width="50%"><strong>🗺️ Live route map</strong><br />Animated routes, grouped origins, and traveler names at every airport.</td>
  </tr>
  <tr>
    <td width="50%"><strong>⏱️ Arrival intelligence</strong><br />Landing order, arrival spread, flight status, gates, and terminals.</td>
    <td width="50%"><strong>🧠 Coordination engine</strong><br />Find options for travelers who have not booked yet.</td>
  </tr>
</table>

## Made for the moments that matter

The mobile experience keeps the important information close: overall trip readiness before departure, then routes and arrival order while everyone is in motion.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/readme-mobile-dashboard.jpg" width="390" alt="Mobile trip overview with crew, trip metrics, and flight filters" />
    </td>
    <td width="50%" align="center">
      <img src="docs/readme-mobile-timeline.jpg" width="390" alt="Mobile route map and arrival timeline" />
    </td>
  </tr>
  <tr>
    <td align="center"><sub>Know whether the group is ready.</sub></td>
    <td align="center"><sub>Know exactly who lands next.</sub></td>
  </tr>
</table>

## Coordination without the group-chat math

Pick a traveler, confirm their origin, and compare coordinated round-trip options against the group's arrival pattern. A matching itinerary can be added directly to the shared trip.

![Coordination engine showing traveler setup and coordinated flight recommendations](docs/readme-coordination.jpg)

## One simple flow

1. **Create a trip** and set the destination and dates.
2. **Invite the crew** with one private link or six-digit PIN.
3. **Add flights** through guided lookup or manual entry.
4. **Stay coordinated** through the map, arrival timeline, traveler details, and smart status updates.

## Quietly powerful

- **Smart refresh:** flight statuses update automatically around the active trip window and stop after the trip ends.
- **Live calendar subscription:** subscribe through Apple Calendar, Google Calendar, or Outlook and receive updated flight details as the feed refreshes.
- **Traveler-level details:** every flight keeps its traveler, route, local times, status, gate, and arrival terminal together.
- **Shared trip notes:** keep hotels, meetup points, and ground-transport details beside the itinerary.
- **Installable PWA:** use PPC like an app on mobile or desktop.

## Run locally

```bash
git clone https://github.com/yangwy30/ppc-tripflights.git
cd ppc-tripflights
npm install
cp .env.example .env
npm run dev
```

Add your Supabase project values to `.env`. The optional live-flight credential is documented in `.env.example`.

<div align="center">
  <sub>Vite · Supabase · React Simple Maps · Progressive Web App</sub>
</div>
