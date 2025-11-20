# RouteDash Mobile (Milestone 1)

RouteDash is a travel-aware pickup planner that pairs food orders with your current drive. Milestone 1 focuses on the core mobile experience: signing in, plotting a route, viewing a live map with directions, and simulating the trip progress.

## Features delivered
- **Full authentication** – register/login customers and restaurants backed by the Express API (JWT cookies).
- **Route planner** – capture origin/destination via Google Directions, adjust a "ready to eat" slider, and preview a live map.
- **Registered restaurants only** – recommendations and browse views surface the real restaurants from the backend (no dummy data).
- **Menu + checkout** – pull live menus, build a cart, and create an order record that drives the order-status screen.
- **Merchant dashboard** – restaurant users can add sections/items, toggle availability, and see changes reflected instantly for travelers.
- **Gas/EV Stop Integration** – find and add gas stations or EV charging stations along your route. Select vehicle type (Gas/EV) in your profile, adjust refueling time independently from mealtime, and add stations as waypoints to your route.
- **Route management** – add restaurants and gas/EV stations as stops, view complete route overview, and export to Google Maps with all waypoints in order.
- **Traveler Filters** – filter restaurants by fast service, dietary needs, local favorites, and price range.

## Getting started

1. Install dependencies:
   ```bash
   cd routedash
   npm install
   ```
2. Create an `.env` based on `.env.example` and provide both the Google Maps key and your API URL (defaults to `http://localhost:4000`):
   ```bash
   cp .env.example .env
   # edit .env and add GOOGLE_MAPS_API_KEY=your_key_here
   ```
3. Run the Expo development server:
   ```bash
   npm start
   ```
   Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with the Expo Go app.

### Emulator setup tips
- For iOS, use Xcode's Simulator (iOS 17+ recommended).
- For Android, ensure an emulator with Google Play services is running so Google Maps renders correctly.

### Google Maps configuration
- iOS: Expo reads `GOOGLE_MAPS_API_KEY` from the env file and injects it into the native build config (enable **Maps SDK for iOS** in Google Cloud).
- Android: the same key is mapped via `app.config.ts` for the Google Maps SDK (enable **Maps SDK for Android**).
- Web: when running `npm run web`, the key is used for the Routes REST call.

**Required APIs in Google Cloud Console:**
- **Routes API** – for directions and route calculation
- **Places API (Legacy)** – for autocomplete and nearby search (gas/EV stations)
- **Places API (New)** – optional, for fuel pricing information at gas stations

### API connection
- `API_URL` should point to the Express server (defaults to `http://localhost:4000`). For iOS Simulator, `http://127.0.0.1:4000` also works. For Android Emulator, set `API_URL=http://10.0.2.2:4000`.
- Ensure the server is running before launching the app so auth/menu/order calls succeed.

## Gas/EV Station Features

### Vehicle Type Selection
- Users can set their vehicle type (Gas or EV) in their profile
- Vehicle type is saved and persists across sessions
- If not set, users are prompted to select when planning a route

### Finding Stations
- Gas stations and EV charging stations are found along your route based on a configurable refueling time
- Separate slider controls refueling time independently from mealtime
- Filter to show restaurants only, stations only, or both

### Adding Stops to Route
- Tap any gas station or restaurant to add it as a waypoint
- Route automatically recalculates with the new stop
- All stops appear in the "Route stops" section with type indicators
- Remove stops individually or clear the entire route

### Route Overview
- Visual route sequence showing: Start → Stops → Destination
- Color-coded icons for each stop type
- Route summary with total duration and distance

### Google Maps Export
- "Open in Maps" button exports the complete route to Google Maps
- Includes origin, all waypoints in order, and destination
- Opens directly in the Google Maps app with turn-by-turn directions

## Next steps
- Plug in live user location via `expo-location` to anchor simulation to GPS.
- Enhance the recommendation rules (e.g., dietary filters, multiple time windows, richer place details).
- Layer in secure authentication (Cognito, Auth0, etc.) instead of the demo credentials.
- **API service** – Express/TypeScript server scaffold under `server/` with health check and tooling (tsconfig, ESLint, Vitest). Copy `.env.example` to `.env`, set a strong `JWT_SECRET` (and database URL when ready), run `npm install`, then `npm run dev` inside `server/` to start the API at `http://localhost:4000`.
