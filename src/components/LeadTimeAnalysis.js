import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function LeadTimeAnalysis({ analysisData }) {
  if (!analysisData?.confidence_progression) {
    return <div style={{ padding: '20px', color: '#666' }}>No analysis data available</div>;
  }

  const data = analysisData.confidence_progression.map((prob, hour) => ({
    hour,
    probability: parseFloat((prob * 100).toFixed(1)),
    threshold: 50,
  }));

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f5f5f5', 
      borderRadius: '8px',
      marginTop: '20px',
      border: '2px solid #e0e0e0'
    }}>
      <h3 style={{ marginTop: 0, color: '#333' }}>⏱️ Early Detection Analysis</h3>
      
      {analysisData.predicted && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: analysisData.meets_6hr_threshold ? '#d4edda' : '#fff3cd',
          borderRadius: '4px',
          marginBottom: '15px',
          border: `2px solid ${analysisData.meets_6hr_threshold ? '#28a745' : '#ffc107'}`,
          fontSize: '16px',
          fontWeight: 'bold',
          color: analysisData.meets_6hr_threshold ? '#155724' : '#856404'
        }}>
          ✓ Sepsis predicted <span style={{ fontSize: '20px' }}>{analysisData.lead_time_hours}</span> hours BEFORE clinical diagnosis
          {analysisData.meets_6hr_threshold && ' (6+ hours advantage!)'}
        </div>
      )}

      {!analysisData.predicted && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da',
          borderRadius: '4px',
          marginBottom: '15px',
          border: '2px solid #f5c6cb',
          color: '#721c24',
          fontWeight: 'bold'
        }}>
          ✗ No early prediction - risk did not exceed threshold before diagnosis
        </div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
          <XAxis 
            dataKey="hour" 
            label={{ value: 'Hours', position: 'insideBottomRight', offset: -5 }}
            stroke="#666"
          />
          <YAxis 
            label={{ value: 'Risk Probability (%)', angle: -90, position: 'insideLeft' }}
            stroke="#666"
          />
          <Tooltip 
            formatter={(value) => `${value}%`}
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          {analysisData.predicted && (
            <ReferenceLine 
              x={analysisData.prediction_hour} 
              stroke="#28a745" 
              strokeDasharray="3 3"
              label={{ value: 'Model Alert', position: 'top', fill: '#28a745', fontWeight: 'bold' }}
            />
          )}
          
          {analysisData.actual_sepsis_hour && (
            <ReferenceLine 
              x={analysisData.actual_sepsis_hour} 
              stroke="#dc3545" 
              strokeWidth={2}
              label={{ value: 'Clinical Diagnosis', position: 'top', fill: '#dc3545', fontWeight: 'bold' }}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey="probability" 
            stroke="#8884d8" 
            name="Model Prediction" 
            dot={{ fill: '#8884d8', r: 4 }}
            activeDot={{ r: 6 }}
            strokeWidth={2}
          />
          <Line 
            type="monotone" 
            dataKey="threshold" 
            stroke="#dc3545" 
            strokeDasharray="5 5" 
            name="Alert Threshold (50%)"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: '25px', backgroundColor: '#fff', padding: '15px', borderRadius: '4px' }}>
        <h4 style={{ marginTop: 0, color: '#333' }}>📊 Summary</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '15px' }}>
          <div style={{ padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', borderLeft: '4px solid #0066cc' }}>
            <strong>🎯 Model Detection:</strong><br/>
            Hour {analysisData.prediction_hour !== null ? analysisData.prediction_hour : 'N/A'}
          </div>
          
          <div style={{ padding: '10px', backgroundColor: '#ffe7e7', borderRadius: '4px', borderLeft: '4px solid #cc0000' }}>
            <strong>⚠️ Clinical Diagnosis:</strong><br/>
            Hour {analysisData.actual_sepsis_hour}
          </div>
          
          <div style={{ 
            padding: '10px', 
            backgroundColor: analysisData.meets_6hr_threshold ? '#d4edda' : '#fff3cd',
            borderRadius: '4px',
            borderLeft: `4px solid ${analysisData.meets_6hr_threshold ? '#28a745' : '#ffc107'}`
          }}>
            <strong>⏱️ Lead Time Advantage:</strong><br/>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{analysisData.lead_time_hours} hours</span>
          </div>
          
          <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', borderLeft: '4px solid #666' }}>
            <strong>📈 Maximum Probability:</strong><br/>
            {(Math.max(...analysisData.confidence_progression) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{ marginTop: '15px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
        <p>💡 <strong>Note:</strong> Earlier detection allows clinical teams more time for intervention and treatment planning.</p>
      </div>
    </div>
  );
}
