# Rundat

Dashboard personale per importare attività di corsa da CSV o Garmin Connect e
analizzare volume, passo, frequenza cardiaca, record e trend.

## Architettura

- `backend/main.py`: API FastAPI e lifecycle applicativo;
- `backend/domain/`: regole pure di normalizzazione e calcolo;
- `backend/services/`: casi d'uso, sincronizzazione e repository SQLite;
- `backend/infrastructure/`: integrazione Garmin Connect;
- `frontend/src/services/`: accesso all'API;
- `frontend/src/domain/`: analisi statistiche testabili senza React;
- `frontend/src/components/`: pagine e componenti di presentazione.

In locale i dati rimangono in `backend/rundat.db`. In produzione Rundat usa
PostgreSQL/Supabase; credenziali e token Garmin restano server-side e sono
esclusi da Git.

## Pubblicazione personale

Il repository è predisposto per una singola distribuzione Vercel contenente
frontend Vite e API FastAPI, con persistenza su Supabase PostgreSQL, accesso
personale tramite token e installazione PWA su iPhone.

La procedura completa è in [DEPLOYMENT.md](DEPLOYMENT.md).

## Avvio locale

### Backend

```powershell
Copy-Item backend\.env.example backend\.env
# Compilare GARMIN_EMAIL e GARMIN_PASSWORD solo se si usa la sincronizzazione Garmin.
.\.venv\Scripts\uvicorn.exe main:app --app-dir backend --reload
```

API: `http://127.0.0.1:8000`; documentazione: `/docs`; health check:
`GET /api/health`.

Il CSV predefinito è `backend/running_activities_FULL.csv`. `activityId` è la
chiave univoca degli import incrementali. Il database può essere spostato con
`RUNDAT_DB_PATH`; le origini CORS si configurano, separate da virgola, con
`RUNDAT_CORS_ORIGINS`.

Se `DATABASE_URL` è configurata, il backend utilizza PostgreSQL al posto di
SQLite. `RUNDAT_ACCESS_TOKEN` abilita la protezione Bearer dell'API ed è
obbligatoria su Vercel.

### Frontend

```powershell
Set-Location frontend
npm ci
npm run dev
```

In sviluppo Vite inoltra `/api` al backend locale. In produzione il frontend usa
la stessa origine; impostare `VITE_API_URL` solo quando l'API è pubblicata su
un'origine diversa.

## Verifiche prima del rilascio

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
.\.venv\Scripts\python.exe -m compileall -q backend

Set-Location frontend
npm ci
npm run check
```

## Endpoint

- `GET /api/health`
- `GET /api/activities`
- `GET /api/pbs`
- `GET /api/pbs/history`
- `GET /api/dashboard`
- `POST /api/sync/csv`
- `POST /api/sync/garmin`
- `GET /api/sync/history`

## Nota di sicurezza

Rundat contiene dati sanitari/personali. In produzione utilizzare un
`RUNDAT_ACCESS_TOKEN` lungo e casuale, non esporre `DATABASE_URL` o credenziali
Garmin nel frontend e mantenere attiva la Row Level Security predisposta dallo
schema Supabase.
