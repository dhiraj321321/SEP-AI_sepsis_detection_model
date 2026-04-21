import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, NavLink, useLocation } from 'react-router-dom';
import AddPatient from './components/ManualPrediction';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  Legend,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';

// mock data helper
const names = ['Raj Sharma', 'Priya Patel', 'Anita Desai', 'Carlos Méndez', 'Liu Wei', 'Sara Johansson', 'Mohamed Ali', 'Yuki Sato'];
const generateVitals = () => ({
  hr: 60 + Math.random() * 80,
  o2: 90 + Math.random() * 10,
  temp: 36 + Math.random() * 2,
  sbp: 100 + Math.random() * 40,
  map: 70 + Math.random() * 20,
  dbp: 60 + Math.random() * 20,
  resp: 12 + Math.random() * 8,
});

const generatePatient = (id) => {
  const base = generateVitals();
  return {
    id,
    name: names[id % names.length],
    vitalsHistory: Array.from({ length: 12 }, () => generateVitals()),
    risk: Math.random() * 100,
    status: 'stable',
    updated: new Date().toISOString(),
  };
};

const getSamplePatients = () => {
  const initial = Array.from({ length: 8 }, (_, i) => generatePatient(i + 1));
  localStorage.setItem('patients', JSON.stringify(initial));
  return initial;
};

const ensureVitalsHistory = (vitalsHistory) => {
  if (Array.isArray(vitalsHistory) && vitalsHistory.length > 0) return vitalsHistory;
  return Array.from({ length: 12 }, () => generateVitals());
};

function App() {
  const [patients, setPatients] = useState([]);
  const [dataSource, setDataSource] = useState('loading'); // 'db' | 'local'

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/patients');
        if (res.ok) {
          const dbPatients = await res.json();
          if (Array.isArray(dbPatients) && dbPatients.length > 0) {
            setPatients(dbPatients.map((p, idx) => ({
              id: p?.id ?? p?._id ?? idx + 1,
              name: p?.name ?? `Patient ${idx + 1}`,
              vitalsHistory: Array.isArray(p?.vitalsHistory) && p.vitalsHistory.length > 0 ? p.vitalsHistory : Array.from({ length: 12 }, () => generateVitals()),
              risk: Number(p?.risk) >= 0 ? Number(p.risk) : Math.floor(Math.random() * 100),
              status: p?.status ?? 'stable',
              updated: p?.last_updated || p?.updated || new Date().toISOString(),
            })));
            setDataSource('db');
            return;
          }
        }
        throw new Error('No DB patients');
      } catch (err) {
        const stored = localStorage.getItem('patients');
        if (stored) {
          setPatients(JSON.parse(stored));
          setDataSource('local');
        } else {
          const sample = getSamplePatients();
          setPatients(sample);
          setDataSource('local');
        }
      }
    })();
  }, []);

  const updateScores = useCallback(() => {
    setPatients((p) =>
      p.map((pt) => {
        const currentVitals = ensureVitalsHistory(pt.vitalsHistory);
        const change = (Math.random() - 0.5) * 10;
        const risk = Math.max(0, Math.min(100, Number(pt.risk) || 0 + change));
        const newVitals = { ...generateVitals() };
        return {
          ...pt,
          risk,
          vitalsHistory: [...currentVitals.slice(1), newVitals],
          updated: new Date().toISOString(),
        };
      })
    );
  }, []);

  useEffect(() => {
    const iv = setInterval(updateScores, 5000);
    return () => clearInterval(iv);
  }, [updateScores]);

  useEffect(() => {
    localStorage.setItem('patients', JSON.stringify(patients));
  }, [patients]);

  return (
    <Router>
      <div className="w-full min-h-screen bg-[#0d1117] text-white flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#0d1117]">
          <RouteFade>
            <Routes>
              <Route path="/" element={<Dashboard patients={patients} setPatients={setPatients} />} />
              <Route path="/manual" element={<ManualPredictionLegacy />} />
              <Route path="/add-patient" element={<AddPatient />} />
              <Route path="/patients" element={<PatientMonitoring patients={patients} />} />
              <Route path="/upload" element={<UploadDataset setPatients={setPatients} />} />
              <Route path="/reports" element={<Reports patients={patients} />} />
              <Route path="/patients/:id" element={<PatientDetail patients={patients} />} />
            </Routes>
          </RouteFade>
        </main>
      </div>
    </Router>
  );
}

function RouteFade({ children }) {
  return <div className="transition-opacity duration-200 ease-in-out">{children}</div>;
}

