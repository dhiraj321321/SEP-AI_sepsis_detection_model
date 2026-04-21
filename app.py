from typing import Hashable, Any, Literal

import pandas as pd
import numpy as np
from catboost import CatBoostClassifier, Pool
from pandas import DataFrame, Series
from werkzeug.datastructures import FileStorage
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "catboost_model.cbm")

# Core configuration
MAX_DISPLAY = 0.90
EXPONENT = 0.20
THRESHOLD = 0.50

# OPTIMIZED FOR 8+ HOUR EARLY DETECTION
# Lead Time Mode Configuration
LEAD_TIME_MODE_ENABLED = True  # Enable 8+ hour detection optimization
EARLY_DETECTION_THRESHOLD = 0.30  # Lower threshold to detect earlier (6 hours earlier detection)
TREND_BASED_THRESHOLD = 0.25  # Ultra-early warning based on vital trends
MIN_CONFIDENCE_PROGRESSION_POINTS = 3  # Require at least 3 data points for trend analysis

# Vital sign deterioration weights (for trend-based detection)
DETERIORATION_WEIGHTS = {
    "HR": 0.15,        # Heart rate elevation is significant
    "Resp": 0.15,      # Respiratory rate elevation  
    "Temp": 0.15,      # Temperature changes
    "O2Sat": -0.20,    # Negative because decreasing is bad
    "MAP": -0.15,      # Negative because decreasing is bad
    "SBP": -0.15,      # Negative because decreasing is bad
}

def adjust_probability(p) -> float:
    exaggerated = p ** EXPONENT
    return min(exaggerated, MAX_DISPLAY)

print("Loading model...")
model = CatBoostClassifier()
model.load_model(MODEL_PATH)

model_features = model.feature_names_

# ========== DATA VALIDATION ==========
# Valid vital sign ranges (medical standards for adults)
VALID_VITAL_RANGES = {
    "HR": (40, 150),           # Heart Rate: 40-150 bpm
    "O2Sat": (70, 100),        # O2 Saturation: 70-100%
    "Temp": (35.0, 40.0),      # Temperature: 35-40°C
    "SBP": (70, 200),          # Systolic BP: 70-200 mmHg
    "MAP": (50, 130),          # Mean AP: 50-130 mmHg
    "DBP": (40, 120),          # Diastolic BP: 40-120 mmHg
    "Resp": (8, 40),           # Respiration: 8-40 breaths/min
    "Glucose": (40, 400),      # Blood Glucose: 40-400 mg/dL
}

# Reasonable defaults for missing patient demographic data
FEATURE_DEFAULTS = {
    "Age": 50,                  # Average adult age
    "Gender": 1,                # 0=Female, 1=Male (balanced)
    "Unit1": 0,                 # ICU unit encoding
    "Unit2": 0,
    "HospAdmTime": 0,          # Hours since admission (start = 0)
    "ICULOS": 0,               # ICU length of stay in hours (just admitted)
}

def validate_vital_signs(df: DataFrame) -> tuple[bool, list[str]]:
    """
    Validate vital signs are within realistic medical ranges.
    Returns: (is_valid: bool, errors: list of error messages)
    """
    errors = []
    for col, (min_val, max_val) in VALID_VITAL_RANGES.items():
        if col in df.columns:
            mask = (df[col] < min_val) | (df[col] > max_val)
            if mask.any():
                invalid_rows = df[mask]
                for idx, row in invalid_rows.iterrows():
                    errors.append(
                        f"{col}={row[col]:.1f} at row {idx} (expected {min_val}-{max_val})"
                    )
    return len(errors) == 0, errors

def fill_missing_features(df: DataFrame) -> DataFrame:
    """
    Fill missing demographic features with sensible defaults.
    This prevents model from getting zeros for critical patient information.
    """
    df = df.copy()
    
    # Check if user only provided vital signs (missing patient demographic data)
    has_patient_data = any(col in df.columns for col in ["Age", "Gender", "Glucose"])
    
    if not has_patient_data:
        # User entered only vital signs from web form - fill with medical defaults
        for feature, default_val in FEATURE_DEFAULTS.items():
            if feature not in df.columns:
                df[feature] = default_val
    
    # Fill any missing vital signs with midrange baseline
    for vital, (min_val, max_val) in list(VALID_VITAL_RANGES.items())[:7]:
        if vital not in df.columns:
            df[vital] = (min_val + max_val) / 2
    
    return df

