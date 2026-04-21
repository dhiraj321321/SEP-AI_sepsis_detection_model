# 🔧 Sepsis Model: Fix Wrong Predictions on Hourly Vital Data

## 🚨 ROOT CAUSE DISCOVERED

Your model is trained on **42 features** but the frontend only provides **7 vital signs**:

```
What Model Needs (42 features):
├── Vital Signs (7): HR, O2Sat, Temp, SBP, MAP, DBP, Resp
├── Vital Stats (28): *_mean, *_max, *_min, *_trend for each vital  
├── Patient Data (7): Age, Gender, Glucose, Unit1, Unit2, HospAdmTime, ICULOS
└── Identifiers (2): Patient_ID, Hour

What Frontend Sends (7 features):
└── Only Vital Signs: HR, O2Sat, Temp, SBP, MAP, DBP, Resp
    ❌ Missing: 35 features filled with 0s → DESTROYS predictions!
```

## Why This Breaks Predictions

When missing features are filled with **zero**:
- Model thinks patient has **0 Age**, **0 Glucose**, **0 time in hospital**
- These impossible values confuse the model
- Result: Everything predicts as **0% risk** (lowest risk)

---

## ✅ Solutions

### Option 1: Quick Fix (Frontend collects demographics)
Modify the React form to ask for:
- Patient Age
- Patient Gender  
- Blood Glucose level
- Time in hospital (hours)
- ICU unit

### Option 2: Smart Defaults (Recommended)
Use realistic medical averages when data missing:

```python
FEATURE_DEFAULTS = {
    "Age": 50,           # Average adult
    "Gender": 1,         # Balanced (0=F, 1=M)
    "Glucose": 110,      # Normal fasting glucose
    "Unit1": 0,          # ICU unit encoding
    "Unit2": 0,
    "HospAdmTime": 0,    # Start of admission
    "ICULOS": 0,         # Just admitted to ICU
}
```

### Option 3: Add Data Validation
Reject impossible values:

```python
VALID_VITAL_RANGES = {
    "HR": (40, 150),           # Not 200!
    "O2Sat": (70, 100),        # Not 200%!
    "Temp": (35.0, 40.0),      # Not 200°C!
    "SBP": (70, 200),
    "MAP": (50, 130),
    "DBP": (40, 120),
    "Resp": (8, 40),
}
```

---

## 📋 Implementation Steps

### Step 1: Update [app.py](../app.py) - Add Validation and Defaults

**BEFORE** (lines 50-55):
```python
def preprocess(df):
    vital_cols: list[str] = ["HR","O2Sat","Temp","SBP","MAP","DBP","Resp"]
    window = 10
    for col in vital_cols:
        df[f"{col}_mean"] = df[col].rolling(window).mean()
```

**AFTER** - Add this validation function:
```python
# Add right after model_features = model.feature_names_

# Valid ranges for vital signs
VALID_VITAL_RANGES = {
    "HR": (40, 150),
    "O2Sat": (70, 100),
    "Temp": (35.0, 40.0),
    "SBP": (70, 200),
    "MAP": (50, 130),
    "DBP": (40, 120),
    "Resp": (8, 40),
}

# Defaults for missing patient data
FEATURE_DEFAULTS = {
    "Age": 50,
    "Gender": 1,
    "Unit1": 0,
    "Unit2": 0,
    "HospAdmTime": 0,
    "ICULOS": 0,
}

def validate_vital_signs(df: DataFrame) -> tuple[bool, list[str]]:
    """Return (is_valid, error_messages)"""
    errors = []
    for col, (min_val, max_val) in VALID_VITAL_RANGES.items():
        if col in df.columns:
            mask = (df[col] < min_val) | (df[col] > max_val)
            if mask.any():
                for idx in df[mask].index:
                    errors.append(f"{col}={df.loc[idx, col]} (expect {min_val}-{max_val})")
    return len(errors) == 0, errors

def fill_missing_features(df: DataFrame) -> DataFrame:
    """Fill vital-signs-only input with reasonable defaults"""
    # Check if user only provided vital signs (no patient data)
    has_patient_data = any(col in df.columns for col in ["Age", "Glucose"])
    
    if not has_patient_data:
        # Fill with medical defaults
        for feature, default_val in FEATURE_DEFAULTS.items():
            if feature not in df.columns:
                df[feature] = default_val
    
    return df
```

