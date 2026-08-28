import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { appendAudit } from '../services/audit.js';

const router = Router();

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, role = 'triage_nurse' } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const allowedRoles = ['triage_nurse', 'charge_nurse', 'clinical_admin', 'system_admin'];

    if (cleanName.length < 2) {
      return res.status(422).json({ success: false, message: 'Name must be at least 2 characters' });
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return res.status(422).json({ success: false, message: 'Enter a valid email address' });
    }
    if (cleanPassword.length < 6) {
      return res.status(422).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(422).json({ success: false, message: 'Invalid role' });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role,
      active: true
    });

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await appendAudit({
      eventType: 'SIGNUP',
      actorId: user._id.toString(),
      actorRole: user.role,
      payload: { email: user.email, role: user.role }
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      message: 'Account created successfully',
      error: null
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user || !user.active || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    await appendAudit({
      eventType: 'LOGIN',
      actorId: user._id.toString(),
      actorRole: user.role,
      payload: { email: user.email }
    });
    return res.json({
      success: true,
      data: { token, user: { id: user._id, name: user.name, email: user.email, role: user.role } },
      message: 'Login successful',
      error: null
    });
  } catch (e) {
    next(e);
  }
});

router.get('/me', requireAuth, async (req, res) =>
  res.json({
    success: true,
    data: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
    message: 'Current user',
    error: null
  })
);

router.post('/logout', requireAuth, async (req, res) => {
  await appendAudit({
    eventType: 'LOGOUT',
    actorId: req.user._id.toString(),
    actorRole: req.user.role
  });
  return res.json({ success: true, data: null, message: 'Logged out', error: null });
});

export default router;
