# PatientTriage.ai — Demo Walkthrough

This walkthrough is written for a 5–7 minute product demonstration. It follows the normal clinician workflow so the audience can see the intake, model result, safety layer, queue, reassessment, alerts and audit trail as one connected system.

## 1. Start the system

Use the startup steps in `docs/SETUP.md`.

For the complete model-backed demo, confirm:

```text
Frontend  → http://localhost:5173
Backend   → http://localhost:3000
ML        → http://127.0.0.1:8000
```

Sign in with a seeded synthetic account:

```text
Email:    charge@patienttriage.demo
Password: demo123
```

## 2. Command Centre

Start on **Command Centre**.

Point out:

- patients today;
- current waiting volume;
- critical/high-risk counts;
- reassessments due;
- confidence information;
- active alerts;
- AI, database and realtime health states.

Suggested explanation:

> “This is the operational view. The team gets patient volume, acuity, uncertainty and alerts in one place instead of moving between disconnected screens.”

## 3. Patient Intake

Open **Patient Intake**.

Explain that the page follows the reference training-data vocabulary while keeping downstream outcomes out of the predictive input.

Show the sections for:

```text
Patient identity
Demographics
Arrival context
Complaint / mental status
Prior ED visits and admissions
Medication and comorbidity counts
Vital signs
GCS and pain score
Weight and height
NEWS2
```

Point out the calculated values:

```text
Age group
Arrival hour
Arrival day
Arrival month
Arrival season
Shift
BMI
Mean arterial pressure
Pulse pressure
Shock index
```

Suggested explanation:

> “The clinician enters information available at intake. Values that can be derived reliably are calculated automatically so the operator does not have to perform the same arithmetic by hand.”

## 4. Create a synthetic patient

Use a synthetic case. For a clear safety demonstration, a respiratory example works well:

```text
Chief complaint:
Severe shortness of breath and blue lips

SpO₂:
82

Respiratory rate:
34
```

Submit the patient and open **Patient Review**.

## 5. Explain the model recommendation

On Patient Review, show:

```text
AI recommended priority
ESI 1–5
Confidence
Class probabilities
Model name/version
Supporting signals
Independent red flags
```

The final supplied model is:

```text
5 × LightGBM
+
5 × XGBoost
      ↓
LogisticRegression stacking model
      ↓
ESI 1–5 + probabilities + confidence
```

Suggested explanation:

> “This is the supplied final ensemble. It produces an ESI recommendation and probability distribution. The application then applies separate safety and uncertainty logic before the clinician decides what to do.”

## 6. Explain ESI in plain language

The portal should show a short explanation alongside the numeric result. Use this to connect the number to the product's prototype interpretation:

```text
ESI 1 → Immediate intervention
ESI 2 → High-risk / time-sensitive
ESI 3 → Stable, but significant resource need
ESI 4 → Lower acuity
ESI 5 → Minimal acuity
```

Keep the language framed as prototype decision-support wording rather than claiming an official clinical implementation.

## 7. Demonstrate the safety layer

Point to the independent detector results.

The prototype has separate detector families for:

```text
sepsis-like
MI-like
stroke-like
respiratory-failure-like
```

Suggested explanation:

> “The safety layer is deliberately separate from the general model prediction. A configured critical detector can escalate the operational recommendation even when the aggregate model result looks less urgent.”

## 8. Demonstrate alerts

Open the notification bell.

Show that safety-relevant events appear as readable alerts rather than only changing a hidden field.

Useful examples include:

```text
Immediate escalation
Deterioration detected
New triage recommendation
Clinician override
AI fail-open
Surge simulation completed
```

The alert panel is intentionally bounded and scrollable, so a long alert history does not cover the entire page.

## 9. Demonstrate uncertainty and fail-open

Create or open a synthetic patient with limited history.

Point out that sparse information lowers confidence and can lead to:

```text
ABSTAIN_AND_ESCALATE
```

Then stop the Python inference service and trigger a reassessment.

Expected behavior:

```text
ensemble unavailable
      ↓
Node catches the failure
      ↓
explicit prototype fallback
      ↓
workflow remains available
```

Suggested explanation:

> “The model service is not allowed to become a single point of failure. The application keeps the workflow available and records that a fallback was used.”

## 10. Demonstrate Reassess

Click **Reassess**.

Use the reassessment window to change one or more current patient values.

After saving, show that:

```text
new model run
      ↓
new ESI / confidence
      ↓
new assessment entry
      ↓
previous assessments remain visible
```

Explain that the history is retained instead of silently replacing the previous assessment.

## 11. Demonstrate Accept / Override

Use **Accept** to record clinician agreement with the recommendation.

Then demonstrate **Override** with:

```text
Target ESI → 1–5
Reason     → required
Note       → optional
```

Suggested explanation:

> “The application keeps the model recommendation and clinician decision separate. The model can support the decision, but it cannot take the decision away from the clinician.”

## 12. Demonstrate Live Queue

Open **Live Queue**.

Show:

```text
queue position
patient
ESI
confidence
wait time
action state
red-flag state
next reassessment
```

Click **Reassess now** and then demonstrate **Surge mode**.

Suggested explanation:

> “The queue reuses the same triage orchestration instead of maintaining a second scoring implementation. Surge mode simply asks the monitoring loop to work more frequently.”

## 13. Mark a service as done

Return to Patient Review and click **Mark service done**.

Show that the patient leaves the active workflow and becomes available from **Past Patients**.

Explain:

> “Completion is an operational state change. Historical information is retained rather than deleting the patient from the system.”

## 14. Demonstrate the Audit Trail

Open **Audit Trail** and run **Verify chain**.

Point out:

```text
Event ID
Event type
Patient
Actor
Role
Timestamp
Previous hash
Current hash
```

Suggested explanation:

> “Each important workflow event is linked to the previous event using a SHA-256 hash. The application can verify the chain and identify the first broken event.”

## 15. Strong closing statement

> “PatientTriage.ai is a second pair of eyes for emergency triage. It combines dataset-aligned intake, the supplied model ensemble, independent safety checks, visible uncertainty, continuous reassessment, realtime alerts and auditability while keeping the clinician in control of the final decision.”

## Suggested demo sequence

```text
Command Centre
      ↓
Patient Intake
      ↓
Patient Review
      ↓
Safety alert
      ↓
Reassess
      ↓
Accept / Override
      ↓
Live Queue
      ↓
Mark service done
      ↓
Past Patients
      ↓
Audit verification
```

## Demo data safety

Use only synthetic demo users and synthetic patient records. Do not enter real patient information into the prototype.

## Prototype disclaimer

The model, thresholds, safety detectors and workflow logic are demonstration components. They have not been clinically validated and must not be used to make real patient-care decisions.
