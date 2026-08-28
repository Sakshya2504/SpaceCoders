import { ArrowRight, Calculator, ClipboardPlus, Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

/*
 * The form mirrors the useful input features represented in train.csv.
 * Identifiers and post-triage outcomes are intentionally not entered by staff:
 * patient_id is generated, arrival context is derived, and disposition/ED LOS
 * are excluded because they occur after the triage decision.
 */
const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  age: 42,
  sex: 'Male',
  arrivalMode: 'walk-in',
  language: 'English',
  insuranceType: 'unknown',
  transportOrigin: 'home',
  painLocation: 'unknown',
  mentalStatusTriage: 'alert',
  chiefComplaintSystem: 'other',
  chiefComplaint: '',
  priorEdVisits: 0,
  priorAdmissions: 0,
  activeMedications: 0,
  comorbidities: 0,
  systolicBP: 120,
  diastolicBP: 80,
  heartRate: 90,
  respiratoryRate: 18,
  temperature: 37,
  spo2: 98,
  gcsTotal: 15,
  painScore: 3,
  weightKg: 70,
  heightCm: 170,
  news2Score: 0,
  historyAvailable: true,
  historySummary: '',
  conditions: '',
  medications: '',
  allergies: ''
};

const OPTIONS = {
  arrivalMode: ['walk-in', 'police', 'ambulance', 'transfer', 'helicopter', 'brought_by_family'],
  language: ['English', 'Finnish', 'Russian', 'Arabic', 'Estonian', 'Somali', 'Swedish', 'Other'],
  insuranceType: ['public', 'military', 'none', 'private', 'unknown'],
  transportOrigin: ['public_space', 'home', 'nursing_home', 'outdoor', 'workplace', 'other_hospital', 'school'],
  painLocation: ['extremity', 'abdomen', 'multiple', 'back', 'unknown', 'head', 'chest', 'none', 'pelvis'],
  mentalStatusTriage: ['drowsy', 'alert', 'unresponsive', 'agitated', 'confused'],
  chiefComplaintSystem: [
    'neurological', 'genitourinary', 'other', 'dermatological', 'psychiatric',
    'trauma', 'ENT', 'ophthalmic', 'endocrine', 'gastrointestinal', 'infectious',
    'respiratory', 'musculoskeletal', 'cardiovascular'
  ]
};

const toNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function getAgeGroup(age) {
  if (age <= 12) return 'pediatric';
  if (age <= 17) return 'adolescent';
  if (age <= 64) return 'young_adult';
  return 'elderly';
}

function getSeason(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'spring';
  if ([6, 7, 8].includes(month)) return 'summer';
  return 'autumn';
}

function getShift(hour) {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18) return 'evening';
  return 'night';
}

