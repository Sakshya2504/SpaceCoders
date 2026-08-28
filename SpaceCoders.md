# SPACE CODERS — PATIENTTRIAGE.AI
## Accenture Innovation Challenge 2026 — Round 2
## MASTER IMPLEMENTATION PROMPT FOR A CODING AGENT

You are the senior full-stack engineer responsible for taking the EXISTING repository:

https://github.com/Sakshya2504/SpaceCoders

to a polished, end-to-end, demo-ready MERN prototype for Round 2 of the Accenture Innovation Challenge 2026.

IMPORTANT:
- Work INSIDE the existing SpaceCoders repository only.
- Do NOT create a separate unrelated project.
- Do NOT throw away the current React/Express/MongoDB architecture.
- Inspect the repository first, understand existing code, then modify/refactor it in place.
- Preserve working functionality wherever possible.
- If something already exists, improve it rather than duplicating it.
- The final result must run locally with one clear setup flow.
- Use synthetic data only. This is a hackathon prototype, not a medical device and not for clinical use.
- Do not claim clinical accuracy or real-world diagnostic capability.
- The final UI must clearly communicate that the AI recommends/re-ranks and the nurse remains the final decision maker.

============================================================
1. SOURCE OF TRUTH / PRODUCT CONTEXT
============================================================

The selected problem is Problem Track 2 — PatientTriage.ai.

Round 2 requires a working prototype demonstrating:
1. Triage scoring on at least 15–20 simulated patient records.
2. At least one ambiguous/conflicting presentation.
3. Pediatric and geriatric handling.
4. At least one zero-history/first-time patient.
5. Simulated 3× surge behaviour.
6. Explicit confidence on every recommendation.
7. At least one clinician override with logging.
8. Continuous monitoring/reassessment of waiting patients.
9. Safety-first escalation under uncertainty.
10. Human-in-the-loop review and auditability.

The product concept:
PatientTriage.ai is an emergency-department decision-support layer that works alongside a triage nurse. It captures demographics, vitals, complaint and optional history; produces an ESI 1–5 recommendation; runs parallel red-flag screening; provides confidence and human-readable reasons; continuously watches the waiting queue; and records clinician overrides.

The system NEVER independently diagnoses, discharges, assigns beds, or replaces the nurse.

============================================================
2. CURRENT REPOSITORY — START FROM HERE
============================================================

The repository already follows a useful MERN structure:

/
  client/
    src/
      components/
        Sidebar.jsx
      pages/
        Audit.jsx
        Dashboard.jsx
        Intake.jsx
        Login.jsx
        PatientDetail.jsx
        Queue.jsx
      App.jsx
      api.js
      index.css
      main.jsx

  server/
    src/
      config/
      middleware/
        auth.js
      models/
        AuditLog.js
        Patient.js
        User.js
      routes/
        audit.js
        auth.js
        dashboard.js
        patients.js
        queue.js
      services/
        audit.js
        triageEngine.js
      seed.js
      server.js

  docs/
    ARCHITECTURE.md
    DEMO_SCRIPT.md
    ROUND2_CHECKLIST.md

Keep this structure unless a small, justified refactor makes the code substantially cleaner.

The frontend is React + Vite.
The backend is Node.js + Express.
The database is MongoDB + Mongoose.
Real-time updates use Socket.IO.
Authentication uses JWT + bcryptjs.

============================================================
3. TARGET ARCHITECTURE
============================================================

Implement this flow:

                ┌───────────────────────────┐
                │ React ED Command Centre   │
                │ Dashboard / Intake /      │
                │ Queue / Patient / Audit   │
                └─────────────┬─────────────┘
                              │
                    REST + Socket.IO
                              │
                ┌─────────────▼─────────────┐
                │ Express API               │
                │ JWT + RBAC + validation   │
                └─────────────┬─────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
      Patient APIs      Queue Monitor      Audit Service
            │                 │                 │
            └─────────────────┼─────────────────┘
                              ▼
                   ┌─────────────────────┐
                   │ Prototype Triage    │
                   │ Decision Engine     │
                   ├─────────────────────┤
                   │ Age normalization   │
                   │ ESI 1–5 scoring     │
                   │ Red flags           │
                   │ Confidence          │
                   │ Explanations        │
                   │ Escalation logic    │
                   └──────────┬──────────┘
                              ▼
                         MongoDB
                              │
                              ▼
                     SHA-256 audit chain

