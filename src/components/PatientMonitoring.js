import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const PatientMonitoring = () => {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await axios.get('/patients');
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Admitted Patients</h1>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Risk</th>
            <th>Last Update</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {patients.map(p => (
            <tr key={p.patient_id}>
              <td>{p.patient_id}</td>
              <td>{p.name}</td>
              <td>{Math.round(p.current_risk * 100)}%</td>
              <td>{new Date(p.last_updated).toLocaleString()}</td>
              <td><Link to={`/patients/${p.patient_id}`} className="btn btn-sm btn-outline-primary">View</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientMonitoring;