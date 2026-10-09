const day = (offset, hour = 9) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  date.setHours(hour, 0, 0, 0)
  return date
}

export const demoReadings = [
  { id: 'demo-1', kwh: 2841, date: day(-28), source: 'Sample' },
  { id: 'demo-2', kwh: 2880, date: day(-21), source: 'Sample' },
  { id: 'demo-3', kwh: 2926, date: day(-14), source: 'Sample' },
  { id: 'demo-4', kwh: 2967, date: day(-7), source: 'Sample' },
  { id: 'demo-5', kwh: 3012, date: day(0), source: 'Sample' },
]

export const demoAppliances = [
  { id: 'a-1', name: 'Family refrigerator', category: 'Refrigerator', watts: 180, hours: 24, pattern: 'Daily' },
  { id: 'a-2', name: 'Living room fan', category: 'Electric fan', watts: 60, hours: 10, pattern: 'Daily' },
  { id: 'a-3', name: 'Bedroom air conditioner', category: 'Air conditioner', watts: 900, hours: 6, pattern: 'Daily' },
  { id: 'a-4', name: 'Rice cooker', category: 'Rice cooker', watts: 600, hours: 1.5, pattern: 'Daily' },
]

export const weeklyUsage = [
  { day: 'Mon', usage: 8.1 },
  { day: 'Tue', usage: 6.9 },
  { day: 'Wed', usage: 7.6 },
  { day: 'Thu', usage: 9.4 },
  { day: 'Fri', usage: 7.2 },
  { day: 'Sat', usage: 10.1 },
  { day: 'Sun', usage: 8.7 },
]