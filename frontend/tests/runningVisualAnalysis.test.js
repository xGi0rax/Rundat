import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addRollingEfficiency,
  buildRunningVisualData,
  runningEfficiency,
  runningTrainingLoad,
} from '../src/domain/runningVisualAnalysis.js'

function run(id, day, pace, averageHR, duration = 1800) {
  const distance = duration / 60 / pace
  return {
    activityId: id,
    startTimeLocal: `2026-07-${String(day).padStart(2, '0')}T08:00:00`,
    distance: distance * 1000,
    km: distance,
    duration,
    paceDecimal: pace,
    averageHR,
    maxHR: 180,
  }
}

test('running visual metrics calculate efficiency and relative cardiac load', () => {
  const activity = run(1, 10, 5, 150)

  assert.equal(runningEfficiency(activity), 8)
  assert.ok(Math.abs(runningTrainingLoad(activity, 180) - 20.8333) < 0.001)
})

test('running visual data is chronological and includes a rolling efficiency median', () => {
  const data = buildRunningVisualData([
    run(3, 14, 4, 150),
    run(1, 10, 5, 150),
    run(2, 12, 6, 150),
  ])
  const rolling = addRollingEfficiency(data, 2)

  assert.deepEqual(data.map((item) => item.activityId), [1, 2, 3])
  assert.equal(rolling[0].rollingEfficiency, 8)
  assert.equal(rolling[1].rollingEfficiency, (8 + (60 / 6 / 150 * 100)) / 2)
  assert.equal(rolling[2].rollingEfficiency, ((60 / 6 / 150 * 100) + 10) / 2)
})