Every recommendation should produce a structured object containing:
- esi
- confidence
- confidenceBand
- action/tier
- redFlags
- reasons
- featureContributions
- ageBand
- dataCompleteness
- hasHistory
- modelVersion
- generatedAt
- reassessment metadata when applicable

============================================================
4. NON-NEGOTIABLE SAFETY LOGIC
============================================================

Implement these rules exactly.

A. RED FLAG POSITIVE
IF any high-sensitivity red flag is positive:
    action = IMMEDIATE_ESCALATION
    escalation = true
    do not allow the general ESI result to suppress the alert.

Red flags:
- sepsis
- myocardial infarction / MI
- stroke
- respiratory failure

B. LOW CONFIDENCE / CONFLICTING SIGNALS
IF confidence is below threshold OR model and red-flag logic conflict OR data is materially incomplete:
    action = ABSTAIN_AND_ESCALATE
    increase acuity toward the higher-risk branch
    require human review
    NEVER silently choose the lower-risk interpretation.

C. HIGH-CONFIDENCE LOW/MODERATE ACUITY
IF confidence is high AND ESI is 3–5 AND there are no red flags:
    action = AUTO_CONTEXT
    surface the recommendation in the ranked queue without an interruptive alert.

D. SENSOR / MODEL / CONNECTIVITY FAILURE
IF the scoring pipeline fails:
    action = FAIL_OPEN
    return control to manual ESI workflow.
    Do not block care.
    UI must clearly say the AI recommendation is unavailable and manual triage is active.

E. CLINICIAN OVERRIDE
The nurse can always override the recommendation.
Override must require:
- target ESI
- structured reason code
- optional free-text note
- clinician identity
- timestamp

The override must be stored and added to the audit chain.

============================================================
5. TRIAGE ENGINE
============================================================

Do NOT add a mandatory external AI API dependency for the core demo.

The prototype decision engine should be deterministic, local, explainable and fast.

Create/refactor:

server/src/services/triageEngine.js

Expose a stable function such as:

scorePatient(patientInput)

Return:

{
  esi: 1 | 2 | 3 | 4 | 5,
  confidence: 0-100,
  confidenceBand: "HIGH" | "MEDIUM" | "LOW",
  action: "AUTO_CONTEXT" | "IMMEDIATE_ESCALATION" | "ABSTAIN_AND_ESCALATE" | "FAIL_OPEN",
  ageBand: "PEDIATRIC" | "ADOLESCENT" | "ADULT" | "GERIATRIC",
  redFlags: {
    sepsis: { positive, score, reasons },
    mi: { positive, score, reasons },
    stroke: { positive, score, reasons },
    respiratoryFailure: { positive, score, reasons }
  },
  reasons: [],
  featureContributions: [],
  dataCompleteness: 0-100,
  hasHistory: boolean,
  modelVersion: "prototype-v1",
  timestamp
}

Use transparent weighted rules.

AGE BANDS:
- Pediatric: 0–12
- Adolescent: 13–17
- Adult: 18–64
- Geriatric: 65+

Do not use one adult threshold for every age group.

Create a configurable threshold structure so age-specific rules are not hard-coded throughout the engine.

At minimum consider:
- heart rate
- respiratory rate
- temperature
- systolic BP
- SpO2
- pain score
- mental status
- symptom severity
- onset
- history
- observed distress
- chief complaint keywords

The engine should normalize vitals relative to the patient's age band.

IMPORTANT:
The exact thresholds are prototype assumptions, not clinical guidance. Add comments/documentation making this explicit.

