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

export const demoAlerts = [
  {
    id: 'alert-1',
    title: 'Weekly usage is higher than usual',
    context: 'Household · Demo alert',
    description: 'Sample usage is about 18% above the previous week. Review readings and routines; this is not a diagnosis.',
    severity: 'warning',
    createdAt: day(-1, 16),
    read: false,
  },
  {
    id: 'alert-2',
    title: 'Air conditioner estimate stands out',
    context: 'Bedroom air conditioner · Demo alert',
    description: 'Its rated-power estimate is the largest in this sample. Actual consumption can differ from the rating label.',
    severity: 'high',
    createdAt: day(-3, 10),
    read: false,
  },
  {
    id: 'alert-3',
    title: 'Time for a meter reading',
    context: 'Household · Demo reminder',
    description: 'A new reading can help compare your household usage over time.',
    severity: 'info',
    createdAt: day(-5, 11),
    read: true,
  },
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
