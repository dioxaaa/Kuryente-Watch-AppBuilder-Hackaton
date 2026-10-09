import { openDb } from './db.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT) || 3001
const db = openDb()
createApp(db).listen(port, '127.0.0.1', () => // localhost only: not reachable from other machines
  console.log(`KuryenteWatch API (local SQLite) on http://127.0.0.1:${port}`))