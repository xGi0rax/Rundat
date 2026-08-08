import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeCyclingActivities,
  cyclingSpeedKmh,
} from '../src/domain/cyclingAnalysis.js'

function ride(id, day, distance, speed, averageHR, elevationGain = 300) {
  return {
    activityId: id,
    activityType: 'cycling',
    startTimeLocal: `2026-07-${String(day).padStart(2, '0')}T08:00:00`,
    distance: distance * 1000,
    km: distance,
    duration: (distance / speed) * 3600,
    averageSpeed: speed / 3.6,
    averageHR,
    elevationGain,
  }
}

test('cycling speed supports Garmin speed and distance-duration fallback', () => {
  assert.equal(cyclingSpeedKmh({ averageSpeed: 10 }), 36)
  assert.equal(cyclingSpeedKmh({ distance: 20000, duration: 3600 }), 20)
})

test('cycling analysis compares the latest ride with similar historical rides', () => {
  const activities = [
    ride(1, 10, 40, 29, 141),
    ride(2, 12, 42, 31, 139),
    ride(3, 14, 38, 30, 145),
    ride(4, 16, 40, 25, 140),
    ride(5, 18, 60, 35, 160),
    ride(6, 20, 40, 30, 140),
  ]
  const originalOrder = activities.map((activity) => activity.activityId)

  const analysis = analyzeCyclingActivities(activities)

  assert.equal(analysis.latest.activityId, 6)
  assert.equal(analysis.sameSpeed.length, 3)
  assert.equal(analysis.speedReferenceHeartRate, 141)
  assert.equal(analysis.sameHeartRate.length, 4)
  assert.equal(analysis.heartRateReferenceSpeed, 29.5)
  assert.equal(analysis.sameDistance.length, 4)
  assert.equal(analysis.distanceReferenceSpeed, 29.5)
  assert.deepEqual(activities.map((activity) => activity.activityId), originalOrder)
})
