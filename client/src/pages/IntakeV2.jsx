import { ArrowRight, Calculator, ClipboardPlus, Info, Clock3, Database } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getApiMessage, getCreatedPatientId } from '../utils/patientWorkflow';

/*
 * This page mirrors the 40-column train.csv schema at the portal boundary.
 * patient_id and the three post-triage outcomes are lifecycle-managed by the
 * application; every other dataset field is either entered or derived here.
 */
const INITIAL_FORM = {
  arrivalTime: '',
  siteId: 'SITE-DEMO-01',
  triageNurseId: 'NURSE-DEMO',
  firstName: '',
  lastName: '',
  age: '',
  sex: 'M',
  language: 'English',
  insuranceType: 'unknown',
  arrivalMode: 'walk-in',
  transportOrigin: 'home',
  painLocation: 'unknown',
  mentalStatus: 'alert',
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
  mentalStatus: ['drowsy', 'alert', 'unresponsive', 'agitated', 'confused'],
  chiefComplaintSystem: [
    'neurological', 'genitourinary', 'other', 'dermatological', 'psychiatric',
    'trauma', 'ENT', 'ophthalmic', 'endocrine', 'gastrointestinal', 'infectious',
    'respiratory', 'musculoskeletal', 'cardiovascular'
  ]
};

const DATASET_INPUT_COLUMNS = [
  'site_id', 'triage_nurse_id', 'arrival_mode', 'arrival_hour', 'arrival_day',
  'arrival_month', 'arrival_season', 'shift', 'age', 'age_group', 'sex',
  'language', 'insurance_type', 'transport_origin', 'pain_location',
  'mental_status_triage', 'chief_complaint_system', 'num_prior_ed_visits_12m',
  'num_prior_admissions_12m', 'num_active_medications', 'num_comorbidities',
  'systolic_bp', 'diastolic_bp', 'mean_arterial_pressure', 'pulse_pressure',
  'heart_rate', 'respiratory_rate', 'temperature_c', 'spo2', 'gcs_total',
  'pain_score', 'weight_kg', 'height_cm', 'bmi', 'shock_index', 'news2_score'
];

