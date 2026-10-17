// Gestisce distance km.
export function distanceKm(activity) {
  const km = Number(activity?.km)
  if (Number.isFinite(km)) return km
  const metres = Number(activity?.distance)
  return Number.isFinite(metres) ? metres / 1000 : null
}

// Gestisce pace minutes.
export function paceMinutes(activity) {
  const pace = Number(activity?.paceDecimal)
  if (Number.isFinite(pace) && pace > 0) return pace
  const distance = distanceKm(activity)
  const duration = Number(activity?.duration)
  return Number.isFinite(distance) && distance > 0 && Number.isFinite(duration)
    ? (duration / 60) / distance
    : null
}

// Gestisce heart rate.
export function heartRate(activity) {
  const value = Number(activity?.averageHR)
  return Number.isFinite(value) && value > 0 ? value : null
}

// Gestisce max average heart rate ratio.
function maxAverageHeartRateRatio(activity) {
  const averageHeartRate = heartRate(activity)
  const maximumHeartRate = Number(activity?.maxHR)
  if (
    !averageHeartRate
    || !Number.isFinite(maximumHeartRate)
    || maximumHeartRate <= 0
    || maximumHeartRate < averageHeartRate
  ) return null
  return maximumHeartRate / averageHeartRate
}

// Gestisce median.
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

// Gestisce average.
function average(values) {
  const valid = values.filter(Number.isFinite)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

// Gestisce standard deviation.
function standardDeviation(values) {
  const valid = values.filter(Number.isFinite)
  const mean = average(valid)
  if (valid.length < 2 || mean == null) return null
  return Math.sqrt(
    valid.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / valid.length,
  )
}

// Gestisce solve linear system.
function solveLinearSystem(matrix, vector) {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])

  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-9) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]

    const divisor = augmented[column][column]
    for (let index = column; index <= size; index += 1) {
      augmented[column][index] /= divisor
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index]
      }
    }
  }

  return augmented.map((row) => row[size])
}

// Gestisce fit regression.
function fitRegression(rows, targetKey, predictorKeys) {
  const valid = rows.filter((row) => (
    Number.isFinite(row[targetKey])
    && predictorKeys.every((key) => Number.isFinite(row[key]))
  ))
  if (valid.length < Math.max(6, predictorKeys.length + 3)) return null

  const means = Object.fromEntries(
    predictorKeys.map((key) => [key, average(valid.map((row) => row[key]))]),
  )
  const deviations = Object.fromEntries(
    predictorKeys.map((key) => [
      key,
      standardDeviation(valid.map((row) => row[key])) || 1,
    ]),
  )
  const features = valid.map((row) => [
    1,
    ...predictorKeys.map((key) => (row[key] - means[key]) / deviations[key]),
  ])
  const size = predictorKeys.length + 1
  const matrix = Array.from({ length: size }, () => Array(size).fill(0))
  const vector = Array(size).fill(0)

  features.forEach((feature, rowIndex) => {
    for (let first = 0; first < size; first += 1) {
      vector[first] += feature[first] * valid[rowIndex][targetKey]
      for (let second = 0; second < size; second += 1) {
        matrix[first][second] += feature[first] * feature[second]
      }
    }
  })
  for (let index = 1; index < size; index += 1) matrix[index][index] += 1e-6
  const coefficients = solveLinearSystem(matrix, vector)
  if (!coefficients) return null

  // Gestisce predict.
  const predict = (row) => coefficients.reduce((sum, coefficient, index) => (
    index === 0
      ? sum + coefficient
      : sum + coefficient
        * ((row[predictorKeys[index - 1]] - means[predictorKeys[index - 1]])
          / deviations[predictorKeys[index - 1]])
  ), 0)
  const residuals = valid.map((row) => row[targetKey] - predict(row))

  return {
    count: valid.length,
    predict,
    rmse: Math.sqrt(residuals.reduce((sum, value) => sum + (value ** 2), 0) / valid.length),
  }
}

// Gestisce percentile rank.
function percentileRank(values, current, higherIsBetter = true) {
  const valid = values.filter(Number.isFinite)
  if (!valid.length || !Number.isFinite(current)) return null
  const notBetter = valid.filter((value) => (
    higherIsBetter ? value <= current : value >= current
  )).length
  return (notBetter / valid.length) * 100
}

// Gestisce activity training load.
function activityTrainingLoad(activity, observedMaxHeartRate) {
  const hr = heartRate(activity)
  const durationMinutes = Number(activity.duration) / 60
  if (!hr || !Number.isFinite(durationMinutes) || !observedMaxHeartRate) return null
  return durationMinutes * ((hr / observedMaxHeartRate) ** 2)
}

// Gestisce cardiac cost per km.
function cardiacCostPerKm(activity) {
  const hr = heartRate(activity)
  const distance = distanceKm(activity)
  const durationMinutes = Number(activity.duration) / 60
  if (!hr || !distance || !Number.isFinite(durationMinutes)) return null
  return (hr * durationMinutes) / distance
}

