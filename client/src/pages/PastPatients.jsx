import { Archive, Search, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { EsiBadge } from '../components/Badge';

/**
 * Past Patients is the completed-encounter archive. Nothing is deleted when a
 * service is finished; staff can reopen the record and review every assessment.
 */
export default function PastPatients() {
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPatients = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/patients/past', {
        params: query.trim() ? { q: query.trim() } : undefined
      });
      setPatients(response.data.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load completed patient records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSubmit = event => {
    event.preventDefault();
    loadPatients();
  };

  return (
    <div className="past-patients-page">
      <section className="hero-small">
        <div>
          <div className="eyebrow">COMPLETED ENCOUNTERS</div>
          <h2>Past patients</h2>
          <p>
            Review completed services, final decisions, reassessments and the full
            dataset-aligned patient record without removing historical context.
          </p>
        </div>
        <Archive size={32} aria-hidden="true" />
      </section>

      <form className="past-search" onSubmit={handleSubmit}>
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search patient ID, name or chief complaint"
          aria-label="Search past patients"
        />
        <button className="secondary-button" type="submit">
          Search
        </button>
      </form>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="panel table-panel">
        {loading ? (
          <div className="page-loading">Loading completed encounters…</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Final ESI</th>
                  <th>Decision</th>
                  <th>Completed</th>
                  <th>Completion note</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {patients.map(patient => (
                  <tr key={patient.patientId}>
                    <td>
                      <Link
                        className="patient-link"
                        to={`/patients/${patient.patientId}`}
                      >
                        <strong>
                          {patient.firstName} {patient.lastName}
                        </strong>
                        <small>
                          {patient.patientId} · {patient.age}y · {patient.sex}
                        </small>
                      </Link>
                    </td>
                    <td>
                      <EsiBadge esi={patient.finalEsi || patient.triage?.esi} />
                    </td>
                    <td>
                      <span className="decision-pill">
                        <CheckCircle2 size={12} />
                        {patient.clinicianDecision || 'PENDING'}
                      </span>
                    </td>
                    <td>
                      {patient.serviceCompletedAt
                        ? new Date(patient.serviceCompletedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td>
                      <span className="past-note">
                        {patient.completionNote || 'No completion note'}
                      </span>
                    </td>
                    <td>
                      <Link className="table-action" to={`/patients/${patient.patientId}`}>
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !patients.length && (
          <div className="empty-state">
            No completed patient records match your search.
          </div>
        )}
      </section>
    </div>
  );
}
