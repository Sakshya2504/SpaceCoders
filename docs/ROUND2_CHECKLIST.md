# Round 2 prototype checklist

| Requirement | Evidence |
|---|---|
| 15–20 simulated records | `server/src/seed.js` creates 18 |
| ESI 1–5 | `server/src/services/triageEngine.js` |
| Confidence on every score | `patient.triage.confidence` |
| Red flags | Sepsis, MI, stroke, respiratory failure signals |
| Ambiguous/conflicting path | `ABSTAIN_ESCALATE` |
| Pediatric + geriatric | Seeded ages 4–14 and 67–83 |
| Zero-history | `hasHistory=false` lowers confidence |
| Explainability | Reasons + feature contributions |
| Clinician override | Patient Review → Override |
| Audit logging | Append-only SHA-256 linked events |
| Waiting queue | `/queue` |
| Continuous reassessment | `/api/queue/tick` |
| 3× surge | Surge mode → 1-minute cadence |
| Human authority | UI labels recommendations as advisory |
| Fail-open boundary | Safety flow + production gateway hook |
