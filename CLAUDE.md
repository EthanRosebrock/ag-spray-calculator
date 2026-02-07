# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

**Backend (Express server on port 5000):**
```bash
npm start           # production
npm run dev         # development with nodemon auto-reload
```

**Frontend (React on port 3000, proxies API to :5000):**
```bash
cd client && npm start      # dev server
cd client && npm run build  # production build
cd client && npm test       # Jest tests (interactive watch mode)
```

**TypeScript checking:**
```bash
cd client && npx tsc --noEmit
```

**Deployment (Render.com):**
```bash
npm run render-build  # npm install && cd client && npm install && npm run build
```

There is no linter configured beyond what CRA provides (eslint via react-scripts). No Prettier config.

## Architecture

### Backend (`server.js`)
Single Express 5 server — no database, no auth. All user data lives in browser localStorage (with optional Supabase cloud sync). Endpoints:

- `GET /api/weather/location?lat=&lon=` — 4-tier fallback: Weather Underground PWS → NWS API → Open-Meteo → mock data. WU API key is in `.env`.
- `GET /api/weather/stations?lat=&lon=&radius=` — nearby weather stations.
- `GET /api/geocode?address=` — 2-tier fallback: US Census Geocoder → Nominatim/OSM. Returns `{ latitude, longitude, city, state, county, formattedAddress }`. Errors: 400 (no address), 404 (no results), 502 (services down).
- `GET /api/products` — hardcoded default products.

