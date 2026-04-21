import React, { useState } from 'react';
import axios from 'axios';

const AddPatient = () => {
  const [formData, setFormData] = useState({
    patient_id: '',
    name: '',
    age: '',
    gender: '',
    admission_date: '',
    doctor_name: '',
    current_risk: ''
  });
  const [hourlyData, setHourlyData] = useState([]);
  const [currentHour, setCurrentHour] = useState({
    hour: 1,
    HR: '',
    O2Sat: '',
    Temp: '',
    SBP: '',
    MAP: '',
    DBP: '',
    Resp: '',
    risk: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewRisk, setPreviewRisk] = useState(null);
  const [isExistingPatient, setIsExistingPatient] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const normalizePatientId = (value) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    return trimmed.toUpperCase();
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleHourChange = (e) => {
    setCurrentHour({ ...currentHour, [e.target.name]: e.target.value });
  };

  const computeRiskFromHourlyData = async (hourlyRows) => {
    if (!hourlyRows || hourlyRows.length === 0) {
      setPreviewRisk(null);
      return null;
    }

    const payload = hourlyRows.map((row) => ({
      HR: Number(row.HR),
      O2Sat: Number(row.O2Sat),
      Temp: Number(row.Temp),
      SBP: Number(row.SBP),
      MAP: Number(row.MAP),
      DBP: Number(row.DBP),
      Resp: Number(row.Resp),
      hour: Number(row.hour),
    }));

    try {
      const res = await axios.post('/predict', payload);
      if (res?.data?.probability == null) {
        setPreviewRisk(null);
        return null;
      }
      setPreviewRisk(Number(res.data.probability));
      return Number(res.data.probability);
    } catch (err) {
      console.error('strategy risk compute error', err);
      setPreviewRisk(null);
      return null;
    }
  };

  const loadPatientHistory = async () => {
    const patientId = normalizePatientId(formData.patient_id);
    if (!patientId) {
      setError('Enter a valid Patient ID to load existing data.');
      return;
    }
    setLoadingHistory(true);
    setError(null);

    try {
      const res = await axios.get(`/patient-history?id=${encodeURIComponent(patientId)}`);
      const payload = res.data || {};
      const patient = payload.patient || {};
      const history = payload.history || [];

      if (!patient || !patient.patient_id) {
        setResult({message: `Patient ${patientId} not found. Creating new book.`});
        setHourlyData([]);
        setPreviewRisk(null);
        setIsExistingPatient(false);
        return;
      }

      setFormData((f) => ({
        ...f,
        patient_id: patient.patient_id || patientId,
        name: patient.name || f.name,
        age: patient.age ?? f.age,
        gender: patient.gender || f.gender,
        admission_date: patient.admission_date ? patient.admission_date.split('T')[0] : f.admission_date,
        doctor_name: patient.doctor_name || f.doctor_name,
        current_risk: patient.current_risk != null ? (Number(patient.current_risk) * 100).toFixed(1) : f.current_risk,
      }));

      const loaded = history.map((row) => ({
        hour: row.hour,
        HR: row.hr,
        O2Sat: row.o2sat,
        Temp: row.temp,
        SBP: row.sbp,
        MAP: row.map,
        DBP: row.dbp,
        Resp: row.resp,
        risk: Number((Number(row.risk) * 100).toFixed(1)),
        isNew: false,
      }));

      setHourlyData(loaded);
      setPreviewRisk(loaded.length ? loaded[loaded.length - 1].risk / 100 : null);
      setIsExistingPatient(true);
      setResult({success: true, message: `Loaded ${loaded.length} hourly rows for ${patientId}`});
    } catch (err) {
      console.error('load patient history error', err);
      setError(err.response ? err.response.data : err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const addHour = async () => {
    const patientId = normalizePatientId(formData.patient_id);
    if (!patientId) {
      setError('Patient ID is required before adding hourly vitals.');
      return;
    }

    // validate numeric vital inputs
    const validated = {
      hour: Number(currentHour.hour) || hourlyData.length + 1,
      HR: Number(currentHour.HR),
      O2Sat: Number(currentHour.O2Sat),
      Temp: Number(currentHour.Temp),
      SBP: Number(currentHour.SBP),
      MAP: Number(currentHour.MAP),
      DBP: Number(currentHour.DBP),
      Resp: Number(currentHour.Resp),
    };

    if ([validated.HR, validated.O2Sat, validated.Temp, validated.SBP, validated.MAP, validated.DBP, validated.Resp].some((v) => Number.isNaN(v))) {
      setError('All vital fields must be valid numbers before adding an hour.');
      return;
    }

    const predictedRiskFraction = await computeRiskFromHourlyData([...hourlyData, validated]);
    const riskPercent = predictedRiskFraction != null ? Number((predictedRiskFraction * 100).toFixed(1)) : 0;

    const newRow = {
      ...validated,
      risk: riskPercent,
      isNew: true,
    };

    const updatedHourlyData = [...hourlyData, newRow];
    setHourlyData(updatedHourlyData);
    setError(null);
    setPreviewRisk(predictedRiskFraction);

    setCurrentHour({
      hour: validated.hour + 1,
      HR: '',
      O2Sat: '',
      Temp: '',
      SBP: '',
      MAP: '',
      DBP: '',
      Resp: '',
      risk: '',
    });

    if (isExistingPatient) {
      try {
        await axios.post('/add-hourly-data', {
          patient_id: patientId,
          hour: validated.hour,
          HR: validated.HR,
          O2Sat: validated.O2Sat,
          Temp: validated.Temp,
          SBP: validated.SBP,
          MAP: validated.MAP,
          DBP: validated.DBP,
          Resp: validated.Resp,
          risk: predictedRiskFraction,
        });
      } catch (err) {
        console.error('add hour persistence error', err);
        setError(err.response ? err.response.data : err.message);
      }
    }
  };

  const removeHour = (index) => {
    setHourlyData(hourlyData.filter((_, i) => i !== index));
  };

  const clearForm = () => {
    setFormData({
      patient_id: '',
      name: '',
      age: '',
      gender: '',
      admission_date: '',
      doctor_name: '',
      current_risk: ''
    });
    setHourlyData([]);
    setCurrentHour({
      hour: 1,
      HR: '',
      O2Sat: '',
      Temp: '',
      SBP: '',
      MAP: '',
      DBP: '',
      Resp: '',
      risk: ''
    });
    setResult(null);
    setError(null);
    setPreviewRisk(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Name is required to save a patient.');
      return;
    }

    try {
      const payload = {
        patient_id: normalizePatientId(formData.patient_id),
        name: formData.name.trim(),
        age: formData.age ? Number(formData.age) : null,
        gender: formData.gender,
        admission_date: formData.admission_date,
        doctor_name: formData.doctor_name,
        current_risk: formData.current_risk ? Number(formData.current_risk) : null,
        hourly_data: hourlyData.map((row) => ({
          ...row,
          HR: Number(row.HR),
          O2Sat: Number(row.O2Sat),
          Temp: Number(row.Temp),
          SBP: Number(row.SBP),
          MAP: Number(row.MAP),
          DBP: Number(row.DBP),
          Resp: Number(row.Resp),
          risk: Number(row.risk),
        })),
      };

      const res = await axios.post('/patients', payload);
      setResult(res.data);
      setFormData({ ...formData, patient_id: normalizePatientId(formData.patient_id) });
    } catch (err) {
      console.error('add patient error', err);
      setError(err.response ? err.response.data : err.message);
    }
  };

  return (
    <div className="bg-[#0f172a] border border-teal-500/20 rounded-2xl shadow-2xl p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-white">Add Patient</h1>
          <p className="text-sm text-teal-300/90">Enter patient details and hourly vitals to register new data for sepsis risk tracking.</p>
        </div>
        <div className="rounded-xl bg-[#111827] px-4 py-2 border border-teal-500/30">
          <span className="text-xs text-gray-300 uppercase tracking-wider">Current hourly readings</span>
          <div className="text-lg font-medium text-white">{hourlyData.length || 0} entries</div>
        </div>
      </div>

      {previewRisk != null && (
        <div className="mb-5 rounded-xl border border-teal-500/20 bg-[#111827] p-4">
          <p className="text-sm text-gray-300">Live predicted sepsis risk for current dataset</p>
          <p className="text-3xl font-bold text-white">{(previewRisk * 100).toFixed(1)}%</p>
          <p className={`text-sm mt-1 ${previewRisk >= 0.75 ? 'text-red-300' : previewRisk >= 0.5 ? 'text-amber-300' : 'text-green-300'}`}>
            {previewRisk >= 0.75 ? 'High sepsis alert' : previewRisk >= 0.5 ? 'Moderate risk' : 'Low risk'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Patient ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              name="patient_id"
              value={formData.patient_id}
              onChange={handleChange}
              className="flex-1 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
              placeholder="e.g. P001"
            />
            <button
              type="button"
              onClick={loadPatientHistory}
              disabled={!formData.patient_id.trim()}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white"
            >
              Load Book
            </button>
          </div>
          <p className="text-xs text-gray-400">Load existing patient data book before adding additional hourly vitals.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
            placeholder="Patient name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Age</label>
          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
            placeholder="Years"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Gender</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Admission Date</label>
          <input
            type="date"
            name="admission_date"
            value={formData.admission_date}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Doctor Name</label>
          <input
            type="text"
            name="doctor_name"
            value={formData.doctor_name}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
            placeholder="Attending physician"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-200">Current Risk (%)</label>
          <input
            type="number"
            name="current_risk"
            value={formData.current_risk}
            onChange={handleChange}
            min="0"
            max="100"
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-white focus:outline-none focus:border-teal-400"
            placeholder="0 - 100"
          />
        </div>
      
        <div className="md:col-span-3">
          <h3 className="mt-4 mb-2 text-xl font-semibold text-white">Add Hourly Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="space-y-2">
              <label className="text-xs text-gray-300">Hour</label>
              <input
                type="number"
                name="hour"
                value={currentHour.hour}
                onChange={handleHourChange}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-2 py-2 text-white focus:outline-none focus:border-teal-400"
              />
            </div>
            {['HR','O2Sat','Temp','SBP','MAP','DBP','Resp'].map((vital) => (
              <div key={vital} className="space-y-2">
                <label className="text-xs text-gray-300">{vital}</label>
                <input
                  type="number"
                  name={vital}
                  value={currentHour[vital]}
                  onChange={handleHourChange}
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-2 py-2 text-white focus:outline-none focus:border-teal-400"
                  placeholder={vital}
                />
              </div>
            ))}
            <div className="space-y-2">
              <label className="text-xs text-gray-300">Predicted Risk (%)</label>
              <input
                type="text"
                value={previewRisk != null ? `${(previewRisk * 100).toFixed(1)}` : 'auto'}
                disabled
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-2 py-2 text-white"
              />
            </div>
            <button
              type="button"
              onClick={addHour}
              className="h-10 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold hover:brightness-110 transition"
            >
              Add Hour
            </button>
          </div>
        </div>

        {hourlyData.length > 0 && (
          <div className="md:col-span-3 mt-4">
            <div className="bg-[#111827] border border-teal-500/20 rounded-xl p-4">
              <h4 className="text-lg text-teal-300 mb-3">Hourly Data</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-200">
                  <thead>
                    <tr className="text-xs uppercase text-gray-400 border-b border-gray-800">
                      <th className="px-2 py-2">Hour</th>
                      <th className="px-2 py-2">HR</th>
                      <th className="px-2 py-2">O2Sat</th>
                      <th className="px-2 py-2">Temp</th>
                      <th className="px-2 py-2">SBP</th>
                      <th className="px-2 py-2">MAP</th>
                      <th className="px-2 py-2">DBP</th>
                      <th className="px-2 py-2">Resp</th>
                      <th className="px-2 py-2">Risk</th>
                      <th className="px-2 py-2">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyData.map((row, index) => (
                      <tr key={index} className="border-b border-gray-800">
                        <td className="px-2 py-2">{row.hour}</td>
                        <td className="px-2 py-2">{row.HR}</td>
                        <td className="px-2 py-2">{row.O2Sat}</td>
                        <td className="px-2 py-2">{row.Temp}</td>
                        <td className="px-2 py-2">{row.SBP}</td>
                        <td className="px-2 py-2">{row.MAP}</td>
                        <td className="px-2 py-2">{row.DBP}</td>
                        <td className="px-2 py-2">{row.Resp}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${row.risk >= 75 ? 'bg-red-500/20 text-red-300' : row.risk >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                            {row.risk}%
                          </span>
                          <div className="mt-1 text-[10px] text-white/80">
                            {row.risk >= 75 ? '🚨 Sepsis trigger' : row.risk >= 50 ? '⚠ Elevated risk' : '✅ Stable'}
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            onClick={() => removeHour(index)}
                            className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/35 transition"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="md:col-span-3 flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={hourlyData.length === 0}
            className={`flex-1 py-3 rounded-xl text-white font-semibold transition ${hourlyData.length === 0 ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:brightness-110'}`}
          >
            Add Patient
          </button>
          <button type="button" onClick={clearForm} className="flex-1 py-3 rounded-xl border border-gray-600 text-white hover:bg-gray-700 transition">Clear Form</button>
        </div>
      </form>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3">
            <strong className="text-red-200">Error:</strong> <span className="text-red-100">{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}
        {result && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <strong className="text-emerald-200">Success:</strong> <span className="text-white">Patient {result.patient_id} added/updated.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPatient;