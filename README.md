# SEP-AI (Early Sepsis Detection System)

This repository contains a Python backend using CatBoost for sepsis prediction and a React.js frontend dashboard.

## Backend

The Python service (`app.py`) exposes REST endpoints via Flask:

- `POST /predict` – send patient vitals JSON and receive prediction
- `POST /upload-data` – upload CSV/XLSX file for bulk prediction
- `POST /add-hourly-data` – (stub) add hourly vitals for admitted patient
- `GET /patients` – (stub) list admitted patients
- `GET /patient-history?id=<patient_id>` – (stub) history for a single patient

Install dependencies:

```powershell
pip install -r requirements.txt
# requirements.txt should include flask, flask-cors, pandas, numpy, catboost, openpyxl
```

Run:

```powershell
python app.py
```


## Frontend

The React dashboard lives in `frontend`.

Install dependencies with npm/yarn:

```bash
cd frontend
npm install
npm start
```

Available modules:

- Manual Prediction
- Patient Monitoring
- Upload Dataset
- Dashboard with risk status and charts

API base URL is assumed to be `http://localhost:5000`.

## Database

A PostgreSQL schema is provided in `database/schema.sql`. It defines tables for patients, hourly data and predictions.

Apply with:

```sql
psql -U <user> -d <db> -f database/schema.sql
```

## Notes

This scaffold is a starting point; database logic and authentication should be implemented as needed. The UI uses Bootstrap 5 and Chart.js.
