import { distanceKm, heartRate, median } from './dashboardAnalysis.js'

export function cyclingSpeedKmh(activity) {
  const averageSpeed = Number(activity?.averageSpeed)
  if (Number.isFinite(averageSpeed) && averageSpeed > 0) return averageSpeed * 3.6

  const distance = Number(activity?.distance)
  const duration = Number(activity?.duration)
  return Number.isFinite(distance) && distance > 0 && Number.isFinite(duration) && duration > 0
    ? (distance / duration) * 3.6
    : null
}

export function elevationPerKm(activity) {
  const distance = distanceKm(activity)
  const elevation = Number(activity?.elevationGain)
  return distance && Number.isFinite(elevation) && elevation >= 0
    ? elevation / distance
    : null
}

export function cyclingEfficiency(activity) {
  const speed = cyclingSpeedKmh(activity)
  const averageHeartRate = heartRate(activity)
  return speed && averageHeartRate ? (speed / averageHeartRate) * 100 : null
}

function validDate(activity) {
  const date = new Date(activity?.startTimeLocal)
  return Number.isNaN(date.getTime()) ? null : date
}

export function analyzeCyclingActivities(activities) {
  const ordered = activities
    .filter((activity) => validDate(activity))
    .sort((first, second) => validDate(second) - validDate(first))
  const latest = ordered[0]
  if (!latest) return null

  const latestDate = validDate(latest)
  const cutoff = new Date(latestDate)
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const allPrevious = ordered.slice(1)
  const recentPrevious = allPrevious.filter((activity) => validDate(activity) >= cutoff)
  const historical = recentPrevious.length >= 5 ? recentPrevious : allPrevious

  const latestSpeed = cyclingSpeedKmh(latest)
  const latestHeartRate = heartRate(latest)
  const latestDistance = distanceKm(latest)
  const latestElevationRate = elevationPerKm(latest)

  const sameSpeed = latestSpeed
    ? historical.filter((activity) => {
        const speed = cyclingSpeedKmh(activity)
        return speed
          && heartRate(activity)
          && Math.abs(speed - latestSpeed) / latestSpeed <= 0.05
      })
    : []
  const sameHeartRate = latestHeartRate
    ? historical.filter((activity) => {
        const averageHeartRate = heartRate(activity)
        return averageHeartRate
          && cyclingSpeedKmh(activity)
          && Math.abs(averageHeartRate - latestHeartRate) <= 5
      })
    : []
  const sameDistance = latestDistance
    ? historical.filter((activity) => {
        const distance = distanceKm(activity)
        return distance
          && cyclingSpeedKmh(activity)
          && Math.abs(distance - latestDistance) / latestDistance <= 0.1
      })
    : []
  const terrainTolerance = latestElevationRate == null
    ? null
    : Math.max(5, latestElevationRate * 0.2)
  const sameTerrain = terrainTolerance == null
    ? []
    : historical.filter((activity) => {
        const elevationRate = elevationPerKm(activity)
        return elevationRate != null
          && cyclingSpeedKmh(activity)
          && Math.abs(elevationRate - latestElevationRate) <= terrainTolerance
      })
  const efficiencyRides = historical.filter(
    (activity) => Number.isFinite(cyclingEfficiency(activity)),
  )

  return {
    latest,
    allPrevious,
    historical,
    usedRecentWindow: recentPrevious.length >= 5,
    latestSpeed,
    latestHeartRate,
    latestDistance,
    latestElevationRate,
    terrainTolerance,
    sameSpeed,
    sameHeartRate,
    sameDistance,
    sameTerrain,
    efficiencyRides,
    speedReferenceHeartRate: median(sameSpeed.map(heartRate)),
    heartRateReferenceSpeed: median(sameHeartRate.map(cyclingSpeedKmh)),
    distanceReferenceSpeed: median(sameDistance.map(cyclingSpeedKmh)),
    terrainReferenceSpeed: median(sameTerrain.map(cyclingSpeedKmh)),
    latestEfficiency: cyclingEfficiency(latest),
    efficiencyReference: median(efficiencyRides.map(cyclingEfficiency)),
  }
}
