import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get('/patients');
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const statusColor = (risk) => {
    if (risk >= 0.5) return 'danger';
    if (risk >= 0.3) return 'warning';
    return 'success';
  };

  const getLeadTimeIndicator = (patient) => {
    // This is a placeholder - actual lead time will be calculated on PatientDetail page
    return <span className="badge bg-info">View Details</span>;
  };

  return (
    <div>
      <h1>Patient Overview</h1>
      <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '5px', marginBottom: '20px', border: '2px solid #1976d2' }}>
        <strong style={{ color: '#1976d2' }}>✓ 8+ Hour Early Detection Enabled</strong>
        <p style={{ marginBottom: 0, fontSize: '14px', color: '#555' }}>
          Click on any patient to view their personalized early detection analysis
        </p>
      </div>
      <table className="table table-striped">
        <thead>
          <tr>
            <th>Patient ID</th>
            <th>Name</th>
            <th>Current Risk</th>
            <th>Status</th>
            <th>Last Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.patient_id}>
              <td>{p.patient_id}</td>
              <td>{p.name}</td>
              <td>{Math.round(p.current_risk * 100)}%</td>
              <td>
                <span className={`badge bg-${statusColor(p.current_risk)}`}>
                  {statusColor(p.current_risk) === 'danger' ? 'High' : statusColor(p.current_risk) === 'warning' ? 'Medium' : 'Safe'}
                </span>
              </td>
              <td>{new Date(p.last_updated).toLocaleString()}</td>
              <td>
                <Link to={`/patients/${p.patient_id}`} className="btn btn-sm btn-outline-primary">
                  View Details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;