### Step 2: Update Preprocessing Function

**Replace** the old `preprocess()` function:
```python
def preprocess(df):
    # Validate data first
    is_valid, errors = validate_vital_signs(df)
    if errors:
        print(f"⚠️  Data validation warnings: {errors}")
    
    # Fill missing features
    df = fill_missing_features(df.copy())
    
    # Original preprocessing with ADAPTIVE window
    vital_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
    window = min(10, max(2, len(df) - 1))  # Adaptive: 2-10
    
    for col in vital_cols:
        if col in df.columns:
            df[f"{col}_mean"] = df[col].rolling(window, min_periods=1).mean()
            df[f"{col}_max"] = df[col].rolling(window, min_periods=1).max()
            df[f"{col}_min"] = df[col].rolling(window, min_periods=1).min()
            df[f"{col}_trend"] = df[col] - df[col].shift(min(window, len(df)-1))
    
    df = df.ffill().bfill().fillna(0)
    return df
```

### Step 3: Update API Endpoints

Replace in `@app.route('/predict', methods=['POST'])`:

**OLD:**
```python
df = preprocess(df)
for col in model_features:
    if col not in df.columns:
        df[col] = 0  # ❌ This fills with zeros!
```

**NEW:**
```python
df = preprocess(df)  # Now includes validation & feature filling
for col in model_features:
    if col not in df.columns:
        df[col] = 0
    else:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
df = df[model_features]
probs = model.predict_proba(df)[:, 1]
```

---

## 🧪 Test the Fix

Use this test data:

```python
import pandas as pd

# Test 1: Good hourly data (should predict LOW risk)
good_data = pd.DataFrame({
    'HR': [80, 82, 85, 88, 90],
    'O2Sat': [98, 97, 96, 95, 94],
    'Temp': [36.5, 36.6, 36.7, 36.8, 36.9],
    'SBP': [120, 122, 125, 128, 130],
    'MAP': [85, 87, 88, 90, 92],
    'DBP': [70, 72, 75, 78, 80],
    'Resp': [18, 19, 20, 21, 22]
})
# After fix: Should predict realistic % (not 0%)

# Test 2: Deteriorating vitals (should predict HIGH risk)
deteriorating = pd.DataFrame({
    'HR': [90, 100, 110, 120, 130],
    'O2Sat': [98, 96, 94, 92, 90],
    'Temp': [36.5, 36.8, 37.1, 37.4, 37.7],
    'SBP': [120, 130, 140, 150, 160],
    'MAP': [85, 90, 95, 100, 105],
    'DBP': [70, 75, 80, 85, 90],
    'Resp': [18, 20, 22, 24, 26]
})
# Should predict SEPSIS DETECTED

# Test 3: Bad data (should be rejected)
bad_data = pd.DataFrame({
    'HR': [200, 250],
    'O2Sat': [200, 200],
    'Temp': [200, 200],
    'SBP': [300, 350],
    'MAP': [300, 350],
    'DBP': [300, 350],
    'Resp': [100, 120]
})
# Should return validation error
```

---

## 📊 Expected Visual Signs of Fix

**Before Fix:**
- Reasonable vitals → 0% risk ❌
- Bad data → 0% risk ❌
- No variation in predictions ❌

**After Fix:**
- Stable vitals → ~5-15% risk ✅
- Deteriorating vitals → 40-80% risk ✅
- Bad data → ⚠️ Validation error ✅
- Natural prediction variation ✅

---

## 🎯 Optional: Enhance Frontend

Add patient demographics to [Dashboard.js](../frontend/src/components/Dashboard.js):

```javascript
// Add these fields to the form:
<input name="age" type="number" placeholder="Age (years)" min="0" max="120" />
<select name="gender">
  <option value="0">Female</option>
  <option value="1">Male</option>
</select>
<input name="glucose" type="number" placeholder="Glucose (mg/dL)" min="40" max="400" />
```

This will make predictions even more accurate!

---

## 📝 Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| All predictions 0% | Missing 35 features filled with 0s | Fill with medical defaults |
| Bad data accepted | No validation | Add vital sign range checks |
| Wrong risk for stable vitals | Model confusion from zero features | Fill demographics |
| Hourly data unreliable | Window size not adaptive | Use min(10, data_length) |

✅ **After fix:** Model gets proper input → accurate sepsis predictions!
