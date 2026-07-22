from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from data_processor import get_activity_summaries, get_dashboard_summary, get_personal_bests
from schemas import ActivitySummary, DashboardSummary, PersonalBest

app = FastAPI(title="Rundat API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/activities", response_model=list[ActivitySummary])
def get_activities():
    try:
        data = get_activity_summaries()
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Errore: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pbs", response_model=dict[str, PersonalBest])
def get_pbs():
    try:
        data = get_personal_bests()
        return data
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Errore: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/dashboard", response_model=DashboardSummary)
def get_dashboard():
    try:
        return get_dashboard_summary()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Errore: {e}")
        raise HTTPException(status_code=500, detail=str(e))
