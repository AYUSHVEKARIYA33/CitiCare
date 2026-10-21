import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-in-production');

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!JWT_SECRET) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('_id email full_name role department_id zone_id token_version');
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Invalidate session if token_version in JWT doesn't match the user's current token_version (e.g. after password change)
    if (
      decoded.tokenVersion !== undefined &&
      user.token_version !== undefined &&
      decoded.tokenVersion !== user.token_version
    ) {
      res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      department_id: user.department_id?.toString() ?? null,
      zone_id: user.zone_id?.toString() ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
