export const ACTIVITY_TYPES = {
  running: 'running',
  cycling: 'cycling',
}

export function activityType(activity) {
  return activity?.activityType === ACTIVITY_TYPES.cycling
    ? ACTIVITY_TYPES.cycling
    : ACTIVITY_TYPES.running
}

export function activitiesOfType(activities, type) {
  return activities.filter((activity) => activityType(activity) === type)
}

function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function beginningOfWeek(date) {
  const result = startOfDay(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  return result
}

function beginningOfMonth(date) {
  const result = startOfDay(date)
  result.setDate(1)
  return result
}

function beginningOfYear(date) {
  const result = startOfDay(date)
  result.setMonth(0, 1)
  return result
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function periodStart(period, now, activities) {
  if (period === 'all') {
    const timestamps = activities
      .map((activity) => new Date(activity.startTimeLocal).getTime())
      .filter(Number.isFinite)
    return timestamps.length ? startOfDay(new Date(Math.min(...timestamps))) : startOfDay(now)
  }
  const start = startOfDay(now)
  start.setDate(start.getDate() - (Number(period) - 1))
  return start
}

function historyGranularity(period) {
  if (period === 'all') return 'year'
  if (Number(period) <= 14) return 'day'
  if (Number(period) <= 90) return 'week'
  return 'month'
}

function bucketStart(date, granularity) {
  if (granularity === 'week') return beginningOfWeek(date)
  if (granularity === 'month') return beginningOfMonth(date)
  if (granularity === 'year') return beginningOfYear(date)
  return startOfDay(date)
}

function addZones(target, activity) {
  const zones = Array.isArray(activity.heartRateZones) ? activity.heartRateZones : []
  zones.forEach((zone) => {
    const index = Number(zone.zone) - 1
    const seconds = Number(zone.seconds)
    if (index >= 0 && index < 5 && Number.isFinite(seconds) && seconds > 0) {
      target[index] += seconds
    }
  })
}

export function analyzeCombinedActivities(activities, period, now = new Date()) {
  const end = new Date(now)
  const start = periodStart(period, end, activities)
  const filtered = activities.filter((activity) => {
    const date = new Date(activity.startTimeLocal)
    return !Number.isNaN(date.getTime()) && date >= start && date <= end
  })
  const zoneSeconds = Array(5).fill(0)
  const sport = {
    running: { count: 0, duration: 0, distanceKm: 0 },
    cycling: { count: 0, duration: 0, distanceKm: 0 },
  }
  let totalDuration = 0
  let trackedActivities = 0

  filtered.forEach((activity) => {
    const type = activityType(activity)
    const duration = Number(activity.duration) || 0
    const distance = Number(activity.km)
    totalDuration += duration
    sport[type].count += 1
    sport[type].duration += duration
    sport[type].distanceKm += Number.isFinite(distance)
      ? distance
      : (Number(activity.distance) || 0) / 1000
    const before = zoneSeconds.reduce((sum, value) => sum + value, 0)
    addZones(zoneSeconds, activity)
    if (zoneSeconds.reduce((sum, value) => sum + value, 0) > before) trackedActivities += 1
  })

  const trackedSeconds = zoneSeconds.reduce((sum, value) => sum + value, 0)
  const zones = zoneSeconds.map((seconds, index) => ({
    zone: index + 1,
    seconds,
    percentage: trackedSeconds ? (seconds / trackedSeconds) * 100 : 0,
  }))
  const granularity = historyGranularity(period)
  const historyByDate = new Map()
  filtered.forEach((activity) => {
    const values = Array(5).fill(0)
    addZones(values, activity)
    if (!values.some((value) => value > 0)) return
    const date = localDateKey(bucketStart(new Date(activity.startTimeLocal), granularity))
    const bucket = historyByDate.get(date) ?? { date, activities: 0 }
    values.forEach((seconds, index) => {
      bucket[`z${index + 1}`] = (bucket[`z${index + 1}`] || 0) + (seconds / 60)
    })
    bucket.activities += 1
    historyByDate.set(date, bucket)
  })

  return {
    start,
    end,
    activities: filtered,
    activityCount: filtered.length,
    totalDuration,
    trackedActivities,
    trackedSeconds,
    zones,
    sport,
    granularity,
    history: [...historyByDate.values()].sort((first, second) => first.date.localeCompare(second.date)),
  }
}
