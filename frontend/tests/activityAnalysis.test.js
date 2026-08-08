import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activitiesOfType,
  analyzeCombinedActivities,
} from '../src/domain/activityAnalysis.js'

function activity(id, type, day, duration, distance, zones = []) {
  return {
    activityId: id,
    activityType: type,
    startTimeLocal: `${day}T08:00:00`,
    duration,
    km: distance,
    heartRateZones: zones.map((seconds, index) => ({ zone: index + 1, seconds })),
  }
}

test('combined dashboard aggregates running and cycling heart-rate zones', () => {
  const activities = [
    activity(1, 'running', '2026-08-06', 1800, 5, [60, 600, 600, 480, 60]),
    activity(2, 'cycling', '2026-08-05', 3600, 25, [300, 1200, 1200, 720, 180]),
    activity(3, 'cycling', '2026-06-01', 4000, 30, [100, 100, 100, 100, 100]),
  ]

  const result = analyzeCombinedActivities(
    activities,
    { amount: 1, unit: 'week' },
    new Date('2026-08-07T12:00:00'),
  )

  assert.equal(result.activityCount, 2)
  assert.equal(result.sport.running.count, 1)
  assert.equal(result.sport.cycling.count, 1)
  assert.equal(result.trackedActivities, 2)
  assert.equal(result.zones[1].seconds, 1800)
  assert.equal(result.history.length, 7)
})

test('legacy activities remain classified as running', () => {
  const activities = [activity(1, undefined, '2026-08-06', 1800, 5)]
  assert.equal(activitiesOfType(activities, 'running').length, 1)
  assert.equal(activitiesOfType(activities, 'cycling').length, 0)
})

test('zone history column count follows the selected period', () => {
  const now = new Date('2026-08-07T12:00:00')
  const activities = [
    activity(1, 'running', '2026-08-06', 1800, 5, [60, 600, 600, 480, 60]),
  ]

  assert.equal(analyzeCombinedActivities(activities, { amount: 2, unit: 'week' }, now).history.length, 2)
  assert.equal(analyzeCombinedActivities(activities, { amount: 5, unit: 'month' }, now).history.length, 5)
  assert.equal(analyzeCombinedActivities(activities, { amount: 3, unit: 'year' }, now).history.length, 3)
  assert.equal(analyzeCombinedActivities(activities, { amount: 1, unit: 'week' }, now).history.length, 7)
  assert.equal(analyzeCombinedActivities(activities, { amount: 1, unit: 'month' }, now).history.length, 5)
  assert.equal(analyzeCombinedActivities(activities, { amount: 1, unit: 'year' }, now).history.length, 12)
})
