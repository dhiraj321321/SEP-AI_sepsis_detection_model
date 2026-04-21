import React, { useState } from 'react';
import axios from 'axios';

const UploadDataset = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [patientPredictions, setPatientPredictions] = useState([]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/upload-data', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(res.data.preview);
      setResult(res.data.overall_prediction || res.data.prediction || null);
      // optionally keep all patients for extra UI
      if (res.data.patient_predictions) {
        setPatientPredictions(res.data.patient_predictions);
      }
    } catch (err) {
      console.error(err);
      setResult(null);
      setPatientPredictions([]);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setPatientPredictions([]);
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div>
      <h1>Upload Dataset</h1>
      <div className="mb-3">
        <input type="file" className="form-control" onChange={handleFileChange} />
      </div>
      <button className="btn btn-primary" onClick={handleUpload}>Upload & Predict</button>
      {(preview.length > 0 || result || patientPredictions.length > 0) && (
        <button className="btn btn-danger ms-2" onClick={handleClear}>Clear</button>
      )}

      {preview.length > 0 && (
        <div className="mt-4">
          <h5>Data Preview</h5>
          <table className="table table-bordered table-sm">
            <thead>
              <tr>
                {Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val,j) => <td key={j}>{val}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div className="mt-4 alert alert-info">
          <h4>Sepsis Risk: {isNaN(result.probability) ? 'N/A' : `${Math.round(result.probability * 100)}%`}</h4>
          <p>{result.decision || 'N/A'}</p>
          <p>{result.explanation || 'No explanation available'}</p>
          {Array.isArray(result.probability_curve) && (
            <div className="mt-3">
              <h5>Probability curve (%):</h5>
              <pre className="text-xs bg-black/70 p-2 rounded text-white overflow-auto" style={{ maxHeight: '140px' }}>
                {result.probability_curve.map((p, idx) => `${idx + 1}: ${p.toFixed(1)}`).join('\n')}
              </pre>
            </div>
          )}
          {result.factors && (
            <div>
              <h5>Top Factors</h5>
              <ul>
                {result.factors.map((f, idx) => <li key={idx}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {patientPredictions.length > 0 && (
        <div className="mt-4" style={{ border: '1px solid #444', borderRadius: '12px', padding: '18px', backgroundColor: '#0f172a' }}>
          <h4 style={{ color: '#f8fafc' }}>Per-Patient Prediction Dashboard</h4>
          {(() => {
            const sorted = [...patientPredictions].sort((a, b) => b.probability - a.probability);
            const highest = sorted[0];
            const withSepsis = patientPredictions.filter(p => p.decision === 'Sepsis Detected');
            const highRiskCount = patientPredictions.filter(p => p.probability >= 0.9).length;
            const safeCount = patientPredictions.length - withSepsis.length;
            return (
              <>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', padding: '10px 14px', backgroundColor: '#111827', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#60a5fa' }}>Total Patients</p>
                    <p style={{ fontSize: '1.4rem', margin: '0.2rem 0', color: '#fff' }}>{patientPredictions.length}</p>
                  </div>
                  <div style={{ flex: '1 1 220px', padding: '10px 14px', backgroundColor: '#111827', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#f87171' }}>Sepsis Cases</p>
                    <p style={{ fontSize: '1.4rem', margin: '0.2rem 0', color: '#fff' }}>{withSepsis.length}</p>
                  </div>
                  <div style={{ flex: '1 1 220px', padding: '10px 14px', backgroundColor: '#111827', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#34d399' }}>Safe</p>
                    <p style={{ fontSize: '1.4rem', margin: '0.2rem 0', color: '#fff' }}>{safeCount}</p>
                  </div>
                  <div style={{ flex: '1 1 220px', padding: '10px 14px', backgroundColor: '#111827', borderRadius: '8px' }}>
                    <p style={{ margin: 0, color: '#fbbf24' }}>High Risk (&ge;90%)</p>
                    <p style={{ fontSize: '1.4rem', margin: '0.2rem 0', color: '#fff' }}>{highRiskCount}</p>
                  </div>
                </div>
                <div className="mt-4" style={{ padding: '10px', backgroundColor: '#1f2937', borderRadius: '8px' }}>
                  <h5 style={{ marginBottom: '6px', color: '#38bdf8' }}>Top Risk Patient</h5>
                  <p style={{ margin: 0, color: '#fff' }}>Patient <strong>{highest.patient_id}</strong> with <strong>{Math.round(highest.probability * 100)}%</strong> risk ({highest.decision})</p>
                </div>
                <h5 className="mt-3" style={{ color: '#cbd5e1' }}>Patient Alerts</h5>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {patientPredictions.map((patient) => (
                    <li key={patient.patient_id} style={{
                      color: '#e2e8f0',
                      marginBottom: '6px',
                      borderRadius: '8px',
                      padding: '9px 10px',
                      backgroundColor: patient.decision === 'Sepsis Detected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.12)',
                      border: patient.decision === 'Sepsis Detected' ? '1px solid rgba(239, 68, 68, 0.7)' : '1px solid rgba(34, 197, 94, 0.6)'
                    }}>
                      Patient {patient.patient_id}: <strong>{patient.decision}</strong> ({Math.round(patient.probability * 100)}%)
                      {patient.decision === 'Sepsis Detected' ? ' 🚨' : ' ✅'}
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default UploadDataset;