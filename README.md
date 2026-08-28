# PatientTriage.ai — SpaceCoders

Round 2 MERN prototype for the Accenture Innovation Challenge 2026.

Synthetic-data only. AI recommends/re-ranks; final triage authority remains with the nurse.

## Run

```bash
npm install
npm run install:all
cd server
copy .env.example .env
cd ..
npm run seed
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000
Health: http://localhost:3000/api/health

Demo: charge@patienttriage.demo / demo123

See docs/ARCHITECTURE.md and docs/DEMO_SCRIPT.md.
