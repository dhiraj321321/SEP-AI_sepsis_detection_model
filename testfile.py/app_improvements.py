"""
IMPROVED app.py with:
1. Data validation for vital signs
2. Proper handling of missing features 
3. Better error messages
4. Realistic defaults for missing patient data
"""

# Add this section after the imports and before preprocess()

# Valid vital sign ranges (medical standards)
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

# Reasonable defaults for missing patient data (use population mean/median)
FEATURE_DEFAULTS = {
    "Age": 50,                  # Average adult age
    "Gender": 1,                # 0=Female, 1=Male (balanced)
    "Unit1": 0,                 # ICU unit encoding
    "Unit2": 0,
    "HospAdmTime": 0,          # Hours since admission (start of admission)
    "ICULOS": 0,               # ICU length of stay in hours
}

def validate_vital_signs(df: DataFrame) -> tuple[bool, list[str]]:
    """
    Validate vital signs are within realistic ranges.
    Returns: (is_valid: bool, errors: list of error messages)
    """
    errors = []
    for col, (min_val, max_val) in VALID_VITAL_RANGES.items():
        if col in df.columns:
            mask = (df[col] < min_val) | (df[col] > max_val)
            invalid = df[mask]
            if len(invalid) > 0:
                for idx, row in invalid.iterrows():
                    errors.append(
                        f"{col}={row[col]:.1f} at hour {idx} "
                        f"(expected {min_val}-{max_val})"
                    )
    return len(errors) == 0, errors

def fill_missing_features(df: DataFrame) -> DataFrame:
    """
    Fill missing features with sensible defaults for vital-signs-only input.
    This prevents the model from getting zeros for critical features.
    """
    vital_only_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    
    # Check if we have only vital signs (missing patient demographic data)
    has_patient_data = any(col in df.columns for col in ["Age", "Gender", "Glucose"])
    
    if not has_patient_data:
        # User is only entering vital signs from web form - fill with defaults
        for feature, default_val in FEATURE_DEFAULTS.items():
            if feature not in df.columns:
                df[feature] = default_val
    
    # Always fill any completely missing vital signs with reasonable baseline
    for vital, (min_val, max_val) in list(VALID_VITAL_RANGES.items())[:7]:
        if vital not in df.columns:
            df[vital] = (min_val + max_val) / 2  # Use midrange as default
    
    return df

def preprocess_with_validation(df: DataFrame) -> tuple[DataFrame, list[str]]:
    """
    Enhanced preprocessing that validates data AND fills missing features.
    Returns: (processed_df, validation_warnings)
    """
    df = df.copy()
    
    # 1. Validate vital signs
    is_valid, validation_errors = validate_vital_signs(df)
    
    # 2. Fill missing patient demographic features
    df = fill_missing_features(df)
    
    # 3. Original preprocessing (rolling statistics)
    vital_cols: list[str] = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    window = min(10, len(df))  # Adaptive window for small datasets
    
    for col in vital_cols:
        if col in df.columns:
            df[f"{col}_mean"] = df[col].rolling(window=window, min_periods=1).mean()
            df[f"{col}_max"] = df[col].rolling(window=window, min_periods=1).max()
            df[f"{col}_min"] = df[col].rolling(window=window, min_periods=1).min()
            df[f"{col}_trend"] = df[col] - df[col].shift(min(window, len(df)-1))
    
    df = df.ffill().bfill().fillna(0)
    
    return df, validation_errors

# ===== USAGE IN API ENDPOINTS =====

# In @app.route('/predict', methods=['POST']):
# Replace the existing preprocessing with:

@app.route('/predict-with-validation', methods=['POST'])
def api_predict_with_validation() -> Response:
    """
    Enhanced prediction endpoint with data validation.
    """
    data = request.json

    if isinstance(data, list):
        df = pd.DataFrame(data)
    elif isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        return jsonify({'error': 'Invalid payload for prediction'}), 400

    # NEW: Preprocess with validation
    df, validation_warnings = preprocess_with_validation(df)
    
    # Prepare features for model
    for col in model_features:
        if col not in df.columns:
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    df = df[model_features]
    probs = model.predict_proba(df)[:, 1]
    display_prob: float = adjust_probability(probs[-1])
    decision: str = "Sepsis Detected" if display_prob >= THRESHOLD else "No Sepsis"
    top_features: list[Any] = explain_prediction(df)
    explanation: str = interpret_features(top_features, decision)
    
    response = {
        "probability": float(display_prob),
        "decision": decision,
        "explanation": explanation,
        "warnings": validation_warnings if validation_warnings else None
    }
    
    # If there were validation warnings, add them to response
    if validation_warnings:
        response["status"] = "WARNING"
        response["details"] = "Some vital signs outside normal ranges"
    else:
        response["status"] = "OK"
    
    return jsonify(response)

# ===== TESTING =====
if __name__ == "__main__":
    # Test the validation function
    print("Testing data validation...\n")
    
    # Test 1: Good data
    good_data = pd.DataFrame({
        'HR': [80, 85, 90],
        'O2Sat': [98, 97, 96],
        'Temp': [36.5, 36.6, 36.7],
        'SBP': [120, 125, 130],
        'MAP': [85, 87, 90],
        'DBP': [70, 75, 80],
        'Resp': [18, 19, 20]
    })
    
    valid, errors = validate_vital_signs(good_data)
    print(f"Test 1 - Good data: {'✅ PASS' if valid else '❌ FAIL'}")
    
    # Test 2: Bad data
    bad_data = pd.DataFrame({
        'HR': [200, 250],
        'O2Sat': [150, 200],
        'Temp': [200, 220],
        'SBP': [300, 350],
        'MAP': [300, 350],
        'DBP': [300, 350],
        'Resp': [100, 120]
    })
    
    valid, errors = validate_vital_signs(bad_data)
    print(f"Test 2 - Bad data: {'❌ FAIL (caught)' if not valid else '✅ PASS'}")
    for err in errors[:3]:
        print(f"  ⚠️  {err}")
    
    # Test 3: Missing demographic features get filled
    vital_only = pd.DataFrame({
        'HR': [80],
        'O2Sat': [98],
        'Temp': [36.5],
        'SBP': [120],
        'MAP': [85],
        'DBP': [70],
        'Resp': [18]
    })
    
    filled = fill_missing_features(vital_only)
    print(f"\nTest 3 - Fill missing features:")
    print(f"  Before: {vital_only.shape[1]} columns")
    print(f"  After: {filled.shape[1]} columns")
    print(f"  Added: Age={filled['Age'].iloc[0]}, Gender={filled['Gender'].iloc[0]}, etc.")
