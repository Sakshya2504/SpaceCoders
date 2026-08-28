import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Read and validate the bearer token attached to an API request.
 * Authentication is intentionally enforced on the server; the browser's
 * localStorage state is only a convenience for the frontend.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ')
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash');

    if (!user || !user.active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

/**
 * Allow a route to be reached only by one of the explicitly listed roles.
 * Keep authorization rules close to the route instead of trusting the UI.
 */
export const allowRoles = (...roles) => (req, res, next) => {
  if (roles.includes(req.user?.role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Insufficient permissions'
  });
};

// Backwards-compatible alias used by a few older imports.
export const auth = requireAuth;
