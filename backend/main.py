from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_FILE = "running_activities_FULL.csv"

@app.get("/api/activities")
def get_activities():
    try:
        if not os.path.exists(CSV_FILE):
            return {"errore": "CSV non trovato"}

        df = pd.read_csv(CSV_FILE)

        # 1. Pulizia minima
        df['startTimeLocal'] = pd.to_datetime(df['startTimeLocal'])
        df['km'] = (df['distance'].fillna(0) / 1000).round(2)
        
        # 2. Ordiniamo
        df = df.sort_values(by='startTimeLocal', ascending=False)

        # --- IL METODO INFALLIBILE ---
        # Usiamo to_json() di Pandas che gestisce i NaN trasformandoli in 'null'
        # Poi carichiamo quella stringa come oggetto Python da restituire
        json_string = df.to_json(orient="records", date_format="iso")
        return json.loads(json_string)

    except Exception as e:
        print(f"ERRORE: {e}")
        return {"errore_tecnico": str(e)}