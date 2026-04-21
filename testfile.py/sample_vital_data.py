"""
Sample vital sign data for testing sepsis predictions:
- LOW RISK: Stable, healthy vitals
- HIGH RISK: Deteriorating vitals showing sepsis warning signs
"""

import pandas as pd
import json

# ============================================================================
# LOW RISK PATIENT - Stable Vitals (Healthy)
# ============================================================================
# All vital signs remain within normal ranges
# Minimal hour-to-hour variation
# Expected prediction: 0-20% risk

low_risk_data = pd.DataFrame({
    'Hour': [1, 2, 3, 4, 5, 6, 7, 8],
    'HR': [72, 74, 75, 73, 75, 76, 74, 75],           # Normal: 60-100 bpm
    'O2Sat': [98, 98, 97, 98, 97, 98, 98, 97],       # Excellent: 95-100%
    'Temp': [36.8, 36.9, 36.8, 36.9, 37.0, 36.9, 36.8, 37.0],  # Normal: 36.5-37.5°C
    'SBP': [118, 120, 119, 121, 119, 120, 121, 120],  # Normal: 90-120 mmHg
    'MAP': [82, 83, 82, 84, 82, 83, 84, 83],         # Normal: 70-100 mmHg
    'DBP': [68, 70, 68, 71, 68, 70, 71, 70],         # Normal: 60-80 mmHg
    'Resp': [16, 16, 17, 16, 17, 16, 17, 16],        # Normal: 12-20 breaths/min
})

# ============================================================================
# HIGH RISK PATIENT - Deteriorating Vitals (Sepsis Warning Signs)
# ============================================================================
# Multiple warning signs of sepsis:
# - Tachycardia (elevated HR)
# - Hypoxia (low O2Sat)
# - Fever (elevated temperature)
# - Tachypnea (elevated respiratory rate)
# - Hypertension + tachycardia pattern
# Expected prediction: 50-90% risk

high_risk_data = pd.DataFrame({
    'Hour': [1, 2, 3, 4, 5, 6, 7, 8],
    'HR': [88, 95, 102, 110, 118, 125, 130, 135],      # Tachycardia: 88→135 bpm (+47 bpm)
    'O2Sat': [97, 96, 95, 93, 91, 89, 88, 86],        # Hypoxia: 97→86% (-11%)
    'Temp': [37.2, 37.5, 37.8, 38.1, 38.4, 38.7, 39.0, 39.2],  # Fever: 37.2→39.2°C (+2°C)
    'SBP': [125, 130, 135, 140, 142, 145, 148, 150],   # Rising BP: 125→150
    'MAP': [88, 91, 94, 97, 99, 102, 104, 106],        # Rising MAP
    'DBP': [75, 78, 80, 82, 84, 86, 88, 90],          # Rising DBP
    'Resp': [18, 20, 22, 24, 26, 28, 30, 32],         # Tachypnea: 18→32 breaths/min
})

# ============================================================================
# EXPORT SAMPLES
# ============================================================================

print("=" * 80)
print("SAMPLE VITAL SIGNS DATA FOR SEPSIS PREDICTION TESTING")
print("=" * 80)

print("\n\n" + "=" * 80)
print("📊 LOW RISK PATIENT (Healthy - Stable Vitals)")
print("=" * 80)
print(low_risk_data.to_string(index=False))
print(f"\nCharacteristics:")
print(f"  • Heart Rate: Stable 72-76 bpm (normal)")
print(f"  • O2 Saturation: 97-98% (excellent)")
print(f"  • Temperature: 36.8-37.0°C (normal)")
print(f"  • Blood Pressure: 118-121 / 68-71 (normal)")
print(f"  • Respiratory Rate: 16-17 breaths/min (normal)")
print(f"  • Pattern: ✅ STABLE throughout all hours")
print(f"\nExpected Prediction: 0-20% risk (LOW)")
print(f"Expected Decision: ✅ No Sepsis")

print("\n\n" + "=" * 80)
print("🔴 HIGH RISK PATIENT (Deteriorating - Sepsis Warning Signs)")
print("=" * 80)
print(high_risk_data.to_string(index=False))
print(f"\nCharacteristics:")
print(f"  • Heart Rate: TACHYCARDIA 88→135 bpm (+47 bpm / +53%)")
print(f"  • O2 Saturation: HYPOXIA 97%→86% (-11%)")
print(f"  • Temperature: FEVER 37.2→39.2°C (+2°C)")
print(f"  • Blood Pressure: RISING 125→150 / 75→90 mmHg")
print(f"  • Respiratory Rate: TACHYPNEA 18→32 breaths/min (+78%)")
print(f"  • Pattern: ⚠️  RAPID DETERIORATION - Classic sepsis signs")
print(f"\nSepsis Indicators Present:")
print(f"  1. Tachycardia (HR > 90) ✓")
print(f"  2. Fever (Temp > 38°C) ✓")
print(f"  3. Tachypnea (Resp > 20) ✓")
print(f"  4. Hypoxia (O2Sat < 90%) ✓")
print(f"  5. Progressive Multi-organ Dysfunction ✓")
print(f"\nExpected Prediction: 50-90% risk (HIGH)")
print(f"Expected Decision: 🔴 SEPSIS DETECTED")

# ============================================================================
# CSV EXPORT
# ============================================================================

print("\n" + "="*80)
print("CSV FORMAT (for uploading to web interface)")
print("="*80)

print("\n--- LOW RISK CSV ---")
print(low_risk_data.to_csv(index=False))

print("\n--- HIGH RISK CSV ---")
print(high_risk_data.to_csv(index=False))

# ============================================================================
# JSON FORMAT
# ============================================================================

print("\n" + "="*80)
print("JSON FORMAT (for API testing)")
print("="*80)

print("\n--- LOW RISK JSON ---")
low_risk_json = low_risk_data.to_dict(orient='records')
print(json.dumps(low_risk_json, indent=2))

print("\n--- HIGH RISK JSON ---")
high_risk_json = high_risk_data.to_dict(orient='records')
print(json.dumps(high_risk_json, indent=2))

# ============================================================================
# SAVE TO FILES
# ============================================================================

low_risk_data.to_csv('low_risk_patient.csv', index=False)
high_risk_data.to_csv('high_risk_patient.csv', index=False)

print("\n" + "="*80)
print("✅ Files saved:")
print("  • low_risk_patient.csv")
print("  • high_risk_patient.csv")
print("="*80 + "\n")