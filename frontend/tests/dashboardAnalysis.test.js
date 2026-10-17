import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeDashboard,
  comparisonStatus,
  heartRateZoneSummary,
  median,
  paceMinutes,
} from '../src/domain/dashboardAnalysis.js'
import { analyzeCombinedActivities } from '../src/domain/activityAnalysis.js'

function activity(id, day, distance, pace, averageHR, maxHR = averageHR + 15) {
  return {
    activityId: id,
    startTimeLocal: `2026-07-${String(day).padStart(2, '0')}T08:00:00`,
    distance: distance * 1000,
    km: distance,
    duration: distance * pace * 60,
    paceDecimal: pace,
    averageHR,
    maxHR,
  }
}

test('metric helpers handle fallbacks and comparison direction', () => {
  assert.equal(median([9, 1, 5, 3]), 4)
  assert.equal(paceMinutes({ distance: 5000, duration: 1500 }), 5)
  assert.equal(comparisonStatus(145, 150, true).tone, 'positive')
})

test('dashboard analysis builds personal models without mutating input order', () => {
  const activities = [
    activity(1, 10, 5, 5.5, 142),
    activity(2, 12, 6, 5.4, 144),
    activity(3, 14, 7, 5.3, 146),
    activity(4, 16, 8, 5.2, 148),
    activity(5, 18, 9, 5.1, 150),
    activity(6, 20, 10, 5.0, 152),
    activity(7, 22, 11, 4.9, 154),
    activity(8, 24, 10, 4.8, 151),
  ]
  const originalOrder = activities.map((item) => item.activityId)

  const analysis = analyzeDashboard(activities)

  assert.equal(analysis.latest.activityId, 8)
  assert.equal(analysis.historical.length, 7)
  assert.equal(analysis.heartRateModel.count, 7)
  assert.equal(analysis.paceModel.count, 7)
  assert.ok(Number.isFinite(analysis.expectedHeartRate))
  assert.deepEqual(activities.map((item) => item.activityId), originalOrder)
})

test('heart-rate zones are normalized into five percentage buckets', () => {
  const summary = heartRateZoneSummary({
    heartRateZones: [
      { zone: 1, seconds: 100 },
      { zone: 2, seconds: 300 },
    ],
  })

  assert.equal(summary.zones.length, 5)
  assert.equal(summary.zones[1].percentage, 75)
  assert.equal(summary.easyShare, 100)
})

test('combined daily heart-rate zones keep consecutive local dates separate', () => {
  const activities = [
    {
      activityId: 16,
      activityType: 'running',
      startTimeLocal: '2026-10-16T08:00:00',
      duration: 1800,
      distance: 5000,
      heartRateZones: [{ zone: 2, seconds: 600 }],
    },
    {
      activityId: 17,
      activityType: 'cycling',
      startTimeLocal: '2026-10-17T08:00:00',
      duration: 2400,
      distance: 12000,
      heartRateZones: [{ zone: 4, seconds: 900 }],
    },
  ]

  const analysis = analyzeCombinedActivities(
    activities,
    { amount: 1, unit: 'week' },
    new Date('2026-10-17T18:00:00'),
  )

  const day16 = analysis.history.find((bucket) => bucket.date === '2026-10-16')
  const day17 = analysis.history.find((bucket) => bucket.date === '2026-10-17')

  assert.equal(day16.z2, 10)
  assert.equal(day16.z4, 0)
  assert.equal(day17.z2, 0)
  assert.equal(day17.z4, 15)
})