### Frontend (`client/src/`)
React 19 + TypeScript SPA using tab-based navigation via state in `App.tsx` (no React Router, though it's installed). Six tabs: Calculator, Weather, Records, Fields, Map, Settings.

**Data flow:** Components → Custom hooks (`useCalculator`, `useLoadSplitter`, `useWeather`) → `storageService.ts` (localStorage/Supabase) + `weatherService.ts` (API calls to backend). No global state library.

**Proxy:** `client/package.json` has `"proxy": "http://localhost:5000"` so all `/api/*` calls from the dev server route to the backend.

### Custom Hooks

- **`useCalculator`** — manages tankSize, carrierRate, acres, and selectedProducts. Persists defaults to localStorage. Auto-recalculates product `totalAmount` via `convertRateToAmount()` when acres or carrier rate change.
- **`useLoadSplitter`** — splits total volume across loads. Supports `even` or `custom` split mode. In custom mode, loads the user has adjusted become "locked" and won't move when other loads are changed — only unlocked loads receive redistributed volume. `lockedLoads` (Set<number>) tracks this; locks clear on mode switch or load count change.
- **`useWeather`** — auto-detects location (GPS → stored farm location), fetches weather, runs drift assessment. Auto-refreshes every 5 minutes. Exposes `isGo` boolean (true if recommendation is optimal or acceptable).

### Key Domain Concepts

**Rate basis:** Products use either `per_acre` or `per_100_gal` dosing. `convertRateToAmount()` in `loadCalculations.ts` handles both, using measurement unit conversion factors from `unitConstants.ts`. Legacy unit strings (e.g., `oz/acre`) are parsed by `parseLegacyUnit()`.

**Drift assessment:** `weatherService.ts` contains a multi-factor scoring system (wind, gusts, temperature, humidity, inversion) that produces a numeric risk score mapped to low/moderate/high/extreme. Spray recommendations (optimal/acceptable/caution/avoid) use threshold-based rules with hard limits (e.g., wind >15 mph = avoid). `LocationWeatherService` has a stricter scoring variant that also considers time-of-day and pressure.

**Microclimate adjustments:** Fields can have microclimate tags (sheltered/exposed/valley/hilltop) that multiply wind and humidity values before drift scoring. Applied in `LocationWeatherService.adjustForMicroclimate()`.

**Container optimization:** `containerCalculations.ts` uses a greedy largest-first algorithm to break total product amounts into physical containers (jugs, drums, totes, bags). Products can specify `preferredContainers` (array of container IDs) to limit which containers are used. The Container Breakdown section shows both total breakdowns and per-load breakdowns when multiple loads exist.

**Load splitting:** `redistributeLoadVolumes()` in `loadCalculations.ts` accepts a `lockedIndices: Set<number>` parameter. Locked loads keep their volume fixed; remaining volume is proportionally distributed among unlocked loads only. The slider UI includes snap-to-full (95% threshold snaps to tankSize), a Fill button, and editable numeric inputs.

**Field selection & partial spraying:** Calculator and RecordModal use `FieldSelection[]` (fieldId, sprayedAcres, subFieldId?) to track selected fields with partial acre overrides. Fields are sorted by `fieldNumber` and displayed with inline acre inputs showing `[sprayed] / [total] ac`. The `SprayedField` interface stores per-field breakdown in spray records. Legacy `fieldId`/`fieldIds` arrays are still supported for backward compatibility.

**Sub-fields:** Fields can have `subFields: SubField[]` for dividing a field into crop-specific sections per year. Each SubField has `id`, `name`, `acres`, `crop`, and `cropYear`. In field selection lists, sub-fields appear indented under their parent with ↳ prefix. Sub-fields are filtered by the current crop year from `useCropYear()` context.

**Crop year governance:** Global crop year selector in App header (current year ±1). `useCropYear()` hook provides `cropYear` and `setCropYear`. Stored in localStorage as `agrispray_crop_year`. Records page filters by crop year with "show all years" toggle. Legacy records use year extracted from `date` field.

### Storage & Sync

**localStorage:** All keys prefixed `agrispray_` (except legacy `farmLocation` and `fieldLocations`). Key entities: `products`, `containers`, `fields`, `records`, `routes`, `pins`, `calculator_defaults`, `tank_presets`, `carrier_presets`, `crop_year`. Storage has a version migration system (currently v2) that runs on module load in `storageService.ts`. The v1→v2 migration converts legacy unit strings to structured `measurementUnit` + `rateBasis` pairs.

**Supabase cloud sync (optional):** Configured via `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` environment variables. When configured, `supabaseClient.ts` provides cloud persistence for products, fields, settings, spray records, tender routes, and saved pins. Falls back to localStorage-only if Supabase is unavailable. A one-time `migrateLocalStorageToSupabase()` runs on app init (converts camelCase → snake_case for DB). App shows a dismissable warning banner if Supabase health check fails on startup.

**Data preservation:** `getFields()` merges Supabase data with localStorage to preserve `subFields` if Supabase lacks the `sub_fields` column, and includes local-only fields not yet synced. This prevents data loss during redeployment or schema migration gaps.

### Styling
Tailwind CSS with a custom `ag-green` color palette (50–700 shades) defined in `tailwind.config.js`. Four reusable component classes in `index.css`: `.btn-primary`, `.btn-secondary`, `.input-field`, `.card`.

### Map Tab
Uses Leaflet + react-leaflet with free Esri World Imagery satellite tiles (no API key). Field boundaries are stored as `[lat, lng][]` arrays. Tender routes use pin-to-pin waypoints with Haversine distance calculations. Draw controls use native Leaflet APIs (not leaflet-draw plugin controls). `PinManager` handles saved map pins with color coding and a home location concept.

### Import/Export
`importService.ts` handles CSV, Excel (via `xlsx` library), and GeoJSON file parsing for field import. GeoJSON coordinates are `[lng, lat]` (GeoJSON spec) and get converted to `[lat, lng]` (Leaflet convention) on import. Polygon area uses the Shoelace formula with latitude-scaled coordinates. `boundaryMatcher.ts` provides priority-based fuzzy matching to link imported GeoJSON features to existing fields by name, field number, or normalized string similarity.

### Deployment
Hosted on Render.com via `render.yaml`. Environment variables: `WU_API_KEY` (secret, for Weather Underground), `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`. No `.env.example` — env vars are configured in the Render dashboard or `render.yaml`.