function toList(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export default function Intake() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const derived = useMemo(() => {
    const weight = toNumber(form.weightKg);
    const height = toNumber(form.heightCm);
    const systolic = toNumber(form.systolicBP);
    const diastolic = toNumber(form.diastolicBP);
    const heartRate = toNumber(form.heartRate);

    return {
      bmi: weight && height ? weight / ((height / 100) ** 2) : null,
      meanArterialPressure: systolic && diastolic
        ? (systolic + (2 * diastolic)) / 3
        : null,
      pulsePressure: systolic && diastolic ? systolic - diastolic : null,
      shockIndex: systolic && heartRate ? heartRate / systolic : null
    };
  }, [form]);

  const submit = async event => {
    event.preventDefault();
    setError('');

    if (!form.firstName.trim() || !form.lastName.trim() || !form.chiefComplaint.trim()) {
      setError('Please complete the patient name and chief complaint.');
      return;
    }

    const age = toNumber(form.age);
    if (age === null || age < 0 || age > 120) {
      setError('Age must be between 0 and 120.');
      return;
    }

    setBusy(true);

    try {
      const arrival = new Date();
      const arrivalHour = arrival.getHours();
      const arrivalMonth = arrival.getMonth() + 1;

      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        age,
        sex: form.sex,
        chiefComplaint: form.chiefComplaint.trim(),
        mentalStatus: form.mentalStatusTriage,
        hasHistory: form.historyAvailable,
        historySummary: form.historyAvailable ? form.historySummary.trim() : '',
        conditions: toList(form.conditions),
        medications: toList(form.medications),
        allergies: toList(form.allergies),
        vitals: {
          heartRate: toNumber(form.heartRate),
          respiratoryRate: toNumber(form.respiratoryRate),
          systolicBP: toNumber(form.systolicBP),
          diastolicBP: toNumber(form.diastolicBP),
          temperature: toNumber(form.temperature),
          spo2: toNumber(form.spo2),
          painScore: toNumber(form.painScore)
        },

        // This object intentionally follows the training column names so the
        // future XGBoost inference service receives a stable feature contract.
        modelFeatures: {
          site_id: 'SITE-DEMO-01',
          triage_nurse_id: 'NURSE-DEMO',
          arrival_mode: form.arrivalMode,
          arrival_hour: arrivalHour,
          arrival_day: arrival.toLocaleDateString('en-US', { weekday: 'long' }),
          arrival_month: arrivalMonth,
          arrival_season: getSeason(arrivalMonth),
          shift: getShift(arrivalHour),
          age,
          age_group: getAgeGroup(age),
          sex: form.sex === 'Male' ? 'M' : form.sex === 'Female' ? 'F' : 'Other',
          language: form.language,
          insurance_type: form.insuranceType,
          transport_origin: form.transportOrigin,
          pain_location: form.painLocation,
          mental_status_triage: form.mentalStatusTriage,
          chief_complaint_system: form.chiefComplaintSystem,
          num_prior_ed_visits_12m: toNumber(form.priorEdVisits),
          num_prior_admissions_12m: toNumber(form.priorAdmissions),
          num_active_medications: toNumber(form.activeMedications),
          num_comorbidities: toNumber(form.comorbidities),
          systolic_bp: toNumber(form.systolicBP),
          diastolic_bp: toNumber(form.diastolicBP),
          mean_arterial_pressure: derived.meanArterialPressure,
          pulse_pressure: derived.pulsePressure,
          heart_rate: toNumber(form.heartRate),
          respiratory_rate: toNumber(form.respiratoryRate),
          temperature_c: toNumber(form.temperature),
          spo2: toNumber(form.spo2),
          gcs_total: toNumber(form.gcsTotal),
          pain_score: toNumber(form.painScore),
          weight_kg: toNumber(form.weightKg),
          height_cm: toNumber(form.heightCm),
          bmi: derived.bmi,
          shock_index: derived.shockIndex,
          news2_score: toNumber(form.news2Score)
        }
      };

      const response = await api.post('/patients', payload);
      navigate(`/patients/${response.data.data.patientId}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create patient');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="intake-page">
      <section className="hero-small">
        <div>
          <div className="eyebrow">NEW ARRIVAL</div>
          <h2>Patient intake</h2>
          <p>Capture the same clinical and operational feature families used by the acuity model.</p>
        </div>
        <ClipboardPlus size={32} aria-hidden="true" />
      </section>

      <div className="info-box">
        <Info size={14} />
        <span>
          Derived features such as age group, arrival context, BMI, mean arterial pressure,
          pulse pressure and shock index are calculated automatically.
        </span>
      </div>

      <form className="panel form-panel" onSubmit={submit}>
        <div className="section-heading">
          <h3>Patient identity</h3>
          <span className="muted">Application ID is generated automatically</span>
        </div>

        <div className="form-grid three">
          <label>First name<input required value={form.firstName} onChange={event => updateField('firstName', event.target.value)} /></label>
          <label>Last name<input required value={form.lastName} onChange={event => updateField('lastName', event.target.value)} /></label>
          <label>Age<input required type="number" min="0" max="120" value={form.age} onChange={event => updateField('age', event.target.value)} /></label>
          <label>Sex<select value={form.sex} onChange={event => updateField('sex', event.target.value)}><option>Female</option><option>Male</option><option>Other</option></select></label>
        </div>

        <div className="section-heading" style={{ marginTop: 24 }}>
          <h3>Arrival & presentation</h3>
        </div>
        <div className="form-grid four">
          <label>Arrival mode<select value={form.arrivalMode} onChange={event => updateField('arrivalMode', event.target.value)}>{OPTIONS.arrivalMode.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Language<select value={form.language} onChange={event => updateField('language', event.target.value)}>{OPTIONS.language.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Insurance type<select value={form.insuranceType} onChange={event => updateField('insuranceType', event.target.value)}>{OPTIONS.insuranceType.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Transport origin<select value={form.transportOrigin} onChange={event => updateField('transportOrigin', event.target.value)}>{OPTIONS.transportOrigin.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Pain location<select value={form.painLocation} onChange={event => updateField('painLocation', event.target.value)}>{OPTIONS.painLocation.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Mental status<select value={form.mentalStatusTriage} onChange={event => updateField('mentalStatusTriage', event.target.value)}>{OPTIONS.mentalStatusTriage.map(option => <option key={option}>{option}</option>)}</select></label>
          <label>Complaint category<select value={form.chiefComplaintSystem} onChange={event => updateField('chiefComplaintSystem', event.target.value)}>{OPTIONS.chiefComplaintSystem.map(option => <option key={option}>{option}</option>)}</select></label>
        </div>

        <label style={{ marginTop: 16 }}>
          Chief complaint
          <textarea required rows="4" value={form.chiefComplaint} onChange={event => updateField('chiefComplaint', event.target.value)} placeholder="Describe what the patient is experiencing…" />
        </label>

        <div className="section-heading" style={{ marginTop: 24 }}>
          <h3>Bedside measurements</h3>
        </div>
        <div className="form-grid four">
          <label>Heart rate<input type="number" step="0.1" value={form.heartRate} onChange={event => updateField('heartRate', event.target.value)} /></label>
          <label>Respiratory rate<input type="number" step="0.1" value={form.respiratoryRate} onChange={event => updateField('respiratoryRate', event.target.value)} /></label>
          <label>Systolic BP<input type="number" step="0.1" value={form.systolicBP} onChange={event => updateField('systolicBP', event.target.value)} /></label>
          <label>Diastolic BP<input type="number" step="0.1" value={form.diastolicBP} onChange={event => updateField('diastolicBP', event.target.value)} /></label>
          <label>Temperature °C<input type="number" step="0.1" value={form.temperature} onChange={event => updateField('temperature', event.target.value)} /></label>
          <label>SpO₂ %<input type="number" step="0.1" value={form.spo2} onChange={event => updateField('spo2', event.target.value)} /></label>
          <label>GCS total<input type="number" min="3" max="15" value={form.gcsTotal} onChange={event => updateField('gcsTotal', event.target.value)} /></label>
          <label>Pain score<input type="number" min="0" max="10" value={form.painScore} onChange={event => updateField('painScore', event.target.value)} /></label>
          <label>Weight kg<input type="number" step="0.1" value={form.weightKg} onChange={event => updateField('weightKg', event.target.value)} /></label>
          <label>Height cm<input type="number" step="0.1" value={form.heightCm} onChange={event => updateField('heightCm', event.target.value)} /></label>
          <label>NEWS2 score<input type="number" min="0" max="17" value={form.news2Score} onChange={event => updateField('news2Score', event.target.value)} /></label>
        </div>

        <div className="derived-summary">
          <div><Calculator size={14} /><span>BMI</span><strong>{derived.bmi ? derived.bmi.toFixed(1) : '—'}</strong></div>
          <div><Calculator size={14} /><span>Mean arterial pressure</span><strong>{derived.meanArterialPressure ? derived.meanArterialPressure.toFixed(1) : '—'}</strong></div>
          <div><Calculator size={14} /><span>Pulse pressure</span><strong>{derived.pulsePressure ?? '—'}</strong></div>
          <div><Calculator size={14} /><span>Shock index</span><strong>{derived.shockIndex ? derived.shockIndex.toFixed(2) : '—'}</strong></div>
        </div>

        <div className="section-heading" style={{ marginTop: 24 }}>
          <h3>History & context</h3>
        </div>
        <div className="form-grid four">
          <label>Prior ED visits (12m)<input type="number" min="0" value={form.priorEdVisits} onChange={event => updateField('priorEdVisits', event.target.value)} /></label>
          <label>Prior admissions (12m)<input type="number" min="0" value={form.priorAdmissions} onChange={event => updateField('priorAdmissions', event.target.value)} /></label>
          <label>Active medications<input type="number" min="0" value={form.activeMedications} onChange={event => updateField('activeMedications', event.target.value)} /></label>
          <label>Comorbidities<input type="number" min="0" value={form.comorbidities} onChange={event => updateField('comorbidities', event.target.value)} /></label>
        </div>

        <label className="checkbox-line" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={form.historyAvailable} onChange={event => updateField('historyAvailable', event.target.checked)} />
          Prior history is available
        </label>

        {form.historyAvailable && (
          <label style={{ marginTop: 12 }}>
            History summary
            <textarea rows="3" value={form.historySummary} onChange={event => updateField('historySummary', event.target.value)} />
          </label>
        )}

        <div className="form-grid three" style={{ marginTop: 12 }}>
          <label>Conditions<input value={form.conditions} onChange={event => updateField('conditions', event.target.value)} placeholder="comma separated" /></label>
          <label>Medications<input value={form.medications} onChange={event => updateField('medications', event.target.value)} placeholder="comma separated" /></label>
          <label>Allergies<input value={form.allergies} onChange={event => updateField('allergies', event.target.value)} placeholder="comma separated" /></label>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <div className="form-actions">
          <span className="muted">AI is advisory. The clinician remains responsible for the final triage decision.</span>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Scoring…' : 'Create & score patient'}
            {!busy && <ArrowRight size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
}
