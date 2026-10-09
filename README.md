# KuryenteWatch — The Local Energy Detective

KuryenteWatch is a local household electricity PWA. The React interface talks only to its loopback Node.js server; Express validates requests and stores application records in SQLite. No account, cloud database, AI service, or remote API is required.

## Requirements

- Node.js 20 or newer (the checked environment uses Node 24).
- npm.
- A modern browser. PWA installation and service workers are supported on `localhost`/`127.0.0.1` without HTTPS; a deployed non-local origin generally needs HTTPS.

## Install and run for development

From the project root:

```powershell
npm ci
npm run dev:all
```

Open <http://127.0.0.1:5173>. Vite serves the frontend and forwards `/api` requests to the local Express server at <http://127.0.0.1:3001>. Both processes must stay running for database-backed features.

To run either process separately:

```powershell
npm run server
npm run dev
```

## Build and run the production PWA locally

```powershell
npm ci
npm run build
npm start
```

Open <http://127.0.0.1:3001>. The Express server serves the built PWA from `dist/` and the API from `/api`. In Chrome or Edge, use the install icon in the address bar or the browser menu’s **Install KuryenteWatch** action after the app has loaded.

The Vite PWA plugin generates `dist/manifest.webmanifest`, the service worker, and its Workbox runtime during the build. The service worker precaches the frontend shell and build assets; it does not cache SQLite records or make the API available when Node is stopped.

## Local storage and privacy

- Default SQLite file: `data/kuryentewatch.db`.
- `data/`, `node_modules/`, `dist/`, and `.env` files are ignored by Git.
- Existing device telemetry, detector alerts, appliance rows, and settings are preserved. Schema updates are additive; the legacy appliance columns are retained and mapped to the current API.
- To use a different database file, set `KURYENTE_DB` before starting the server:

```powershell
$env:KURYENTE_DB = 'C:\path\to\private-data\kuryentewatch.db'
npm start
```

On first launch, create a local profile and household. This is not an online account. Reset setup in Settings removes only those two names; readings, appliances, settings, and alerts remain. The API’s full data reset requires the explicit confirmation string `DELETE ALL LOCAL DATA`.

## Local API

The server binds to `127.0.0.1` only. JSON is served from `/api`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verify server and SQLite readiness |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/profile` | Read/create/update/reset the local profile and household |
| `GET`, `POST` | `/api/readings` | List or create cumulative household kWh meter readings |
| `GET`, `POST` | `/api/appliances` | List or create appliance estimates |
| `PUT`, `DELETE` | `/api/appliances/:id` | Update or delete an appliance |
| `GET`, `PATCH` | `/api/alerts`, `/api/alerts/:id` | List, read, and dismiss local detector alerts |
| `GET`, `PUT` | `/api/settings` | Read and update rate and display settings |

Legacy local detector routes remain available: `/api/devices`, `/api/devices/:name/readings`, `/api/devices/:name/train`, `/api/devices/:name/scan`, and `/api/devices/:name/baseline`. Device power telemetry remains separate from cumulative household meter readings.

## Tests and offline check

Run the existing detector/API tests and the local application API tests:

```powershell
npm test
npm run build
```

For an offline check, first run the production build and local server, open the app once, and confirm the service worker is activated in the browser’s Application/Storage panel. Then disconnect internet access while leaving `npm start` running, reload, and verify that the app can still reach `http://127.0.0.1:3001/api/health` and read/write SQLite-backed data. Finally, stop the Node server and reload: the UI should report that local database features are unavailable. The frontend cache alone cannot provide SQLite access.

## Product boundaries

- Electricity estimates use the configured rate and calculated meter-reading differences; appliance usage is estimated from rated watts and hours.
- Meter and appliance label images are browser previews only. OCR is not implemented.
- The existing detector is a local statistical/rule-based feature, not an AI model or appliance fault diagnosis.
- This project does not synchronize or queue writes while the backend is stopped.
