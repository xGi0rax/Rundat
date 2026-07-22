# Rundat

## Avvio locale

### Backend

```powershell
cd backend
..\.venv\Scripts\uvicorn.exe main:app --reload
```

La documentazione interattiva è disponibile su `http://127.0.0.1:8000/docs`.

Endpoint disponibili:

- `GET /api/activities`: elenco delle attività validate;
- `GET /api/pbs`: record personali per distanza;
- `GET /api/dashboard`: riepilogo aggregato della dashboard.
- `POST /api/sync/csv`: importazione incrementale del CSV;
- `POST /api/sync/garmin`: sincronizzazione incrementale da Garmin Connect;
- `GET /api/sync/history`: storico delle ultime sincronizzazioni.

Il CSV viene cercato in `backend/running_activities_FULL.csv`, indipendentemente
dalla directory da cui viene avviata l'applicazione.

I dati applicativi vengono salvati in `backend/rundat.db`. Al primo avvio il CSV
esistente viene importato automaticamente. Gli import successivi usano
`activityId` come chiave univoca e inseriscono, aggiornano o ignorano le attività
senza creare duplicati. Il percorso del database può essere sovrascritto con la
variabile d'ambiente `RUNDAT_DB_PATH`.

### Test backend

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

### Frontend

```powershell
cd frontend
npm run dev
```
