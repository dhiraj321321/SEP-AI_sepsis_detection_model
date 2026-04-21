"""
Test lead time detection using real patient data from training set.
This extracts actual patient sequences and tests early detection.
"""

import requests
import json
import pandas as pd
import numpy as np
from datetime import datetime

print("=" * 70)
print("LOADING REAL PATIENT DATA FROM TRAINING DATASET")
print("=" * 70)

# Load training data
df_train = pd.read_csv("Dataset.csv")
print(f"✓ Loaded {len(df_train)} records from training dataset")

# Find patients with sepsis labels
sepsis_patients = df_train[df_train["SepsisLabel"] == 1]["Patient_ID"].unique()
print(f"✓ Found {len(sepsis_patients)} patients with sepsis")

# Get the first few sepsis patients
test_patients = sepsis_patients[:3]

def test_patient_sequence(patient_id, test_name):
    """Test a specific patient's sequence for early detection"""
    print(f"\n" + "="*70)
    print(f"{test_name} - PATIENT {patient_id}")
    print(f"="*70)
    
    # Get patient data
    patient_data = df_train[df_train["Patient_ID"] == patient_id].copy()
    patient_data = patient_data.sort_values("Hour")
    
    print(f"\nPatient data: {len(patient_data)} hours of records")
    print(f"Sepsis outcome: {patient_data['SepsisLabel'].max()}")
    
    if patient_data["SepsisLabel"].max() == 0:
        print("⚠️  This patient did NOT have sepsis diagnosed")
        return
    
    # Find the hour of sepsis diagnosis (when SepsisLabel first becomes 1)
    sepsis_hour = patient_data[patient_data["SepsisLabel"] == 1]["Hour"].min()
    print(f"Sepsis diagnosed at Hour: {sepsis_hour}")
    
    # Use data up to and including sepsis hour  
    sequence_data = patient_data[patient_data["Hour"] <= sepsis_hour].copy()
    
    if len(sequence_data) < 5:
        print(f"⚠️  Not enough data points ({len(sequence_data)} < 5)")
        return
    
    # Convert to API format - drop rows with too many NaNs
    sequence_data_clean = sequence_data.dropna(thresh=15)  # At least 15 non-null values
    
    if len(sequence_data_clean) < 5:
        print(f"⚠️  Not enough clean data points ({len(sequence_data_clean)} < 5 after removing NaN)")
        return
    
    # Use last portion for testing (more recent data)
    test_data = sequence_data_clean.tail(10).copy()
    
    # Clean up any remaining NaN/Inf values
    test_data = test_data.replace([np.inf, -np.inf], np.nan)
    test_data = test_data.fillna(0)
    
    # Convert to records for API
    records = test_data.to_dict('records')
    
    print(f"Using {len(records)} records for prediction test")
    
    # Make API request
    url = "http://localhost:5000/analyze-lead-time"
    data = {
        "vital_signs": records,
        "actual_sepsis_hour": int(sepsis_hour)
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        result = response.json()
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Could not connect to localhost:5000")
        print("   Make sure Flask server is running: python app.py")
        return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    
    # Display results
    if result.get("predicted"):
        lead_time = result['lead_time_hours']
        prediction_hour = result['prediction_hour']
        detection_method = result.get('detection_method', 'unknown')
        meets_8hr = result.get('meets_8hr_threshold', False)
        meets_6hr = result.get('meets_6hr_threshold', False)
        
        print(f"\n✓ SEPSIS PREDICTED EARLY")
        print(f"  • Lead Time: {lead_time} hours")
        print(f"  • Detection Method: {detection_method}")
        print(f"  • Meets 6-hour threshold: {meets_6hr}")
        print(f"  • Meets 8-hour threshold: {meets_8hr}")
        
        if meets_8hr:
            return "8hr"
        elif meets_6hr:
            return "6hr"
        else:
            return "early"
    else:
        print(f"\n✗ SEPSIS WAS NOT PREDICTED EARLY")
        confidence = result.get('confidence_progression', [])
        if confidence:
            print(f"  • Max confidence: {max(confidence):.4f}")
        return None

# Test with real patient data
print("\n" + "="*70)
print("TESTING WITH REAL PATIENT SEQUENCES")
print("="*70)

results = []

for i, patient_id in enumerate(test_patients[:3], 1):
    result = test_patient_sequence(patient_id, f"TEST {i}")
    results.append(result)

# Summary
print("\n" + "="*70)
print("TEST SUMMARY")
print("="*70)

passed_8hr = sum(1 for r in results if r == "8hr")
passed_6hr = sum(1 for r in results if r == "6hr")
passed_early = sum(1 for r in results if r == "early")
failed = sum(1 for r in results if r is None)

print(f"\n8+ Hour Detection: {passed_8hr} tests")
print(f"6+ Hour Detection: {passed_6hr} tests")
print(f"Early Detection (<6hr): {passed_early} tests")
print(f"Failed: {failed} tests")

if passed_8hr + passed_6hr > 0:
    print(f"\n✓✓✓ SUCCESS: Early detection achieved! ✓✓✓")
elif passed_early > 0:
    print(f"\n✓ Detection achieved (but <6 hours early)")
else:
    print(f"\n✗ Tests did not achieve early detection goal")

print("="*70)
