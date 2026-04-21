import pandas as pd
from app import preprocess, model, model_features, adjust_probability, explain_prediction, interpret_features, THRESHOLD

def norm_patient_id(v):
    if pd.isna(v):
        return 0.0
    s = str(v).strip()
    if s.lower().startswith('p'):
        s = s[1:]
    digits = ''.join(ch for ch in s if ch.isdigit())
    return float(digits) if digits else 0.0


df = pd.read_csv('patients_risk_levels_clean.csv')
print('rows', len(df))
print('columns', df.columns.tolist())

if 'Patient_ID' in df.columns:
    df['Patient_ID'] = df['Patient_ID'].apply(norm_patient_id)

# ensure features exist
for col in model_features:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    else:
        df[col] = 0

for pid, group in df.groupby('Patient_ID', sort=False):
    p = preprocess(group.copy())
    for col in model_features:
        if col in p.columns:
            p[col] = pd.to_numeric(p[col], errors='coerce').fillna(0)
        else:
            p[col] = 0
    p = p[model_features].copy()
    probs = model.predict_proba(p)[:,1]
    adjusted = [adjust_probability(x) for x in probs]
    risk = adjusted[-1]
    dec = 'Sepsis Detected' if risk >= THRESHOLD else 'No Sepsis'
    print('patient', pid, 'risk', risk, 'decision', dec, 'curve', [round(x*100,2) for x in adjusted])

print('smoke test done')