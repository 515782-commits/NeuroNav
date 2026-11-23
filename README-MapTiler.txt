NEURONAV — MAPTILER SETUP / API FIX

FIX APPLIED
- The dashboard uses Leaflet. map-config.js previously tried to create a separate
  MapLibre map, although MapLibre was not loaded and the dashboard does not use it.
- map-config.js now exposes the key as window.MAPTILER_API_KEY, which app.js reads.
- The Leaflet MapTiler tile layer now reports tile failures and falls back to CARTO.
- Geocoding, routing and weather requests now check HTTP status before parsing JSON.

SET UP YOUR KEY
1. Open map-config.js.
2. Replace the current key with your own MapTiler browser/public key if needed.
3. In MapTiler, restrict the key to the website origin/domain where NeuroNav is hosted.
4. Save and reload the app.

IMPORTANT
- Browser API keys are visible to visitors. Use a browser/public key, not a private
  server secret, and restrict allowed origins and usage limits.
- The key that was present in the uploaded project should be rotated if it was not
  intended to be shared. Add the replacement key only after rotating it.
- Do not open the project using file:// when testing geolocation. Use localhost or
  HTTPS; browser geolocation generally requires a secure context.
- Public Nominatim and OSRM demo services have usage limits and are not production
  backend APIs. For production traffic, use a compliant geocoding/routing provider
  or your own backend proxy with caching and rate limiting.

Leaflet remains the map renderer. Existing GPS markers and route overlays remain.

LOCATION ACCURACY FIX (Nov 2026)
- app.js: new fused-fix location engine, manual/landmark location no longer overwritten
  by GPS, "Use my GPS location" button, map re-centres on better fix, throttled
  reverse-geocoding, clearer permission / insecure-page messages.
- tracker.js: fixed coordinate regex so "lat, lng" input is recognised.
- phone.js: accuracy shown while waiting; desktops can share after 20s with a usable fix.
- Test via http://localhost (python -m http.server) or HTTPS, never file://.

DISCOVER NEARBY (Nov 2026)
- New "Discover Nearby" panel under Route Planner: Tourist Places / Cafes tabs, radius picker,
  distance-sorted list, map markers, and a "Go" button that fills the destination and routes.
- Data comes from OpenStreetMap via the free Overpass API (no key needed). Results depend on
  how well OSM maps your area.

ROUTE MODES - FASTEST / SAFEST / ECO (Nov 2026)
- Before this fix the three buttons only changed colour; every mode requested the same
  route. Now Get Route asks OSRM for several candidate routes (its alternatives plus up to two
  via-point detours on longer trips), scores each one and draws the best match for the selected
  mode. The other candidates stay on the map as faint dashed lines.
- Fastest: lowest travel time.
- Safest: heuristic safety score out of 100 (shown in the alert). Fewer turns / sharp turns,
  less time on narrow or crawling roads and unnamed service roads, and no needless extra
  distance score higher. It is an estimate from route data, NOT real accident statistics.
- Eco: lowest estimated fuel use (typical petrol car) from the speed on each stretch of road
  plus a small cost per turn. The alert shows litres and % saved versus the fastest route.
- Clicking a mode after a route is on screen switches instantly (no new request); if the
  destination changed or you have moved >300 m, it recalculates.
- If only one sensible route exists (short trips), all modes show it and the alert says so.
- The public OSRM demo server is rate limited; a longer trip uses up to 3 requests.
