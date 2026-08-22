# PatientTriage.ai — Round 2 Prototype

PatientTriage.ai is a human-in-the-loop emergency-department triage decision-support prototype for the Accenture Innovation Challenge 2026.

The prototype follows the Round 2 architecture: simulated patient intake, age-aware normalization, ESI 1–5 recommendation, red-flag screening, confidence-gated escalation, nurse accept/override workflow, continuous waiting-queue monitoring, audit logging, and surge/fail-open demonstrations.

> **Safety note:** This is a simulated prototype using synthetic records. It is not a medical device and must not be used for clinical decision-making.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Real-time: Socket.IO
- Auth/RBAC: JWT + bcryptjs

## Run

```bash
npm install
npm run install:all
cp server/.env.example server/.env
npm run seed
npm run dev
```

Open `http://localhost:5173`.

Demo login: `charge@patienttriage.demo` / `demo123`.

See `docs/ARCHITECTURE.md`, `docs/DEMO_SCRIPT.md`, and `docs/ROUND2_CHECKLIST.md`.