============================================================
6. CHIEF-COMPLAINT NLP
============================================================

Implement lightweight local NLP / keyword extraction for the prototype.

Input:
"patient says chest pressure radiating to left arm with sweating"

Output should identify useful signals such as:
- chest pain/pressure
- radiation
- diaphoresis/sweating

Support common symptom phrases for:
- chest pain
- shortness of breath
- breathing difficulty
- weakness
- facial droop
- speech difficulty
- confusion
- fever
- chills
- cough
- abdominal pain
- bleeding
- trauma
- seizure
- fainting/syncope
- severe headache
- vomiting
- diarrhea
- dizziness

Do NOT pretend this is a medical-grade NLP model.

Show "Extracted clinical signals" in the UI.

============================================================
7. RED-FLAG DETECTION
============================================================

Implement four independent high-recall prototype detectors.

SEPSIS:
Signals may include combinations of:
- fever/hypothermia
- tachycardia
- tachypnea
- hypotension
- altered mental status
- suspected infection keywords

MI:
Signals may include:
- chest pain/pressure
- radiation to arm/jaw/back
- diaphoresis
- nausea
- prior cardiac history
- abnormal vitals

STROKE:
Signals may include:
- facial droop
- unilateral weakness
- speech difficulty
- sudden confusion
- sudden severe neurological symptoms

RESPIRATORY FAILURE:
Signals may include:
- low SpO2
- severe respiratory distress
- high respiratory rate
- cyanosis
- inability to speak normally
- severe shortness of breath

Each detector must return:
positive
score
reasons

A positive detector must short-circuit into immediate escalation.

============================================================
8. CONFIDENCE MODEL
============================================================

Do not simply use a random confidence number.

Calculate confidence from:
- data completeness
- availability of history
- consistency of signals
- distance from normal age-band ranges
- agreement between general severity score and red-flag detectors
- presence/absence of conflicting evidence

Example concept:

confidence =
  0.30 * dataCompleteness
+ 0.25 * signalConsistency
+ 0.20 * historyAvailability
+ 0.15 * ageNormalizationConfidence
+ 0.10 * modelAgreement

Clamp to 0–100.

Make the weights configurable.

If:
confidence < 60
    LOW

60–79
    MEDIUM

80–100
    HIGH

Use sensible prototype thresholds and document them.

For zero-history patients:
- do not silently impute history
- data completeness should decrease
- confidence should decrease
- ambiguous cases should be more likely to escalate

============================================================
9. ESI SCORING
============================================================

Produce ESI 1–5.

Prototype interpretation:
ESI 1 = immediate life-saving intervention / catastrophic instability
ESI 2 = high-risk / time-sensitive emergency
ESI 3 = stable but significant resource need
ESI 4 = lower acuity
ESI 5 = minimal acuity

Do not claim this is an official clinical ESI implementation.

Use an internal continuous severity/risk score and then map it to ESI.

Make severe signals increase severity.

Examples:
- critical SpO2 + respiratory distress => high acuity
- stroke signs => high acuity
- chest pain + concerning features => high acuity
- severe hypotension => high acuity
- stable minor wound => lower acuity

============================================================
10. AGE-AWARE DEMONSTRATION
============================================================

The demo must visibly prove that age matters.

Seed at least:
- one pediatric case
- one adolescent case
- several adults
- one or more geriatric cases

Create at least one comparison-friendly case where similar raw vitals are interpreted differently because the age band differs.

Display:
"Age band: Pediatric / Adult / Geriatric"
and
"Age-adjusted interpretation"

============================================================
11. SEED DATA
============================================================

Create at least 18 synthetic patient records.

Make them realistic enough for a hackathon demo.

Include deliberately engineered cases:

1. Critical respiratory failure
2. Suspected MI
3. Suspected stroke
4. Sepsis-like presentation
5. Pediatric fever
6. Geriatric weakness/confusion
7. Zero-history patient
8. Ambiguous/conflicting presentation
9. Low-acuity minor injury
10. Abdominal pain
11. Syncope
12. Asthma/respiratory complaint
13. Headache
14. Dehydration
15. Trauma
16. Infection-like complaint
17. Chest discomfort without clear red flag
18. Stable chronic complaint

