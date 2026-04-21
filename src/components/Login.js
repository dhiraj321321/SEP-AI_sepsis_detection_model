import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    // placeholder: call auth API
    navigate('/');
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <form onSubmit={submit} className="p-4 border rounded" style={{minWidth: '300px'}}>
        <h3 className="mb-3">Doctor Login</h3>
        <div className="mb-2">
          <label className="form-label">Username</label>
          <input className="form-control" value={user} onChange={e => setUser(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input type="password" className="form-control" value={pass} onChange={e => setPass(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary w-100">Login</button>
      </form>
    </div>
  );
};

export default Login;