def preprocess(df):
    """
    Enhanced preprocessing with validation and feature filling.
    """
    df = df.copy()
    
    # 1. Validate vital signs are realistic
    is_valid, validation_errors = validate_vital_signs(df)
    if validation_errors:
        print(f"⚠️  WARNING: {len(validation_errors)} vital sign anomalies detected")
    
    # 2. Fill missing demographic features
    df = fill_missing_features(df)
    
    # 3. Original preprocessing (rolling statistics) with ADAPTIVE window
    vital_cols: list[str] = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    window = min(10, max(2, len(df) - 1))  # Adaptive: use smaller window for short data
    
    for col in vital_cols:
        if col in df.columns:
            # Use min_periods to handle short datasets
            df[f"{col}_mean"] = df[col].rolling(window=window, min_periods=1).mean()
            df[f"{col}_max"] = df[col].rolling(window=window, min_periods=1).max()
            df[f"{col}_min"] = df[col].rolling(window=window, min_periods=1).min()
            df[f"{col}_trend"] = df[col] - df[col].shift(min(window, len(df) - 1))
    
    df = df.ffill().bfill().fillna(0)
    return df

def calculate_vital_deterioration_score(df: DataFrame) -> float:
    """
    Calculate how rapidly vitals are deteriorating (useful for early warning).
    Returns a score 0-1 where 1 = severe deterioration.
    """
    if len(df) < MIN_CONFIDENCE_PROGRESSION_POINTS:
        return 0.0
    
    vital_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    deterioration_score = 0.0
    count = 0
    
    for col in vital_cols:
        if col in df.columns:
            values = df[col].tail(10).values.astype(float)
            if len(values) >= 2:
                # Calculate rate of change
                diffs = np.diff(values)
                if col in ["O2Sat", "MAP", "SBP", "DBP"]:
                    # For these, decreasing is bad (negative derivative is bad)
                    rate_of_change = -np.mean(diffs) / (np.std(values) + 1e-6)
                else:
                    # For these (HR, Temp, Resp), increasing is bad
                    rate_of_change = np.mean(diffs) / (np.std(values) + 1e-6)
                
                weight = DETERIORATION_WEIGHTS.get(col, 0.0)
                deterioration_score += min(1.0, max(0.0, rate_of_change * weight))
                count += 1
    
    return min(1.0, deterioration_score / max(count, 1))

def analyze_confidence_progression(probs: list[float]) -> dict[str, Any]:
    """
    Analyze the confidence progression to detect if patient is trending toward sepsis.
    Returns dict with trend analysis results.
    """
    if len(probs) < MIN_CONFIDENCE_PROGRESSION_POINTS:
        return {"trend": "insufficient_data", "velocity": 0.0, "acceleration": 0.0}
    
    recent_probs = probs[-MIN_CONFIDENCE_PROGRESSION_POINTS:]
    
    # Calculate velocity (rate of confidence change)
    velocity = np.mean(np.diff(recent_probs))
    
    # Calculate acceleration (change in velocity)
    if len(probs) >= MIN_CONFIDENCE_PROGRESSION_POINTS + 1:
        older_probs = probs[-(MIN_CONFIDENCE_PROGRESSION_POINTS + 1):-1]
        older_velocity = np.mean(np.diff(older_probs))
        acceleration = velocity - older_velocity
    else:
        acceleration = 0.0
    
    # Determine trend
    if velocity > 0.05:  # Strong upward trend
        trend = "deteriorating"
    elif velocity > 0.01:  # Moderate upward trend
        trend = "slowly_deteriorating"
    elif velocity < -0.05:  # Strong downward trend
        trend = "improving"
    else:
        trend = "stable"
    
    return {
        "trend": trend,
        "velocity": float(velocity),
        "acceleration": float(acceleration),
        "recent_confidence": float(recent_probs[-1])
    }