Ensure:
- hasHistory=true for approximately half
- hasHistory=false for approximately half
- ages cover all bands
- vitals vary
- complaints vary
- at least one patient initially appears low/moderate but is escalated by a red flag
- at least one patient is low confidence and follows ABSTAIN_AND_ESCALATE

Seed should be idempotent:
npm run seed

It should clear/recreate synthetic demo data safely.

============================================================
12. DATA MODEL
============================================================

Patient model should contain enough information for:

Identity:
- patientId / MRN-like synthetic identifier
- firstName
- lastName
- age
- sex
- arrivalTime

Clinical intake:
- chiefComplaint
- extractedSymptoms
- vitals:
  - heartRate
  - respiratoryRate
  - temperature
  - systolicBP
  - diastolicBP
  - spo2
  - painScore
- mentalStatus
- hasHistory
- historySummary
- conditions
- medications
- allergies

Triage:
- esi
- confidence
- confidenceBand
- action
- ageBand
- redFlags
- reasons
- featureContributions
- dataCompleteness
- manualEsi
- finalEsi
- status

Queue:
- queueStatus
- position
- lastReassessmentAt
- nextReassessmentAt
- safeMaxWaitMinutes
- deteriorationDetected
- surgeMode

Override:
- overridden
- overrideBy
- overrideAt
- overrideReason
- overrideNote

Audit references:
- lastAuditHash

Create separate Triage/Assessment records only if this makes the existing implementation cleaner; otherwise keep triage history embedded as an array.

============================================================
13. AUDIT TRAIL
============================================================

Implement a SHA-256 linked audit chain.

Each audit event contains:

{
  eventId,
  eventType,
  patientId,
  actorId,
  actorRole,
  timestamp,
  payload,
  previousHash,
  hash
}

hash = SHA256(
  canonical JSON of:
  eventType +
  patientId +
  actorId +
  timestamp +
  payload +
  previousHash
)

The chain should be append-only at the application level.

Event types:
- LOGIN
- PATIENT_CREATED
- TRIAGE_SCORED
- RED_FLAG_TRIGGERED
- ESCALATION
- QUEUE_REASSESSMENT
- DETERIORATION_DETECTED
- CLINICIAN_ACCEPTED
- CLINICIAN_OVERRIDE
- MANUAL_TRIAGE
- FAIL_OPEN
- LOGOUT

Audit page should show:
- timestamp
- event type
- patient
- actor
- role
- action
- hash
- previous hash
- readable payload summary

Add a "Verify chain" button that walks the chain and reports:
VALID / INVALID
and identifies the first broken event if invalid.

============================================================
14. AUTHENTICATION + RBAC
============================================================

Use JWT + bcryptjs.

Roles:
- triage_nurse
- charge_nurse
- clinical_admin
- system_admin

Permissions should be enforced server-side.

Suggested rules:
triage_nurse:
- view patients
- create intake
- review triage
- accept
- override
- view own/relevant audit

charge_nurse:
- all nurse permissions
- view surge controls
- view wider audit
- view metrics

clinical_admin:
- dashboards
- audit
- configuration
- quality metrics

system_admin:
- all demo administration capabilities

Never trust the frontend for authorization.

Protect every sensitive API route with auth middleware.

============================================================
15. DASHBOARD
============================================================

Make the Dashboard the primary ED command centre.

Show:

Top KPI cards:
- Patients Today
- Waiting
- Critical / ESI 1–2
- High Risk
- Avg Triage Time
- Reassessment Due
- Active Alerts

Main sections:
1. Live queue
2. Critical alerts
3. Risk distribution
4. Confidence distribution
5. Red-flag breakdown
6. Recent audit activity
7. Surge status
8. System health

Use charts where useful:
- ESI distribution
- confidence distribution
- queue by acuity
- red flag counts
- reassessment activity

