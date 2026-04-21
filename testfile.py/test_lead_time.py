import requests
import json
import pandas as pd

# Sample vital signs data simulating sepsis development over 20 hours
# Using more extreme values like in the sepsis datasets
vital_signs = [
    {"HR": 75, "O2Sat": 98, "Temp": 36.5, "SBP": 120, "MAP": 85, "DBP": 70, "Resp": 16},  # Hour 1
    {"HR": 78, "O2Sat": 97, "Temp": 36.7, "SBP": 118, "MAP": 83, "DBP": 68, "Resp": 17},  # Hour 2
    {"HR": 82, "O2Sat": 96, "Temp": 37.0, "SBP": 115, "MAP": 80, "DBP": 65, "Resp": 18},  # Hour 3
    {"HR": 85, "O2Sat": 95, "Temp": 37.2, "SBP": 112, "MAP": 78, "DBP": 62, "Resp": 19},  # Hour 4
    {"HR": 88, "O2Sat": 94, "Temp": 37.5, "SBP": 108, "MAP": 75, "DBP": 60, "Resp": 20},  # Hour 5
    {"HR": 92, "O2Sat": 93, "Temp": 37.8, "SBP": 105, "MAP": 72, "DBP": 58, "Resp": 21},  # Hour 6
    {"HR": 95, "O2Sat": 92, "Temp": 38.0, "SBP": 102, "MAP": 70, "DBP": 55, "Resp": 22},  # Hour 7
    {"HR": 98, "O2Sat": 91, "Temp": 38.2, "SBP": 98, "MAP": 68, "DBP": 52, "Resp": 23},   # Hour 8
    {"HR": 102, "O2Sat": 90, "Temp": 38.5, "SBP": 95, "MAP": 65, "DBP": 50, "Resp": 24},  # Hour 9
    {"HR": 105, "O2Sat": 89, "Temp": 38.8, "SBP": 92, "MAP": 62, "DBP": 48, "Resp": 25},  # Hour 10 - Should predict here
    {"HR": 108, "O2Sat": 88, "Temp": 39.0, "SBP": 88, "MAP": 60, "DBP": 45, "Resp": 26},  # Hour 11
    {"HR": 112, "O2Sat": 87, "Temp": 39.2, "SBP": 85, "MAP": 58, "DBP": 42, "Resp": 27},  # Hour 12
    {"HR": 115, "O2Sat": 86, "Temp": 39.5, "SBP": 82, "MAP": 55, "DBP": 40, "Resp": 28},  # Hour 13
    {"HR": 118, "O2Sat": 85, "Temp": 39.8, "SBP": 80, "MAP": 52, "DBP": 38, "Resp": 29},  # Hour 14
    {"HR": 120, "O2Sat": 84, "Temp": 40.0, "SBP": 78, "MAP": 50, "DBP": 35, "Resp": 30},  # Hour 15
    {"HR": 125, "O2Sat": 83, "Temp": 40.2, "SBP": 75, "MAP": 48, "DBP": 32, "Resp": 31},  # Hour 16
    {"HR": 128, "O2Sat": 82, "Temp": 40.5, "SBP": 72, "MAP": 45, "DBP": 30, "Resp": 32},  # Hour 17
    {"HR": 130, "O2Sat": 81, "Temp": 40.8, "SBP": 70, "MAP": 42, "DBP": 28, "Resp": 33},  # Hour 18
    {"HR": 132, "O2Sat": 80, "Temp": 41.0, "SBP": 68, "MAP": 40, "DBP": 25, "Resp": 34},  # Hour 19
    {"HR": 135, "O2Sat": 79, "Temp": 41.2, "SBP": 65, "MAP": 38, "DBP": 22, "Resp": 35},  # Hour 20 - Actual sepsis
]

# Actual sepsis diagnosed at hour 20
actual_sepsis_hour = 20

# Make API request
url = "http://localhost:5000/analyze-lead-time"
data = {
    "vital_signs": vital_signs,
    "actual_sepsis_hour": actual_sepsis_hour
}

response = requests.post(url, json=data)
result = response.json()

print("Lead Time Analysis Result:")
print(json.dumps(result, indent=2))

if result.get("predicted"):
    print(f"\nModel predicted sepsis {result['lead_time_hours']} hours early!")
    print(f"First prediction at hour: {result['prediction_hour']}")
    print(f"Actual diagnosis at hour: {result['actual_sepsis_hour']}")
    print(f"Meets 6-hour threshold: {result['meets_6hr_threshold']}")
else:
    print("Model did not predict sepsis early.")

# Let's also check the prediction probabilities for the last few hours
print("\nChecking prediction probabilities for recent hours...")
for i in range(max(1, len(vital_signs)-5), len(vital_signs)+1):
    test_data = vital_signs[:i]
    test_response = requests.post(url, json={"vital_signs": test_data, "actual_sepsis_hour": 20})
    test_result = test_response.json()
    if "confidence_progression" in test_result:
        prob = test_result["confidence_progression"][-1]
        print(f"Hour {i}: Probability = {prob:.3f}")