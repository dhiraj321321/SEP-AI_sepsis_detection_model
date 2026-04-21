import React, { useState } from 'react';
import LeadTimeAnalysis from './LeadTimeAnalysis';

/**
 * Example: How to integrate LeadTimeAnalysis component
 * 
 * This component demonstrates how to call the /analyze-lead-time endpoint
 * and display the results using the LeadTimeAnalysis component.
 */

export default function LeadTimeDemo() {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeLeadTime = async () => {
    setLoading(true);
    setError(null);

    try {
      // Example: Mock vital signs data for demonstration
      // Replace with real patient data from your database
      const vitalSignsData = [
        { HR: 80, O2Sat: 98, Temp: 36.5, SBP: 120, MAP: 85, DBP: 65, Resp: 16 },
        { HR: 82, O2Sat: 97, Temp: 36.6, SBP: 118, MAP: 83, DBP: 63, Resp: 16 },
        { HR: 85, O2Sat: 96, Temp: 36.8, SBP: 115, MAP: 80, DBP: 60, Resp: 17 },
        { HR: 88, O2Sat: 95, Temp: 37.2, SBP: 110, MAP: 75, DBP: 55, Resp: 18 },
        { HR: 92, O2Sat: 93, Temp: 37.8, SBP: 105, MAP: 70, DBP: 50, Resp: 20 },
        { HR: 95, O2Sat: 91, Temp: 38.2, SBP: 100, MAP: 65, DBP: 45, Resp: 22 },
        // ... more hours of data ...
      ];

      // Call backend API
      const response = await fetch('http://localhost:5000/analyze-lead-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vital_signs: vitalSignsData,
          actual_sepsis_hour: vitalSignsData.length - 1, // Last hour was diagnosis
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze lead time');
      }

      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h2>Lead Time Analysis Demo</h2>
      <button
        onClick={analyzeLeadTime}
        disabled={loading}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze Lead Time'}
      </button>

      {error && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb',
        }}>
          Error: {error}
        </div>
      )}

      {analysisData && (
        <LeadTimeAnalysis analysisData={analysisData} />
      )}
    </div>
  );
}
