import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Ward } from '../models/Ward.js';
import { uploadImageFile } from '../services/storage/cloudinary.js';

export async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    let department_name = null;
    if (user.department_id) {
      const dept = await Department.findById(user.department_id).select('name').lean();
      department_name = dept?.name ?? null;
    }
    res.json({
      id: user._id.toString(),
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      address_line: user.address_line ?? null,
      avatar_url: user.avatar_url,
      department_id: user.department_id?.toString() ?? null,
      ward_id: user.ward_id?.toString() ?? null,
      department_name,
      notification_email: user.notification_email ?? false,
      notification_push: user.notification_push ?? false,
      notification_status_updates: user.notification_status_updates ?? false,
      notification_comments: user.notification_comments ?? false,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateProfile(req, res) {
  try {
    const {
      full_name,
      phone,
      address_line,
      ward_id,
      notification_email,
      notification_push,
      notification_status_updates,
      notification_comments,
    } = req.body;

    const update = {};
    if (full_name !== undefined) update.full_name = full_name;
    if (phone !== undefined) update.phone = phone;
    if (address_line !== undefined) update.address_line = address_line ?? null;

    if (ward_id !== undefined) {
      if (ward_id === null || ward_id === '') {
        update.ward_id = null;
      } else if (!mongoose.Types.ObjectId.isValid(ward_id)) {
        res.status(400).json({ error: 'Invalid ward_id' });
        return;
      } else {
        const ward = await Ward.findById(ward_id).select('_id zone_id').lean();
        if (!ward) {
          res.status(404).json({ error: 'Ward not found' });
          return;
        }
        update.ward_id = ward._id;
        update.zone_id = ward.zone_id;
      }
    }

    if (notification_email !== undefined) update.notification_email = notification_email;
    if (notification_push !== undefined) update.notification_push = notification_push;
    if (notification_status_updates !== undefined) update.notification_status_updates = notification_status_updates;
    if (notification_comments !== undefined) update.notification_comments = notification_comments;

    await User.findByIdAndUpdate(req.user.id, update);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function uploadAvatar(req, res) {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const publicBaseUrl = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
    const uploaded = await uploadImageFile(file, {
      folder: 'citicare/avatars',
      publicBaseUrl,
    });
    const avatarUrl = uploaded.secure_url;
    await User.findByIdAndUpdate(req.user.id, { avatar_url: avatarUrl });
    res.json({ avatar_url: avatarUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }

    if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      res.status(400).json({ error: 'New password must be between 8 and 72 characters' });
      return;
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    await user.save();
    res.json({ ok: true, message: 'Password updated and previous sessions revoked' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to change password' });
  }
}
