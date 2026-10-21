import multer from 'multer';
import path from 'path';
import { randomBytes } from 'crypto';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Derive extension strictly from validated mimetype to prevent executable extensions
    const ext = MIME_EXTENSION_MAP[file.mimetype.toLowerCase()] || '.jpg';
    const name = `${randomBytes(12).toString('hex')}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const isAllowedMime = Boolean(MIME_EXTENSION_MAP[file.mimetype?.toLowerCase()]);
    if (isAllowedMime) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

/**
 * Pre-upload authorization middleware.
 * Verifies that the complaint exists and the authenticated user is authorized to upload
 * files to it BEFORE Multer streams or writes any file to disk.
 */
export async function authorizeComplaintUpload(req, res, next) {
  try {
    const { Complaint } = await import('../models/Complaint.js');
    const { default: mongoose } = await import('mongoose');

    const complaintId = req.params.id;
    if (!complaintId || !mongoose.Types.ObjectId.isValid(complaintId)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const complaint = await Complaint.findById(complaintId).select('user_id department_id assigned_to status');
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwner = complaint.user_id && complaint.user_id.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isAssigned = complaint.assigned_to && complaint.assigned_to.toString() === userId;
    const isDeptHead = userRole === 'department_head' && req.user?.department_id && complaint.department_id && complaint.department_id.toString() === req.user.department_id.toString();

    // Only authorized staff or complaint owner can upload files
    if (!isAdmin && !isDeptHead && !isAssigned && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to upload files for this complaint' });
      return;
    }

    // Attach complaint to req for downstream controller reuse
    req.complaint = complaint;
    next();
  } catch (err) {
    console.error('[authorizeComplaintUpload]', err);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}

