import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

export function getProfile(db) {
  return db.prepare(`
    SELECT p.id, p.user_name AS userName, h.id AS householdId,
      h.household_name AS householdName, p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM user_profile p JOIN household h ON h.id = p.household_id
    WHERE p.id = 1
  `).get() ?? null
}

export function createProfile(db, { userName, householdName }) {
  const timestamp = now()
  return db.transaction(() => {
    if (getProfile(db)) throw Object.assign(new Error('A profile already exists on this installation.'), { status: 409 })
    db.prepare(`INSERT INTO household (id, household_name, created_at, updated_at) VALUES (1, ?, ?, ?)`)
      .run(householdName, timestamp, timestamp)
    db.prepare(`INSERT INTO user_profile (id, user_name, household_id, created_at, updated_at) VALUES (1, ?, 1, ?, ?)`)
      .run(userName, timestamp, timestamp)
    return getProfile(db)
  })()
}

export function updateProfile(db, { userName, householdName }) {
  return db.transaction(() => {
    if (!getProfile(db)) throw Object.assign(new Error('No profile exists on this installation yet.'), { status: 404 })
    const timestamp = now()
    db.prepare('UPDATE user_profile SET user_name = ?, updated_at = ? WHERE id = 1').run(userName, timestamp)
    db.prepare('UPDATE household SET household_name = ?, updated_at = ? WHERE id = 1').run(householdName, timestamp)
    return getProfile(db)
  })()
}

export function resetProfile(db) {
  return db.transaction(() => {
    const existed = db.prepare('SELECT 1 FROM user_profile WHERE id = 1').get() !== undefined
    db.prepare('DELETE FROM user_profile WHERE id = 1').run()
    db.prepare('DELETE FROM household WHERE id = 1').run()
    return existed
  })()
}

export function listMeterReadings(db) {
  return db.prepare(`
    SELECT COALESCE(reading_kwh, kwh) AS readingKwh, recorded_at AS recordedAt,
      COALESCE(external_id, CAST(id AS TEXT)) AS id,
      notes, created_at AS createdAt,
      COALESCE(reading_kwh, kwh) - LAG(COALESCE(reading_kwh, kwh)) OVER (ORDER BY recorded_at) AS usageKwh
    FROM meter_readings ORDER BY recorded_at
  `).all()
}

export function createMeterReading(db, { readingKwh, recordedAt, notes }) {
  return db.transaction(() => {
    const before = db.prepare(`
      SELECT reading_kwh AS readingKwh FROM meter_readings
      WHERE recorded_at < ? ORDER BY recorded_at DESC LIMIT 1
    `).get(recordedAt)
    const after = db.prepare(`
      SELECT reading_kwh AS readingKwh FROM meter_readings
      WHERE recorded_at > ? ORDER BY recorded_at LIMIT 1
    `).get(recordedAt)
    if (before && readingKwh < before.readingKwh) {
      throw Object.assign(new Error(`Reading must be at least ${before.readingKwh} kWh, the preceding meter value.`), { status: 400 })
    }
    if (after && readingKwh > after.readingKwh) {
      throw Object.assign(new Error(`Reading must not exceed ${after.readingKwh} kWh, the next meter value.`), { status: 400 })
    }
    const createdAt = now()
    const generatedId = randomUUID()
    const idColumn = db.pragma('table_info(meter_readings)').find(column => column.name === 'id')
    const textPrimaryKey = idColumn.type.toUpperCase() !== 'INTEGER' && idColumn.pk === 1
    const insert = textPrimaryKey
      ? db.prepare(`INSERT INTO meter_readings (id, external_id, reading_kwh, kwh, recorded_at, notes, source, created_at, is_reset)
          VALUES (?, ?, ?, ?, ?, ?, 'Manual entry', ?, 0)`)
      : db.prepare(`INSERT INTO meter_readings (external_id, reading_kwh, kwh, recorded_at, notes, source, created_at, is_reset)
          VALUES (?, ?, ?, ?, ?, 'Manual entry', ?, 0)`)
    const result = textPrimaryKey
      ? insert.run(generatedId, generatedId, readingKwh, readingKwh, recordedAt, notes, createdAt)
      : insert.run(generatedId, readingKwh, readingKwh, recordedAt, notes, createdAt)
    return {
      id: textPrimaryKey ? generatedId : Number(result.lastInsertRowid),
      readingKwh,
      recordedAt,
      notes,
      createdAt,
      usageKwh: before ? readingKwh - before.readingKwh : null,
    }
  })()
}

const applianceSelect = `
  SELECT id, name, category, COALESCE(rated_watts, watts) AS ratedWatts,
    COALESCE(hours_per_day, hours) AS hoursPerDay,
    COALESCE(usage_pattern, pattern, 'Daily') AS usagePattern,
    COALESCE(brand, '') AS brand, COALESCE(model, '') AS model,
    created_at AS createdAt, updated_at AS updatedAt,
    COALESCE(sample, 0) AS isSample
  FROM appliances
`

export const listAppliances = db => db.prepare(`${applianceSelect} ORDER BY name COLLATE NOCASE`).all()
export const getAppliance = (db, id) => db.prepare(`${applianceSelect} WHERE id = ?`).get(id) ?? null

export function createAppliance(db, appliance) {
  const timestamp = now()
  const id = randomUUID()
  const result = db.prepare(`
    INSERT INTO appliances (
      id, name, category, watts, hours, pattern, sample, brand, model,
      created_at, updated_at, rated_watts, hours_per_day, usage_pattern
    ) VALUES (
      @id, @name, @category, @ratedWatts, @hoursPerDay, @usagePattern,
      0, @brand, @model, @timestamp, @timestamp, @ratedWatts, @hoursPerDay, @usagePattern
    )
  `).run({ ...appliance, id, timestamp })
  return getAppliance(db, id)
}

export function updateAppliance(db, id, appliance) {
  const result = db.prepare(`
    UPDATE appliances SET name=@name, category=@category, watts=@ratedWatts,
      hours=@hoursPerDay, pattern=@usagePattern, rated_watts=@ratedWatts,
      hours_per_day=@hoursPerDay, usage_pattern=@usagePattern, brand=@brand,
      model=@model, updated_at=@timestamp WHERE id=@id
  `).run({ ...appliance, id, timestamp: now() })
  return result.changes ? getAppliance(db, id) : null
}

export const deleteAppliance = (db, id) => db.prepare('DELETE FROM appliances WHERE id = ?').run(id).changes > 0

export function getAppSettings(db) {
  const rows = db.prepare('SELECT key, value FROM app_settings').all()
  return rows.reduce((settings, row) => {
    settings[row.key] = JSON.parse(row.value)
    return settings
  }, { ratePerKwh: 12.5, compact: false, weeklySummary: true })
}

export function updateAppSettings(db, values) {
  const timestamp = now()
  const put = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `)
  db.transaction(settings => {
    for (const [key, value] of Object.entries(settings)) put.run(key, JSON.stringify(value), timestamp)
  })(values)
  return getAppSettings(db)
}
