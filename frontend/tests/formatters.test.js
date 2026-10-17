import assert from 'node:assert/strict'
import test from 'node:test'

import { formatRelativeDate } from '../src/utils/formatters.js'

test('relative dates use local calendar days', () => {
  const now = new Date('2026-10-17T18:00:00')

  assert.equal(formatRelativeDate('2026-10-17T08:00:00', now), 'Oggi')
  assert.equal(formatRelativeDate('2026-10-16T23:59:00', now), 'Ieri')
  assert.equal(formatRelativeDate('2026-10-14T08:00:00', now), '3 giorni fa')
})