def manual_input() -> DataFrame:
    print("\nEnter patient hourly data")
    print("Type 'done' when finished\n")
    rows = []
    hour = 1
    while True:
        val: str = input("Enter HR (or 'done'): ")
        if val == "done":
            break
        HR = float(val)
        O2Sat = float(input("O2Sat: "))
        Temp = float(input("Temp: "))
        SBP = float(input("SBP: "))
        MAP = float(input("MAP: "))
        DBP = float(input("DBP: "))
        Resp = float(input("Resp: "))
        rows.append({
            "Hour":hour,
            "HR":HR,
            "O2Sat":O2Sat,
            "Temp":Temp,
            "SBP":SBP,
            "MAP":MAP,
            "DBP":DBP,
            "Resp":Resp
        })
        hour += 1
    return pd.DataFrame(rows)

def file_input() -> DataFrame:
    path: str = input("\nEnter CSV or Excel file path: ")
    if path.endswith(".csv"):
        df: DataFrame = pd.read_csv(path)
    elif path.endswith(".xlsx"):
        df: DataFrame = pd.read_excel(path)
    else:
        raise Exception("Unsupported file format")
    return df

def explain_prediction(df) -> list[Any]:
    pool: Pool = Pool(df)
    importance = model.get_feature_importance(pool, type="PredictionValuesChange")
    importance_df = pd.DataFrame({"feature": model_features, "importance": importance})
    importance_df: DataFrame = importance_df.sort_values(by="importance", ascending=False)
    return importance_df.head(3)["feature"].tolist()

def interpret_features(features, decision) -> str:
    risk_map: dict[str, tuple[str, str]] = {
        "HR": ("abnormal heart rate","stable heart rate"),
        "Temp": ("high body temperature","normal body temperature"),
        "MAP": ("blood pressure instability","stable blood pressure"),
        "SBP": ("blood pressure instability","stable blood pressure"),
        "Resp": ("elevated respiratory rate","normal breathing rate"),
        "O2Sat": ("low oxygen saturation","healthy oxygen saturation")
    }
    readable = []
    for f in features:
        for key in risk_map:
            if key in f:
                if decision == "Sepsis Detected":
                    readable.append(risk_map[key][0])
                else:
                    readable.append(risk_map[key][1])
    if decision == "Sepsis Detected":
        return "Model suspects sepsis due to: " + ", ".join(readable)
    else:
        return "Model predicts no sepsis because vitals appear stable: " + ", ".join(readable)

def calculate_lead_time(df: DataFrame, actual_sepsis_hour: int) -> dict[str, Any]:
    """
    Calculate how many hours before actual sepsis onset the model first predicted it.
    Optimized for 8+ hour early detection using multiple detection strategies.
    
    Args:
        df: patient data with vital signs time series
        actual_sepsis_hour: the hour when sepsis was actually diagnosed (from labels)
    
    Returns:
        dict with lead_time_hours, prediction_hour, confidence_progression, and detection insights
    """
    df_processed = preprocess(df.copy())
    for col in model_features:
        if col not in df_processed.columns:
            df_processed[col] = 0
    
    df_processed = df_processed[model_features]
    probs = model.predict_proba(df_processed)[:, 1]
    
    prediction_hour = None
    detection_method = None
    
    if LEAD_TIME_MODE_ENABLED:
        # Strategy 1: Early Detection Threshold (30% confidence)
        for hour, prob in enumerate(probs):
            if prob >= EARLY_DETECTION_THRESHOLD:
                prediction_hour = hour
                detection_method = "early_threshold"
                break
        
        # Strategy 2: Trend-Based Detection (if early threshold didn't trigger)
        if prediction_hour is None:
            for hour in range(MIN_CONFIDENCE_PROGRESSION_POINTS, len(probs)):
                confidence_analysis = analyze_confidence_progression(probs[:hour+1].tolist())
                vital_deterioration = calculate_vital_deterioration_score(df.iloc[:hour+1])
                
                # Trigger alert if strong deterioration trend or high acceleration
                if (confidence_analysis["trend"] == "deteriorating" and 
                    confidence_analysis["velocity"] > 0.03 and 
                    vital_deterioration > 0.4):
                    prediction_hour = hour
                    detection_method = "trend_based"
                    break
    else:
        # Fallback to original 50% threshold if lead time mode disabled
        for hour, prob in enumerate(probs):
            if prob >= THRESHOLD:
                prediction_hour = hour
                detection_method = "standard_threshold"
                break
    
    if prediction_hour is None:
        return {
            "predicted": False,
            "lead_time_hours": 0,
            "prediction_hour": None,
            "actual_sepsis_hour": actual_sepsis_hour,
            "confidence_progression": probs.tolist(),
            "meets_6hr_threshold": False,
            "meets_8hr_threshold": False,
            "detection_method": None
        }
    
    lead_time = actual_sepsis_hour - prediction_hour
    
    return {
        "predicted": True,
        "lead_time_hours": max(0, lead_time),
        "prediction_hour": prediction_hour,
        "actual_sepsis_hour": actual_sepsis_hour,
        "confidence_progression": probs.tolist(),
        "meets_6hr_threshold": lead_time >= 6,
        "meets_8hr_threshold": lead_time >= 8,
        "detection_method": detection_method,
        "early_detection_enabled": LEAD_TIME_MODE_ENABLED
    }

