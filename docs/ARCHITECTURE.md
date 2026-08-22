# PatientTriage.ai — Round 2 Architecture

```text
React ED Command Centre
  │ REST + Socket.IO
  ▼
Express API + JWT/RBAC
  ├── Patient / Intake APIs
  ├── Queue Monitor
  └── Audit Service
       │
       ├── Prototype Triage Engine
       │     ├── age-aware signals
       │     ├── ESI 1–5
       │     ├── red flags
       │     ├── confidence
       │     └── explainable features
       │
       └── SHA-256 linked audit events
              │
              ▼
          MongoDB
```

## Safety decision flow
1. Capture vitals, complaint, demographics and optional history.
2. Normalize age-sensitive signals.
3. Produce ESI 1–5, confidence, red flags and feature contributions.
4. Any red flag → **Immediate escalation**.
5. Low confidence/conflict → **Abstain & escalate** and move one tier higher.
6. High-confidence low/moderate acuity → **Auto-context**.
7. Inference failure → **Fail open** to manual ESI.
8. Nurse can accept or override; override reason is mandatory.
9. Recommendations, reassessments, overrides and status changes enter the audit chain.
10. Waiting patients are reassessed continuously; surge mode shortens the cadence.

## Production upgrade
The current MERN implementation keeps inference behind a stable service boundary. Replace `scorePatient()` with an internal XGBoost/SHAP inference service without changing the frontend contract. The Round 2 design specifies XGBoost + SHAP, independent high-sensitivity red-flag classifiers and containerized inference behind an API gateway.

Prototype data is synthetic; no real PHI is required.
