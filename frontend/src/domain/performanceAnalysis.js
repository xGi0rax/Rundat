const zoneWeights = [1, 1.5, 2, 3, 4]

function activityDistanceKm(activity) {
  const distance = Number(activity.km)
  if (Number.isFinite(distance)) return distance
  return Math.max(0, Number(activity.distance) / 1000 || 0)
}

function activityDate(activity) {
  const date = new Date(activity.startTimeLocal)
  return Number.isNaN(date.getTime()) ? null : date
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function beginningOfWeek(date) {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

function activityLoad(activity) {
  const duration = Number(activity.duration)
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const zones = Array.isArray(activity.heartRateZones) ? activity.heartRateZones : []
  const zoneSeconds = zones.reduce(
    (total, zone) => total + (Number(zone.seconds) || 0),
    0,
  )
  if (zoneSeconds > 0) {
    return zones.reduce(
      (total, zone) => total + (Number(zone.seconds) || 0) * (zoneWeights[(Number(zone.zone) || 1) - 1] || 1),
      0,
    ) / 60
  }
  const intensity = Number(activity.averageHR) > 0 && Number(activity.maxHR) > 0
    ? Math.min(1.5, Math.max(0.5, Number(activity.averageHR) / Number(activity.maxHR)))
    : 1
  return (duration / 60) * intensity
}

function standardDeviation(values) {
  if (values.length < 2) return 0
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length)
}

function formatBucketLabel(date) {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')
}

function formatFreshnessLabel(date) {
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', '')
}

function exponentialAverage(previous, value, days) {
  return previous + ((value - previous) / days)
}

export function analyzeFitnessFreshness(activities, period, now = new Date()) {
  const visibleStart = new Date(now)
  if (period.unit === 'week') visibleStart.setDate(visibleStart.getDate() - (period.amount * 7))
  else if (period.unit === 'year') visibleStart.setFullYear(visibleStart.getFullYear() - period.amount)
  else visibleStart.setMonth(visibleStart.getMonth() - period.amount)
  visibleStart.setHours(0, 0, 0, 0)

  const calculationStart = new Date(visibleStart)
  calculationStart.setDate(calculationStart.getDate() - 42)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const loadsByDay = new Map()

  activities.forEach((activity) => {
    const date = activityDate(activity)
    if (!date || date < calculationStart || date > end) return
    const key = localDateKey(date)
    loadsByDay.set(key, (loadsByDay.get(key) || 0) + activityLoad(activity))
  })

  const points = []
  let fitness = 0
  let fatigue = 0
  for (const cursor = new Date(calculationStart); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const load = loadsByDay.get(localDateKey(cursor)) || 0
    fitness = exponentialAverage(fitness, load, 42)
    fatigue = exponentialAverage(fatigue, load, 7)
    if (cursor >= visibleStart) {
      points.push({
        date: localDateKey(cursor),
        label: formatFreshnessLabel(cursor),
        load: Math.round(load),
        fitness: Number(fitness.toFixed(1)),
        fatigue: Number(fatigue.toFixed(1)),
        form: Number((fitness - fatigue).toFixed(1)),
      })
    }
  }

  return {
    data: points,
    current: points.at(-1) || null,
    start: visibleStart,
    end,
  }
}

export function analyzePerformance(activities, racePredictions = [], weeks = 12) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = beginningOfWeek(new Date(end.getFullYear(), end.getMonth(), end.getDate() - ((weeks - 1) * 7)))
  const buckets = []
  for (let index = 0; index < weeks; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index * 7)
    buckets.push({
      date: localDateKey(date),
      label: formatBucketLabel(date),
      load: 0,
      runningLoad: 0,
      cyclingLoad: 0,
      distanceKm: 0,
      runningDistanceKm: 0,
      cyclingDistanceKm: 0,
      duration: 0,
      runningDuration: 0,
      cyclingDuration: 0,
      elevation: 0,
      runs: 0,
      cycling: 0,
      easySeconds: 0,
      moderateSeconds: 0,
      hardSeconds: 0,
      efficiencyTotal: 0,
      efficiencyCount: 0,
      days: new Set(),
      dailyLoads: Array(7).fill(0),
      dataQuality: { total: 0, heartRate: 0, zones: 0, elevation: 0 },
    })
  }

  activities.forEach((activity) => {
    const date = activityDate(activity)
    if (!date || date < start || date > end) return
    const bucket = buckets[Math.floor((date - start) / (7 * 86400000))]
    if (!bucket) return
    const duration = Number(activity.duration) || 0
    const distanceKm = activityDistanceKm(activity)
    const load = activityLoad(activity)
    bucket.dataQuality.total += 1
    if (Number(activity.averageHR) > 0) bucket.dataQuality.heartRate += 1
    if (Array.isArray(activity.heartRateZones) && activity.heartRateZones.some((zone) => Number(zone.seconds) > 0)) {
      bucket.dataQuality.zones += 1
    }
    if (Number.isFinite(Number(activity.elevationGain))) bucket.dataQuality.elevation += 1
    const dayIndex = Math.floor((date - beginningOfWeek(date)) / 86400000)
    bucket.dailyLoads[dayIndex] += load
    bucket.load += load
    if (activity.activityType === 'running') bucket.runningLoad += load
    if (activity.activityType === 'cycling') bucket.cyclingLoad += load
    bucket.distanceKm += distanceKm
    if (activity.activityType === 'running') bucket.runningDistanceKm += distanceKm
    if (activity.activityType === 'cycling') bucket.cyclingDistanceKm += distanceKm
    bucket.duration += duration
    if (activity.activityType === 'running') bucket.runningDuration += duration
    if (activity.activityType === 'cycling') bucket.cyclingDuration += duration
    bucket.elevation += Math.max(0, Number(activity.elevationGain) || 0)
    bucket.runs += activity.activityType === 'running' ? 1 : 0
    bucket.cycling += activity.activityType === 'cycling' ? 1 : 0
    bucket.days.add(localDateKey(date))
    const zones = Array.isArray(activity.heartRateZones) ? activity.heartRateZones : []
    zones.forEach((zone) => {
      const seconds = Number(zone.seconds) || 0
      if (Number(zone.zone) <= 2) bucket.easySeconds += seconds
      else if (Number(zone.zone) === 3) bucket.moderateSeconds += seconds
      else bucket.hardSeconds += seconds
    })
    const speed = Number(activity.averageSpeed)
    const heartRate = Number(activity.averageHR)
    if (speed > 0 && heartRate > 0) {
      bucket.efficiencyTotal += speed / heartRate
      bucket.efficiencyCount += 1
    }
  })

  const values = buckets.map((bucket, index) => {
    const previous = buckets.slice(Math.max(0, index - 3), index)
    const chronicLoad = previous.length
      ? previous.reduce((sum, item) => sum + item.load, 0) / previous.length
      : bucket.load
    const totalZoneSeconds = bucket.easySeconds + bucket.moderateSeconds + bucket.hardSeconds
    const dailyLoadAverage = bucket.dailyLoads.reduce((sum, value) => sum + value, 0) / 7
    const dailyLoadDeviation = standardDeviation(bucket.dailyLoads)
    const monotony = dailyLoadDeviation > 0 ? dailyLoadAverage / dailyLoadDeviation : 0
    const quality = bucket.dataQuality
    const qualityPercent = (value) => quality.total ? Math.round((value / quality.total) * 100) : null
    return {
      ...bucket,
      load: Math.round(bucket.load),
      chronicLoad: Math.round(chronicLoad),
      dailyLoadAverage: Number(dailyLoadAverage.toFixed(1)),
      dailyLoadDeviation: Number(dailyLoadDeviation.toFixed(1)),
      monotony: Number(monotony.toFixed(2)),
      strain: Math.round(bucket.load * monotony),
      distanceKm: Number(bucket.distanceKm.toFixed(1)),
      runningDistanceKm: Number(bucket.runningDistanceKm.toFixed(1)),
      cyclingDistanceKm: Number(bucket.cyclingDistanceKm.toFixed(1)),
      runningDuration: Math.round(bucket.runningDuration),
      cyclingDuration: Math.round(bucket.cyclingDuration),
      elevation: Math.round(bucket.elevation),
      activeDays: bucket.days.size,
      activities: bucket.runs + bucket.cycling,
      easyShare: totalZoneSeconds ? Math.round((bucket.easySeconds / totalZoneSeconds) * 100) : null,
      moderateShare: totalZoneSeconds ? Math.round((bucket.moderateSeconds / totalZoneSeconds) * 100) : null,
      hardShare: totalZoneSeconds ? Math.round((bucket.hardSeconds / totalZoneSeconds) * 100) : null,
      efficiency: bucket.efficiencyCount
        ? bucket.efficiencyTotal / bucket.efficiencyCount
        : null,
      quality: {
        activities: quality.total,
        heartRate: qualityPercent(quality.heartRate),
        zones: qualityPercent(quality.zones),
        elevation: qualityPercent(quality.elevation),
      },
      qualityHeartRate: qualityPercent(quality.heartRate),
      qualityZones: qualityPercent(quality.zones),
      qualityElevation: qualityPercent(quality.elevation),
    }
  })
  const latest = values.at(-1)
  const previous = values.at(-2)
  const totalLoad = values.reduce((sum, item) => sum + item.load, 0)
  const runLoad = values.reduce((sum, item) => sum + item.runningLoad, 0)
  const totalDuration = values.reduce((sum, item) => sum + item.duration, 0)
  const runningDuration = values.reduce((sum, item) => sum + item.runningDuration, 0)
  const totalDistance = values.reduce((sum, item) => sum + item.distanceKm, 0)
  const runningDistance = values.reduce((sum, item) => sum + item.runningDistanceKm, 0)
  let consecutiveActiveWeeks = 0
  for (let index = values.length - 1; index >= 0 && values[index].activeDays > 0; index -= 1) {
    consecutiveActiveWeeks += 1
  }
  const predictionChanges = ['5k', '10k', 'halfMarathon', 'marathon'].map((key) => {
    const series = racePredictions
      .filter((item) => item.granularity === 'monthly' && Number(item[key]) > 0)
      .sort((first, second) => first.date.localeCompare(second.date))
    const first = series.at(-2)?.[key]
    const last = series.at(-1)?.[key]
    return { key, change: first && last ? ((last - first) / first) * 100 : null }
  })

  return {
    buckets: values.map((bucket) => {
      const result = { ...bucket }
      delete result.days
      delete result.dailyLoads
      delete result.dataQuality
      return result
    }),
    summary: {
      latestLoad: latest?.load || 0,
      chronicLoad: latest?.chronicLoad || 0,
      loadChange: previous?.load ? ((latest.load - previous.load) / previous.load) * 100 : null,
      totalLoad: Math.round(totalLoad),
      runLoadShare: totalLoad ? Math.round((runLoad / totalLoad) * 100) : null,
      activeDays: values.reduce((sum, item) => sum + item.activeDays, 0),
      averageActivities: Number((values.reduce((sum, item) => sum + item.runs + item.cycling, 0) / weeks).toFixed(1)),
      averageActiveDays: Number((values.reduce((sum, item) => sum + item.activeDays, 0) / weeks).toFixed(1)),
      consecutiveActiveWeeks,
      inactiveWeeks: values.filter((item) => item.activeDays === 0).length,
      runningActivities: values.reduce((sum, item) => sum + item.runs, 0),
      cyclingActivities: values.reduce((sum, item) => sum + item.cycling, 0),
      runningTimeShare: totalDuration ? Math.round((runningDuration / totalDuration) * 100) : null,
      runningDistanceShare: totalDistance ? Math.round((runningDistance / totalDistance) * 100) : null,
      latestMonotony: latest?.monotony || 0,
      latestStrain: latest?.strain || 0,
      highestStrain: values.reduce(
        (highest, item) => item.strain > highest.strain ? item : highest,
        { strain: 0, label: '—' },
      ),
      dataQuality: ['heartRate', 'zones', 'elevation'].reduce((result, key) => {
        const available = values.reduce((sum, item) => (
          sum + (item.quality.activities ? (item.quality[key] / 100) * item.quality.activities : 0)
        ), 0)
        const total = values.reduce((sum, item) => sum + item.quality.activities, 0)
        result[key] = total ? Math.round((available / total) * 100) : null
        return result
      }, {}),
      efficiencyChange: latest?.efficiency && previous?.efficiency
        ? ((latest.efficiency - previous.efficiency) / previous.efficiency) * 100
        : null,
      predictionChanges,
    },
  }
}