function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const links = [
    { to: '/', icon: '🏠', label: 'Dashboard', color: '#00d4aa' },
    { to: '/manual', icon: '🩺', label: 'Predict', color: '#00d4aa' },
    { to: '/add-patient', icon: '➕', label: 'Add Patient', color: '#00d4aa' },
    { to: '/patients', icon: '👥', label: 'Patients', color: '#00d4aa' },
    { to: '/upload', icon: '📤', label: 'Upload', color: '#ffa502' },
    { to: '/reports', icon: '📊', label: 'Reports', color: '#00d4aa' },
  ];

  const SidebarLink = ({ to, icon, label }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    
    return (
      <NavLink
        to={to}
        className={`flex items-center gap-4 px-4 py-3 rounded-lg relative group transition-all duration-200 ${
          isActive 
            ? 'bg-teal-500/20 text-teal-300 shadow-lg shadow-teal-500/20' 
            : 'text-gray-400 hover:text-teal-300 hover:bg-teal-500/10'
        }`}
      >
        <span className="text-xl flex-shrink-0 drop-shadow-lg">{icon}</span>
        <span className={`font-semibold transition-opacity ${expanded ? 'opacity-100' : 'opacity-0'}`}>{label}</span>
        <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-teal-400 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'opacity-100' : ''}`}></span>
      </NavLink>
    );
  };

  return (
    <nav
      className={`h-full bg-gradient-to-b from-[#0a0e1a] to-[#0d1117] border-r border-teal-500/10 transition-all duration-300 shadow-2xl ${
        expanded ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-center h-16 border-b border-teal-500/20">
        <div className={`text-2xl font-bold transition-all ${expanded ? 'text-xl mr-2' : ''}`}>
          {expanded ? '⚕️ SEP-AI' : '⚕️'}
        </div>
      </div>
      <ul className="mt-6 space-y-2 px-2">
        {links.map((l) => (
          <li key={l.to}>
            <SidebarLink to={l.to} icon={l.icon} label={l.label} />
          </li>
        ))}
      </ul>
      <div className={`absolute bottom-6 left-0 right-0 px-4 transition-opacity ${expanded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-xs text-gray-500 text-center">v1.0 | Clinical</div>
      </div>
    </nav>
  );
}

function Dashboard({ patients, setPatients }) {
  const kpistats = useMemo(() => {
    const total = patients.length;
    const high = patients.filter((p) => p.risk > 70).length;
    const avg = total ? (patients.reduce((s, p) => s + p.risk, 0) / total).toFixed(1) : 0;
    const alerts = patients.filter((p) => p.risk > 90).length;
    return { total, high, avg, alerts };
  }, [patients]);

  return (
    <div className="p-6 lg:p-8 bg-[#0d1117] min-h-screen">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">Dashboard</h1>
        <p className="text-lg text-gray-400">Real-time patient risk monitoring & clinical intelligence</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <MetricCard label="Total Patients" value={kpistats.total} accent="teal" />
        <MetricCard label="High Risk" value={kpistats.high} accent="red" />
        <MetricCard label="Avg. Risk Score" value={`${kpistats.avg}%`} accent="orange" />
        <MetricCard label="Critical Alerts" value={kpistats.alerts} accent="red" />
      </div>

      {/* Patient Table */}
      <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl rounded-xl border border-teal-500/20 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-2xl font-bold text-white">Patient Overview</h2>
        </div>
        <PatientTable patients={patients} setPatients={setPatients} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent = 'teal' }) {
  const colorConfig = {
    teal: { bg: 'from-teal-500/10 to-teal-500/5', border: 'border-teal-500/30', text: 'text-teal-300', glow: 'shadow-teal-500/20' },
    red: { bg: 'from-red-500/10 to-red-500/5', border: 'border-red-500/30', text: 'text-red-300', glow: 'shadow-red-500/20' },
    orange: { bg: 'from-amber-500/10 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-300', glow: 'shadow-amber-500/20' },
  }[accent];
  
  return (
    <div className={`relative group bg-gradient-to-br ${colorConfig.bg} backdrop-blur-xl p-6 rounded-xl border ${colorConfig.border} shadow-lg ${colorConfig.glow} hover:shadow-2xl transition-all duration-300 overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      <div className="relative z-10">
        <span className={`text-xs uppercase tracking-widest font-bold ${colorConfig.text} block opacity-70`}>{label}</span>
        <span className="text-4xl font-mono font-bold mt-3 text-white block animate-pulse-slow drop-shadow-lg">{value}</span>
      </div>
    </div>
  );
}

function PatientTable({ patients }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) => setExpandedId((current) => (current === id ? null : id));

  if (!Array.isArray(patients) || patients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-8">
        <svg className="w-32 h-32 mb-4 opacity-50" viewBox="0 0 120 28">
          <path fill="none" stroke="#00d4aa" strokeWidth="2" d="M0 14 L20 14 L24 6 L28 22 L32 14 L40 14"></path>
        </svg>
        <p className="text-lg font-semibold">No patients currently admitted</p>
        <p className="text-sm text-gray-500 mt-1">Waiting for admission data...</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700 bg-[#0a0e1a]/50">
            <th className="px-8 py-4 text-left text-xs uppercase tracking-wider font-bold text-gray-400">ID</th>
            <th className="px-8 py-4 text-left text-xs uppercase tracking-wider font-bold text-gray-400">Patient</th>
            <th className="px-8 py-4 text-left text-xs uppercase tracking-wider font-bold text-gray-400">Risk</th>
            <th className="px-8 py-4 text-left text-xs uppercase tracking-wider font-bold text-gray-400">Updated</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p, index) => {
            const safeId = p?.id ?? p?._id ?? index + 1;
            const safeName = p?.name ?? `Patient ${index + 1}`;
            const safeRisk = Number(p?.risk) >= 0 ? Number(p.risk) : 0;
            const safeUpdated = p?.updated || p?.last_updated || new Date().toISOString();

            return (
              <tr key={safeId} className="border-b border-gray-800 hover:bg-teal-500/5 transition-all duration-200" onClick={() => toggle(safeId)}>
                <td className="px-8 py-4 font-mono font-bold text-teal-400">#{String(safeId).padStart(3, '0')}</td>
                <td className="px-8 py-4">{safeName}</td>
                <td className="px-8 py-4">{safeRisk.toFixed(1)}%</td>
                <td className="px-8 py-4 text-sm text-gray-400">{new Date(safeUpdated).toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VitalsSparkline({ data }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data.map((v, i) => ({ x: i, y: v }))}>
        <Line type="monotone" dataKey="y" stroke="#00d4aa" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RiskGauge({ value }) {
  const color = value > 70 ? '#ff4757' : value > 40 ? '#ffa502' : '#00d4aa';
  return (
    <RadialBarChart width={60} height={60} cx="50%" cy="50%" innerRadius="80%" outerRadius="100%" barSize={10} data={[{ name: 'risk', value }]}>      
      <RadialBar
        minAngle={15}
        background
        clockWise
        dataKey="value"
        cornerRadius={5}
        fill={color}
      />
    </RadialBarChart>
  );
}

function VitalsHistoryChart({ data }) {
  const formatted = data.map((v, i) => ({ time: i, hr: v.hr, o2: v.o2, temp: v.temp }));
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis dataKey="time" stroke="#888" />
        <YAxis stroke="#888" />
        <Tooltip />
        <Line type="monotone" dataKey="hr" stroke="#00d4aa" />
        <Line type="monotone" dataKey="o2" stroke="#ffa502" />
        <Line type="monotone" dataKey="temp" stroke="#ff4757" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ManualPredictionLegacy({ setPatients }) {
  const [form, setForm] = useState({ id: '', hr: '', o2: '', temp: '', sbp: '', map: '', dbp: '', resp: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const handleChange = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: null });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.hr || form.hr < 40 || form.hr > 180) newErrors.hr = 'HR must be 40-180 bpm';
    if (!form.o2 || form.o2 < 70 || form.o2 > 100) newErrors.o2 = 'O2 must be 70-100%';
    if (!form.temp || form.temp < 35 || form.temp > 42) newErrors.temp = 'Temp must be 35-42°C';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const predict = () => {
    if (!validateForm()) return;
    setLoading(true);
    setTimeout(() => {
      const risk = Math.min(100, Math.random() * 100);
      setResult({
        risk,
        factors: [
          { name: 'Heart Rate', val: Math.random() * 0.8 + 0.2 },
          { name: 'Temperature', val: Math.random() * 0.7 + 0.3 },
          { name: 'O2 Saturation', val: Math.random() * 0.6 + 0.4 },
          { name: 'Blood Pressure', val: Math.random() * 0.5 + 0.5 },
        ],
        recommendation: risk > 70 ? 'URGENT: Immediate evaluation required' : risk > 40 ? 'Monitor closely and reassess in 2 hours' : 'Continue routine monitoring',
      });
      setLoading(false);
    }, 1200);
  };

  const quickFill = () => {
    setForm({ id: '9', hr: '120', o2: '92', temp: '38.2', sbp: '95', map: '60', dbp: '55', resp: '20' });
    setResult(null);
  };

  return (
    <div className="p-6 lg:p-8 bg-[#0d1117] min-h-screen">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">Sepsis Risk Prediction</h1>
        <p className="text-lg text-gray-400">Enter vital signs for real-time clinical assessment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-8 rounded-xl border border-teal-500/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-8">Vital Parameters</h2>
          
          <div className="space-y-5 mb-8">
            {[
              { k: 'hr', label: 'Heart Rate', unit: 'bpm', min: 40, max: 180, icon: '❤️' },
              { k: 'o2', label: 'O₂ Saturation', unit: '%', min: 70, max: 100, icon: '💨' },
              { k: 'temp', label: 'Temperature', unit: '°C', min: 35, max: 42, icon: '🌡️' },
              { k: 'sbp', label: 'Systolic BP', unit: 'mmHg', min: 60, max: 200, icon: '🩸' },
              { k: 'map', label: 'Mean AP', unit: 'mmHg', min: 40, max: 150, icon: '—' },
              { k: 'dbp', label: 'Diastolic BP', unit: 'mmHg', min: 30, max: 120, icon: '—' },
              { k: 'resp', label: 'Resp. Rate', unit: '/min', min: 8, max: 40, icon: '💨' },
            ].map((field) => (
              <div key={field.k}>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  <span className="mr-2">{field.icon}</span>{field.label}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder={`${field.min}-${field.max}`}
                    value={form[field.k]}
                    onChange={handleChange(field.k)}
                    className={`w-full bg-[#0d1117] border rounded-lg px-4 py-3 text-white font-mono placeholder-gray-600 focus:outline-none transition-all text-base ${
                      errors[field.k]
                        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/50'
                        : 'border-gray-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/50'
                    }`}
                  />
                  <span className="absolute right-4 top-3.5 text-gray-500 text-sm font-mono">{field.unit}</span>
                </div>
                {errors[field.k] && <p className="text-red-400 text-xs mt-1.5">{errors[field.k]}</p>}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={predict}
              disabled={loading}
              className={`flex-1 px-6 py-3 rounded-lg font-bold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-lg shadow-teal-500/50 hover:shadow-xl'
              }`}
            >
              {loading && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
              {loading ? 'Predicting...' : '🔬 Predict Risk'}
            </button>
            <button
              onClick={quickFill}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all"
              title="Load sample data"
            >
              ⚡ Sample
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className={`bg-gradient-to-br ${result ? 'from-teal-500/10 to-blue-500/10' : 'from-[#0a0e1a]/40 to-[#0d1117]/60'} backdrop-blur-xl p-8 rounded-xl border border-teal-500/20 shadow-2xl transition-all duration-300 ${!result && 'opacity-50'}`}>
          {loading && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 border-4 border-teal-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-transparent border-t-teal-400 border-r-teal-400 rounded-full animate-spin"></div>
              </div>
              <p className="text-gray-400 font-semibold">Analyzing vital signs...</p>
              <p className="text-gray-500 text-sm mt-2">ML model processing</p>
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-lg font-semibold text-gray-400">Enter vital signs and click Predict</p>
              <p className="text-sm text-gray-500 mt-2">Real-time sepsis risk assessment</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div>
                <div className="text-6xl font-mono font-bold text-white mb-3">{result.risk.toFixed(1)}%</div>
                <span className={`px-4 py-2 rounded-lg font-bold text-white inline-block text-lg ${
                  result.risk > 70
                    ? 'bg-red-600/80 shadow-lg shadow-red-500/50'
                    : result.risk > 40
                    ? 'bg-amber-600/80 shadow-lg shadow-amber-500/50'
                    : 'bg-green-600/80 shadow-lg shadow-green-500/50'
                }`}>
                  {result.risk > 70 ? '🔴 HIGH RISK' : result.risk > 40 ? '🟡 MEDIUM RISK' : '🟢 LOW RISK'}
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-gray-300 text-sm uppercase tracking-wider">Contributing Factors</h3>
                {result.factors.map((f) => (
                  <div key={f.name}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">{f.name}</span>
                      <span className="text-sm font-mono text-teal-300">{(f.val * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-[#0d1117] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${f.val * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`p-4 rounded-lg border ${result.risk > 70 ? 'bg-red-500/10 border-red-500/30' : result.risk > 40 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                <p className="text-sm font-bold text-white mb-2">Clinical Recommendation</p>
                <p className="text-sm text-gray-300">{result.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function PatientMonitoring({ patients }) {
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('risk');
  const filtered = useMemo(() => {
    let arr = [...patients];
    if (filter === 'High') arr = arr.filter((p) => p.risk > 70);
    if (filter === 'Medium') arr = arr.filter((p) => p.risk <= 70 && p.risk > 40);
    if (filter === 'Low') arr = arr.filter((p) => p.risk <= 40);
    if (filter === 'Alerts') arr = arr.filter((p) => p.risk > 90);
    return arr.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'updated' ? new Date(b.updated) - new Date(a.updated) : b.risk - a.risk));
  }, [patients, filter, sort]);

  return (
    <div className="p-6 lg:p-8 bg-[#0d1117] min-h-screen">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">Patient Monitoring</h1>
        <p className="text-lg text-gray-400">Real-time vital signs and risk assessment</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-6 rounded-xl border border-teal-500/20 shadow-lg mb-8 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {['All', 'High', 'Medium', 'Low', 'Alerts'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
                filter === f
                  ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-400"
        >
          <option value="risk">Sort by Risk</option>
          <option value="updated">Sort by Updated</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p) => (
          <PatientCard key={p.id} p={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-semibold text-gray-400">No patients match filter</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
}

function PatientCard({ p }) {
  const [modal, setModal] = useState(false);
  const safeVitals = ensureVitalsHistory(p.vitalsHistory);
  const lastVitals = safeVitals.slice(-1)[0];

  return (
    <>
      <div className={`bg-gradient-to-br ${
        p.risk > 70
          ? 'from-red-500/10 to-red-600/10 border-red-500/30'
          : p.risk > 40
          ? 'from-amber-500/10 to-amber-600/10 border-amber-500/30'
          : 'from-teal-500/10 to-blue-500/10 border-teal-500/30'
      } backdrop-blur-xl p-6 rounded-xl border shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        {/* Alert Badge */}
        {p.risk > 90 && (
          <div className="absolute top-3 right-3 animate-pulse">
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500"></span>
          </div>
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-4 pb-4 border-b border-gray-700/50">
            <h3 className="font-bold text-lg text-white">{p.name}</h3>
            <p className="text-xs text-gray-400 mt-1">Patient ID: {p.id}</p>
          </div>

          {/* Risk Gauge */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Risk Score</p>
              <p className="text-3xl font-mono font-bold text-white">{p.risk.toFixed(0)}%</p>
            </div>
            <RiskGauge value={p.risk} />
          </div>

          {/* Vital Signs Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6 pb-6 border-b border-gray-700/50">
            <div className="bg-[#0d1117]/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400">Heart Rate</p>
              <p className="text-lg font-mono font-bold text-teal-300">{lastVitals.hr.toFixed(0)}</p>
              <p className="text-xs text-gray-500">bpm</p>
            </div>
            <div className="bg-[#0d1117]/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400">O₂ Sat.</p>
              <p className="text-lg font-mono font-bold text-teal-300">{lastVitals.o2.toFixed(1)}</p>
              <p className="text-xs text-gray-500">%</p>
            </div>
            <div className="bg-[#0d1117]/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400">Temp</p>
              <p className="text-lg font-mono font-bold text-teal-300">{lastVitals.temp.toFixed(1)}</p>
              <p className="text-xs text-gray-500">°C</p>
            </div>
            <div className="bg-[#0d1117]/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400">Resp. Rate</p>
              <p className="text-lg font-mono font-bold text-teal-300">{lastVitals.resp.toFixed(0)}</p>
              <p className="text-xs text-gray-500">/min</p>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 ${
            p.risk > 70
              ? 'bg-red-600/30 text-red-300 border border-red-500/50'
              : p.risk > 40
              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
              : 'bg-green-600/30 text-green-300 border border-green-500/50'
          }`}>
            {p.risk > 70 ? '🔴 HIGH RISK' : p.risk > 40 ? '🟡 MEDIUM' : '🟢 STABLE'}
          </span>

          {/* Action Button */}
          <button
            onClick={() => setModal(true)}
            className="w-full py-2 bg-gradient-to-r from-teal-600/30 to-teal-700/30 border border-teal-500/50 hover:from-teal-500/40 hover:to-teal-600/40 rounded-lg text-teal-300 font-semibold transition-all text-sm"
          >
            View Full Details →
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal onClose={() => setModal(false)}>
          <div className="space-y-6">
            <div className="border-b border-gray-700 pb-4">
              <h2 className="text-2xl font-bold text-white">{p.name}</h2>
              <p className="text-gray-400 text-sm">Patient ID: {p.id}</p>
            </div>
            <div>
              <h3 className="font-bold text-teal-300 text-sm uppercase tracking-wider mb-4">Vital Signs Trend</h3>
              <VitalsHistoryChart data={ensureVitalsHistory(p.vitalsHistory)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0e1a] p-4 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-xs">Last Updated</p>
                <p className="font-mono text-teal-300 mt-2">{new Date(p.updated).toLocaleString()}</p>
              </div>
              <div className="bg-[#0a0e1a] p-4 rounded-lg border border-gray-700">
                <p className="text-gray-400 text-xs">Risk Level</p>
                <p className="font-mono text-xl font-bold text-white mt-2">{p.risk.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function UploadDataset({ setPatients }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [patientForm, setPatientForm] = useState({
    patient_id: '',
    name: '',
    age: '',
    gender: '',
    admission_date: '',
    doctor_name: '',
    current_risk: '',
  });
  const [formMessage, setFormMessage] = useState('');

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'text/csv') setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploadError('');
    setResults(null);
    setProgress(10);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('http://localhost:5000/upload-data', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      const data = await res.json();
      setResults(data);
      setProgress(100);
      // optionally refresh patients list
      const patientsResp = await fetch('http://127.0.0.1:5000/patients');
      if (patientsResp.ok) setPatients(await patientsResp.json());
    } catch (err) {
      setUploadError(err.message || 'Upload error');
      setProgress(0);
    }
  };

  const addPatient = async () => {
    setFormMessage('');
    const payload = {
      patient_id: patientForm.patient_id.trim(),
      name: patientForm.name.trim(),
      age: patientForm.age ? Number(patientForm.age) : null,
      gender: patientForm.gender,
      admission_date: patientForm.admission_date,
      doctor_name: patientForm.doctor_name,
      current_risk: patientForm.current_risk ? Number(patientForm.current_risk) : 0,
    };

    if (!payload.patient_id || !payload.name) {
      setFormMessage('Patient ID and Name are required.');
      return;
    }

    try {
      const res = await fetch('http://127.0.0.1:5000/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`${res.status} ${res.statusText}: ${body.error || 'Failed to add patient'}`);
      }
      setFormMessage('Patient added successfully.');
      // refresh patient list on success
      const patientsResp = await fetch('http://127.0.0.1:5000/patients');
      if (patientsResp.ok) setPatients(await patientsResp.json());
      setPatientForm({patient_id:'', name:'', age:'', gender:'', admission_date:'', doctor_name:'', current_risk:''});
    } catch (error) {
      setFormMessage(`Network or API error: ${error.message || 'Error adding patient'}`);
      console.error('Add patient error:', error);
    }
  };

  return (
    <div className="p-6 lg:p-8 bg-[#0d1117] min-h-screen">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">Upload Dataset</h1>
        <p className="text-lg text-gray-400">Batch process patient data for sepsis risk assessment</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div
          className={`relative rounded-xl border-2 border-dashed p-16 text-center transition-all duration-300 cursor-pointer ${
            isDragging
              ? 'border-teal-400 bg-teal-500/10 shadow-lg shadow-teal-500/50'
              : 'border-gray-700 bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 hover:border-teal-400/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="relative z-10">
            {!file && !results && (
              <>
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-2xl font-bold text-white mb-2">Drop CSV file here</h3>
                <p className="text-gray-400 mb-4 text-lg">or click to browse</p>
                <p className="text-sm text-gray-500">Supported: .csv • Max size: 50MB</p>
              </>
            )}
            {file && !results && (
              <>
                <div className="text-5xl mb-3">✓</div>
                <p className="text-white font-semibold text-lg">{file.name}</p>
                <p className="text-gray-400 text-sm mt-2">Ready to upload</p>
              </>
            )}
          </div>
        </div>

        <input
          type="file"
          accept=".csv"
          className="mt-4 bg-gray-800 text-white p-2 rounded-lg"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />

        {file && !results && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={upload}
              className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 rounded-lg font-bold text-white text-lg shadow-lg shadow-teal-500/50 transition-all"
            >
              📤 Upload & Process
            </button>
            <button
              onClick={() => {
                setFile(null);
                setProgress(0);
                setUploadError('');
              }}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all"
            >
              Clear
            </button>
          </div>
        )}

        {uploadError && <p className="text-sm text-red-400 mt-4">{uploadError}</p>}

        {progress > 0 && progress < 100 && (
          <div className="mt-6">
            <div className="flex justify-between items-center text-sm text-gray-300">
              <span>Processing…</span>
              <span>{Math.floor(progress)}%</span>
            </div>
            <div className="w-full bg-gray-800 h-2 rounded-full mt-2">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-10">
            <div className="rounded-xl border border-teal-500/20 p-6 bg-[#0a0e1a]/50">
              <h3 className="text-xl text-white font-bold mb-3">Upload Result</h3>
              <p className="text-gray-300">Total preview rows: {results.preview?.length ?? 0}</p>
              <p className="text-gray-300">Prediction: {results.prediction?.decision ?? 'N/A'}</p>
              <p className="text-gray-300">Risk: {(results.prediction?.probability * 100).toFixed(1) ?? 'N/A'}%</p>
              <pre className="text-xs text-gray-300 overflow-auto max-h-40 mt-3 bg-black/50 p-2 rounded-lg">{JSON.stringify(results.preview?.slice(0,3), null, 2)}</pre>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-10 rounded-xl border border-teal-500/20 p-6 bg-[#0a0e1a]/50">
            <h3 className="text-xl text-white font-bold mb-3">Sepsis Prediction Dashboard</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#111827] border border-teal-500/20">
                <p className="text-sm text-gray-300">Overall Prediction</p>
                <p className="text-2xl font-bold text-white">{results.prediction?.decision ?? 'N/A'}</p>
                <p className="text-sm text-sky-300 mt-1">Risk: {((results.prediction?.probability ?? 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-[#111827] border border-rose-500/20">
                <p className="text-sm text-gray-300">Sepsis Detected</p>
                <p className="text-2xl font-bold text-white">{results.sepsis_detected_count ?? 0}</p>
                <p className="text-sm text-gray-400">in {results.patient_predictions?.length ?? 0} patients</p>
              </div>
              <div className="p-4 rounded-lg bg-[#111827] border border-emerald-500/20">
                <p className="text-sm text-gray-300">Top Risk Patient</p>
                <p className="text-2xl font-bold text-white">ID {results.top_risk_patient?.patient_id ?? '-'} </p>
                <p className="text-sm text-sky-300">{((results.top_risk_patient?.probability ?? 0) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-[#111827] border border-violet-500/20">
                <p className="text-sm text-gray-300">Highlighted Factor</p>
                <p className="text-base text-white">{results.top_risk_patient?.factors?.[0] ?? 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {results && results.patient_predictions?.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/10 p-6 bg-[#0a0e1a]/70">
            <h3 className="text-xl font-bold text-white mb-3">Per-Patient Sepsis Alerts</h3>
            <ul className="space-y-3">
              {results.patient_predictions.map((p) => (
                <li key={p.patient_id} className={`p-3 rounded-lg border ${p.decision === 'Sepsis Detected' ? 'border-red-400 bg-red-500/10' : 'border-green-400 bg-green-500/10'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">Patient {p.patient_id}</p>
                      <p className="text-sm text-gray-300">{p.decision} • {Math.round(p.probability * 100)}%</p>
                    </div>
                    <span className="font-bold text-xl">{p.decision === 'Sepsis Detected' ? '🚨' : '✅'}</span>
                  </div>
                  <p className="text-sm text-gray-200 mt-2">{p.explanation}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Reports({ patients }) {
  const [range, setRange] = useState('7');
  const data = useMemo(() => {
    const dist = [0, 0, 0];
    patients.forEach((p) => {
      if (p.risk > 70) dist[2]++;
      else if (p.risk > 40) dist[1]++;
      else dist[0]++;
    });
    return dist;
  }, [patients]);

  const chartData = [
    { name: 'Low Risk', value: data[0], color: '#00d4aa' },
    { name: 'Medium', value: data[1], color: '#ffa502' },
    { name: 'High Risk', value: data[2], color: '#ff4757' },
  ];

  const admissionsData = [
    { day: 'Mon', patients: 3, high: 1 },
    { day: 'Tue', patients: 5, high: 2 },
    { day: 'Wed', patients: 4, high: 1 },
    { day: 'Thu', patients: 6, high: 3 },
    { day: 'Fri', patients: 7, high: 2 },
    { day: 'Sat', patients: 5, high: 1 },
    { day: 'Sun', patients: 4, high: 2 },
  ];

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="p-6 lg:p-8 bg-[#0d1117] min-h-screen">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-white mb-3">Clinical Reports</h1>
        <p className="text-lg text-gray-400">Analytics and predictive insights</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-6 rounded-xl border border-teal-500/20 shadow-lg mb-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-400"
        >
          <option value="7">📅 Last 7 Days</option>
          <option value="30">📅 Last 30 Days</option>
          <option value="90">📅 Last 90 Days</option>
        </select>
        <button
          onClick={exportPDF}
          className="sm:ml-auto px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 rounded-lg font-semibold text-white transition-all"
        >
          📄 Export PDF
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">Tip: in the print dialog, choose "Save as PDF".</p>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <MetricCard label="Total Predictions" value={patients.length} />
        <MetricCard label="Accuracy Rate" value="94.2%" />
        <MetricCard label="Avg. Response" value="1.2s" accent="teal" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Risk Distribution Pie */}
        <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-8 rounded-xl border border-teal-500/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-8">Risk Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} patients`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Admissions Trend */}
        <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-8 rounded-xl border border-teal-500/20 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-8">Weekly Admissions</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={admissionsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="day" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0d1117',
                  border: '1px solid #00d4aa',
                }}
              />
              <Bar dataKey="patients" fill="#00d4aa" name="Total" />
              <Bar dataKey="high" fill="#ff4757" name="High Risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* High Risk Timeline */}
      <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-8 rounded-xl border border-teal-500/20 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-8">High-Risk Patient Timeline</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={admissionsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="day" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0d1117',
                border: '1px solid #ff4757',
              }}
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="#ff4757"
              strokeWidth={2}
              dot={{ fill: '#ff4757', r: 4 }}
              activeDot={{ r: 6 }}
              name="High Risk Cases"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PatientDetail({ patients }) {
  const { id } = useParams();
  const p = patients.find((x) => x.id === parseInt(id));
  if (!p) return <div className="p-8">Patient not found</div>;
  return (
    <div className="p-8 bg-[#0d1117] min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">{p.name}</h1>
        <p className="text-gray-400">Patient ID: {p.id}</p>
      </div>
      <div className="bg-gradient-to-br from-[#0a0e1a]/40 to-[#0d1117]/60 backdrop-blur-xl p-8 rounded-xl border border-teal-500/20">
        <h2 className="font-bold text-teal-300 text-sm uppercase tracking-wider mb-6">Vital Signs History</h2>
        <VitalsHistoryChart data={ensureVitalsHistory(p.vitalsHistory)} />
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-[#0a0e1a] to-[#0d1117] border border-teal-500/30 rounded-2xl max-w-2xl w-full shadow-2xl shadow-teal-500/20 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 right-0 p-6 flex justify-between items-center border-b border-gray-700/50 bg-gradient-to-r from-[#0a0e1a] to-transparent">
          <div></div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl font-semibold hover:bg-red-500/20 rounded-lg p-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}

// global styles
const styles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=JetBrains+Mono:wght@400;600&family=Sora:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap');

* { box-sizing: border-box; }

html, body, #root { width: 100%; height: 100%; margin: 0; padding: 0; }

body { 
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0d1117;
  color: #ffffff;
  line-height: 1.6;
  overflow-x: hidden;
}

.font-mono { 
  font-family: 'DM Mono', 'JetBrains Mono', monospace;
  font-weight: 500;
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

@keyframes pulseBorder {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 170, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(0, 212, 170, 0); }
}

@keyframes glow {
  0%, 100% { 
    text-shadow: 0 0 10px rgba(0, 212, 170, 0.3);
  }
  50% { 
    text-shadow: 0 0 20px rgba(0, 212, 170, 0.6), 0 0 30px rgba(0, 212, 170, 0.3);
  }
}

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes spin-slow {
  to { transform: rotate(360deg); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes counter {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* Utility Classes */
.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

.animate-slide-in-left {
  animation: slideInLeft 0.5s ease-out;
}

.animate-slide-in-right {
  animation: slideInRight 0.5s ease-out;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-pulse-border {
  animation: pulseBorder 2s infinite;
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}

.animate-counter {
  animation: counter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.loader {
  border: 3px solid rgba(0, 212, 170, 0.1);
  border-top: 3px solid #00d4aa;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
}

/* Glassmorphism */
.glass {
  background: rgba(13, 17, 23, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 212, 170, 0.1);
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(13, 17, 23, 0.5);
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 170, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 212, 170, 0.8);
}

/* Transitions */
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

button:active {
  transform: scale(0.98);
}

input:focus, select:focus {
  outline: none;
}

/* Responsive */
@media (max-width: 768px) {
  body { font-size: 14px; }
}
`;

// inject styles once
const StyleInjector = () => {
  useEffect(() => {
    const tag = document.createElement('style');
    tag.innerHTML = styles;
    document.head.appendChild(tag);
  }, []);
  return null;
};

export default function WrappedApp() {
  return (
    <>
      <StyleInjector />
      <App />
    </>
  );
}