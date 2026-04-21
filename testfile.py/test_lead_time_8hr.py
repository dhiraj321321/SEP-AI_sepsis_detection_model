"""
Test script to demonstrate 8+ hour early sepsis detection capability.
This tests the optimized lead time detection system using real patient data.
"""

import requests
import json
import pandas as pd
from datetime import datetime

def test_with_api():
    """Test using the Flask API with sample data"""
    print("\n" + "="*70)
    print("METHOD 1: API TEST WITH ENHANCED FEATURES")
    print("="*70)
    
    # Sample data with all required features
    vital_signs = [
        {
            "Hour": 1, "HR": 75, "O2Sat": 98, "Temp": 36.5, "SBP": 120, "MAP": 85, 
            "DBP": 70, "Resp": 16, "Glucose": 110, "Age": 55, "Gender": 1, 
            "Unit1": 0, "Unit2": 0, "HospAdmTime": 1, "ICULOS": 1, "Patient_ID": 1,
            "EtCO2": 0, "BaseExcess": 0, "HCO3": 0, "FiO2": 0, "pH": 0
        },
        {
            "Hour": 2, "HR": 78, "O2Sat": 97, "Temp": 36.7, "SBP": 118, "MAP": 83,
            "DBP": 68, "Resp": 17, "Glucose": 112, "Age": 55, "Gender": 1,
            "Unit1": 0, "Unit2": 0, "HospAdmTime": 1, "ICULOS": 2, "Patient_ID": 1,
            "EtCO2": 0, "BaseExcess": 0, "HCO3": 0, "FiO2": 0, "pH": 0
        },
        {
            "Hour": 3, "HR": 82, "O2Sat": 96, "Temp": 37.0, "SBP": 115, "MAP": 80,
            "DBP": 65, "Resp": 18, "Glucose": 115, "Age": 55, "Gender": 1,
            "Unit1": 0, "Unit2": 0, "HospAdmTime": 1, "ICULOS": 3, "Patient_ID": 1,
            "EtCO2": 0, "BaseExcess": 0, "HCO3": 0, "FiO2": 0, "pH": 0
        },
    ]
    
    actual_sepsis_hour = 3
    
    url = "http://localhost:5000/analyze-lead-time"
    data = {
        "vital_signs": vital_signs,
        "actual_sepsis_hour": actual_sepsis_hour
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        result = response.json()
        return result
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to Flask API at localhost:5000")
        print("   Please start the Flask server first: python app.py")
        return None
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return None

def test_with_real_data():
    """Test using real patient data from training set"""
    print("\n" + "="*70)
    print("METHOD 2: TEST WITH REAL TRAINING DATA")
    print("="*70)
    
    # Load training data
    try:
        df_train = pd.read_csv("Dataset.csv")
    except Exception as e:
        print(f"❌ Cannot load Dataset.csv: {e}")
        return None
    
    # Find a sepsis patient
    sepsis_patients = df_train[df_train["SepsisLabel"] == 1]["Patient_ID"].unique()
    
    if len(sepsis_patients) == 0:
        print("❌ No sepsis patients found in training data")
        return None
    
    patient_id = sepsis_patients[0]
    patient_data = df_train[df_train["Patient_ID"] == patient_id].copy()
    patient_data = patient_data.sort_values("Hour")
    
    # Find sepsis diagnosis hour
    sepsis_hour = patient_data[patient_data["SepsisLabel"] == 1]["Hour"].min()
    
    # Use data around sepsis diagnosis
    test_data = patient_data[patient_data["Hour"] <= sepsis_hour].copy()
    test_data = test_data.dropna(thresh=15)  # Keep rows with enough data
    test_data = test_data.replace([float('inf'), float('-inf')], 0)
    test_data = test_data.fillna(0)
    test_data = test_data.tail(min(10, len(test_data)))  # Use last 10 or fewer
    
    if len(test_data) < 3:
        print(f"⚠ Not enough clean data for patient {patient_id}")
        return None
    
    records = test_data.to_dict('records')
    
    url = "http://localhost:5000/analyze-lead-time"
    data = {
        "vital_signs": records,
        "actual_sepsis_hour": int(sepsis_hour)
    }
    
    try:
        response = requests.post(url, json=data, timeout=10)
        result = response.json()
        result["patient_id"] = patient_id
        result["data_points_used"] = len(records)
        return result
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to Flask API")
        return None
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return None

if __name__ == "__main__":
    print("\n" + "="*70)
    print("SEPSIS EARLY DETECTION TEST - 8+ HOUR OPTIMIZATION")
    print("="*70)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test 1: API Test
    result1 = test_with_api()
    
    if result1:
        print(f"\n✓ Method 1 Results:")
        print(f"  Predicted: {result1.get('predicted')}")
        if result1.get('predicted'):
            print(f"  Lead Time: {result1.get('lead_time_hours')} hours")
            print(f"  Detection Method: {result1.get('detection_method')}")
            print(f"  Meets 8-hour threshold: {result1.get('meets_8hr_threshold')}")
    
    # Test 2: Real Data Test
    result2 = test_with_real_data()
    
    if result2:
        print(f"\n✓ Method 2 Results (Real Patient Data):")
        print(f"  Patient ID: {result2.get('patient_id')}")
        print(f"  Data Points Used: {result2.get('data_points_used')}")
        print(f"  Predicted: {result2.get('predicted')}")
        if result2.get('predicted'):
            print(f"  Lead Time: {result2.get('lead_time_hours')} hours")
            print(f"  Detection Method: {result2.get('detection_method')}")
            print(f"  Meets 8-hour threshold: {result2.get('meets_8hr_threshold')}")
            
            if result2.get('meets_8hr_threshold'):
                print(f"\n  ✓✓✓ 8+ HOUR DETECTION ACHIEVED! ✓✓✓")
            elif result2.get('meets_6hr_threshold'):
                print(f"\n  ✓✓ 6+ HOUR DETECTION ACHIEVED ✓✓")
    
    print("\n" + "="*70)
    print("TEST COMPLETE")
    print("="*70)
