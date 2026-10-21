import jwt from 'jsonwebtoken';
import { User } from '../../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-in-production');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn('[auth] JWT_SECRET not set in .env; using dev default. Set JWT_SECRET in backend/.env for production.');
}
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in backend/.env');
}

function issueToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      tokenVersion: user.token_version ?? 0,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.full_name,
    role: user.role,
    department_id: user.department_id?.toString() ?? null,
    ward_id: user.ward_id?.toString() ?? null,
    address_line: user.address_line ?? null,
    zone_id: user.zone_id?.toString() ?? null,
    phone: user.phone ?? null,
    avatar_url: user.avatar_url ?? null,
  };
}

export async function registerUser({ email, password, full_name }) {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof full_name !== 'string' ||
    !email.trim() ||
    !password ||
    !full_name.trim()
  ) {
    return { error: { status: 400, message: 'Valid email, password, and full_name are required' } };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return { error: { status: 400, message: 'Please provide a valid email address' } };
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return { error: { status: 400, message: 'Password must be between 8 and 72 characters' } };
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return { error: { status: 400, message: 'Email already registered' } };
  }

  const user = await User.create({
    email: normalizedEmail,
    password,
    full_name: full_name.trim(),
    role: 'citizen',
    token_version: 0,
  });
  const token = issueToken(user);
  return { data: { token, user: toPublicUser(user) } };
}

export async function loginUser({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return { error: { status: 400, message: 'Email and password are required' } };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  
  if (!user) {
    return { error: { status: 401, message: 'Invalid email or password' } };
  }

  const passwordMatch = await user.comparePassword(password);
  console.log('[auth] Password match result:', passwordMatch);
  
  if (!passwordMatch) {
    console.log('[auth] Password mismatch for user:', email);
    return { error: { status: 401, message: 'Invalid email or password' } };
  }

  const token = issueToken(user);
  return { data: { token, user: toPublicUser(user) } };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return { error: { status: 404, message: 'User not found' } };
  }
  return { data: toPublicUser(user) };
}
