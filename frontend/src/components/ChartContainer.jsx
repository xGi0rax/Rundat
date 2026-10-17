import { ResponsiveContainer } from 'recharts'

const INITIAL_DIMENSION = { width: 1, height: 1 }

// Gestisce chart container.
function ChartContainer({ children }) {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={0}
      initialDimension={INITIAL_DIMENSION}
    >
      {children}
    </ResponsiveContainer>
  )
}

export default ChartContainer