def predict(df) -> None:
    patient_id = None
    if "Patient_ID" in df.columns:
        patient_id = df["Patient_ID"].iloc[0]
        df = df.drop(columns=["Patient_ID"])
    df = preprocess(df)
    for col in model_features:
        if col not in df.columns:
            df[col] = 0
    df = df[model_features]
    probs = model.predict_proba(df)[:,1]
    display_prob: float = adjust_probability(probs[-1])
    decision: str = "Sepsis Detected" if display_prob >= THRESHOLD else "No Sepsis"
    top_features: list[Any] = explain_prediction(df.tail(1))
    explanation: str = interpret_features(top_features, decision)
    print("\n==============================")
    print("SEPSIS PREDICTION RESULT")
    print("==============================\n")
    if patient_id:
        print("Patient ID:", patient_id)
    print("Sepsis Risk Probability:", round(display_prob*100,1), "%")
    print("Decision:", decision)
    print("Explanation:", explanation)

# command‑line interface removed in favor of API

# ----- helper functions already defined above -----

# expose a minimal Flask API for the React frontend
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import tempfile
import psycopg2
from psycopg2.extras import RealDictCursor

# connection string – adjust user/password/host as needed
DB_CONN_INFO = "host=localhost dbname=sepsis user=postgres password=Dp@1412"

def get_db():
    # simple connection for each request
    return psycopg2.connect(DB_CONN_INFO, cursor_factory=RealDictCursor)

app = Flask(__name__)
CORS(app)  # allow cross‑origin requests from frontend

# Ensure hourly data is tracked uniquely per patient by hour, like a patient "vitals book"
def ensure_db_indexes():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS hourly_data_patient_hour_uq ON hourly_data (patient_id, hour)")
        conn.commit()

ensure_db_indexes()

@app.route('/predict', methods=['POST'])
def api_predict() -> Response:
    data = request.json

    if isinstance(data, list):
        df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        return jsonify({'error': 'Invalid payload for prediction'}), 400

    # parse patient id into numeric if given
    if 'patient_id' in df.columns:
        try:
            df['patient_id'] = pd.to_numeric(df['patient_id'], errors='coerce').fillna(0)
        except Exception:
            df['patient_id'] = 0
    if 'Patient_ID' in df.columns:
        df['Patient_ID'] = pd.to_numeric(df['Patient_ID'].apply(lambda v: str(v).lstrip('Pp').strip()), errors='coerce').fillna(0)

    # Apply preprocessing with validation and feature filling
    df = preprocess(df)
    
    # Prepare features for model prediction
    for col in model_features:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    df: Series[Any] = df[model_features]
    probs = model.predict_proba(df)[:,1]
    display_prob: float = adjust_probability(probs[-1])
    decision: str = "Sepsis Detected" if display_prob >= THRESHOLD else "No Sepsis"
    top_features: list[Any] = explain_prediction(df)
    explanation: str = interpret_features(top_features, decision)
    
    return jsonify({
        "probability": float(display_prob),
        "decision": decision,
        "explanation": explanation,
        "status": "OK"
    })

