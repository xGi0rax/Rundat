export const PERIOD_UNITS = [
  { value: 'week', singular: 'Settimana', plural: 'Settimane' },
  { value: 'month', singular: 'Mese', plural: 'Mesi' },
  { value: 'year', singular: 'Anno', plural: 'Anni' },
]

// Gestisce period amount limit.
export function periodAmountLimit(unit, activities = [], now = new Date()) {
  if (unit !== 'year') return 12
  const years = activities
    .map((activity) => new Date(activity.startTimeLocal))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => date.getFullYear())
  const firstYear = years.length ? Math.min(...years) : now.getFullYear()
  return Math.max(1, now.getFullYear() - firstYear + 1)
}

// Gestisce normalize period.
export function normalizePeriod(period, activities = [], now = new Date()) {
  const unit = PERIOD_UNITS.some((option) => option.value === period?.unit)
    ? period.unit
    : 'week'
  const limit = periodAmountLimit(unit, activities, now)
  const amount = Math.min(limit, Math.max(1, Math.round(Number(period?.amount) || 1)))
  return { amount, unit }
}

// Gestisce days in month.
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// Gestisce shift period.
export function shiftPeriod(date, period, multiplier = 1) {
  const result = new Date(date)
  const amount = Number(period.amount) * multiplier
  if (period.unit === 'week') {
    result.setDate(result.getDate() + (amount * 7))
    return result
  }
  const originalDay = result.getDate()
  const monthShift = period.unit === 'year' ? amount * 12 : amount
  const targetMonth = result.getMonth() + monthShift
  const targetYear = result.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  result.setFullYear(targetYear, normalizedMonth, Math.min(
    originalDay,
    daysInMonth(targetYear, normalizedMonth),
  ))
  return result
}

// Gestisce period start.
export function periodStart(period, now = new Date()) {
  const start = shiftPeriod(now, period, -1)
  start.setHours(0, 0, 0, 0)
  return start
}

// Gestisce period range.
export function periodRange(period, offset = 0, now = new Date()) {
  if (offset === 0) return { start: periodStart(period, now), end: new Date(now) }
  const endBoundary = shiftPeriod(now, period, -offset)
  endBoundary.setHours(0, 0, 0, 0)
  const start = shiftPeriod(endBoundary, period, -1)
  const end = new Date(endBoundary.getTime() - 1)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// Gestisce period label.
export function periodLabel(period) {
  const definition = PERIOD_UNITS.find((option) => option.value === period.unit)
    ?? PERIOD_UNITS[0]
  return `${period.amount} ${period.amount === 1 ? definition.singular.toLowerCase() : definition.plural.toLowerCase()}`
}
