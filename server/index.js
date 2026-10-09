import { openDb } from './db.js'
import { createApp } from './app.js'
<<<<<<< HEAD
import ollama from 'ollama'

const port = Number(process.env.PORT) || 3001
const db = openDb()

// 1. Create the Express app instance
const app = createApp(db)

// 2. Health check route for http://127.0.0.1:3001/
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'KuryenteWatch API is running locally!' })
})

// 3. Local AI Energy Recommendation Route
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
    res.status(500).json({
      success: false,
      error: 'Failed to generate AI insight. Make sure Ollama is running.',
    })
  }
})

// 4. Start the server
app.listen(port, '127.0.0.1', () => {
  console.log(`KuryenteWatch API (local SQLite) on http://127.0.0.1:${port}`)
})
=======
import { seedDefaultAppliances } from './default-appliances.js'

const port = Number(process.env.PORT) || 3001
const db = openDb()
seedDefaultAppliances(db)
createApp(db).listen(port, '127.0.0.1', () => // localhost only: not reachable from other machines
  console.log(`KuryenteWatch API (local SQLite) on http://127.0.0.1:${port}`))
>>>>>>> 6fc94916586368bb2aa5929ef21924da13e7bfeb
