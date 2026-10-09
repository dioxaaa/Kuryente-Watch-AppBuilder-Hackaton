import { openDb } from './db.js'
import { createApp } from './app.js'
import { seedDefaultAppliances } from './default-appliances.js'

const port = Number(process.env.PORT) || 3001
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.')
  process.exit(1)
}
// Loopback by default. Set HOST=0.0.0.0 to let other LAN devices open the production build; Ollama stays on loopback either way.
const host = process.env.HOST || '127.0.0.1'

let db
try {
  db = openDb()
  const integrity = db.pragma('quick_check')
  if (integrity[0]?.quick_check !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity[0]?.quick_check ?? 'unknown result'}`)
  }
  seedDefaultAppliances(db)
} catch (error) {
  console.error(`Could not open the local KuryenteWatch database. The existing file was not removed: ${error.message}`)
  process.exit(1)
}

const server = createApp(db).listen(port, host, () => {
  console.log(`KuryenteWatch local app and SQLite API listening on http://${host}:${port}`)
  if (host !== '127.0.0.1' && host !== 'localhost') console.warn('Warning: the unauthenticated API and household data are reachable from your network.')
  console.log(`Database: ${process.env.KURYENTE_DB || 'data/kuryentewatch.db'}`)
  console.log(`Frontend: ${process.env.NODE_ENV === 'production' ? 'production build (if available)' : 'Vite dev server at http://127.0.0.1:5173'}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    console.log('KuryenteWatch server stopped.')
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
