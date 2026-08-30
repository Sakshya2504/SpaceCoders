import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyAuditChain } from '../services/audit.js';

const router = Router();

// All audit records contain potentially sensitive operational details, so the
// audit endpoints require an authenticated session.
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 250);
    const events = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: events,
      message: 'Audit events',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const events = await AuditLog.find({
      patientId: req.params.patientId
    })
      .sort({ timestamp: -1 })
      .lean();

    return res.json({
      success: true,
      data: events,
      message: 'Patient audit',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const verification = await verifyAuditChain();

    return res.json({
      success: true,
      data: verification,
      message: 'Audit chain verification',
      error: null
    });
  } catch (error) {
    next(error);
  }
});

export default router;