@app.route('/upload-data', methods=['POST'])
def api_upload_data() -> tuple[Response, Literal[400]] | Response:
    # accept file upload
    if 'file' not in request.files:
        return jsonify({"error": "no file"}), 400
    f: FileStorage = request.files['file']
    filename: str = secure_filename(f.filename)
    import tempfile
    tmpdir: str = tempfile.gettempdir()
    os.makedirs(tmpdir, exist_ok=True)
    path: str = os.path.join(tmpdir, filename)
    f.save(path)

    try:
        if path.endswith('.csv'):
            df: DataFrame = pd.read_csv(path)
        else:
            df: DataFrame = pd.read_excel(path)
    except Exception as exc:
        return jsonify({"error": f"Unable to read file: {exc}"}), 400

    if df.empty:
        return jsonify({"error": "Uploaded CSV is empty"}), 400

    df.columns = [str(c).strip() for c in df.columns]

    # normalize column names (supports many variants of the same vital/ID fields)
    column_aliases = {
        'patientid': 'Patient_ID',
        'patient_id': 'Patient_ID',
        'patient id': 'Patient_ID',
        'hr': 'HR',
        'o2sat': 'O2Sat',
        'o2 sat': 'O2Sat',
        'temp': 'Temp',
        'sbp': 'SBP',
        'map': 'MAP',
        'dbp': 'DBP',
        'resp': 'Resp'
    }
    normalized_columns = {}
    for c in df.columns:
        key = str(c).strip().lower()
        normalized_columns[c] = column_aliases.get(key, c)
    df = df.rename(columns=normalized_columns)

    if 'Patient_ID' in df.columns:
        def normalize_patient_id(v):
            if pd.isna(v):
                return 0
            if isinstance(v, (int, float)):
                return float(v)
            s = str(v).strip()
            if s.lower().startswith('p'):
                s = s[1:]
            digits = ''.join(ch for ch in s if ch.isdigit())
            return float(digits) if digits else 0
        df['Patient_ID'] = df['Patient_ID'].apply(normalize_patient_id)

    # Promote patient_id column if alternate name exists
    if 'patient_id' in df.columns and 'Patient_ID' not in df.columns:
        df['Patient_ID'] = pd.to_numeric(df['patient_id'], errors='coerce').fillna(0)

    # Apply preprocessing with validation and feature filling
    df = preprocess(df)
    
    # Ensure all model features are present
    for col in model_features:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

    # keep patient id for grouping by patient
    output_df = df.copy()

    preview: list[dict[Hashable, Any]] = output_df.head(10).to_dict(orient='records')

    try:
        patient_results = []
        overall_top = None

        if 'Patient_ID' in output_df.columns:
            for patient_id, patient_df in output_df.groupby('Patient_ID', sort=False):
                if patient_df.empty:
                    continue

                # preprocess per patient records
                patient_processed = preprocess(patient_df.copy())

                for col in model_features:
                    if col not in patient_processed.columns:
                        patient_processed[col] = 0
                    else:
                        patient_processed[col] = pd.to_numeric(patient_processed[col], errors='coerce').fillna(0)

                patient_processed = patient_processed[model_features].copy()

                predictions = model.predict_proba(patient_processed)[:, 1]
                adjusted = [float(adjust_probability(p)) for p in predictions]
                final_risk = adjusted[-1]
                decision = "Sepsis Detected" if final_risk >= THRESHOLD else "No Sepsis"
                factors = explain_prediction(patient_processed.tail(1))
                explanation = interpret_features(factors, decision)

                entry = {
                    'patient_id': int(patient_id) if pd.notna(patient_id) else None,
                    'probability': final_risk,
                    'decision': decision,
                    'explanation': explanation,
                    'factors': factors,
                    'probability_curve': [float(round(p * 100, 2)) for p in adjusted]
                }
                patient_results.append(entry)

                if overall_top is None or final_risk > overall_top['probability']:
                    overall_top = entry
        else:
            processed = preprocess(output_df.copy())
            for col in model_features:
                if col not in processed.columns:
                    processed[col] = 0
                else:
                    processed[col] = pd.to_numeric(processed[col], errors='coerce').fillna(0)
            processed = processed[model_features].copy()
            predictions = model.predict_proba(processed)[:, 1]
            adjusted = [float(adjust_probability(p)) for p in predictions]
            overall_top = {
                'patient_id': None,
                'probability': adjusted[-1],
                'decision': "Sepsis Detected" if adjusted[-1] >= THRESHOLD else "No Sepsis",
                'explanation': interpret_features(explain_prediction(processed.tail(1)), "Sepsis Detected" if adjusted[-1] >= THRESHOLD else "No Sepsis"),
                'factors': explain_prediction(processed.tail(1)),
                'probability_curve': [float(round(p * 100, 2)) for p in adjusted]
            }

        sepsis_patients = [p['patient_id'] for p in patient_results if p['decision'] == 'Sepsis Detected']
        sepsis_count = len(sepsis_patients)
        top_patient = overall_top

        response = {
            'preview': preview,
            'prediction': overall_top,
            'overall_prediction': overall_top,
            'patient_predictions': patient_results,
            'sepsis_detected_count': sepsis_count,
            'sepsis_detected_patients': sepsis_patients,
            'top_risk_patient': top_patient
        }

    except Exception as exc:
        return jsonify({"error": f"Processing/prediction failed: {exc}"}), 400

    return jsonify(response)

