import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function App() {
  const [activities, setActivities] = useState([]);

  // 1. Chiamata al Backend
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/activities')
      .then(response => response.json())
      .then(data => {
        // Prendiamo solo le ultime 10 corse per il grafico
        const recentData = data.slice(0, 10).reverse();
        setActivities(recentData);
      })
      .catch(err => console.error("Errore nel recupero dati:", err));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1>🏃 Rundat Dashboard</h1>
      
      <div style={{ backgroundColor: '#2a2a2a', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3>Ultime 10 Corse (km)</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={activities}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="startTimeLocal" tickFormatter={(str) => str.split('T')[0]} stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#333', border: 'none', color: 'white' }}
                labelFormatter={(str) => `Data: ${str.split('T')[0]}`}
              />
              <Bar dataKey="km" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <table border="1" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#444' }}>
        <thead>
          <tr style={{ backgroundColor: '#333' }}>
            <th>Data</th>
            <th>Distanza (km)</th>
            <th>FC Media</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, i) => (
            <tr key={i} style={{ textAlign: 'center' }}>
              <td>{act.startTimeLocal.split('T')[0]}</td>
              <td>{act.km}</td>
              <td>{act.averageHR}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;