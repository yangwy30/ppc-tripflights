#!/bin/bash
# Copy demo screenshots from Antigravity brain to docs/
BRAIN="/Users/wangyang/.gemini/antigravity/brain/3dcc98f0-45b2-4421-9564-0f9a9090ab64"
DOCS="$(cd "$(dirname "$0")" && pwd)"

cp "$BRAIN/demo_home_1775921092958.png" "$DOCS/demo_home.png"
cp "$BRAIN/demo_dashboard_top_1775921103653.png" "$DOCS/demo_dashboard.png"
cp "$BRAIN/demo_flights_cards_1775921108094.png" "$DOCS/demo_flights_outbound.png"
cp "$BRAIN/demo_flights_return_1775921113023.png" "$DOCS/demo_flights_more.png"
cp "$BRAIN/demo_timeline_scroll_1775921215775.png" "$DOCS/demo_timeline.png"
cp "$BRAIN/demo_coordination_1775921140363.png" "$DOCS/demo_coordination_tab.png"
cp "$BRAIN/demo_add_flight_1775921274586.png" "$DOCS/demo_add_flight.png"
cp "$BRAIN/demo_filter_ryan_1775921313292.png" "$DOCS/demo_filter.png"

echo "✅ All screenshots copied to $DOCS/"
ls -la "$DOCS"/*.png
