# PatientTriage.ai — Demonstration Walkthrough

This guide is designed for a 5–7 minute product demonstration. The sequence is intentionally ordered so the audience sees the operational problem, the decision support, the safety controls and the audit trail in one continuous story.

## 1. Start the system

Run the Node application and, for the complete ML demo, the XGBoost inference service as described in `docs/SETUP.md`.

Confirm:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:3000
ML       → http://127.0.0.1:8000
```

Open the frontend and sign in with:

```text
Email:    charge@patienttriage.demo
Password: demo123
```

## 2. Command Centre — establish the operational picture

Start on **Command Centre**.

Point out:

- patients today;
- patients currently waiting;
- critical and high-risk volume;
- reassessments due;
- confidence information;
- active alerts;
- current AI, database and realtime health state.

Suggested explanation:

> “This is the operational view. Instead of looking at isolated patient records, the team can see acuity, uncertainty, alerts and queue pressure together.”

## 3. Patient Intake — show dataset-aligned input

Open **Patient Intake**.

Explain that the form captures the same feature families represented in the reference `train.csv` dataset.

Show:

```text
Demographics
Arrival context
Complaint category
Pain location
Mental status
Prior ED visits/admissions
Medication and comorbidity counts
Vital signs
GCS
Pain score
Weight and height
NEWS2
```

Then point out the derived values:

```text
Age group
Arrival hour/day/month/season
Shift
BMI
Mean arterial pressure
Pulse pressure
Shock index
```

Suggested explanation:

> “The operator enters information that is realistically available during intake. Derived values are calculated automatically so staff do not have to perform duplicate arithmetic.”

## 4. Use an easy high-risk demonstration case

A seeded case can be used, or enter a synthetic case such as:

```text
Chief complaint:
Severe shortness of breath and blue lips

Example vitals:
SpO₂: 82
Respiratory rate: 34
```

Submit the patient.

Open **Patient Review**.

## 5. Explain the recommendation

Show:

- ESI recommendation;
- model/source and confidence;
- confidence band;
- extracted complaint signals;
- independent red-flag results;
- feature contributions/reasons;
- clinician action controls.

Suggested explanation:

> “The model provides a recommendation, but that recommendation is not the final authority. The application also runs independent safety checks and makes uncertainty visible.”

## 6. Demonstrate a red-flag escalation

For a respiratory case, point to the respiratory detector and explain that a positive safety detector can move the case to the immediate-escalation path.

The alert center should surface the escalation through the realtime Socket.IO event path.

Suggested explanation:

> “The red-flag layer is intentionally separated from the general model score. A critical safety signal should not disappear just because the aggregate model prediction looks less severe.”

## 7. Demonstrate uncertainty and fail-open

Create a sparse/zero-history synthetic patient.

Show that history availability affects confidence and that the system has an explicit `ABSTAIN_AND_ESCALATE` path when information is insufficient.

Then stop the Python inference service temporarily and reassess the patient.

The Node workflow should continue using the deterministic fallback instead of blocking the triage screen.

Suggested explanation:

> “Model availability is not allowed to become a single point of failure. When inference is unavailable, the workflow remains available and the source is exposed for traceability.”

## 8. Demonstrate the Live Queue

Open **Live Queue**.

Show:

- queue position;
- patient ID and age band;
- ESI;
- confidence;
- wait time;
- action tier;
- red-flag count.

Click **Reassess now**.

Then toggle **Surge mode**.

Explain that the queue monitor uses more frequent reassessment during surge conditions.

## 9. Demonstrate clinician control

Return to **Patient Review**.

Choose one:

```text
Accept
```

or:

```text
Override
```

For an override, select a target ESI and structured reason and submit the action.

Suggested explanation:

> “The model can recommend, but the clinician decides. The application stores the model recommendation separately from the final clinician action.”

## 10. Demonstrate alerts

Open the alert bell in the top navigation.

Show the distinction between:

```text
Immediate escalation
Deterioration detected
New triage recommendation
Clinician override
AI fail-open
Surge simulation completed
```

Use **Mark all read** or dismiss an item to demonstrate the alert interaction.

## 11. Demonstrate auditability

Open **Audit Trail**.

Click **Verify chain**.

Point out:

```text
Event ID
Event type
Patient
Actor
Role
Timestamp
Current hash
Previous hash
```

Suggested explanation:

> “Each important workflow event is linked to the previous event through a SHA-256 hash. The application can verify that chain instead of relying only on a table of unconnected logs.”

## 12. Strong closing statement

Use this closing message:

> “PatientTriage.ai is a second pair of eyes for emergency triage. It brings patient context, model evidence, independent safety checks, confidence, continuous queue monitoring and traceability into one workspace while preserving clinician authority over the final decision.”

## Recommended demo sequence

```text
Command Centre
      ↓
Patient Intake
      ↓
Patient Review
      ↓
Red-flag alert
      ↓
Live Queue
      ↓
Clinician override
      ↓
Audit verification
```

This sequence demonstrates the complete operational story without requiring the presenter to navigate randomly between screens.

## Demo data safety

Use only the seeded synthetic accounts and patient records. Do not enter real patient information into the prototype.

## Prototype disclaimer

The model, thresholds, red-flag detectors and decision logic are prototype components. They have not been clinically validated and should not be used to make real patient-care decisions.
