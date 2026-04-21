"""
Check the training dataset to understand data distribution
"""

import pandas as pd
import numpy as np

# Load training dataset
print("Loading training dataset...")
df = pd.read_csv("Dataset.csv")

print(f"\nDataset shape: {df.shape}")
print(f"\nColumn names:")
for i, col in enumerate(df.columns):
    print(f"  {i:2d}: {col}")

print(f"\n" + "="*70)
print("DATA DISTRIBUTION ANALYSIS")
print("="*70)

# Check vital columns
vital_cols = ["HR", "O2Sat", "Temp", "SBP", "MAP", "DBP", "Resp"]
for col in vital_cols:
    if col in df.columns:
        print(f"\n{col}:")
        print(f"  Min: {df[col].min():.2f}, Max: {df[col].max():.2f}, Mean: {df[col].mean():.2f}")

# Check other important columns
print(f"\n" + "-"*70)
other_cols = ["Glucose", "Age", "Gender", "ICULOS", "Hour"]
for col in other_cols:
    if col in df.columns:
        print(f"\n{col}:")
        print(f"  Min: {df[col].min()}, Max: {df[col].max()}, Mean: {df[col].mean():.2f}")
        if col in ["Gender", "Unit1", "Unit2"]:
            print(f"  Unique values: {df[col].unique()}")

# Check sepsis label
print(f"\n" + "-"*70)
if "SepsisLabel" in df.columns:
    print(f"\nSepsisLabel distribution:")
    print(f"  No Sepsis (0): {(df['SepsisLabel'] == 0).sum()}")
    print(f"  Sepsis (1): {(df['SepsisLabel'] == 1).sum()}")
    print(f"  Ratio: {(df['SepsisLabel'] == 1).sum() / len(df) * 100:.2f}%")

# Show sample rows for sepsis cases
print(f"\n" + "="*70)
print("SAMPLE SEPSIS CASES (SepsisLabel=1)")
print("="*70)

if "SepsisLabel" in df.columns:
    sepsis_rows = df[df["SepsisLabel"] == 1]
    if len(sepsis_rows) > 0:
        print(f"\nFirst sepsis case:")
        print(sepsis_rows.iloc[0])

# Check a healthy case
print(f"\n" + "="*70)
print("SAMPLE NON-SEPSIS CASE (SepsisLabel=0)")
print("="*70)

if "SepsisLabel" in df.columns:
    healthy_rows = df[df["SepsisLabel"] == 0]
    if len(healthy_rows) > 0:
        print(f"\nFirst healthy case:")
        print(healthy_rows.iloc[0])
