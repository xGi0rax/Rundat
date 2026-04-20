import streamlit as st
import pandas as pd
import plotly.express as px

# 1. Configurazione della pagina
st.set_page_config(page_title="Garmin Stats", layout="wide")

# 2. Titolo e stile
st.title("🏃 My Garmin Dashboard")
st.sidebar.header("Impostazioni")

# 3. Caricamento Dati (Usiamo il CSV che hai già creato)
@st.cache_data  # Fondamentale: evita di rileggere il file ogni secondo
def load_data():
    df = pd.read_csv("running_activities_FULL.csv")
    df['startTimeLocal'] = pd.to_datetime(df['startTimeLocal'])
    # Piccola pulizia: trasformiamo metri in km
    df['km'] = (df['distance'] / 1000).round(2)
    return df

df = load_data()

# 4. Filtro Interattivo nella Sidebar
anni = df['startTimeLocal'].dt.year.unique()
anno_scelto = st.sidebar.selectbox("Seleziona Anno", sorted(anni, reverse=True))

df_filtrato = df[df['startTimeLocal'].dt.year == anno_scelto]

# 5. Visualizzazione Metriche
col1, col2, col3 = st.columns(3)
col1.metric("Totale KM", f"{df_filtrato['km'].sum():.1f}")
col2.metric("N. Corse", len(df_filtrato))
col3.metric("VO2 Max Medio", f"{df_filtrato['vO2MaxValue'].mean():.1f}")

# 6. Grafico Plotly
st.subheader(f"Analisi Distanza nel {anno_scelto}")
fig = px.bar(df_filtrato, x='startTimeLocal', y='km', template="plotly_dark")
st.plotly_chart(fig, width='stretch')