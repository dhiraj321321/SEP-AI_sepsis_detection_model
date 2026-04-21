import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div className="bg-primary text-white vh-100 p-3" style={{width: '220px'}}>
      <h2 className="h5">SEP‑AI Dashboard</h2>
      <nav className="nav flex-column">
        <NavLink className="nav-link text-white" to="/">Dashboard</NavLink>
        <NavLink className="nav-link text-white" to="/manual">Manual Prediction</NavLink>
        <NavLink className="nav-link text-white" to="/patients">Patient Monitoring</NavLink>
        <NavLink className="nav-link text-white" to="/upload">Upload Dataset</NavLink>
        <NavLink className="nav-link text-white" to="/reports">Reports</NavLink>
      </nav>
    </div>
  );
};

export default Sidebar;