function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getAgeGroup(age) {
  if (age <= 17) return 'pediatric';
  if (age <= 39) return 'young_adult';
  if (age <= 64) return 'middle_aged';
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
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function toLocalDatetimeValue(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function IntakeV2() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    arrivalTime: toLocalDatetimeValue(new Date())
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSchema, setShowSchema] = useState(false);

  const updateField = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const derived = useMemo(() => {
    const weight = toNumber(form.weightKg);
    const height = toNumber(form.heightCm);
    const systolic = toNumber(form.systolicBP);
    const diastolic = toNumber(form.diastolicBP);
    const heartRate = toNumber(form.heartRate);
    const arrival = form.arrivalTime ? new Date(form.arrivalTime) : new Date();
    const age = toNumber(form.age);
    const arrivalHour = arrival.getHours();
    const arrivalMonth = arrival.getMonth() + 1;

    return {
      arrival,
      arrivalHour,
      arrivalDay: arrival.toLocaleDateString('en-US', { weekday: 'long' }),
      arrivalMonth,
      arrivalSeason: getSeason(arrivalMonth),
      shift: getShift(arrivalHour),
      ageGroup: age === null ? '' : getAgeGroup(age),
      bmi: weight !== null && height !== null && height > 0
        ? weight / ((height / 100) ** 2)
        : null,
      meanArterialPressure: systolic !== null && diastolic !== null
        ? diastolic + (systolic - diastolic) / 3
        : null,
      pulsePressure: systolic !== null && diastolic !== null
        ? systolic - diastolic
        : null,
      shockIndex: systolic !== null && heartRate !== null && systolic > 0
        ? heartRate / systolic
        : null
    };
  }, [form]);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.firstName.trim() || !form.lastName.trim() || !form.chiefComplaint.trim()) {
      setError('First name, last name, and chief complaint are required.');
      return;
    }

    const age = toNumber(form.age);
    if (age === null || age < 0 || age > 120) {
      setError('Age must be between 0 and 120.');
      return;
    }

    const requiredNumbers = [
      form.systolicBP, form.diastolicBP, form.heartRate, form.respiratoryRate,
      form.temperature, form.spo2, form.gcsTotal, form.painScore,
      form.weightKg, form.heightCm, form.news2Score
    ];

    if (requiredNumbers.some(value => toNumber(value) === null)) {
      setError('Please complete all bedside measurements before scoring the patient.');
      return;
    }

    setBusy(true);

    try {
      /*
       * Keep the browser payload close to the training schema. The server still
       * rebuilds the canonical engineered feature vector before model inference.
       */
      const modelFeatures = {
        site_id: form.siteId.trim() || 'SITE-DEMO-01',
        triage_nurse_id: form.triageNurseId.trim() || 'NURSE-DEMO',
        arrival_mode: form.arrivalMode,
        arrival_hour: derived.arrivalHour,
        arrival_day: derived.arrivalDay,
        arrival_month: derived.arrivalMonth,
        arrival_season: derived.arrivalSeason,
        shift: derived.shift,
        age,
        age_group: derived.ageGroup,
        sex: form.sex,
        language: form.language,
        insurance_type: form.insuranceType,
        transport_origin: form.transportOrigin,
        pain_location: form.painLocation,
        mental_status_triage: form.mentalStatus,
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
      };

      const response = await api.post('/patients', {
        arrivalTime: derived.arrival.toISOString(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        age,
        sex: form.sex === 'M' ? 'Male' : form.sex === 'F' ? 'Female' : 'Other',
        chiefComplaint: form.chiefComplaint.trim(),
        mentalStatus: form.mentalStatus,
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
        modelFeatures
      });

      const patientId = getCreatedPatientId(response);
      if (!patientId) {
        throw new Error('The patient was created, but no patient identifier was returned.');
      }

      setSuccess(`Patient ${patientId} created. Opening clinical review…`);
      window.setTimeout(() => navigate(`/patients/${patientId}`), 150);
    } catch (requestError) {
      setError(
        getApiMessage(
          requestError,
          'Unable to create patient. Check the API, database, and model service.'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const schemaValues = {
    site_id: form.siteId,
    triage_nurse_id: form.triageNurseId,
    arrival_mode: form.arrivalMode,
    arrival_hour: derived.arrivalHour,
    arrival_day: derived.arrivalDay,
    arrival_month: derived.arrivalMonth,
    arrival_season: derived.arrivalSeason,
    shift: derived.shift,
    age: form.age,
    age_group: derived.ageGroup,
    sex: form.sex,
    language: form.language,
    insurance_type: form.insuranceType,
    transport_origin: form.transportOrigin,
    pain_location: form.painLocation,
    mental_status_triage: form.mentalStatus,
    chief_complaint_system: form.chiefComplaintSystem,
    num_prior_ed_visits_12m: form.priorEdVisits,
    num_prior_admissions_12m: form.priorAdmissions,
    num_active_medications: form.activeMedications,
    num_comorbidities: form.comorbidities,
    systolic_bp: form.systolicBP,
    diastolic_bp: form.diastolicBP,
    mean_arterial_pressure: derived.meanArterialPressure,
    pulse_pressure: derived.pulsePressure,
    heart_rate: form.heartRate,
    respiratory_rate: form.respiratoryRate,
    temperature_c: form.temperature,
    spo2: form.spo2,
    gcs_total: form.gcsTotal,
    pain_score: form.painScore,
    weight_kg: form.weightKg,
    height_cm: form.heightCm,
    bmi: derived.bmi,
    shock_index: derived.shockIndex,
    news2_score: form.news2Score
  };

  return (
    <div className="intake-page">
      <section className="hero-small">
        <div>
          <div className="eyebrow">NEW ARRIVAL</div>
          <h2>Patient intake</h2>
          <p>Enter the complete pre-triage record used by the supplied training pipeline.</p>
        </div>
        <ClipboardPlus size={32} aria-hidden="true" />
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}

      <div className="info-box">
        <Info size={14} />
        <span>Arrival fields are captured directly. Hour, day, month, season and shift are derived from the selected arrival timestamp. Patient ID and post-triage outcomes are generated later.</span>
      </div>

      <form className="panel form-panel" onSubmit={submit}>
        <div className="section-heading">
          <h3>Arrival & dataset context</h3>
          <span className="muted">Maps directly to the arrival-related training fields.</span>
        </div>

        <div className="form-grid four">
          <label>Arrival date & time<input type="datetime-local" value={form.arrivalTime} onChange={event => updateField('arrivalTime', event.target.value)} required /></label>
          <label>Site ID<input value={form.siteId} onChange={event => updateField('siteId', event.target.value)} /></label>
          <label>Triage nurse ID<input value={form.triageNurseId} onChange={event => updateField('triageNurseId', event.target.value)} /></label>
          <div className="derived-field"><Clock3 size={14} /><span>Derived day / shift</span><strong>{derived.arrivalDay} · {derived.shift}</strong></div>
        </div>

        <div className="derived-summary">
          <div><Clock3 size={14} /><span>Arrival hour</span><strong>{derived.arrivalHour}</strong></div>
          <div><Clock3 size={14} /><span>Month</span><strong>{derived.arrivalMonth}</strong></div>
          <div><Clock3 size={14} /><span>Season</span><strong>{derived.arrivalSeason}</strong></div>
          <div><Clock3 size={14} /><span>Shift</span><strong>{derived.shift}</strong></div>
        </div>

        <div className="section-heading" style={{ marginTop: 24 }}><h3>Patient identity</h3><span className="muted">The application ID is generated by the server.</span></div>
        <div className="form-grid four">
          <label>First name<input required value={form.firstName} onChange={event => updateField('firstName', event.target.value)} /></label>
          <label>Last name<input required value={form.lastName} onChange={event => updateField('lastName', event.target.value)} /></label>
          <label>Age<input required type="number" min="0" max="120" value={form.age} onChange={event => updateField('age', event.target.value)} /></label>
          <label>Sex<select value={form.sex} onChange={event => updateField('sex', event.target.value)}><option value="M">Male (M)</option><option value="F">Female (F)</option><option value="Other">Other</option></select></label>
        </div>

        <div className="section-heading" style={{ marginTop: 24 }}><h3>Presentation</h3></div>
        <div className="form-grid four">
          <label>Arrival mode<select value={form.arrivalMode} onChange={event => updateField('arrivalMode', event.target.value)}>{OPTIONS.arrivalMode.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Language<select value={form.language} onChange={event => updateField('language', event.target.value)}>{OPTIONS.language.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Insurance type<select value={form.insuranceType} onChange={event => updateField('insuranceType', event.target.value)}>{OPTIONS.insuranceType.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Transport origin<select value={form.transportOrigin} onChange={event => updateField('transportOrigin', event.target.value)}>{OPTIONS.transportOrigin.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Pain location<select value={form.painLocation} onChange={event => updateField('painLocation', event.target.value)}>{OPTIONS.painLocation.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Mental status<select value={form.mentalStatus} onChange={event => updateField('mentalStatus', event.target.value)}>{OPTIONS.mentalStatus.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Complaint system<select value={form.chiefComplaintSystem} onChange={event => updateField('chiefComplaintSystem', event.target.value)}>{OPTIONS.chiefComplaintSystem.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label style={{ marginTop: 16 }}>Chief complaint<textarea required rows="4" value={form.chiefComplaint} onChange={event => updateField('chiefComplaint', event.target.value)} placeholder="Describe the patient's current complaint…" /></label>

        <div className="section-heading" style={{ marginTop: 24 }}><h3>Bedside measurements</h3></div>
        <div className="form-grid four">
          <label>Systolic BP<input required type="number" step="0.1" value={form.systolicBP} onChange={event => updateField('systolicBP', event.target.value)} /></label>
          <label>Diastolic BP<input required type="number" step="0.1" value={form.diastolicBP} onChange={event => updateField('diastolicBP', event.target.value)} /></label>
          <label>Heart rate<input required type="number" step="0.1" value={form.heartRate} onChange={event => updateField('heartRate', event.target.value)} /></label>
          <label>Respiratory rate<input required type="number" step="0.1" value={form.respiratoryRate} onChange={event => updateField('respiratoryRate', event.target.value)} /></label>
          <label>Temperature °C<input required type="number" step="0.1" value={form.temperature} onChange={event => updateField('temperature', event.target.value)} /></label>
          <label>SpO₂ %<input required type="number" step="0.1" value={form.spo2} onChange={event => updateField('spo2', event.target.value)} /></label>
          <label>GCS total<input required type="number" min="3" max="15" value={form.gcsTotal} onChange={event => updateField('gcsTotal', event.target.value)} /></label>
          <label>Pain score<input required type="number" min="0" max="10" value={form.painScore} onChange={event => updateField('painScore', event.target.value)} /></label>
          <label>Weight kg<input required type="number" step="0.1" value={form.weightKg} onChange={event => updateField('weightKg', event.target.value)} /></label>
          <label>Height cm<input required type="number" step="0.1" value={form.heightCm} onChange={event => updateField('heightCm', event.target.value)} /></label>
          <label>NEWS2 score<input required type="number" min="0" max="17" value={form.news2Score} onChange={event => updateField('news2Score', event.target.value)} /></label>
          <div className="derived-field"><Calculator size={14} /><span>Age group</span><strong>{derived.ageGroup || '—'}</strong></div>
        </div>

        <div className="derived-summary">
          <div><Calculator size={14} /><span>BMI</span><strong>{derived.bmi === null ? '—' : derived.bmi.toFixed(2)}</strong></div>
          <div><Calculator size={14} /><span>Mean arterial pressure</span><strong>{derived.meanArterialPressure === null ? '—' : derived.meanArterialPressure.toFixed(2)}</strong></div>
          <div><Calculator size={14} /><span>Pulse pressure</span><strong>{derived.pulsePressure === null ? '—' : derived.pulsePressure.toFixed(2)}</strong></div>
          <div><Calculator size={14} /><span>Shock index</span><strong>{derived.shockIndex === null ? '—' : derived.shockIndex.toFixed(3)}</strong></div>
        </div>

        <div className="section-heading" style={{ marginTop: 24 }}><h3>History & context</h3></div>
        <div className="form-grid four">
          <label>Prior ED visits (12m)<input type="number" min="0" value={form.priorEdVisits} onChange={event => updateField('priorEdVisits', event.target.value)} /></label>
          <label>Prior admissions (12m)<input type="number" min="0" value={form.priorAdmissions} onChange={event => updateField('priorAdmissions', event.target.value)} /></label>
          <label>Active medications<input type="number" min="0" value={form.activeMedications} onChange={event => updateField('activeMedications', event.target.value)} /></label>
          <label>Comorbidities<input type="number" min="0" value={form.comorbidities} onChange={event => updateField('comorbidities', event.target.value)} /></label>
        </div>
        <label className="checkbox-line" style={{ marginTop: 16 }}><input type="checkbox" checked={form.historyAvailable} onChange={event => updateField('historyAvailable', event.target.checked)} /> Prior history is available</label>
        <label style={{ marginTop: 12 }}>History summary<textarea rows="3" disabled={!form.historyAvailable} value={form.historySummary} onChange={event => updateField('historySummary', event.target.value)} placeholder={form.historyAvailable ? 'Relevant prior history…' : 'Zero-history patient'} /></label>
        <div className="form-grid three" style={{ marginTop: 12 }}>
          <label>Conditions<input value={form.conditions} onChange={event => updateField('conditions', event.target.value)} placeholder="Comma separated" /></label>
          <label>Medications<input value={form.medications} onChange={event => updateField('medications', event.target.value)} placeholder="Comma separated" /></label>
          <label>Allergies<input value={form.allergies} onChange={event => updateField('allergies', event.target.value)} placeholder="Comma separated" /></label>
        </div>

        <div className="dataset-schema-summary">
          <div><Database size={15} /><div><strong>40-column training schema</strong><span>All dataset columns are represented by intake values or downstream lifecycle results.</span></div></div>
          <button type="button" className="secondary-button" onClick={() => setShowSchema(value => !value)}>{showSchema ? 'Hide schema' : 'Review all columns'}</button>
        </div>

        {showSchema && (
          <div className="dataset-table-wrap">
            <table className="dataset-table">
              <thead><tr><th>Column</th><th>Current value</th><th>Lifecycle</th></tr></thead>
              <tbody>
                {DATASET_INPUT_COLUMNS.map(column => (
                  <tr key={column}><td><strong>{column}</strong></td><td>{schemaValues[column] === null || schemaValues[column] === '' ? '—' : String(schemaValues[column])}</td><td>Input / derived</td></tr>
                ))}
                <tr><td><strong>patient_id</strong></td><td>Generated after save</td><td>System identifier</td></tr>
                <tr><td><strong>disposition</strong></td><td>Set when service completes</td><td>Outcome</td></tr>
                <tr><td><strong>ed_los_hours</strong></td><td>Calculated at completion</td><td>Outcome</td></tr>
                <tr><td><strong>triage_acuity</strong></td><td>Generated by triage / clinician decision</td><td>Target / final label</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <span className="muted">AI is advisory. The clinician remains responsible for the final triage decision.</span>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Creating & scoring…' : 'Create & score patient'}
            {!busy && <ArrowRight size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
}
