import { periodStart, shiftPeriod } from './periods.js'

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

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function historyConfiguration(period) {
  if (period.amount === 1 && period.unit === 'week') {
    return { count: 7, granularity: 'day', evenlySplit: true }
  }
  if (period.amount === 1 && period.unit === 'month') {
    return { count: 5, granularity: 'week', evenlySplit: true }
  }
  if (period.amount === 1 && period.unit === 'year') {
    return { count: 12, granularity: 'month', unit: 'month' }
  }
  return { count: period.amount, granularity: period.unit, unit: period.unit }
}

function createHistoryBuckets(start, end, period) {
  const configuration = historyConfiguration(period)
  const boundaries = Array.from({ length: configuration.count + 1 }, (_value, index) => {
    if (index === 0) return new Date(start)
    if (index === configuration.count) return new Date(end)
    if (configuration.evenlySplit) {
      return new Date(start.getTime() + (((end - start) * index) / configuration.count))
    }
    return shiftPeriod(start, { amount: index, unit: configuration.unit })
  })
  const buckets = Array.from({ length: configuration.count }, (_value, index) => {
    const bucketEnd = new Date(boundaries[index + 1].getTime() - 1)
    const startDate = localDateKey(boundaries[index])
    const endDate = localDateKey(bucketEnd)
    return {
      date: configuration.granularity === 'day' ? endDate : startDate,
      startDate,
      endDate,
      activities: 0,
      z1: 0,
      z2: 0,
      z3: 0,
      z4: 0,
      z5: 0,
    }
  })
  return { boundaries, buckets, granularity: configuration.granularity }
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
  const start = periodStart(period, end)
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
  const historyAnalysis = createHistoryBuckets(start, end, period)
  filtered.forEach((activity) => {
    const values = Array(5).fill(0)
    addZones(values, activity)
    if (!values.some((value) => value > 0)) return
    const activityDate = new Date(activity.startTimeLocal)
    const bucketIndex = historyAnalysis.boundaries.findIndex((boundary, index) => (
      index < historyAnalysis.buckets.length
      && activityDate >= boundary
      && (
        activityDate < historyAnalysis.boundaries[index + 1]
        || (index === historyAnalysis.buckets.length - 1 && activityDate <= end)
      )
    ))
    if (bucketIndex < 0) return
    const bucket = historyAnalysis.buckets[bucketIndex]
    values.forEach((seconds, index) => {
      bucket[`z${index + 1}`] = (bucket[`z${index + 1}`] || 0) + (seconds / 60)
    })
    bucket.activities += 1
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
    granularity: historyAnalysis.granularity,
    history: historyAnalysis.buckets,
  }
}