export const HEART_RATE_ZONE_COLORS = ['#a9b8ad', '#4f7d5c', '#d3a83f', '#e57a32', '#b84b3a']

// Gestisce heart rate zone summary.
export function heartRateZoneSummary(activity) {
  const source = Array.isArray(activity?.heartRateZones) ? activity.heartRateZones : []
  const byZone = new Map(
    source.map((zone) => [Number(zone.zone), Math.max(0, Number(zone.seconds) || 0)]),
  )
  const zones = Array.from({ length: 5 }, (_value, index) => ({
    zone: index + 1,
    seconds: byZone.get(index + 1) || 0,
  }))
  const totalSeconds = zones.reduce((sum, zone) => sum + zone.seconds, 0)
  if (!totalSeconds) return null
  zones.forEach((zone) => {
    zone.percentage = (zone.seconds / totalSeconds) * 100
  })
  return {
    zones,
    totalSeconds,
    easyShare: zones[0].percentage + zones[1].percentage,
    hardShare: zones[3].percentage + zones[4].percentage,
    dominant: zones.reduce(
      (largest, zone) => (zone.seconds > largest.seconds ? zone : largest),
      zones[0],
    ),
  }
}

// Gestisce aerobic efficiency.
function aerobicEfficiency(activity) {
  const pace = paceMinutes(activity)
  const hr = heartRate(activity)
  if (!pace || !hr) return null
  const speedKmh = 60 / pace
  return (speedKmh / hr) * 100
}

// Gestisce confidence for.
export function confidenceFor(count) {
  if (count >= 8) return { label: 'Affidabilità alta', className: 'high' }
  if (count >= 4) return { label: 'Affidabilità media', className: 'medium' }
  return { label: 'Affidabilità indicativa', className: 'low' }
}

// Gestisce comparison status.
export function comparisonStatus(latestValue, referenceValue, lowerIsBetter) {
  if (!Number.isFinite(latestValue) || !Number.isFinite(referenceValue) || referenceValue === 0) {
    return null
  }
  const difference = latestValue - referenceValue
  const percent = (difference / Math.abs(referenceValue)) * 100
  const improvement = lowerIsBetter ? -percent : percent
  if (Math.abs(improvement) < 1) {
    return { tone: 'stable', label: 'In linea', improvement, difference }
  }
  return {
    tone: improvement > 0 ? 'positive' : 'negative',
    label: improvement > 0 ? 'Meglio' : 'Peggio',
    improvement,
    difference,
  }
}

