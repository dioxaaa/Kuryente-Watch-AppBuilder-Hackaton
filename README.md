# KuryenteWatch — The Local Energy Companion

KuryenteWatch is a local household electricity PWA. The React interface talks to its loopback Node.js server; Express validates requests and stores application records in SQLite. No account or cloud database is required. The optional Energy Assistant uses an Ollama model running locally on the same computer.

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

Vite listens on `0.0.0.0`, so phones or laptops on the same network can open the UI too (see [Using KuryenteWatch from other devices on your network](#using-kuryentewatch-from-other-devices-on-your-network)).

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

The Vite PWA plugin generates `dist/manifest.webmanifest`, the service worker, and its Workbox runtime during the build. The service worker precaches the frontend shell, build assets, and the on-device OCR engine and language data (about 10 MB in total), so the installed app opens and works with no network. It does not cache SQLite records; when Node is stopped the app switches to on-device mode (see [Working without the server](#working-without-the-server-on-device-mode)).

## Local Energy Assistant (Ollama)

The Energy Assistant sends prompts and relevant saved household context from the local Node server to Ollama at `http://127.0.0.1:11434`. Browser code never calls Ollama directly, and prompts/records are not sent to a cloud model. Ollama must be installed and running, and at least one local model must be available. The app lists installed models in the Assistant page.

For example, install a model once and start Ollama:

```powershell
ollama pull qwen3.5:4b
ollama serve
```

If Ollama is already running as a background service, just leave it running. Configure a different loopback Ollama port with `OLLAMA_HOST`, for example `$env:OLLAMA_HOST = 'http://127.0.0.1:11434'` before starting `npm start`. The server intentionally rejects non-loopback Ollama hosts to keep household prompts local. If Ollama is stopped or no model is installed, the Assistant page reports that state and provides a model refresh action; the rest of KuryenteWatch continues to work.

## Working without the server (on-device mode)

KuryenteWatch works fully on the device when the Node server cannot be reached: static hosting (for example a deployed `dist/`), the installed PWA or APK on a phone away from home, or no network at all. Nothing needs to be configured.

- **Detection:** `src/api.js` switches to on-device mode when any `/api` request fails to connect, when `/api/health` does not return the KuryenteWatch health payload (`{ "ok": true, ... }`, e.g. a static host returning `index.html` or a foreign 404), or when a route returns something other than JSON and the health check fails.
- **Data:** profile, settings, meter readings, and appliances are saved in this browser's IndexedDB (`src/local-api.js`, via Dexie). They stay on this device and are not copied into SQLite later.
- **Assistant:** the dashboard widget and the Assistant chat are answered by a built-in, rule-based responder (`src/utils/offline-assistant.js`) using the saved readings and appliances. The model picker shows **On-device assistant**. The same responder answers when the server is running but Ollama has no model.
- **Meter photo scan:** the photo is read in the browser with Tesseract (`tesseract.js`, WebAssembly) in `src/utils/offline-ocr.js`. The worker, OCR engine, and English language data are bundled with the build (served from the app's own origin, never a CDN), so it works offline. The longest number on the display is suggested as the kWh value; check it before saving. If no digits are found, type the reading manually. When the server is running but its Ollama vision model is unavailable, the same on-device OCR is used.
- **Device telemetry:** device power monitoring and detector alerts need the server; on the device they are simply empty.
- **Switching back:** while in on-device mode the app re-checks `/api/health` every 30 seconds of use, when the page becomes visible again, and when the network comes back. When the real server answers, the app switches back to it and reloads the server's data.

## Using KuryenteWatch from other devices on your network

The AI (Ollama), the SQLite database, and the Express API all stay on the host computer. Other devices only load the web UI, and the UI calls the same-origin `/api`, which the host answers.

**Development / preview (default LAN mode):** `npm run dev:all` (or `npm run dev` / `npm run preview` with `npm run server`). Vite binds to `0.0.0.0` and proxies `/api` to the API on the host's loopback (`127.0.0.1:3001`), so the API itself never listens on the network.

1. Find the host's LAN IP (`ipconfig` on Windows, `ip addr` / `ifconfig` on Linux/macOS), e.g. `192.168.1.20`.
2. On the other device, open `http://192.168.1.20:5173` (or `:4173` for `npm run preview`).
3. If it does not load, allow Node/Vite through the host firewall for private networks.

**Production build (opt-in):** `npm start` serves the built `dist/` and the API on `127.0.0.1` only. To reach it from other devices, start it with `HOST=0.0.0.0` and open `http://<host-ip>:3001`:

```powershell
$env:HOST = '0.0.0.0'
npm start
```

Over plain HTTP on a LAN IP, browsers will not register the service worker or offer PWA install; the app still works as a normal web page.

> **Privacy warning:** the API has no login. Anyone on the same network who can reach the Vite port (dev/preview) or the API port (`HOST=0.0.0.0`) can read, change, or delete your readings, appliances, alerts, and settings, and can ask the assistant questions about them. Only enable LAN access on a trusted home network, never on public Wi-Fi, and stop the servers when you are done. Ollama is never exposed: the server still rejects non-loopback Ollama hosts.

## Local storage and privacy

- Default SQLite file: `data/kuryentewatch.db`.
- `data/`, `node_modules/`, `dist/`, and `.env` files are ignored by Git.
- Existing device telemetry, detector alerts, appliance rows, and settings are preserved. Schema updates are additive; the legacy appliance columns are retained and mapped to the current API.
- The SQLite data is unauthenticated. With the default LAN-enabled Vite dev/preview server (or `HOST=0.0.0.0` for `npm start`), devices on your network can access it; see the networking section above.
- To use a different database file, set `KURYENTE_DB` before starting the server:

```powershell
$env:KURYENTE_DB = 'C:\path\to\private-data\kuryentewatch.db'
npm start
```

On first launch, create a local profile and household. This is not an online account. Reset setup in Settings removes only those two names; readings, appliances, settings, and alerts remain. The API’s full data reset requires the explicit confirmation string `DELETE ALL LOCAL DATA`.

## Local API

The server binds to `127.0.0.1` by default (override with `HOST`, see the networking section). JSON is served from `/api`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verify server and SQLite readiness |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/profile` | Read/create/update/reset the local profile and household |
| `GET`, `POST` | `/api/readings` | List or create cumulative household kWh meter readings |
| `GET`, `POST` | `/api/appliances` | List or create appliance estimates |
| `PUT`, `DELETE` | `/api/appliances/:id` | Update or delete an appliance |
| `GET`, `PATCH` | `/api/alerts`, `/api/alerts/:id` | List, read, and dismiss local detector alerts |
| `GET`, `PUT` | `/api/settings` | Read and update rate and display settings |
| `GET` | `/api/assistant/status` | List locally installed Ollama models and report availability |
| `POST` | `/api/assistant/chat` | Generate a response with local Ollama and saved household context |
| `POST` | `/api/meter-readings/read-photo` | Suggest a kWh value from a meter photo with the local Ollama vision model |

Legacy local detector routes remain available: `/api/devices`, `/api/devices/:name/readings`, `/api/devices/:name/train`, `/api/devices/:name/scan`, and `/api/devices/:name/baseline`. Device power telemetry remains separate from cumulative household meter readings.

## Tests and offline check

Run the existing detector/API tests and the local application API tests:

```powershell
npm test
npm run build
```

For an offline check, first run the production build and local server, open the app once, and confirm the service worker is activated in the browser’s Application/Storage panel. Then disconnect internet access while leaving `npm start` running, reload, and verify that the app can still reach `http://127.0.0.1:3001/api/health` and read/write SQLite-backed data. Finally, stop the Node server and reload: the app switches to on-device mode (the footer shows **Saved on this device**) and readings, appliances, settings, the assistant, and meter photo scanning keep working from IndexedDB and the bundled OCR. Start the server again and bring the tab back to the foreground to switch back to SQLite.

## Product boundaries

- Electricity estimates use the configured rate and calculated meter-reading differences; appliance usage is estimated from rated watts and hours.
- Meter photos are read by the local Ollama vision model when the server is running, or by on-device Tesseract OCR otherwise. Both only suggest a value that the person confirms before saving. Appliance label images are browser previews only.
- The Energy Assistant uses actual local Ollama inference when the Ollama runtime and a model are available; it is not a cloud AI integration.
- The existing detector is a local statistical/rule-based feature, not an AI model or appliance fault diagnosis.
- This project does not synchronize data between on-device mode (IndexedDB) and the server's SQLite database; records saved in one are not copied to the other.
