const predictionDistances = [
  { key: '5k', label: '5 km', distanceKm: 5, color: '#345f9d' },
  { key: '10k', label: '10 km', distanceKm: 10, color: '#2f9d50' },
  { key: 'halfMarathon', label: 'Mezza maratona', distanceKm: 21.0975, color: '#e57a32' },
  { key: 'marathon', label: 'Maratona', distanceKm: 42.195, color: '#c73636' },
]

// Gestisce race prediction distance.
export function racePredictionDistances() {
  return predictionDistances
}