Use Recharts if it already exists.

The dashboard must update in real time through Socket.IO.

============================================================
16. INTAKE PAGE
============================================================

Create a fast nurse-friendly intake flow.

Sections:
A. Demographics
B. Chief complaint
C. Vitals
D. Medical history
E. Medications/allergies
F. Review

On submit:
1. validate
2. save patient
3. run triage engine
4. store result
5. create audit event
6. emit Socket.IO update
7. route to patient review

Show a progress indicator.

Show inline validation.

Make the workflow optimized for keyboard use and speed.

============================================================
17. PATIENT REVIEW PAGE
============================================================

This is the most important demo page.

Display:

Header:
- patient name / synthetic ID
- age
- arrival time
- current queue status
- ESI recommendation

Large recommendation panel:
- ESI 1–5
- confidence %
- confidence band
- action
- escalation badge

Red flags:
- Sepsis
- MI
- Stroke
- Respiratory Failure

Each should show:
- positive/negative
- score
- reason

Explainability:
"Why the system recommended this"

Show top 3–5 feature contributions.

Example:
+ Low SpO2 for age
+ High respiratory rate
+ Severe dyspnea
- No prior history

History completeness:
- Full
- Partial
- Zero-history

Show:
"AI recommendation is decision support. Final priority remains with the nurse."

Buttons:
- Accept recommendation
- Override recommendation
- Mark manual triage
- Trigger reassessment

Override modal:
- target ESI
- reason dropdown
- note
- confirm

Do not allow override without a reason.

============================================================
18. QUEUE PAGE
============================================================

Build a real ED waiting queue.

Columns/cards:
- Priority
- Patient
- Age
- Chief complaint
- ESI
- Confidence
- Red flags
- Wait time
- Next reassessment
- Status
- Action

Sort primarily by:
1. immediate escalation
2. ESI
3. deterioration
4. wait breach
5. arrival time

Make high-risk patients visually prominent.

Include filters:
- All
- ESI 1
- ESI 2
- ESI 3
- ESI 4–5
- Red flags
- Low confidence
- Reassessment due
- Zero history

Add a search field.

============================================================
19. CONTINUOUS QUEUE MONITOR
============================================================

Implement a background queue monitor.

For each waiting patient:
- calculate wait time
- calculate safe max wait based on ESI
- determine whether reassessment is due
- detect worsening vitals when updated
- rerun triage
- update queue ordering
- create audit event
- emit Socket.IO event

For prototype:
Normal cadence = 5 minutes
Surge cadence = 1 minute

Do not make the demo wait 5 real minutes to prove functionality.

Add DEMO MODE / simulation controls:
- "Advance 5 min"
- "Advance 15 min"
- "Simulate deterioration"
- "Run queue tick"
- "Toggle surge mode"

These should be clearly labeled as simulation controls.

When surge mode is active:
- reassessment cadence becomes 1 minute
- dashboard shows SURGE MODE
- queue prioritizes critical alerts
- routine notifications are compressed
- show a measurable "3× load simulation" panel

============================================================
20. SURGE SIMULATION
============================================================

Implement a dedicated surge demo.

Normal:
- baseline queue volume
- 5-minute reassessment cadence

Surge:
- 3× simulated arrival volume
- 1-minute reassessment cadence
- queue remains responsive
- critical alerts stay prominent
- routine notifications are condensed

Show metrics:
- simulated arrivals
- processed
- reassessed
- alerts
- average processing latency
- queue depth
- reassessment latency

A button:
"Run 3× Surge Simulation"

It should complete quickly and visibly update the UI.

============================================================
21. FAIL-OPEN DEMONSTRATION
============================================================

Add a controlled demo mechanism:
"Simulate scoring service failure"

When activated:
- scoring call fails
- no fake recommendation is produced
- UI switches to "Manual ESI Required"
- patient remains safely in workflow
- audit event = FAIL_OPEN
- user can enter manual ESI
- Socket.IO broadcasts system status

