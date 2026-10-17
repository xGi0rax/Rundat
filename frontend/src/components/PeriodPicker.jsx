import {
  normalizePeriod,
  PERIOD_UNITS,
  periodAmountLimit,
  periodRange,
} from '../domain/periods.js'
import { formatDate } from '../utils/formatters.js'

// Gestisce period picker.
function PeriodPicker({
  value,
  onChange,
  activities,
  idPrefix,
  className = '',
  dateRange,
  referenceDate,
}) {
  const periodEnd = referenceDate ?? new Date()
  const normalized = normalizePeriod(value, activities, periodEnd)
  const limit = periodAmountLimit(normalized.unit, activities, periodEnd)
  const visibleRange = dateRange ?? periodRange(normalized, 0, periodEnd)

  return (
    <div className={`period-picker ${className}`.trim()}>
      <label htmlFor={`${idPrefix}-amount`}>
        <span>Numero</span>
        <select
          id={`${idPrefix}-amount`}
          value={normalized.amount}
          onChange={(event) => onChange({
            ...normalized,
            amount: Number(event.target.value),
          })}
        >
          {Array.from({ length: limit }, (_value, index) => index + 1).map((amount) => (
            <option key={amount} value={amount}>{amount}</option>
          ))}
        </select>
      </label>
      <label htmlFor={`${idPrefix}-unit`}>
        <span>Periodo</span>
        <select
          id={`${idPrefix}-unit`}
          value={normalized.unit}
          onChange={(event) => {
            const unit = event.target.value
            onChange({
              unit,
              amount: Math.min(
                normalized.amount,
                periodAmountLimit(unit, activities, periodEnd),
              ),
            })
          }}
        >
          {PERIOD_UNITS.map((option) => (
            <option key={option.value} value={option.value}>
              {normalized.amount === 1 ? option.singular : option.plural}
            </option>
          ))}
        </select>
      </label>
      <output className="period-picker-dates" aria-live="polite">
        <span>Intervallo</span>
        <strong>{formatDate(visibleRange.start)} – {formatDate(visibleRange.end)}</strong>
      </output>
    </div>
  )
}

export default PeriodPicker
