import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzePerformance } from '../src/domain/performanceAnalysis.js'

test('performance analysis aggregates load, intensity and sport balance', () => {
  const result = analyzePerformance([
    {
      activityType: 'running',
      startTimeLocal: '2026-10-28T08:00:00',
      km: 10,
      distance: 10000,
      duration: 3000,
      averageSpeed: 3.33,
      averageHR: 145,
      elevationGain: 120,
      heartRateZones: [
        { zone: 2, seconds: 1800 },
        { zone: 4, seconds: 1200 },
      ],
    },
    {
      activityType: 'cycling',
      startTimeLocal: '2026-10-27T08:00:00',
      km: 30,
      distance: 30000,
      duration: 3600,
      averageSpeed: 8.33,
      averageHR: 130,
      elevationGain: 300,
      heartRateZones: [{ zone: 2, seconds: 3600 }],
    },
  ])

  assert.equal(result.buckets.length, 12)
  assert.ok(result.summary.totalLoad > 0)
  assert.equal(result.summary.activeDays, 2)
  assert.equal(result.summary.runLoadShare, 54)
  assert.equal(result.summary.consecutiveActiveWeeks, 1)
  assert.equal(result.summary.inactiveWeeks, 11)
  assert.equal(result.summary.runningActivities, 1)
  assert.equal(result.summary.cyclingActivities, 1)
  assert.equal(result.summary.dataQuality.heartRate, 100)
  assert.equal(result.summary.dataQuality.zones, 100)
  assert.equal(result.summary.dataQuality.elevation, 100)
  assert.ok(result.buckets.at(-1).monotony > 0)
  assert.ok(result.buckets.at(-1).strain > 0)
  assert.equal(result.buckets.at(-1).distanceKm, 40)
  assert.equal(result.buckets.at(-1).hardShare, 18)
})
