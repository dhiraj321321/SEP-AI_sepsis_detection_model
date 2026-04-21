"""
Detailed lead time analysis showing progression over time
"""

import pandas as pd
import numpy as np
import sys
import requests
import json

print("=" * 80)
print("DETAILED LEAD TIME ANALYSIS - REAL PATIENT DATA")
print("=" * 80)

# Load training data
df_train = pd.read_csv("Dataset.csv")
sepsis_patients = df_train[df_train["SepsisLabel"] == 1]["Patient_ID"].unique()

# Test first 3 sepsis patients
for patient_num, patient_id in enumerate(sepsis_patients[:3], 1):
    patient_data = df_train[df_train["Patient_ID"] == patient_id].copy()
    patient_data = patient_data.sort_values("Hour")
    
    # Only consider those with actual sepsis diagnosis
    if patient_data["SepsisLabel"].max() == 0:
        continue
    
    sepsis_diagnosis_hour = patient_data[patient_data["SepsisLabel"] == 1]["Hour"].min()
    
    print(f"\n{'='*80}")
    print(f"PATIENT {patient_num}: ID {patient_id}")
    print(f"{'='*80}")
    print(f"Sepsis diagnosed at Hour: {sepsis_diagnosis_hour}")
    
    # Get data up to sepsis diagnosis
    diagnosis_data = patient_data[patient_data["Hour"] <= sepsis_diagnosis_hour].copy()
    diagnosis_data = diagnosis_data.dropna(thresh=15)
    
    if len(diagnosis_data) < 3:
        print(f"⚠ Insufficient data ({len(diagnosis_data)} records)")
        continue
    
    print(f"Total records available: {len(diagnosis_data)}")
    
    # Test prediction at different time points (sliding window)
    print(f"\nSliding window progression:")
    print(f"{'Hours Used':<12} {'Max Prob':<12} {'Detection':<15} {'Lead Time':<12} {'Status':<10}")
    print(f"{'-'*80}")
    
    detection_hour = None
    
    for end_hour in range(3, len(diagnosis_data) + 1):
        # Get data up to this point
        window_data = diagnosis_data.iloc[:end_hour].copy()
        window_data = window_data.replace([np.inf, -np.inf], np.nan)
        window_data = window_data.fillna(0)
        
        # Make API request
        records = window_data.to_dict('records')
        
        try:
            response = requests.post(
                "http://localhost:5000/analyze-lead-time",
                json={
                    "vital_signs": records,
                    "actual_sepsis_hour": int(sepsis_diagnosis_hour)
                },
                timeout=5
            )
            result = response.json()
            
            max_prob = max(result.get('confidence_progression', [0]))
            predicted = result.get('predicted', False)
            detected_hour = result.get('prediction_hour')
            lead_time = result.get('lead_time_hours', 0)
            meets_8hr = result.get('meets_8hr_threshold', False)
            
            if predicted and detection_hour is None:
                detection_hour = detected_hour
                first_detection_hour_available = end_hour
            
            status = ""
            if predicted:
                if meets_8hr:
                    status = "✓ 8HR"
                else:
                    status = "✓ EARLY"
            
            print(f"{end_hour:<12} {max_prob:<12.4f} {detected_hour if predicted else 'None':<15} {lead_time:<12} {status:<10}")
            
        except requests.exceptions.ConnectionError:
            print("ERROR: Cannot connect to Flask server. Make sure it's running.")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: {str(e)[:50]}")
            continue
    
    # Summary
    if detection_hour is not None:
        hours_until_detection = sepsis_diagnosis_hour - detection_hour
        print(f"\n✓ Detection Summary:")
        print(f"  - First detected at Hour: {detection_hour}")
        print(f"  - Sepsis diagnosed at Hour: {sepsis_diagnosis_hour}")
        print(f"  - Lead Time: {hours_until_detection} hours")
        if hours_until_detection >= 8:
            print(f"  - Status: ✓✓✓ 8+ HOUR DETECTION ACHIEVED")
        elif hours_until_detection >= 6:
            print(f"  - Status: ✓✓ 6+ HOUR DETECTION ACHIEVED")
        else:
            print(f"  - Status: ✓ Early detection achieved")
    else:
        print(f"\n✗ No early detection achieved")

print(f"\n{'='*80}")
print("ANALYSIS COMPLETE")
print(f"{'='*80}")