@app.route('/favicon.ico')
def favicon() -> tuple[str, int]:
    # Avoid unnecessary 404 noise from browser favicon requests
    return "", 204

# database-backed endpoints --------------------------------

@app.route('/patients', methods=['GET', 'POST'])
def api_patients() -> Response:
    if request.method == 'GET':
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM patient ORDER BY last_updated DESC")
                rows: list[tuple[Any, ...]] = cur.fetchall()
        return jsonify(rows)

    # POST -> add new patient
    data = request.json
    raw_patient_id = data.get('patient_id') or data.get('id')

    def normalize_patient_id(pid):
        if pid is None:
            return None
        s = str(pid).strip()
        if s == '':
            return None
        # preserve prefix with uppercase
        if s[0].lower() == 'p':
            return s.upper()
        return s

    patient_id = normalize_patient_id(raw_patient_id)

    # if no patient_id specified, autogenerate sequential ID
    if not patient_id:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT patient_id FROM patient ORDER BY patient_id DESC LIMIT 1")
                last = cur.fetchone()
        if last and last.get('patient_id'):
            last_id = str(last['patient_id'])
            digits = ''.join(ch for ch in last_id if ch.isdigit())
            prefix = ''.join(ch for ch in last_id if not ch.isdigit()) or 'P'
            next_num = int(digits) + 1 if digits.isdigit() else 1
            patient_id = f"{prefix}{next_num:03d}"
        else:
            patient_id = 'P001'

    name = data.get('name', '')
    age = data.get('age')
    gender = data.get('gender')
    admission_date = data.get('admission_date')
    doctor_name = data.get('doctor_name')
    current_risk = data.get('current_risk', 0)

    # current_risk in frontend is typically percent (e.g. 56), while DB numeric(5,4) expects 0-9.9999
    # convert percent to fraction when >1
    try:
        current_risk = float(current_risk)
    except (TypeError, ValueError):
        current_risk = 0.0

    if current_risk > 1:
        current_risk = round(min(max(current_risk / 100.0, 0.0), 1.0), 4)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO patient (patient_id, name, age, gender, admission_date, doctor_name, current_risk, last_updated) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s, now()) "
                "ON CONFLICT (patient_id) DO UPDATE SET name=EXCLUDED.name, age=EXCLUDED.age, gender=EXCLUDED.gender, "
                "admission_date=EXCLUDED.admission_date, doctor_name=EXCLUDED.doctor_name, current_risk=EXCLUDED.current_risk, last_updated=now()",
                (patient_id, name, age, gender, admission_date, doctor_name, current_risk)
            )
            # optionally insert hourly data rows if provided
            hourly_rows = data.get('hourly_data') or []
            effective_risk = current_risk
            for row in hourly_rows:
                row_risk = row.get('risk', effective_risk)
                try:
                    row_risk = float(row_risk)
                except (TypeError, ValueError):
                    row_risk = effective_risk
                if row_risk > 1:
                    row_risk = round(min(max(row_risk / 100.0, 0.0), 1.0), 4)

                hour_value = row.get('hour') if row.get('hour') is not None else None
                hr_value = row.get('HR') or row.get('hr')
                o2_value = row.get('O2Sat') or row.get('o2sat')
                temp_value = row.get('Temp') or row.get('temp')
                sbp_value = row.get('SBP') or row.get('sbp')
                map_value = row.get('MAP') or row.get('map')
                dbp_value = row.get('DBP') or row.get('dbp')
                resp_value = row.get('Resp') or row.get('resp')

                cur.execute(
                    "INSERT INTO hourly_data (patient_id,hour,hr,o2sat,temp,sbp,map,dbp,resp,risk) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (patient_id, hour) DO UPDATE SET hr=EXCLUDED.hr, o2sat=EXCLUDED.o2sat, temp=EXCLUDED.temp, "
                    "sbp=EXCLUDED.sbp, map=EXCLUDED.map, dbp=EXCLUDED.dbp, resp=EXCLUDED.resp, risk=EXCLUDED.risk, created_at=now()",
                    (
                        patient_id,
                        hour_value,
                        hr_value,
                        o2_value,
                        temp_value,
                        sbp_value,
                        map_value,
                        dbp_value,
                        resp_value,
                        row_risk
                    )
                )
                effective_risk = row_risk

            # if hourly rows present, set patient risk based on latest row risk
            if hourly_rows:
                cur.execute(
                    "UPDATE patient SET current_risk=%s, last_updated=now() WHERE patient_id=%s",
                    (effective_risk, patient_id)
                )

    return jsonify({'success': True, 'patient_id': patient_id})

