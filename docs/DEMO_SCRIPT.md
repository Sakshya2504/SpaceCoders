# PatientTriage.ai — Demo Walkthrough

## 5–7 minute flow

### 1. Sign in

Use the demo charge-nurse account:

```text
charge@patienttriage.demo
 demo123
```

Start on the Command Centre and point out the operational KPIs, current acuity mix, active alerts and system health.

### 2. Create a patient

Open **Patient Intake**.

Show that the form captures the same feature families used by the training dataset: demographics, arrival context, complaint category, pain location, mental status, prior utilization, medications, comorbidities and bedside measurements.

Mention that age group, arrival timing fields, BMI, mean arterial pressure, pulse pressure and shock index are derived automatically.

### 3. Review the decision

After submission, open **Patient Review**.

Show:

- ESI recommendation.
- Confidence and confidence band.
- Extracted complaint signals.
- Independent sepsis, MI, stroke and respiratory-risk detectors.
- Feature contributions/reasons.
- Final clinician action controls.

### 4. Demonstrate safety behavior

Use a high-risk or seeded case to show immediate escalation.

Then demonstrate a zero-history or sparse case and show the confidence reduction and explicit `ABSTAIN_AND_ESCALATE` path.

Explain that a model failure uses `FAIL_OPEN` so manual triage remains available.

### 5. Demonstrate the queue

Open **Live Queue**.

Show position, ESI, confidence, wait time, action tier and red-flag count. Use **Reassess now** to demonstrate re-scoring.

Toggle surge mode to show that the monitoring cadence can tighten during high volume.

### 6. Demonstrate clinician control

On Patient Review, accept a recommendation or open **Override**.

Select a target ESI and structured reason, then save. Emphasize that the model recommendation and clinician decision are stored separately.

### 7. Demonstrate traceability

Open **Audit Trail** and click **Verify chain**.

Show the timestamp, event, patient, actor, role, hashes and validation result. Explain that decision events are linked with SHA-256 for traceability.

## Presentation message

The product is a second pair of eyes for emergency triage: it surfaces acuity and risk early, makes uncertainty visible, continuously watches the queue, and preserves clinician authority over the final decision.

All demo records are synthetic. The model and thresholds are prototype components and are not clinically validated.