Add a small system health indicator:
AI Engine: ONLINE / FAIL-OPEN
Database: ONLINE / OFFLINE
Realtime: CONNECTED / DISCONNECTED

============================================================
22. REAL-TIME SOCKET.IO
============================================================

Implement Socket.IO events for:
- patient created
- triage completed
- escalation
- queue updated
- reassessment
- deterioration
- override
- surge status
- system health

Frontend should update without a manual refresh.

Handle socket reconnect gracefully.

============================================================
23. API DESIGN
============================================================

Maintain REST APIs with clean responses.

Suggested endpoints:

AUTH
POST /api/auth/login
GET  /api/auth/me

PATIENTS
GET  /api/patients
GET  /api/patients/:id
POST /api/patients
PUT  /api/patients/:id
POST /api/patients/:id/triage
POST /api/patients/:id/override
POST /api/patients/:id/reassess
POST /api/patients/:id/manual-triage

QUEUE
GET  /api/queue
POST /api/queue/tick
POST /api/queue/simulate-deterioration
POST /api/queue/surge
POST /api/queue/surge/run

DASHBOARD
GET /api/dashboard/summary
GET /api/dashboard/metrics

AUDIT
GET /api/audit
GET /api/audit/patient/:patientId
GET /api/audit/verify

HEALTH
GET /api/health

Use consistent JSON:

{
  success: true,
  data: ...,
  message: "...",
  error: null
}

For errors:

{
  success: false,
  data: null,
  message: "...",
  error: {
    code: "...",
    details: "..."
  }
}

============================================================
24. FRONTEND DESIGN
============================================================

The UI should look like a serious modern emergency operations centre.

Design direction:
- dark/navy clinical command-centre base
- white/light cards for readable data
- restrained purple accent inspired by Accenture/SpaceCoders branding
- strong red/orange only for clinical urgency
- green for safe/accepted
- blue for information
- high contrast
- rounded cards
- subtle shadows
- dense but readable data
- responsive layout

Do not make it look like a generic student CRUD dashboard.

Create:
- professional sidebar
- top bar
- notification area
- user/role indicator
- system health indicator
- consistent badges
- skeleton/loading states
- empty states
- error states
- confirmation dialogs
- toast notifications

Accessibility:
- keyboard-friendly
- semantic labels
- sufficient contrast
- do not rely only on color
- clear text for urgency

Responsive:
- desktop first
- tablet support
- usable on smaller screens

============================================================
25. ROUTING
============================================================

Routes:

/login
/
/dashboard
/intake
/queue
/patients/:id
/audit

Protected routes require login.

Redirect unauthenticated users to /login.

After login:
- triage nurse -> dashboard
- charge nurse -> dashboard
- clinical admin -> dashboard
- system admin -> dashboard

============================================================
26. DEMO CREDENTIALS
============================================================

Keep/update demo credentials:

charge@patienttriage.demo
demo123

Also seed:
nurse@patienttriage.demo
demo123

admin@patienttriage.demo
demo123

Use obvious demo-only credentials and document them.

============================================================
27. ERROR HANDLING
============================================================

Implement:
- API error middleware
- validation errors
- MongoDB connection errors
- JWT errors
- socket errors
- triage engine errors
- fail-open handling

Frontend:
- global API error handling
- retry where safe
- readable error messages
- never expose stack traces to users

============================================================
28. TESTING
============================================================

Add automated tests where practical.

At minimum test:

Triage engine:
- normal low-acuity patient
- critical respiratory patient
- MI red flag
- stroke red flag
- sepsis red flag
- pediatric age normalization
- geriatric age normalization
- zero history lowers confidence
- ambiguous case -> ABSTAIN_AND_ESCALATE
- red flag overrides ESI
- fail-open result

Audit:
- first event
- hash chain
- chain verification
- override event

API:
- login
- protected route
- patient creation
- triage
- override
- queue tick

Do not add a huge testing framework if the repo doesn't already have one; choose a lightweight solution compatible with the existing project.

