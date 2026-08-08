import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePeriod,
  periodAmountLimit,
  periodRange,
} from '../src/domain/periods.js'

const activities = [
  { startTimeLocal: '2021-04-10T08:00:00' },
  { startTimeLocal: '2025-01-02T08:00:00' },
]

test('period limits are coherent with unit and first activity year', () => {
  const now = new Date('2026-08-08T12:00:00')
  assert.equal(periodAmountLimit('week', activities, now), 12)
  assert.equal(periodAmountLimit('month', activities, now), 12)
  assert.equal(periodAmountLimit('year', activities, now), 6)
  assert.deepEqual(normalizePeriod({ amount: 20, unit: 'year' }, activities, now), {
    amount: 6,
    unit: 'year',
  })
})

test('period ranges support calendar weeks, months and years', () => {
  const now = new Date('2026-08-08T12:00:00')
  const fiveWeeks = periodRange({ amount: 5, unit: 'week' }, 0, now).start
  const twoMonths = periodRange({ amount: 2, unit: 'month' }, 0, now).start
  assert.deepEqual(
    [fiveWeeks.getFullYear(), fiveWeeks.getMonth(), fiveWeeks.getDate()],
    [2026, 6, 4],
  )
  assert.deepEqual(
    [twoMonths.getFullYear(), twoMonths.getMonth(), twoMonths.getDate()],
    [2026, 5, 8],
  )
})
