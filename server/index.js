import { openDb } from './db.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT) || 3001
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.')
  process.exit(1)
}

let db
try {
  db = openDb()
  const integrity = db.pragma('quick_check')
  if (integrity[0]?.quick_check !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity[0]?.quick_check ?? 'unknown result'}`)
} catch (error) {
  console.error(`Could not open the local KuryenteWatch database. The existing file was not removed: ${error.message}`)
  process.exit(1)
}

const server = createApp(db).listen(port, '127.0.0.1', () => {
  console.log(`KuryenteWatch local app and SQLite API listening on http://127.0.0.1:${port}`)
  console.log(`Database: ${process.env.KURYENTE_DB || 'data/kuryentewatch.db'}`)
  console.log(`Frontend: ${process.env.NODE_ENV === 'production' ? 'production build (if available)' : 'Vite dev server at http://127.0.0.1:5173'}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    console.log('KuryenteWatch server stopped.')
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)