============================================================
29. DOCUMENTATION
============================================================

Update/create:

README.md
docs/ARCHITECTURE.md
docs/DEMO_SCRIPT.md
docs/ROUND2_CHECKLIST.md
docs/API.md
docs/SECURITY.md

README must include:
- product overview
- architecture
- stack
- features
- local setup
- environment variables
- seed command
- demo credentials
- demo walkthrough
- screenshots placeholders
- safety disclaimer
- production upgrade path

ARCHITECTURE.md must include:
- system architecture diagram in Mermaid
- request flow
- triage flow
- queue monitor flow
- audit chain
- surge mode
- fail-open flow
- production XGBoost/SHAP upgrade path

DEMO_SCRIPT.md should be a 5–7 minute judging demo.

ROUND2_CHECKLIST.md should map every requirement to:
- feature
- file
- API
- UI evidence
- demo step

============================================================
30. PRODUCTION UPGRADE PATH
============================================================

The current prototype should remain pure MERN.

However, architect the triage engine behind a stable contract so that later:

Node prototype triageEngine.js
        ↓
internal inference API
        ↓
XGBoost/LightGBM + SHAP service

can replace the prototype scorer without changing the React workflow.

Document that production would require:
- clinical validation
- secure secrets
- TLS
- encryption at rest
- stronger audit immutability
- model monitoring
- model/version governance
- formal regulatory review
- real hospital integration
- FHIR/EHR interoperability
- proper PHI controls
- human factors validation

============================================================
31. DO NOT OVERENGINEER
============================================================

This is a Round 2 prototype.

DO NOT:
- add Kubernetes
- add microservices for everything
- require paid APIs
- require cloud AI to run
- require Python just to demonstrate scoring
- introduce unnecessary infrastructure
- make the setup impossible for judges

The prototype must be:
- local
- reproducible
- fast
- understandable
- visually impressive
- technically defensible

============================================================
32. IMPLEMENTATION PROCESS
============================================================

Follow this exact sequence.

PHASE 1 — RECON
1. Inspect every existing frontend and backend file.
2. Understand current models, routes, pages, services and API calls.
3. Identify what already works.
4. Do not rewrite blindly.

PHASE 2 — BACKEND FOUNDATION
1. Validate MongoDB configuration.
2. Clean up models.
3. Harden JWT/RBAC.
4. Implement/upgrade triage engine.
5. Implement red flags.
6. Implement confidence.
7. Implement escalation logic.
8. Implement audit hash chain.
9. Implement queue monitor.
10. Implement surge simulator.
11. Implement fail-open.
12. Add Socket.IO events.
13. Make seed idempotent.

PHASE 3 — FRONTEND
1. Improve global layout.
2. Improve sidebar/topbar.
3. Upgrade dashboard.
4. Upgrade intake.
5. Upgrade queue.
6. Upgrade patient detail/review.
7. Upgrade audit.
8. Add live updates.
9. Add loading/error/empty states.
10. Add simulation controls.

PHASE 4 — INTEGRATION
1. Verify every frontend API call.
2. Verify authentication.
3. Verify MongoDB persistence.
4. Verify Socket.IO.
5. Verify audit chain.
6. Verify queue re-ranking.
7. Verify override.
8. Verify fail-open.
9. Verify surge.

PHASE 5 — QUALITY
1. Run lint/build/tests.
2. Fix all runtime errors.
3. Remove dead code.
4. Remove console spam.
5. Ensure no secrets are committed.
6. Ensure .env.example is correct.
7. Ensure seed works from clean database.
8. Ensure README setup instructions are accurate.

PHASE 6 — DEMO READINESS
Run the exact demo:
1. Login as charge nurse.
2. Show dashboard.
3. Open an existing critical patient.
4. Show ESI + confidence + reasons.
5. Show red flag escalation.
6. Accept one recommendation.
7. Override another.
8. Show audit chain.
9. Return to queue.
10. Simulate deterioration.
11. Show automatic reassessment and re-ranking.
12. Toggle surge.
13. Run 3× simulation.
14. Demonstrate zero-history lower confidence.
15. Demonstrate pediatric/geriatric age-aware logic.
16. Demonstrate fail-open.
17. Return to dashboard and show metrics.