@app.route('/patient-history', methods=['GET'])
def api_history() -> Response:
    patient_id: str | None = request.args.get('id')
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM patient WHERE patient_id=%s", (patient_id,))
            patient: tuple[Any, ...] | dict[Any, Any] = cur.fetchone() or {}
            cur.execute(
                "SELECT hour, hr, o2sat, temp, sbp, map, dbp, resp, risk FROM hourly_data "
                "WHERE patient_id=%s ORDER BY hour",
                (patient_id,)
            )
            history: list[tuple[Any, ...]] = cur.fetchall()
    return jsonify({"patient": patient, "history": history})

@app.route('/add-hourly-data', methods=['POST'])
def api_add_hourly() -> Response:
    data = request.json
    # expected keys: patient_id, hour, HR, O2Sat, Temp, SBP, MAP, DBP, Resp, risk
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO hourly_data (patient_id,hour,hr,o2sat,temp,sbp,map,dbp,resp,risk) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                "ON CONFLICT (patient_id, hour) DO UPDATE SET hr=EXCLUDED.hr, o2sat=EXCLUDED.o2sat, temp=EXCLUDED.temp, "
                "sbp=EXCLUDED.sbp, map=EXCLUDED.map, dbp=EXCLUDED.dbp, resp=EXCLUDED.resp, risk=EXCLUDED.risk, created_at=now() "
                "RETURNING id",
                (data['patient_id'], data['hour'], data['HR'], data['O2Sat'],
                 data['Temp'], data['SBP'], data['MAP'], data['DBP'],
                 data['Resp'], data['risk'])
            )
            new_id = cur.fetchone()['id']
        # update patient current_risk & last_updated
        with conn.cursor() as cur2:
            cur2.execute(
                "UPDATE patient SET current_risk=%s, last_updated=now() WHERE patient_id=%s",
                (data['risk'], data['patient_id'])
            )
    return jsonify({"id": new_id})

@app.route('/analyze-lead-time', methods=['POST'])
def api_analyze_lead_time() -> Response:
    """Analyze early prediction capability for sepsis detection"""
    data = request.json
    df = pd.DataFrame(data['vital_signs'])
    actual_sepsis_hour = data.get('actual_sepsis_hour', len(df) - 1)
    
    result = calculate_lead_time(df, actual_sepsis_hour)
    
    return jsonify(result)

@app.errorhandler(Exception)
def api_error_handler(error):
    # Return JSON error always, prevents CORS blocks with HTML error page
    response = jsonify({
        'error': str(error),
    })
    response.status_code = getattr(error, 'code', 500)
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5000)