const shortDate = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' })
const longDate = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })

// Gestisce format date.
export function formatDate(value, style = 'long') {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return (style === 'short' ? shortDate : longDate).format(date)
}

// Gestisce format relative date.
export function formatRelativeDate(value, now = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const dateStart = new Date(date)
  dateStart.setHours(0, 0, 0, 0)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const daysAgo = Math.round((todayStart - dateStart) / 86400000)

  if (daysAgo === 0) return 'Oggi'
  if (daysAgo === 1) return 'Ieri'
  if (daysAgo > 1) return `${daysAgo} giorni fa`
  if (daysAgo === -1) return 'Domani'
  return `Tra ${Math.abs(daysAgo)} giorni`
}

// Gestisce format distance.
export function formatDistance(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}

// Gestisce format heart rate.
export function formatHeartRate(value) {
  if (value == null || Number.isNaN(Number(value))) return 'FC —'
  return `${Math.round(Number(value))} bpm`
}

// Gestisce format duration.
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const total = Math.round(Number(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainingSeconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

// Gestisce format pace decimal.
export function formatPaceDecimal(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const totalSeconds = Math.round(Number(value) * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
