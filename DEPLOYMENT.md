# Pubblicazione personale: Vercel + Supabase

Questa configurazione mantiene Rundat disponibile da iPhone senza un computer
acceso. Vercel ospita frontend e API FastAPI; Supabase conserva attività,
statistiche, storico e sessione Garmin.

## 1. Creare il progetto Supabase

1. Accedere a [Supabase](https://supabase.com/dashboard) e creare un progetto
   Free nella regione europea di Francoforte, vicina alla funzione Vercel
   configurata in `vercel.json`.
2. Conservare la password del database.
3. Aprire **SQL Editor**, creare una nuova query, incollare l'intero contenuto
   di `supabase/schema.sql` ed eseguirlo.
4. Aprire **Connect** e copiare la URI del **Transaction pooler**. Sostituire
   `[YOUR-PASSWORD]` con la password del database. Se contiene simboli riservati
   come `@`, `:`, `/` o `#`, codificarla come componente URL.

La connection string ottenuta sarà simile a:

```text
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Non usare la chiave `anon` come `DATABASE_URL` e non pubblicare questa stringa.

## 2. Migrare i dati già presenti

Aggiornare una sola volta l'ambiente Python locale:

```powershell
.\.venv\Scripts\python.exe -m pip install "psycopg[binary]==3.2.9"
```

Nella stessa finestra PowerShell impostare temporaneamente la connection string
e avviare la migrazione:

```powershell
$env:DATABASE_URL='INCOLLA_QUI_LA_TRANSACTION_POOLER_URI'
.\.venv\Scripts\python.exe scripts\migrate_sqlite_to_supabase.py
Remove-Item Env:DATABASE_URL
```

Lo script copia attività e zone cardiache
sessione Garmin. È idempotente: può essere rilanciato senza duplicare le corse.
Il database SQLite locale non viene modificato.

## 3. Pubblicare su Vercel

1. Caricare il repository su GitHub, GitLab o Bitbucket senza aggiungere
   `backend/.env`, `backend/rundat.db`, CSV o `.garminconnect`.
2. Accedere a [Vercel](https://vercel.com/new), importare il repository e lasciare
   la directory radice su `.`. `vercel.json` configura build e funzione Python.
3. In **Project Settings → Environment Variables** aggiungere le variabili
   seguenti per l'ambiente Production:

| Nome | Valore |
|---|---|
| `DATABASE_URL` | URI Transaction pooler di Supabase |
| `GARMIN_EMAIL` | Email Garmin Connect |
| `GARMIN_PASSWORD` | Password Garmin Connect |
| `RUNDAT_ACCESS_TOKEN` | Codice personale casuale di almeno 32 byte |

Per generare un codice sicuro in PowerShell:

```powershell
[Convert]::ToHexString(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
).ToLower()
```

Conservare il risultato in un password manager: verrà richiesto al primo accesso
da iPhone.

4. Avviare il deployment. Dopo ogni modifica futura sarà sufficiente un nuovo
   push sul branch collegato.

## 4. Verificare l'app

1. Aprire `https://NOME-PROGETTO.vercel.app/api/health`: deve rispondere con
   `{"status":"ok","authenticationRequired":true}`.
2. Aprire l'indirizzo principale e inserire `RUNDAT_ACCESS_TOKEN`.
3. Controllare che le attività migrate siano visibili.
4. Premere **Sincronizza Garmin** e verificare il messaggio con le attività
   inserite o aggiornate.
5. In Supabase, aprire **Table Editor → sync_runs** e controllare che l'ultima
   sincronizzazione sia `success`.

Se la prima sincronizzazione Garmin non riesce, verificare prima le variabili
Vercel. La sessione locale migrata evita normalmente un nuovo login e riduce il
rischio di limitazioni Garmin.

## 5. Installare Rundat su iPhone

1. Aprire l'URL Vercel in Safari.
2. Toccare **Condividi**.
3. Selezionare **Aggiungi alla schermata Home**.
4. Avviare Rundat dalla nuova icona e inserire il codice personale.

La PWA conserva nella cache del dispositivo le ultime risposte di lettura. Se la
rete non è disponibile, può quindi mostrare i dati già caricati; la
sincronizzazione Garmin richiede invece una connessione.

## Manutenzione e limiti gratuiti

- La sincronizzazione è incrementale e rilegge gli ultimi sette giorni per
  intercettare eventuali correzioni Garmin.
- Il piano Supabase Free può sospendere progetti con attività insufficiente per
  circa una settimana. In quel caso riattivare il progetto dal dashboard
  Supabase; la PWA continua a conservare l'ultima copia letta.
- Il filesystem di Vercel è temporaneo: non salvare database o token in `/tmp`
  aspettandosi che sopravvivano. Rundat salva i token nel database in forma
  privata e usa `/tmp` solo durante la richiesta.
- Se si cambia `RUNDAT_ACCESS_TOKEN`, uscire cancellando i dati del sito in
  Safari oppure reinstallare la PWA e inserire il nuovo codice.
