"""
Diagnostic script to check model features and preprocessing
"""

import pandas as pd
import numpy as np
from catboost import CatBoostClassifier

# Load the model
MODEL_PATH = "catboost_model.cbm"
print("Loading model...")
model = CatBoostClassifier()
model.load_model(MODEL_PATH)

print(f"\n✓ Model loaded successfully")
print(f"Number of features expected: {model.n_features_in_}")
print(f"\nModel feature names:")
for i, feat in enumerate(model.feature_names_):
    print(f"  {i:3d}: {feat}")

# Now test with sample data
print("\n" + "="*70)
print("TESTING WITH SAMPLE DATA")
print("="*70)

vital_signs = [
    {"HR": 75, "O2Sat": 98, "Temp": 36.5, "SBP": 120, "MAP": 85, "DBP": 70, "Resp": 16},
    {"HR": 78, "O2Sat": 97, "Temp": 36.6, "SBP": 118, "MAP": 83, "DBP": 69, "Resp": 17},
    {"HR": 80, "O2Sat": 97, "Temp": 36.7, "SBP": 116, "MAP": 81, "DBP": 67, "Resp": 17},
]

df = pd.DataFrame(vital_signs)
print(f"\nInput data shape: {df.shape}")
print(f"Input columns: {list(df.columns)}")
print("\nFirst few rows:")
print(df)

# Preprocess
def preprocess(df):
    vital_cols = ["HR","O2Sat","Temp","SBP","MAP","DBP","Resp"]
    window = 10
    for col in vital_cols:
        df[f"{col}_mean"] = df[col].rolling(window).mean()
        df[f"{col}_max"] = df[col].rolling(window).max()
        df[f"{col}_min"] = df[col].rolling(window).min()
        df[f"{col}_trend"] = df[col] - df[col].shift(window)
    df = df.ffill().bfill().fillna(0)
    return df

df_processed = preprocess(df.copy())
print(f"\nAfter preprocessing:")
print(f"  Shape: {df_processed.shape}")
print(f"  Columns: {list(df_processed.columns)}")
print(f"\nProcessed data (last row):")
for col in df_processed.columns:
    print(f"  {col}: {df_processed[col].iloc[-1]:.4f}")

# Check which model features are missing
print(f"\n" + "="*70)
print("FEATURE MATCHING")
print("="*70)

model_features = model.feature_names_
missing_features = [f for f in model_features if f not in df_processed.columns]
extra_features = [f for f in df_processed.columns if f not in model_features]

print(f"\nMissing features ({len(missing_features)}):")
for feat in missing_features[:5]:
    print(f"  - {feat}")
if len(missing_features) > 5:
    print(f"  ... and {len(missing_features)-5} more")

if extra_features:
    print(f"\nExtra features not in model ({len(extra_features)}):")
    for feat in extra_features[:5]:
        print(f"  - {feat}")

# Try prediction
print(f"\n" + "="*70)
print("PREDICTION TEST")
print("="*70)

try:
    # Select only model features
    for col in model_features:
        if col not in df_processed.columns:
            df_processed[col] = 0
    
    df_model = df_processed[model_features]
    print(f"\nDataframe for model shape: {df_model.shape}")
    print(f"Dataframe columns match model: {len(df_model.columns) == model.n_features_in_}")
    
    # Make prediction
    probs = model.predict_proba(df_model)
    print(f"\n✓ Prediction successful")
    print(f"Probabilities shape: {probs.shape}")
    print(f"Last row probabilities: {probs[-1]}")
    print(f"  Class 0 (No Sepsis): {probs[-1][0]:.4f}")
    print(f"  Class 1 (Sepsis): {probs[-1][1]:.4f}")
    
    if max(probs[-1]) < 0.01:
        print("\n⚠️  WARNING: Probabilities are extremely low (< 0.01)")
        print("   This suggests the features may be incorrectly scaled or normalized")
        print("   Check if model expects normalized features")
    
except Exception as e:
    print(f"\n✗ Prediction failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
