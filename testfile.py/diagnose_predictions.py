"""
Diagnose why sepsis predictions are giving wrong results for hourly vital data.
Checks data validation, feature ranges, and preprocessing issues.
"""

import pandas as pd
import numpy as np
from catboost import CatBoostClassifier, Pool

# Load the model
MODEL_PATH = r"c:\final year project\catboost_model.cbm"
model = CatBoostClassifier()
model.load_model(MODEL_PATH)
model_features = model.feature_names_

# Valid vital sign ranges (based on medical standards)
VALID_RANGES = {
    "HR": (40, 150),           # Heart Rate: 40-150 bpm
    "O2Sat": (70, 100),        # O2 Saturation: 70-100%
    "Temp": (35.0, 40.0),      # Temperature: 35-40°C
    "SBP": (70, 200),          # Systolic BP: 70-200 mmHg
    "MAP": (50, 130),          # Mean AP: 50-130 mmHg
    "DBP": (40, 120),          # Diastolic BP: 40-120 mmHg
    "Resp": (8, 40),           # Respiration: 8-40 breaths/min
}

def validate_vital_signs(df):
    """Check if vital signs are within realistic ranges."""
    issues = []
    for col, (min_val, max_val) in VALID_RANGES.items():
        if col in df.columns:
            out_of_range = df[(df[col] < min_val) | (df[col] > max_val)]
            if len(out_of_range) > 0:
                for idx, row in out_of_range.iterrows():
                    issues.append(f"  ⚠️  {col}={row[col]} (expected {min_val}-{max_val}) at hour {idx}")
    return issues

def preprocess(df):
    """Original preprocessing function from app.py"""
    vital_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    window = 10
    for col in vital_cols:
        df[f"{col}_mean"] = df[col].rolling(window).mean()
        df[f"{col}_max"] = df[col].rolling(window).max()
        df[f"{col}_min"] = df[col].rolling(window).min()
        df[f"{col}_trend"] = df[col] - df[col].shift(window)
    df = df.ffill().bfill().fillna(0)
    return df

def analyze_stability(df):
    """Measure how stable vital signs are hour-to-hour."""
    vital_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    stability = {}
    
    for col in vital_cols:
        if col in df.columns and len(df) > 1:
            values = df[col].values
            hourly_change = np.abs(np.diff(values))
            avg_change = np.mean(hourly_change)
            max_change = np.max(hourly_change)
            stability[col] = {
                "avg_hourly_change": float(avg_change),
                "max_hourly_change": float(max_change),
                "std_dev": float(np.std(values))
            }
    
    return stability

def diagnose_data(df, data_name="Patient Data"):
    """Run full diagnostic on input data."""
    print(f"\n{'='*60}")
    print(f"🔍 DIAGNOSTIC REPORT: {data_name}")
    print(f"{'='*60}\n")
    
    print(f"📊 Data Shape: {df.shape[0]} rows, {df.shape[1]} columns\n")
    
    # Check for validation issues
    print("1️⃣  VITAL SIGN VALIDATION")
    issues = validate_vital_signs(df)
    if issues:
        print("  ❌ INVALID VALUES DETECTED:")
        for issue in issues:
            print(issue)
    else:
        print("  ✅ All vital signs within normal ranges")
    
    # Check stability
    print("\n2️⃣  VITAL SIGN STABILITY (Hour-to-Hour Changes)")
    stability = analyze_stability(df)
    for vital, stats in stability.items():
        print(f"  {vital}:")
        print(f"    - Avg hourly change: {stats['avg_hourly_change']:.2f}")
        print(f"    - Max hourly change: {stats['max_hourly_change']:.2f}")
        print(f"    - Std deviation: {stats['std_dev']:.2f}")
    
    # Show what preprocessing creates
    print("\n3️⃣  PREPROCESSING FEATURES CREATED")
    df_proc = preprocess(df.copy())
    print(f"  Original columns: {len(df.columns)}")
    print(f"  After preprocessing: {len(df_proc.columns)}")
    print(f"  New columns: {[c for c in df_proc.columns if c not in df.columns][:5]}...")
    
    # Show feature statistics after preprocessing
    print("\n4️⃣  FEATURE STATISTICS (After Preprocessing)")
    print(f"  Model expects {len(model_features)} features:")
    print(f"  {model_features[:10]}...")
    
    # Make prediction
    print("\n5️⃣  MODEL PREDICTION")
    try:
        # Add missing features that model expects
        for col in model_features:
            if col not in df_proc.columns:
                df_proc[col] = 0
        
        df_proc = df_proc[model_features]
        probs = model.predict_proba(df_proc)[:, 1]
        print(f"  Risk scores across time: {[f'{p*100:.1f}%' for p in probs]}")
        print(f"  Final prediction: {probs[-1]*100:.1f}%")
    except Exception as e:
        print(f"  ❌ Prediction failed: {e}")
    
    print(f"\n{'='*60}\n")

# Test Case 1: Reasonable vital signs
print("TEST 1: Reasonable Vital Signs")
test1_data = pd.DataFrame({
    'HR': [80, 82, 85, 88, 90],
    'O2Sat': [98, 97, 96, 95, 94],
    'Temp': [36.5, 36.6, 36.7, 36.8, 36.9],
    'SBP': [120, 122, 125, 128, 130],
    'MAP': [85, 87, 88, 90, 92],
    'DBP': [70, 72, 75, 78, 80],
    'Resp': [18, 19, 20, 21, 22]
})
diagnose_data(test1_data, "NORMAL VITALS")

# Test Case 2: Unrealistic values (from screenshot)
print("TEST 2: Unrealistic Vital Signs (BAD DATA)")
test2_data = pd.DataFrame({
    'HR': [200, 200],
    'O2Sat': [200, 200],
    'Temp': [200, 200],
    'SBP': [200, 200],
    'MAP': [200, 200],
    'DBP': [200, 200],
    'Resp': [200, 200]
})
diagnose_data(test2_data, "UNREALISTIC VITALS")

# Test Case 3: Mixed reasonable and extreme values
print("TEST 3: Mixed Data (Reasonable → Abnormal Trend)")
test3_data = pd.DataFrame({
    'HR': [80, 90, 100, 110, 120],
    'O2Sat': [98, 96, 94, 92, 90],
    'Temp': [36.5, 36.8, 37.1, 37.4, 37.7],
    'SBP': [120, 130, 140, 150, 160],
    'MAP': [85, 90, 95, 100, 105],
    'DBP': [70, 75, 80, 85, 90],
    'Resp': [18, 20, 22, 24, 26]
})
diagnose_data(test3_data, "DETERIORATING VITALS")

print("\n" + "="*60)
print("RECOMMENDATIONS")
print("="*60)
print("""
1. ADD DATA VALIDATION in app.py:
   - Reject vital signs outside valid ranges
   - Return error for impossible values (O2Sat > 100, Temp > 40°C, etc.)

2. NORMALIZE FEATURES before prediction:
   - Scale vital signs to consistent ranges [0,1] or standardize
   - This helps CatBoost make better decisions

3. CHECK PREPROCESSING WINDOW:
   - Rolling window of 10 hours may not be enough for sparse data
   - Consider adaptive window size based on available hours

4. ADD TREND DETECTION:
   - Flag when vital signs change > 20% per hour (usually abnormal)
   - Model should be trained on realistic vital changes
""")
print("="*60 + "\n")