// Gestisce analyze dashboard.
export function analyzeDashboard(activities) {
  const ordered = [...activities].sort(
    (first, second) => new Date(second.startTimeLocal) - new Date(first.startTimeLocal),
  )
  const latest = ordered[0]
  if (!latest) return null

  const latestDate = new Date(latest.startTimeLocal)
  const cutoff = new Date(latestDate)
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const allPrevious = ordered.slice(1)
  const recentPrevious = allPrevious.filter(
    (activity) => new Date(activity.startTimeLocal) >= cutoff,
  )
  const historical = recentPrevious.length >= 5 ? recentPrevious : allPrevious
  const latestPace = paceMinutes(latest)
  const latestHr = heartRate(latest)
  const latestDistance = distanceKm(latest)

  const samePace = latestPace
    ? historical.filter((activity) => {
        const pace = paceMinutes(activity)
        return pace && heartRate(activity) && Math.abs(pace - latestPace) / latestPace <= 0.05
      })
    : []
  const sameHeartRate = latestHr
    ? historical.filter((activity) => {
        const hr = heartRate(activity)
        return hr && paceMinutes(activity) && Math.abs(hr - latestHr) <= 5
      })
    : []
  const distanceTolerance = latestDistance ? latestDistance * 0.1 : null
  const sameDistance = latestDistance
    ? historical.filter((activity) => {
        const distance = distanceKm(activity)
        return distance != null
          && paceMinutes(activity)
          && Math.abs(distance - latestDistance) <= distanceTolerance
      })
    : []
  const efficiencyRuns = historical.filter(
    (activity) => Number.isFinite(aerobicEfficiency(activity)),
  )
  const modelRows = historical.map((activity) => ({
    distance: distanceKm(activity),
    pace: paceMinutes(activity),
    heartRate: heartRate(activity),
  }))
  const heartRateModel = fitRegression(modelRows, 'heartRate', ['pace', 'distance'])
  const paceModel = fitRegression(modelRows, 'pace', ['heartRate', 'distance'])
  const latestModelRow = {
    distance: latestDistance,
    pace: latestPace,
    heartRate: latestHr,
  }
  const expectedHeartRate = heartRateModel && latestPace && latestDistance
    ? heartRateModel.predict(latestModelRow)
    : null
  const expectedPace = paceModel && latestHr && latestDistance
    ? paceModel.predict(latestModelRow)
    : null
  const exceptionalSignals = []
  if (expectedHeartRate != null && latestHr != null && heartRateModel.rmse > 0) {
    exceptionalSignals.push((expectedHeartRate - latestHr) / heartRateModel.rmse)
  }
  if (expectedPace != null && latestPace != null && paceModel.rmse > 0) {
    exceptionalSignals.push((expectedPace - latestPace) / paceModel.rmse)
  }
  const exceptionality = average(exceptionalSignals)

  const comparableEfficiencies = sameDistance.map(aerobicEfficiency).filter(Number.isFinite)
  const latestEfficiency = aerobicEfficiency(latest)
  const performancePercentile = comparableEfficiencies.length >= 3 && latestEfficiency != null
    ? percentileRank(comparableEfficiencies, latestEfficiency, true)
    : percentileRank(sameDistance.map(paceMinutes), latestPace, false)
  const percentileBasis = comparableEfficiencies.length >= 3
    ? 'efficienza aerobica su distanza simile'
    : 'passo su distanza simile'

  const bestComparable = sameDistance
    .filter((activity) => paceMinutes(activity))
    .sort((first, second) => paceMinutes(first) - paceMinutes(second))[0] ?? null
  const bestComparablePace = bestComparable ? paceMinutes(bestComparable) : null

  const observedMaxHeartRate = Math.max(
    0,
    ...ordered
      .map((activity) => Number(activity.maxHR))
      .filter((value) => Number.isFinite(value) && value > 0),
  )
  const latestLoad = activityTrainingLoad(latest, observedMaxHeartRate)
  const historicalLoads = historical
    .map((activity) => activityTrainingLoad(activity, observedMaxHeartRate))
    .filter(Number.isFinite)
  const loadReference = median(historicalLoads)
  const latestHeartRateRatio = maxAverageHeartRateRatio(latest)
  const historicalHeartRateRatios = historical
    .map(maxAverageHeartRateRatio)
    .filter(Number.isFinite)
  const heartRateRatioReference = median(historicalHeartRateRatios)

  const latestCardiacCost = cardiacCostPerKm(latest)
  const comparableCardiacCosts = sameDistance.map(cardiacCostPerKm).filter(Number.isFinite)
  const cardiacCostReference = median(comparableCardiacCosts)

  const millisecondsPerDay = 86400000
  const previous28Days = allPrevious.filter((activity) => {
    const daysBefore = (latestDate - new Date(activity.startTimeLocal)) / millisecondsPerDay
    return daysBefore > 0 && daysBefore <= 28
  })
  const previous7Days = previous28Days.filter((activity) => (
    (latestDate - new Date(activity.startTimeLocal)) / millisecondsPerDay <= 7
  ))
  // Gestisce sum distance.
  const sumDistance = (items) => items.reduce(
    (sum, activity) => sum + (distanceKm(activity) || 0),
    0,
  )
  const recent7Distance = sumDistance(previous7Days)
  const weeklyDistanceBaseline = sumDistance(previous28Days) / 4
  const fatigueRatio = weeklyDistanceBaseline > 0
    ? recent7Distance / weeklyDistanceBaseline
    : null

  const comparablePaces = sameDistance.map(paceMinutes).filter(Number.isFinite)
  const regularPace = median(comparablePaces)
  const meanComparablePace = average(comparablePaces)
  const paceVariability = comparablePaces.length >= 2 && meanComparablePace
    ? (standardDeviation(comparablePaces) / meanComparablePace) * 100
    : null
  const regularityDifferenceSeconds = regularPace != null && latestPace != null
    ? (latestPace - regularPace) * 60
    : null

  return {
    latest,
    allPrevious,
    historical,
    latestPace,
    latestHr,
    latestDistance,
    samePace,
    sameHeartRate,
    sameDistance,
    efficiencyRuns,
    paceReferenceHr: median(samePace.map(heartRate)),
    heartRateReferencePace: median(sameHeartRate.map(paceMinutes)),
    distanceReferencePace: median(sameDistance.map(paceMinutes)),
    latestEfficiency,
    efficiencyReference: median(efficiencyRuns.map(aerobicEfficiency)),
    usedRecentWindow: recentPrevious.length >= 5,
    expectedHeartRate,
    expectedPace,
    heartRateModel,
    paceModel,
    exceptionality,
    performancePercentile,
    percentileBasis,
    bestComparable,
    bestComparablePace,
    latestLoad,
    loadReference,
    latestHeartRateRatio,
    heartRateRatioReference,
    heartRateRatioSampleCount: historicalHeartRateRatios.length,
    latestCardiacCost,
    cardiacCostReference,
    comparableCardiacCosts,
    recent7Distance,
    weeklyDistanceBaseline,
    fatigueRatio,
    paceVariability,
    regularityDifferenceSeconds,
    regularitySampleCount: comparablePaces.length,
  }
}
