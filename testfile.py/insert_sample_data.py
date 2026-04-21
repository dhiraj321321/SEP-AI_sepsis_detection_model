import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

# Database connection
DB_CONN_INFO = "host=localhost dbname=sepsis user=postgres password=Dp@1412"

def insert_sample_data():
    df = pd.read_csv('sample_patients.csv')

    with psycopg2.connect(DB_CONN_INFO, cursor_factory=RealDictCursor) as conn:
        with conn.cursor() as cur:
            # Insert patients (unique by patient_id)
            patients = df[['Patient_ID', 'Name', 'Age', 'Gender', 'Admission_Date', 'Doctor_Name', 'Current_Risk']].drop_duplicates()
            for _, p in patients.iterrows():
                cur.execute(
                    "INSERT INTO patient (patient_id, name, age, gender, admission_date, doctor_name, current_risk, last_updated) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s, now()) "
                    "ON CONFLICT (patient_id) DO NOTHING",
                    (p['Patient_ID'], p['Name'], p['Age'], p['Gender'], p['Admission_Date'], p['Doctor_Name'], p['Current_Risk'])
                )

            # Insert hourly data
            for _, row in df.iterrows():
                cur.execute(
                    "INSERT INTO hourly_data (patient_id, hour, hr, o2sat, temp, sbp, map, dbp, resp, risk) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (row['Patient_ID'], row['Hour'], row['HR'], row['O2Sat'], row['Temp'], row['SBP'], row['MAP'], row['DBP'], row['Resp'], row['Risk'])
                )

    print("Sample data inserted successfully.")

if __name__ == "__main__":
    insert_sample_data()