============================================================
33. ACCEPTANCE TEST — MUST PASS
============================================================

Before considering the task complete, verify all of these:

[ ] npm install works
[ ] npm run install:all works if retained
[ ] server starts
[ ] client starts
[ ] MongoDB connection works
[ ] seed works
[ ] login works
[ ] protected routes work
[ ] 18+ synthetic patients exist
[ ] ESI 1–5 appears
[ ] every score has confidence
[ ] every score has reasons
[ ] red flags work
[ ] sepsis red flag works
[ ] MI red flag works
[ ] stroke red flag works
[ ] respiratory failure red flag works
[ ] red flag overrides general ESI
[ ] pediatric case exists
[ ] geriatric case exists
[ ] zero-history case exists
[ ] zero-history lowers confidence
[ ] ambiguous case exists
[ ] ambiguous case escalates
[ ] nurse can accept
[ ] nurse can override
[ ] override requires reason
[ ] override appears in audit
[ ] audit hash chain exists
[ ] audit verification works
[ ] queue exists
[ ] queue sorts by risk
[ ] queue reassessment works
[ ] deterioration simulation works
[ ] surge mode works
[ ] 3× surge demo works
[ ] reassessment cadence changes in surge
[ ] Socket.IO live updates work
[ ] fail-open works
[ ] manual ESI workflow works
[ ] dashboard metrics work
[ ] build succeeds
[ ] no hard-coded production secrets
[ ] README is updated
[ ] architecture document is updated
[ ] demo script is updated
[ ] Round 2 checklist is updated

============================================================
34. IMPORTANT CODING RULES
============================================================

1. Prefer simple, readable JavaScript.
2. Do not add TypeScript unless the current repository is migrated intentionally.
3. Keep business logic out of React components.
4. Keep triage logic in the service layer.
5. Keep audit generation in the audit service.
6. Keep authorization server-side.
7. Validate all request bodies.
8. Sanitize user input.
9. Do not store passwords in plaintext.
10. Never expose JWT secrets.
11. Never commit .env.
12. Never use real patient information.
13. Avoid random AI outputs.
14. Make demo results deterministic.
15. Use clear function names.
16. Add comments where safety logic is non-obvious.
17. Avoid giant files when splitting improves maintainability.
18. Keep API contracts stable.
19. Do not break existing routes without updating the frontend.
20. Do not silently remove an existing feature.

============================================================
35. FINAL OUTPUT REQUIRED FROM THE CODING AGENT
============================================================

When implementation is finished, provide:

1. Summary of changes.
2. Exact files created/modified.
3. Exact commands to run.
4. Environment variables required.
5. Demo credentials.
6. API endpoint list.
7. Round 2 requirement coverage table.
8. Known limitations.
9. Production upgrade path.
10. Test/build results.

Also print a final status:

ROUND 2 READINESS
-----------------
Prototype: READY / NOT READY
Build: PASS / FAIL
Tests: PASS / FAIL
Seed: PASS / FAIL
Auth: PASS / FAIL
Triage: PASS / FAIL
Red Flags: PASS / FAIL
Confidence: PASS / FAIL
Queue Monitor: PASS / FAIL
Surge: PASS / FAIL
Override: PASS / FAIL
Audit Chain: PASS / FAIL
Fail Open: PASS / FAIL
Socket.IO: PASS / FAIL
Documentation: PASS / FAIL

Do not stop after generating a plan. Actually implement the changes, run the application/build/tests, inspect failures, and fix them.

If an implementation choice conflicts with the existing repository, prefer the existing repository conventions unless they prevent satisfying a Round 2 requirement.

The final result should feel like a serious Accenture Innovation Challenge prototype rather than a CRUD student project.
