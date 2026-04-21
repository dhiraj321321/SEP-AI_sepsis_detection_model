import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import LeadTimeAnalysis from './LeadTimeAnalysis';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const PatientDetail = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [id]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`/patient-history?id=${id}`);
      setPatient(res.data.patient);
      setHistory(res.data.history);
      
      // Call analyze-lead-time endpoint to get early detection analysis
      if (res.data.history && res.data.history.length > 0) {
        try {
          const vitalSigns = res.data.history.map(h => ({
            hr: h.hr,
            o2sat: h.o2sat,
            temp: h.temp,
            sbp: h.sbp,
            map: h.map,
            dbp: h.dbp,
            resp: h.resp
          }));
          
          const analysisRes = await axios.post('/analyze-lead-time', {
            vital_signs: vitalSigns,
            actual_sepsis_hour: res.data.history.length - 1
          });
          
          setAnalysisData(analysisRes.data);
        } catch (analysisErr) {
          console.error('Lead time analysis error:', analysisErr);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const prepareChart = (field) => {
    return {
      labels: history.map(h => h.hour),
      datasets: [
        {
          label: field,
          data: history.map(h => h[field.toLowerCase()]),
          borderColor: 'rgba(75,192,192,1)',
          fill: false
        }
      ]
    };
  };

  if (!patient) return <p>Loading...</p>;

  const lastRisk = history.length ? history[history.length-1].risk : 0;
  const showAlert = lastRisk > 0.5;

  return (
    <div>
      {showAlert && (
        <div className="alert alert-danger">
          ⚠ HIGH SEPSIS RISK - Immediate medical attention recommended.
        </div>
      )}
      <h1>Patient {patient.name} ({patient.patient_id})</h1>
      <div className="mb-3">
        <strong>Age:</strong> {patient.age} &nbsp;
        <strong>Gender:</strong> {patient.gender} &nbsp;
        <strong>Doctor:</strong> {patient.doctor_name}
      </div>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Hour</th><th>HR</th><th>O2Sat</th><th>Temp</th><th>SBP</th><th>MAP</th><th>DBP</th><th>Resp</th><th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {history.map(h => (
            <tr key={h.hour}>
              <td>{h.hour}</td>
              <td>{h.hr}</td>
              <td>{h.o2sat}</td>
              <td>{h.temp}</td>
              <td>{h.sbp}</td>
              <td>{h.map}</td>
              <td>{h.dbp}</td>
              <td>{h.resp}</td>
              <td>{Math.round(h.risk * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <div className="col-md-6">
          <Line data={prepareChart('Risk')} />
        </div>
        <div className="col-md-6">
          <Line data={prepareChart('HR')} />
        </div>
      </div>
      <div className="row mt-3">
        <div className="col-md-6">
          <Line data={prepareChart('Temp')} />
        </div>
      </div>
      
      {/* 8+ HOUR EARLY DETECTION ANALYSIS */}
      {analysisData && (
        <div className="mt-4">
          <LeadTimeAnalysis analysisData={analysisData} />
        </div>
      )}
    </div>
  );
};

export default PatientDetail;