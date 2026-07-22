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

Il CSV viene cercato in `backend/running_activities_FULL.csv`, indipendentemente
dalla directory da cui viene avviata l'applicazione.

### Test backend

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

### Frontend

```powershell
cd frontend
npm run dev
```
