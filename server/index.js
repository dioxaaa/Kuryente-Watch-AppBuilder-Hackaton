import { openDb } from './db.js'
import { createApp } from './app.js'
import { seedDefaultAppliances } from './default-appliances.js'
import ollama from 'ollama'
import cors from 'cors' // <-- Added CORS import

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
const db = openDb()

// Seed initial appliance data into SQLite
seedDefaultAppliances(db)

// Create Express app instance
const app = createApp(db)

// Enable CORS middleware so localhost:5173 can talk to 127.0.0.1:3001
app.use(cors())

// Root health check route
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'KuryenteWatch API is running locally!' })
})

// Local AI Energy Recommendation Route
app.post('/api/ai/recommendation', async (req, res) => {
  const { applianceName, ratedWatts, hoursPerDay } = req.body

  if (!applianceName || !ratedWatts) {
    return res.status(400).json({ error: 'Missing appliance name or rated watts.' })
  }

  const dailyKwh = ((ratedWatts * (hoursPerDay || 0)) / 1000).toFixed(2)

  const prompt = `You are an energy efficiency assistant for KuryenteWatch.
Analyze this household appliance:
- Name: ${applianceName}
- Rating: ${ratedWatts} Watts
- Usage: ${hoursPerDay || 0} hours/day
- Estimated Consumption: ${dailyKwh} kWh/day

Give a concise, practical 2-sentence tip on how the household can save energy for this device.`

  try {
    const response = await ollama.generate({
      model: 'llama3.2',
      prompt: prompt,
    })

    res.json({
      success: true,
      appliance: applianceName,
      insight: response.response.trim(),
    })
  } catch (error) {
    console.error('Ollama Local AI Error:', error.message)
    
    // Graceful fallback response so the widget never hangs
    res.json({
      success: true,
      appliance: applianceName,
      insight: `For your ${applianceName}, consider unplugging it when idle to prevent phantom energy draw and run it during off-peak hours to save up to 15% on your bill.`
    })
  }
})

// Start server
app.listen(port, '127.0.0.1', () => {
  console.log(`KuryenteWatch API (local SQLite) on http://127.0.0.1:${port}`)
})
