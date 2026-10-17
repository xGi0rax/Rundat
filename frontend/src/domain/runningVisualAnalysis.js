import {
  distanceKm,
  heartRate,
  median,
  paceMinutes,
} from './dashboardAnalysis.js'

// Gestisce running efficiency.
export function runningEfficiency(activity) {
  const pace = paceMinutes(activity)
  const averageHeartRate = heartRate(activity)
  return pace && averageHeartRate ? ((60 / pace) / averageHeartRate) * 100 : null
}

// Gestisce running training load.
export function runningTrainingLoad(activity, observedMaxHeartRate) {
  const averageHeartRate = heartRate(activity)
  const durationMinutes = Number(activity?.duration) / 60
  if (!averageHeartRate || !observedMaxHeartRate || !Number.isFinite(durationMinutes)) return null
  return durationMinutes * ((averageHeartRate / observedMaxHeartRate) ** 2)
}

// Gestisce build running visual data.
export function buildRunningVisualData(activities) {
  const observedMaxHeartRate = Math.max(
    0,
    ...activities
      .map((activity) => Number(activity.maxHR))
      .filter((value) => Number.isFinite(value) && value > 0),
  )

  return activities
    .map((activity) => {
      const date = new Date(activity.startTimeLocal)
      const averageHeartRate = heartRate(activity)
      const durationMinutes = Number(activity.duration) / 60
      return {
        activity,
        activityId: activity.activityId,
        name: activity.activityName || 'Corsa',
        date,
        dateValue: activity.startTimeLocal,
        distance: distanceKm(activity),
        pace: paceMinutes(activity),
        heartRate: averageHeartRate,
        durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : null,
        intensity: averageHeartRate && observedMaxHeartRate
          ? (averageHeartRate / observedMaxHeartRate) * 100
          : null,
        load: runningTrainingLoad(activity, observedMaxHeartRate),
        efficiency: runningEfficiency(activity),
      }
    })
    .filter((item) => !Number.isNaN(item.date.getTime()))
    .sort((first, second) => first.date - second.date)
}

// Gestisce add rolling efficiency.
export function addRollingEfficiency(data, windowSize = 5) {
  return data.map((item, index) => {
    const window = data
      .slice(Math.max(0, index - windowSize + 1), index + 1)
      .map((entry) => entry.efficiency)
    return { ...item, rollingEfficiency: median(window) }
  })
}
