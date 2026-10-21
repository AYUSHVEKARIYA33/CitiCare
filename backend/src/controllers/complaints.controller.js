import fs from 'fs';
import mongoose from 'mongoose';
import { Complaint } from '../models/Complaint.js';
import { ComplaintImage } from '../models/ComplaintImage.js';
import { ComplaintComment } from '../models/ComplaintComment.js';
import { getNextComplaintNumber } from '../models/ComplaintCounter.js';
import { Department } from '../models/Department.js';
import { sendNotification } from '../services/notification/notification.service.js';
import { calculateSlaDeadline } from '../services/sla/sla.service.js';

const baseUrl = process.env.API_BASE_URL || '';

function getPublicBaseUrl(req) {
  if (baseUrl) return baseUrl.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function toId(obj) {
  return obj?._id?.toString() ?? null;
}

/**
 * Sanitized public serializer for community feeds (nearby, ward view, unrelated citizens).
 * Omits submitter PII (phone, email, full name), internal cost breakdowns, and internal remarks.
 */
function complaintToCommunityJson(c, extra) {
  const createdAt = c?.createdAt ?? c?.created_at;
  const updatedAt = c?.updatedAt ?? c?.updated_at;
  return {
    id: c?._id?.toString?.() ?? '',
    complaint_number: c?.complaint_number ?? '',
    user_id: null,
    title: c?.title ?? '',
    description: c?.description ?? '',
    category: c?.category ?? '',
    status: c?.status ?? 'pending',
    priority: c?.priority ?? 'medium',
    department_id: toId(c?.department_id),
    assigned_to: null,
    zone_id: toId(c?.zone_id),
    ward_id: toId(c?.ward_id),
    area_id: toId(c?.area_id),
    address: c?.address ? 'Nearby Citizen Report' : null,
    latitude: c?.latitude ?? null,
    longitude: c?.longitude ?? null,
    resolved_at: c?.resolved_at ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    departments: c?.departments ? { name: c.departments.name } : null,
    zones: c?.zones ? { name: c.zones.name } : null,
    wards: c?.wards ? { name: c.wards.name } : null,
    areas: c?.areas ? { name: c.areas.name } : null,
    profiles: null,
    assigned_officer: null,
    upvotes: c?.upvotes ?? 0,
    upvoted_by_user: extra && typeof extra.upvoted_by_user === 'boolean' ? extra.upvoted_by_user : false,
    complaint_images: Array.isArray(c?.complaint_images)
      ? c.complaint_images.map((img) => ({
          id: img?._id?.toString?.() ?? '',
          complaint_id: img?.complaint_id?.toString?.() ?? null,
          url: img?.url ?? '',
          caption: img?.caption ?? null,
          type: img?.type ?? 'general',
        }))
      : [],
    accepted_by_department: null,
    accepted_at: null,
    cost_estimated_amount: null,
    cost_materials: null,
    cost_labor: null,
    cost_status: null,
    cost_submitted_at: null,
    cost_approved_by: null,
    completion_remarks: null,
    completed_at: c?.completed_at ?? null,
    feedback_rating: c?.feedback_rating ?? null,
    feedback_comment: null,
    feedback_submitted_at: null,
    sla_due_date: null,
    sla_breached: false,
    sla_escalated: false,
    ...extra,
  };
}

function complaintToJson(c, extra) {
  const createdAt = c?.createdAt ?? c?.created_at;
  const updatedAt = c?.updatedAt ?? c?.updated_at;
  return {
    id: c?._id?.toString?.() ?? '',
    complaint_number: c?.complaint_number ?? '',
    user_id: toId(c?.user_id),
    title: c?.title ?? '',
    description: c?.description ?? '',
    category: c?.category ?? '',
    status: c?.status ?? 'pending',
    priority: c?.priority ?? 'medium',
    department_id: toId(c?.department_id),
    assigned_to: toId(c?.assigned_to),
    zone_id: toId(c?.zone_id),
    ward_id: toId(c?.ward_id),
    area_id: toId(c?.area_id),
    address: c?.address ?? null,
    latitude: c?.latitude ?? null,
    longitude: c?.longitude ?? null,
    resolved_at: c?.resolved_at ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    departments: c?.departments ? { name: c.departments.name } : null,
    zones: c?.zones ? { name: c.zones.name } : null,
    wards: c?.wards ? { name: c.wards.name } : null,
    areas: c?.areas ? { name: c.areas.name } : null,
    profiles: c?.profiles ? { full_name: c.profiles.full_name } : null,
    assigned_officer: c?.assigned_to ? { full_name: c.assigned_to.full_name, email: c.assigned_to.email } : null,
    assigned_contractor_id: toId(c?.assigned_contractor_id),
    assigned_contractor: c?.assigned_contractor_id && typeof c.assigned_contractor_id === 'object' && c.assigned_contractor_id.full_name
      ? {
          id: toId(c.assigned_contractor_id),
          full_name: c.assigned_contractor_id.full_name,
          email: c.assigned_contractor_id.email,
          phone: c.assigned_contractor_id.phone ?? null,
          company: c.assigned_contractor_id.contractor_company ?? null,
        }
      : null,
    contractor_deadline: c?.contractor_deadline ?? null,
    contractor_instructions: c?.contractor_instructions ?? null,
    contractor_status: c?.contractor_status ?? 'unassigned',
    contractor_accepted_at: c?.contractor_accepted_at ?? null,
    labor_count: c?.labor_count ?? null,
    contractor_remarks: c?.contractor_remarks ?? null,
    assignment_history: Array.isArray(c?.assignment_history)
      ? c.assignment_history.map((h) => ({
          contractor_id: toId(h.contractor_id),
          contractor_name: h.contractor_id?.full_name ?? null,
          assigned_by: toId(h.assigned_by),
          assigned_by_name: h.assigned_by?.full_name ?? null,
          assigned_at: h.assigned_at,
          deadline: h.deadline ?? null,
          instructions: h.instructions ?? null,
          notes: h.notes ?? null,
        }))
      : [],
    upvotes: c?.upvotes ?? 0,
    upvoted_by_user: extra && typeof extra.upvoted_by_user === 'boolean' ? extra.upvoted_by_user : false,
    complaint_images: Array.isArray(c?.complaint_images)
      ? c.complaint_images.map((img) => ({
          id: img?._id?.toString?.() ?? '',
          complaint_id: img?.complaint_id?.toString?.() ?? null,
          url: img?.url ?? '',
          caption: img?.caption ?? null,
          type: img?.type ?? 'general',
        }))
      : [],
    accepted_by_department: c?.accepted_by_department ?? null,
    accepted_at: c?.accepted_at ?? null,
    cost_estimated_amount: c?.cost_estimated_amount ?? null,
    cost_materials: c?.cost_materials ?? null,
    cost_labor: c?.cost_labor ?? null,
    cost_status: c?.cost_status ?? 'pending',
    cost_submitted_at: c?.cost_submitted_at ?? null,
    cost_approved_by: toId(c?.cost_approved_by),
    completion_remarks: c?.completion_remarks ?? null,
    completed_at: c?.completed_at ?? null,
    feedback_rating: c?.feedback_rating ?? null,
    feedback_comment: c?.feedback_comment ?? null,
    feedback_submitted_at: c?.feedback_submitted_at ?? null,
    sla_due_date: c?.sla_due_date ?? null,
    sla_breached: c?.sla_breached ?? false,
    sla_escalated: c?.sla_escalated ?? false,
    ...extra,
  };
}

export async function listComplaints(req, res) {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    let filter = {};
    if (req.user.role === 'citizen') {
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        res.status(400).json({ error: 'Invalid user' });
        return;
      }
      filter = { user_id: new mongoose.Types.ObjectId(req.user.id) };
    } else if (req.user.role === 'department_head') {
      if (req.user.department_id && mongoose.Types.ObjectId.isValid(req.user.department_id)) {
        filter = {
          $or: [
            { department_id: new mongoose.Types.ObjectId(req.user.department_id) },
            { assigned_to: new mongoose.Types.ObjectId(req.user.id) }
          ]
        };
      } else if (mongoose.Types.ObjectId.isValid(req.user.id)) {
        filter = { assigned_to: new mongoose.Types.ObjectId(req.user.id) };
      }
    } else if (req.user.role === 'officer') {
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        res.status(400).json({ error: 'Invalid user' });
        return;
      }
      filter = { assigned_to: new mongoose.Types.ObjectId(req.user.id) };
    } else if (req.user.role === 'contractor') {
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        res.status(400).json({ error: 'Invalid user' });
        return;
      }
      filter = { assigned_contractor_id: new mongoose.Types.ObjectId(req.user.id) };
    }
    const sortBy = req.query.sort || 'date';
    let sortOption = { createdAt: -1 };
    if (sortBy === 'priority') sortOption = { priority: 1, createdAt: -1 };
    if (sortBy === 'area') sortOption = { ward_id: 1, area_id: 1, createdAt: -1 };
    const list = await Complaint.find(filter)
      .populate('department_id', 'name code category')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('user_id', 'full_name phone email')
      .populate('assigned_to', 'full_name email')
      .populate('assigned_contractor_id', 'full_name email phone contractor_company')
      .sort(sortOption)
      .lean();

    const complaintIds = list.map((c) => c._id);
    const allImages = complaintIds.length
      ? await ComplaintImage.find({ complaint_id: { $in: complaintIds } }).lean()
      : [];
    const imagesByComplaint = new Map();
    for (const img of allImages) {
      const cid = img.complaint_id.toString();
      if (!imagesByComplaint.has(cid)) imagesByComplaint.set(cid, []);
      imagesByComplaint.get(cid).push({
        id: img._id?.toString?.() ?? '',
        complaint_id: cid,
        url: img.url ?? '',
        caption: img.caption ?? null,
        type: img.type ?? 'general',
      });
    }

    const withImages = list.map((c) => {
      const cid = c._id.toString();
      const urls = imagesByComplaint.get(cid) || [];
      const upvotedByUser = Array.isArray(c?.upvoted_by)
        ? c.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user.id)
        : false;
      return complaintToJson(
        {
          ...c,
          complaint_images: urls,
          departments: c.department_id,
          zones: c.zone_id,
          wards: c.ward_id,
          areas: c.area_id,
          profiles: c.user_id,
        },
        { upvoted_by_user: upvotedByUser }
      );
    });
    res.json(withImages);
  } catch (e) {
    console.error('[GET /complaints]', e?.message ?? e);
    res.status(500).json({ error: 'Failed to fetch complaints', detail: process.env.NODE_ENV === 'development' ? e?.message : undefined });
  }
}

export async function getComplaintStats(req, res) {
  try {
    let filter = {};
    if (req.user.role === 'citizen') {
      filter = { user_id: new mongoose.Types.ObjectId(req.user.id) };
    } else if (req.user.role === 'department_head') {
      if (req.user.department_id && mongoose.Types.ObjectId.isValid(req.user.department_id)) {
        filter = {
          $or: [
            { department_id: new mongoose.Types.ObjectId(req.user.department_id) },
            { assigned_to: new mongoose.Types.ObjectId(req.user.id) }
          ]
        };
      } else if (mongoose.Types.ObjectId.isValid(req.user.id)) {
        filter = { assigned_to: new mongoose.Types.ObjectId(req.user.id) };
      }
    } else if (req.user.role === 'officer') {
      filter = { assigned_to: new mongoose.Types.ObjectId(req.user.id) };
    } else if (req.user.role === 'contractor') {
      filter = { assigned_contractor_id: new mongoose.Types.ObjectId(req.user.id) };
    }
    const complaints = await Complaint.find(filter).select('status').lean();
    const stats = { total: complaints.length, pending: 0, in_progress: 0, on_hold: 0, resolved: 0, rejected: 0, closed: 0 };
    complaints.forEach((c) => {
      if (c.status && stats[c.status] !== undefined) stats[c.status] += 1;
    });
    res.json(stats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

export async function getMonthlyComplaints(req, res) {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const filter = { createdAt: { $gte: sixMonthsAgo } };
    if (req.user.role === 'citizen') {
      filter.user_id = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role === 'department_head') {
      if (req.user.department_id && mongoose.Types.ObjectId.isValid(req.user.department_id)) {
        filter.$or = [
          { department_id: new mongoose.Types.ObjectId(req.user.department_id) },
          { assigned_to: new mongoose.Types.ObjectId(req.user.id) }
        ];
      } else if (mongoose.Types.ObjectId.isValid(req.user.id)) {
        filter.assigned_to = new mongoose.Types.ObjectId(req.user.id);
      }
    } else if (req.user.role === 'officer') {
      filter.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }
    const complaints = await Complaint.find(filter).select('createdAt created_at').lean();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const monthlyData = [];
    for (let i = 5; i >= 0; i -= 1) {
      const monthIndex = (currentMonth - i + 12) % 12;
      monthlyData.push({ month: months[monthIndex], complaints: 0 });
    }
    complaints.forEach((c) => {
      const d = new Date(c.createdAt ?? c.created_at);
      const name = months[d.getMonth()];
      const entry = monthlyData.find((m) => m.month === name);
      if (entry) entry.complaints += 1;
    });
    res.json(monthlyData);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch monthly stats' });
  }
}

export async function listNearbyComplaints(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const rawRadius = parseInt(req.query.radius || '5000', 10);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng query parameters are required' });
      return;
    }

    // Cap radius between 100m and 50,000m (50km) to prevent unbounded geo searches
    const radius = Math.min(Math.max(Number.isFinite(rawRadius) ? rawRadius : 5000, 100), 50000);

    const toRadians = (deg) => (deg * Math.PI) / 180;
    const earthRadius = 6371000;
    const latDelta = (radius / earthRadius) * (180 / Math.PI);
    const lngDelta = (radius / (earthRadius * Math.cos(toRadians(lat)))) * (180 / Math.PI);

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const distanceMeters = (lat1, lon1, lat2, lon2) => {
      const dLat = toRadians(lat2 - lat1);
      const dLon = toRadians(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadius * c;
    };

    // Filter by bounding-box directly in MongoDB with a hard limit
    const candidates = await Complaint.find({
      latitude: { $gte: minLat, $lte: maxLat },
      longitude: { $gte: minLng, $lte: maxLng },
    })
      .populate('department_id', 'name')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('upvoted_by', '_id')
      .limit(60)
      .lean();

    const nearby = candidates
      .filter((c) => {
        if (c.latitude == null || c.longitude == null) return false;
        const d = distanceMeters(lat, lng, Number(c.latitude), Number(c.longitude));
        return d <= radius;
      })
      .slice(0, 50);

    // Single batch query for images
    const complaintIds = nearby.map((c) => c._id);
    const allImages = complaintIds.length
      ? await ComplaintImage.find({ complaint_id: { $in: complaintIds } }).lean()
      : [];
    const imagesByComplaint = new Map();
    for (const img of allImages) {
      const cid = img.complaint_id.toString();
      if (!imagesByComplaint.has(cid)) imagesByComplaint.set(cid, []);
      imagesByComplaint.get(cid).push({
        id: img._id.toString(),
        complaint_id: cid,
        url: img.url,
        caption: img.caption,
        type: img.type ?? 'general',
      });
    }

    const withImages = nearby.map((c) => {
      const cid = c._id.toString();
      const urls = imagesByComplaint.get(cid) || [];
      const upvotedByUser = Array.isArray(c?.upvoted_by)
        ? c.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user?.id)
        : false;
      return complaintToCommunityJson(
        {
          ...c,
          complaint_images: urls,
          departments: c.department_id,
          zones: c.zone_id,
          wards: c.ward_id,
          areas: c.area_id,
        },
        { upvoted_by_user: upvotedByUser }
      );
    });

    res.json(withImages);
  } catch (e) {
    console.error('[GET /complaints/nearby]', e);
    res.status(500).json({ error: 'Failed to fetch nearby complaints' });
  }
}

export async function listWardNearbyComplaints(req, res) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userZone = req.user.zone_id;
    if (!userZone) {
      res.status(400).json({ error: 'User has no ward/zone assigned' });
      return;
    }

    const list = await Complaint.find({ zone_id: userZone })
      .populate('department_id', 'name')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('upvoted_by', '_id')
      .sort({ upvotes: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const complaintIds = list.map((c) => c._id);
    const allImages = complaintIds.length
      ? await ComplaintImage.find({ complaint_id: { $in: complaintIds } }).lean()
      : [];
    const imagesByComplaint = new Map();
    for (const img of allImages) {
      const cid = img.complaint_id.toString();
      if (!imagesByComplaint.has(cid)) imagesByComplaint.set(cid, []);
      imagesByComplaint.get(cid).push({
        id: img._id.toString(),
        complaint_id: cid,
        url: img.url,
        caption: img.caption,
        type: img.type ?? 'general',
      });
    }

    const withImages = list.map((c) => {
      const cid = c._id.toString();
      const urls = imagesByComplaint.get(cid) || [];
      const upvotedByUser = Array.isArray(c?.upvoted_by)
        ? c.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user?.id)
        : false;
      return complaintToCommunityJson(
        {
          ...c,
          complaint_images: urls,
          departments: c.department_id,
          zones: c.zone_id,
          wards: c.ward_id,
          areas: c.area_id,
        },
        { upvoted_by_user: upvotedByUser }
      );
    });

    res.json(withImages);
  } catch (e) {
    console.error('[GET /complaints/nearby/ward]', e);
    res.status(500).json({ error: 'Failed to fetch ward complaints' });
  }
}

export async function listComplaintsByWard(req, res) {
  try {
    const wardId = req.query.wardId;
    if (!wardId || !mongoose.Types.ObjectId.isValid(wardId)) {
      res.status(400).json({ error: 'wardId query parameter is required and must be a valid id' });
      return;
    }

    const list = await Complaint.find({ ward_id: new mongoose.Types.ObjectId(wardId) })
      .populate('department_id', 'name')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('upvoted_by', '_id')
      .sort({ upvotes: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const complaintIds = list.map((c) => c._id);
    const allImages = complaintIds.length
      ? await ComplaintImage.find({ complaint_id: { $in: complaintIds } }).lean()
      : [];
    const imagesByComplaint = new Map();
    for (const img of allImages) {
      const cid = img.complaint_id.toString();
      if (!imagesByComplaint.has(cid)) imagesByComplaint.set(cid, []);
      imagesByComplaint.get(cid).push({
        id: img._id.toString(),
        complaint_id: cid,
        url: img.url,
        caption: img.caption,
        type: img.type ?? 'general',
      });
    }

    const withImages = list.map((c) => {
      const cid = c._id.toString();
      const urls = imagesByComplaint.get(cid) || [];
      const upvotedByUser = Array.isArray(c?.upvoted_by)
        ? c.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user?.id)
        : false;
      return complaintToCommunityJson(
        {
          ...c,
          complaint_images: urls,
          departments: c.department_id,
          zones: c.zone_id,
          wards: c.ward_id,
          areas: c.area_id,
        },
        { upvoted_by_user: upvotedByUser }
      );
    });

    res.json(withImages);
  } catch (e) {
    console.error('[GET /complaints/by-ward]', e);
    res.status(500).json({ error: 'Failed to fetch complaints by ward' });
  }
}

export async function listComplaintDepartmentsMeta(_req, res) {
  try {
    const { Department } = await import('../models/Department.js');
    const list = await Department.find().select('_id name code category').sort({ name: 1 }).lean();
    res.json(list.map((d) => ({ id: d._id.toString(), name: d.name, code: d.code, category: d.category })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
}

export async function listOfficersMeta(req, res) {
  try {
    const { User } = await import('../models/User.js');
    const deptId = req.query.departmentId;
    const filter = { role: 'officer' };
    if (deptId) filter.department_id = new mongoose.Types.ObjectId(deptId);
    const officers = await User.find(filter).select('_id full_name email department_id').sort({ full_name: 1 }).lean();
    res.json(
      officers.map((o) => ({
        id: o._id.toString(),
        full_name: o.full_name,
        email: o.email,
        department_id: o.department_id?.toString() ?? null,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch officers' });
  }
}

export async function listComplaintComments(req, res) {
  try {
    const complaintId = req.params.id;
    if (!complaintId || !mongoose.Types.ObjectId.isValid(complaintId)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const complaint = await Complaint.findById(complaintId).select('user_id department_id assigned_to zone_id');
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isAdmin = userRole === 'admin';
    const isOwner = complaint.user_id && complaint.user_id.toString() === userId;
    const isAssigned = complaint.assigned_to && complaint.assigned_to.toString() === userId;
    const isDeptStaff = Boolean(
      (userRole === 'department_head' || userRole === 'officer') &&
      req.user?.department_id &&
      complaint.department_id &&
      req.user.department_id.toString() === complaint.department_id.toString()
    );
    const isStaff = isAdmin || isDeptStaff || isAssigned;

    if (userRole === 'citizen') {
      const userZone = req.user.zone_id ? req.user.zone_id.toString() : null;
      const compZone = complaint.zone_id ? complaint.zone_id.toString() : null;
      if (!isOwner && (!userZone || userZone !== compZone)) {
        res.status(403).json({ error: 'You do not have permission to view comments for this complaint' });
        return;
      }
    } else if (!isStaff) {
      res.status(403).json({ error: 'You do not have permission to view comments for this complaint' });
      return;
    }

    // Never return internal staff notes to citizen users
    const commentQuery = { complaint_id: complaint._id };
    if (!isStaff) {
      commentQuery.is_internal = false;
    }

    const comments = await ComplaintComment.find(commentQuery)
      .populate('user_id', 'full_name')
      .sort({ createdAt: 1 })
      .lean();

    res.json(
      comments.map((c) => ({
        id: c._id.toString(),
        complaint_id: c.complaint_id.toString(),
        user_id: toId(c.user_id),
        content: c.content,
        is_internal: c.is_internal,
        created_at: c.createdAt ?? c.created_at,
        profiles: c.user_id ? { full_name: c.user_id.full_name } : null,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

export async function getComplaintById(req, res) {
  try {
    const id = req.params.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const c = await Complaint.findById(id)
      .populate('department_id', 'name code category')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('user_id', 'full_name phone email')
      .populate('assigned_to', 'full_name email')
      .populate('assigned_contractor_id', 'full_name email phone contractor_company')
      .populate('assignment_history.contractor_id', 'full_name email phone contractor_company')
      .populate('assignment_history.assigned_by', 'full_name email')
      .populate('upvoted_by', '_id')
      .lean();
    if (!c) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isOwner = c.user_id && toId(c.user_id) === userId;
    const isAdmin = userRole === 'admin';
    const isAssigned = c.assigned_to && toId(c.assigned_to) === userId;
    const isAssignedContractor = c.assigned_contractor_id && toId(c.assigned_contractor_id) === userId;
    const compDeptId = c.department_id ? (c.department_id._id ? c.department_id._id.toString() : c.department_id.toString()) : null;
    const userDeptId = req.user?.department_id ? req.user.department_id.toString() : null;
    const isSameDept = Boolean(compDeptId && userDeptId && compDeptId === userDeptId);

    // Contractor access control: contractors can only see work assigned directly to them
    if (userRole === 'contractor') {
      if (!isAssignedContractor && !isAdmin) {
        res.status(403).json({ error: 'You do not have permission to view complaints assigned to another contractor' });
        return;
      }
    }

    // Staff access control: Department heads & officers can only access complaints within their department or assigned to them
    if (userRole === 'department_head' || userRole === 'officer') {
      if (!isSameDept && !isAssigned && !isAdmin) {
        res.status(403).json({ error: 'You do not have permission to view complaints from other departments' });
        return;
      }
    }

    // Citizen access control:
    let isCommunityView = false;
    if (userRole === 'citizen') {
      const userZone = req.user?.zone_id ? req.user.zone_id.toString() : null;
      const compZone = c.zone_id ? (c.zone_id._id ? c.zone_id._id.toString() : c.zone_id.toString()) : null;
      if (!isOwner) {
        if (!userZone || userZone !== compZone) {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        // Citizen viewing someone else's complaint in their zone receives sanitized community response
        isCommunityView = true;
      }
    }

    const images = await ComplaintImage.find({ complaint_id: id }).lean();
    const urls = images.map((i) => ({
      id: i._id.toString(),
      complaint_id: i.complaint_id?.toString?.() ?? null,
      url: i.url,
      caption: i.caption,
      type: i.type ?? 'general',
    }));
    const upvotedByUser = Array.isArray(c.upvoted_by)
      ? c.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user.id)
      : false;

    const complaintData = {
      ...c,
      complaint_images: urls,
      departments: c.department_id,
      zones: c.zone_id,
      wards: c.ward_id,
      areas: c.area_id,
      profiles: isCommunityView ? null : c.user_id,
    };

    if (isCommunityView) {
      res.json(complaintToCommunityJson(complaintData, { upvoted_by_user: upvotedByUser }));
    } else {
      res.json(complaintToJson(complaintData, { upvoted_by_user: upvotedByUser }));
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch complaint' });
  }
}

export async function createComplaint(req, res) {
  try {
    const { title, description, category, address, zone_id, ward_id, area_id, department_id, latitude: bodyLat, longitude: bodyLng } = req.body;
    if (!title || !description || !category) {
      res.status(400).json({ error: 'Title, description and category are required' });
      return;
    }
    const complaint_number = await getNextComplaintNumber();
    const files = req.files;
    const publicBaseUrl = getPublicBaseUrl(req);
    const imageUrls = (files || []).map((f) => `${publicBaseUrl}/uploads/${f.filename}`);
    const toObjectId = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

    let assigned_to = null;
    if (department_id && mongoose.Types.ObjectId.isValid(department_id)) {
      const dept = await Department.findById(department_id).select('in_charge_officer_id').lean();
      if (dept?.in_charge_officer_id) {
        assigned_to = dept.in_charge_officer_id;
      }
    }

    const createdAt = new Date();
    const sla_due_date = calculateSlaDeadline(createdAt, 'medium');

    let latitude = bodyLat !== undefined && bodyLat !== '' && !Number.isNaN(Number(bodyLat)) ? Number(bodyLat) : null;
    let longitude = bodyLng !== undefined && bodyLng !== '' && !Number.isNaN(Number(bodyLng)) ? Number(bodyLng) : null;

    const complaint = await Complaint.create({
      complaint_number,
      user_id: new mongoose.Types.ObjectId(req.user.id),
      title,
      description,
      category,
      address: address || null,
      zone_id: toObjectId(zone_id),
      ward_id: toObjectId(ward_id),
      area_id: toObjectId(area_id),
      department_id: toObjectId(department_id),
      assigned_to,
      status: 'pending',
      priority: 'medium',
      sla_due_date,
      latitude,
      longitude,
    });
    if (imageUrls.length > 0) {
      await ComplaintImage.insertMany(imageUrls.map((url) => ({ complaint_id: complaint._id, url, type: 'general' })));
    }

    // Send database notifications in background without blocking response
    try {
      sendNotification({
        recipientId: req.user.id,
        type: 'status_change',
        title: 'Complaint Submitted',
        message: `Your complaint #${complaint_number} has been successfully submitted.`,
        link: `/complaints/${complaint._id}`
      }).catch((err) => console.error('[Notification] Error creating notification for new complaint:', err));

      if (assigned_to) {
        sendNotification({
          recipientId: assigned_to.toString(),
          senderId: req.user.id,
          type: 'assignment',
          title: 'New Complaint Assigned',
          message: `Complaint #${complaint_number} has been assigned to your department.`,
          link: `/complaints/${complaint._id}`
        }).catch((err) => console.error('[Notification] Error creating assignment notification:', err));
      }
    } catch (err) {
      console.error('[Notification] Error triggering notifications for new complaint:', err);
    }

    const populated = await Complaint.findById(complaint._id)
      .populate('department_id', 'name')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('user_id', 'full_name')
      .populate('upvoted_by', '_id')
      .lean();
    const images = await ComplaintImage.find({ complaint_id: complaint._id }).lean();
    res.status(201).json(
      complaintToJson(
        {
          ...populated,
          complaint_images: images.map((i) => ({ id: i._id.toString(), complaint_id: i.complaint_id?.toString?.() ?? null, url: i.url, caption: i.caption })),
          departments: populated?.department_id,
          zones: populated?.zone_id,
          wards: populated?.ward_id,
          areas: populated?.area_id,
          profiles: populated?.user_id,
        },
        { upvoted_by_user: Array.isArray(populated?.upvoted_by) && populated.upvoted_by.some((u) => (u?._id?.toString ? u._id.toString() : u?.toString()) === req.user.id) }
      )
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
}

export async function updateComplaint(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const {
      status,
      department_id,
      assigned_to,
      priority,
      accepted_by_department,
      cost_estimated_amount,
      cost_materials,
      cost_labor,
      cost_status,
      completion_remarks,
      assigned_contractor_id,
      contractor_deadline,
      contractor_instructions,
      contractor_status,
      contractor_remarks,
      labor_count,
    } = req.body;

    const oldComplaint = await Complaint.findById(req.params.id)
      .select('status user_id department_id assigned_to assigned_contractor_id contractor_status complaint_number createdAt priority assignment_history')
      .lean();
    if (!oldComplaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    // Role-based Access Control (RBAC) & Object-level Authorization
    const userRole = req.user.role;
    const userId = req.user.id;
    const isOwner = oldComplaint.user_id && oldComplaint.user_id.toString() === userId;
    const isAdmin = userRole === 'admin';
    const isDeptHead = userRole === 'department_head';
    const isAssigned = oldComplaint.assigned_to && oldComplaint.assigned_to.toString() === userId;
    const isAssignedContractor = oldComplaint.assigned_contractor_id && oldComplaint.assigned_contractor_id.toString() === userId;
    const isSameDept = Boolean(
      req.user.department_id &&
      oldComplaint.department_id &&
      oldComplaint.department_id.toString() === req.user.department_id.toString()
    );
    const isDeptHeadOfThisDept = isDeptHead && isSameDept;

    const toObjectId = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);
    const update = {};

    if (userRole === 'citizen') {
      if (!isOwner) {
        res.status(403).json({ error: 'You do not have permission to modify this complaint' });
        return;
      }
      // Citizens are not permitted to change status, department assignment, priority, or costs
      const restrictedFields = [
        'status', 'department_id', 'assigned_to', 'priority',
        'accepted_by_department', 'cost_estimated_amount', 'cost_materials',
        'cost_labor', 'cost_status', 'completion_remarks',
        'assigned_contractor_id', 'contractor_deadline', 'contractor_instructions',
        'contractor_status', 'contractor_remarks', 'labor_count'
      ];
      const attemptedRestricted = restrictedFields.some((field) => req.body[field] !== undefined);
      if (attemptedRestricted) {
        res.status(403).json({ error: 'Only municipal officers and administrators can update complaint status and workflow fields' });
        return;
      }
    } else if (userRole === 'contractor') {
      // Contractor must be specifically assigned to this complaint
      if (!isAssignedContractor) {
        res.status(403).json({ error: 'You do not have permission to modify complaints assigned to another contractor' });
        return;
      }

      // Contractors cannot change department, assignees, or priority
      if (department_id !== undefined || assigned_to !== undefined || assigned_contractor_id !== undefined || priority !== undefined) {
        res.status(403).json({ error: 'Contractors cannot alter department, assignment, or priority' });
        return;
      }

      // Contractors cannot approve or reject costs
      if (cost_status === 'approved' || cost_status === 'rejected') {
        res.status(403).json({ error: 'Contractors cannot approve or reject cost estimates' });
        return;
      }

      // Contractors cannot verify their own work or resolve the complaint
      if (contractor_status === 'verified' || status === 'resolved' || status === 'closed') {
        res.status(403).json({ error: 'Contractors cannot verify their own work or resolve complaints. Department Head verification required.' });
        return;
      }

      // Allowed Contractor Action 1: Accept Assignment
      if (contractor_status === 'accepted') {
        update.contractor_status = 'accepted';
        update.contractor_accepted_at = new Date();
        update.status = 'in_progress';
      }

      // Allowed Contractor Action 2: Submit Cost Estimate (Head reviews -> Admin approves)
      if (cost_estimated_amount !== undefined || cost_materials !== undefined || cost_labor !== undefined) {
        if (cost_estimated_amount !== undefined) update.cost_estimated_amount = Number(cost_estimated_amount) || null;
        if (cost_materials !== undefined) update.cost_materials = cost_materials ?? null;
        if (cost_labor !== undefined) update.cost_labor = cost_labor ?? null;
        update.cost_status = 'submitted';
        update.cost_submitted_at = new Date();
      }

      // Allowed Contractor Action 3: Progress & Ground Work
      if (labor_count !== undefined) update.labor_count = Number(labor_count) || null;
      if (contractor_remarks !== undefined) update.contractor_remarks = contractor_remarks ?? null;

      // Allowed Contractor Action 4: Submit Completed Work
      if (contractor_status === 'completed') {
        update.contractor_status = 'completed';
        if (completion_remarks !== undefined) update.completion_remarks = completion_remarks ?? null;
        update.completed_at = new Date();
      }
    } else {
      // Staff authorization: must be admin, department head of THIS complaint's department, or assigned officer/staff
      if (!isAdmin && !isDeptHeadOfThisDept && !isAssigned && !isSameDept) {
        res.status(403).json({ error: 'You do not have permission to update this complaint' });
        return;
      }

      // 1. Cross-department reassignment: Admin only
      if (department_id !== undefined && !isAdmin) {
        const targetDept = department_id ? department_id.toString() : null;
        const currentDept = oldComplaint.department_id ? oldComplaint.department_id.toString() : null;
        if (targetDept !== currentDept) {
          res.status(403).json({ error: 'Only administrators can reassign complaints across departments' });
          return;
        }
      }

      // 2. Budget Approval / Rejection / Review: Admin or Department Head of this department
      if (cost_status !== undefined) {
        if (cost_status === 'approved' || cost_status === 'rejected') {
          if (!isAdmin && !isDeptHeadOfThisDept) {
            res.status(403).json({ error: 'Only administrators or the department head can approve or reject complaint cost estimates' });
            return;
          }
        }
        if (cost_status === 'reviewed') {
          if (!isAdmin && !isDeptHeadOfThisDept) {
            res.status(403).json({ error: 'Only the department head or administrator can mark estimates as reviewed' });
            return;
          }
        }
        if (cost_status === 'submitted') {
          // Only assigned officer, department head of this department, or admin can submit costs
          if (!isAdmin && !isDeptHeadOfThisDept && !isAssigned) {
            res.status(403).json({ error: 'Only the assigned officer, contractor, or department head can submit cost estimates' });
            return;
          }
        }
        update.cost_status = cost_status;
        if (cost_status === 'submitted') update.cost_submitted_at = new Date();
        if (cost_status === 'approved') update.cost_approved_by = new mongoose.Types.ObjectId(req.user.id);
      }

      // 3. Officer assignment: Admin or Department Head of this department only
      if (assigned_to !== undefined && !isAdmin && !isDeptHeadOfThisDept) {
        res.status(403).json({ error: 'Only department heads or administrators can assign officers to complaints' });
        return;
      }
      if (assigned_to !== undefined) update.assigned_to = toObjectId(assigned_to);

      // 4. Contractor Assignment: Admin or Department Head of this department only
      if (assigned_contractor_id !== undefined) {
        if (!isAdmin && !isDeptHeadOfThisDept) {
          res.status(403).json({ error: 'Only department heads or administrators can assign contractors to complaints' });
          return;
        }

        if (assigned_contractor_id) {
          const { User } = await import('../models/User.js');
          const contractorUser = await User.findById(assigned_contractor_id).lean();
          if (!contractorUser || contractorUser.role !== 'contractor') {
            res.status(400).json({ error: 'Selected user is not a valid contractor' });
            return;
          }
          if (
            contractorUser.department_id &&
            oldComplaint.department_id &&
            contractorUser.department_id.toString() !== oldComplaint.department_id.toString() &&
            !isAdmin
          ) {
            res.status(400).json({ error: 'Contractor does not belong to this department' });
            return;
          }

          update.assigned_contractor_id = contractorUser._id;
          update.contractor_status = 'assigned';
          if (contractor_deadline) update.contractor_deadline = new Date(contractor_deadline);
          if (contractor_instructions !== undefined) update.contractor_instructions = contractor_instructions;

          // Record assignment history entry
          const historyEntry = {
            contractor_id: contractorUser._id,
            assigned_by: new mongoose.Types.ObjectId(userId),
            assigned_at: new Date(),
            deadline: contractor_deadline ? new Date(contractor_deadline) : null,
            instructions: contractor_instructions || null,
            notes: `Assigned by ${req.user.full_name || 'Department Head'}`,
          };
          update.$push = { assignment_history: historyEntry };
        } else {
          // Unassign contractor
          update.assigned_contractor_id = null;
          update.contractor_status = 'unassigned';
        }
      }

      // 5. Work Verification: Admin or Department Head of this department
      if (contractor_status !== undefined) {
        if (contractor_status === 'verified') {
          if (!isAdmin && !isDeptHeadOfThisDept) {
            res.status(403).json({ error: 'Only department heads or administrators can verify contractor work' });
            return;
          }
          update.contractor_status = 'verified';
          update.status = 'resolved';
          update.resolved_at = new Date();
          update.completed_at = new Date();
        } else if (contractor_status === 'in_progress' || contractor_status === 'rejected_by_head') {
          // Correction requested by head
          update.contractor_status = 'in_progress';
          update.status = 'in_progress';
          if (contractor_remarks !== undefined) update.contractor_remarks = contractor_remarks;
        }
      }

      // 6. Priority updates: Admin or Department Head of this department only
      if (priority !== undefined && !isAdmin && !isDeptHeadOfThisDept) {
        res.status(403).json({ error: 'Only department heads or administrators can alter complaint priority' });
        return;
      }
      if (priority !== undefined) {
        update.priority = priority;
        if (priority !== oldComplaint.priority) {
          const baseDate = oldComplaint.createdAt || oldComplaint.created_at || new Date();
          update.sla_due_date = calculateSlaDeadline(baseDate, priority);
          update.sla_breached = new Date(update.sla_due_date) <= new Date();
        }
      }

      // 7. General Status updates (if not handled via verification)
      if (status !== undefined && update.status === undefined) {
        const allowedStatuses = ['pending', 'in_progress', 'on_hold', 'resolved', 'rejected', 'closed'];
        if (!allowedStatuses.includes(status)) {
          res.status(400).json({ error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` });
          return;
        }
        update.status = status;
        if (status === 'resolved') {
          update.resolved_at = new Date();
          update.completed_at = new Date();
        }
      }

      if (department_id !== undefined) update.department_id = toObjectId(department_id);
      if (accepted_by_department !== undefined) {
        update.accepted_by_department = accepted_by_department === true || accepted_by_department === 'true';
        update.accepted_at = new Date();
      }
      if (cost_estimated_amount !== undefined) update.cost_estimated_amount = Number(cost_estimated_amount) || null;
      if (cost_materials !== undefined) update.cost_materials = cost_materials ?? null;
      if (cost_labor !== undefined) update.cost_labor = cost_labor ?? null;
      if (completion_remarks !== undefined) update.completion_remarks = completion_remarks ?? null;
      if (contractor_remarks !== undefined && update.contractor_remarks === undefined) update.contractor_remarks = contractor_remarks ?? null;
      if (labor_count !== undefined && update.labor_count === undefined) update.labor_count = Number(labor_count) || null;
    }

    const c = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('department_id', 'name code category')
      .populate('assigned_contractor_id', 'full_name email phone contractor_company')
      .populate('assignment_history.contractor_id', 'full_name email phone contractor_company')
      .populate('assignment_history.assigned_by', 'full_name email')
      .lean();
    if (!c) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    // Send notifications if status, officer, or contractor assignment changed in background
    try {
      if (update.status && update.status !== oldComplaint.status) {
        sendNotification({
          recipientId: oldComplaint.user_id?.toString(),
          senderId: req.user.id,
          type: 'status_change',
          title: 'Complaint Status Updated',
          message: `Your complaint #${oldComplaint.complaint_number} status has been updated to "${update.status.replace('_', ' ')}".`,
          link: `/complaints/${c._id}`
        }).catch((err) => console.error('[Notification] Status update notify error:', err));
      }

      if (update.assigned_to && update.assigned_to.toString() !== oldComplaint.assigned_to?.toString()) {
        sendNotification({
          recipientId: update.assigned_to.toString(),
          senderId: req.user.id,
          type: 'assignment',
          title: 'New Complaint Assigned',
          message: `Complaint #${oldComplaint.complaint_number} has been assigned to you.`,
          link: `/complaints/${c._id}`
        }).catch((err) => console.error('[Notification] Assignment notify error:', err));
      }

      if (update.assigned_contractor_id && update.assigned_contractor_id.toString() !== oldComplaint.assigned_contractor_id?.toString()) {
        sendNotification({
          recipientId: update.assigned_contractor_id.toString(),
          senderId: req.user.id,
          type: 'contractor_assigned',
          title: 'New Field Job Assigned',
          message: `You have been assigned to complaint #${oldComplaint.complaint_number}. Instructions: ${update.contractor_instructions || 'Please review in Contractor Portal'}.`,
          link: `/contractor/jobs`
        }).catch((err) => console.error('[Notification] Contractor assignment notify error:', err));
      }
    } catch (err) {
      console.error('[Notification] Error triggering notification for updated complaint:', err);
    }

    const images = await ComplaintImage.find({ complaint_id: c._id }).lean();
    res.json(
      complaintToJson({
        ...c,
        complaint_images: images.map((i) => ({ id: i._id.toString(), complaint_id: i.complaint_id?.toString?.() ?? null, url: i.url, caption: i.caption, type: i.type ?? 'general' })),
        departments: c.department_id,
        zones: c.zone_id,
        wards: c.ward_id,
        areas: c.area_id,
        profiles: c.user_id,
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
}

export async function uploadComplaintImages(req, res) {
  try {
    const complaintId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(complaintId)) {
      if (req.files) {
        for (const file of req.files) {
          try { fs.unlinkSync(file.path); } catch {}
        }
      }
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const type = req.body.type || 'general';
    if (!['before', 'after', 'general'].includes(type)) {
      if (req.files) {
        for (const file of req.files) {
          try { fs.unlinkSync(file.path); } catch {}
        }
      }
      res.status(400).json({ error: 'type must be before, after, or general' });
      return;
    }

    const files = req.files;
    if (!files?.length) {
      res.status(400).json({ error: 'No images uploaded' });
      return;
    }

    // Fetch complaint and verify access BEFORE persisting records to database
    const c = await Complaint.findById(complaintId)
      .populate('department_id', 'name')
      .populate('zone_id', 'name')
      .populate('ward_id', 'name')
      .populate('area_id', 'name')
      .populate('user_id', 'full_name phone email')
      .lean();

    if (!c) {
      for (const file of files) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isAdmin = userRole === 'admin';
    const isOwner = c.user_id && toId(c.user_id) === userId;
    const isAssigned = c.assigned_to && toId(c.assigned_to) === userId;
    const compDeptId = c.department_id ? (c.department_id._id ? c.department_id._id.toString() : c.department_id.toString()) : null;
    const userDeptId = req.user?.department_id ? req.user.department_id.toString() : null;
    const isDeptStaff = Boolean(
      (userRole === 'department_head' || userRole === 'officer') &&
      compDeptId &&
      userDeptId &&
      compDeptId === userDeptId
    );
    const isStaff = isAdmin || isDeptStaff || isAssigned;

    // Disallow unauthorized users
    if (!isStaff && !isOwner) {
      for (const file of files) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(403).json({ error: 'You do not have permission to attach images to this complaint' });
      return;
    }

    // Only staff can upload before/after work evidence photos
    if ((type === 'before' || type === 'after') && !isStaff) {
      for (const file of files) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(403).json({ error: 'Only municipal officers and administrators can upload work evidence (before/after photos)' });
      return;
    }

    const publicBaseUrl = getPublicBaseUrl(req);
    const urls = files.map((f) => `${publicBaseUrl}/uploads/${f.filename}`);
    const complaintObjectId = new mongoose.Types.ObjectId(complaintId);
    await ComplaintImage.insertMany(urls.map((url) => ({ complaint_id: complaintObjectId, url, type })));

    const images = await ComplaintImage.find({ complaint_id: complaintId }).lean();
    res.json(
      complaintToJson({
        ...c,
        complaint_images: images.map((i) => ({ id: i._id.toString(), complaint_id: i.complaint_id?.toString?.() ?? null, url: i.url, caption: i.caption, type: i.type ?? 'general' })),
        departments: c.department_id,
        zones: c.zone_id,
        wards: c.ward_id,
        areas: c.area_id,
        profiles: c.user_id,
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to upload images' });
  }
}

export async function deleteComplaint(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const complaint = await Complaint.findById(req.params.id).select('user_id status');
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = complaint.user_id && complaint.user_id.toString() === req.user.id;
    const isPending = complaint.status === 'pending';

    // Only administrators, or citizens withdrawing their own pending complaint, can delete
    if (!isAdmin && !(isOwner && isPending)) {
      res.status(403).json({ error: 'You do not have permission to delete this complaint' });
      return;
    }

    await ComplaintComment.deleteMany({ complaint_id: req.params.id });
    await ComplaintImage.deleteMany({ complaint_id: req.params.id });
    await Complaint.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete complaint' });
  }
}

export async function upvoteComplaint(req, res) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role !== 'citizen') {
      res.status(403).json({ error: 'Only citizens can upvote complaints' });
      return;
    }
    const cid = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(cid)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }
    const complaint = await Complaint.findById(cid);
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userIdStr = req.user.id;
    const already = Array.isArray(complaint.upvoted_by) && complaint.upvoted_by.some((u) => u.toString() === userIdStr);

    const userIdObj = new mongoose.Types.ObjectId(req.user.id);
    if (already) {
      await Complaint.findByIdAndUpdate(cid, { $pull: { upvoted_by: userIdObj }, $inc: { upvotes: -1 } });
    } else {
      await Complaint.findByIdAndUpdate(cid, { $addToSet: { upvoted_by: userIdObj }, $inc: { upvotes: 1 } });
    }

    const updated = await Complaint.findById(cid);
    res.json({ upvotes: updated?.upvotes || 0, upvoted_by_user: !already });
  } catch (e) {
    console.error('[POST /complaints/:id/upvote]', e);
    res.status(500).json({ error: 'Failed to upvote complaint' });
  }
}

export async function submitComplaintFeedback(req, res) {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role !== 'citizen') {
      res.status(403).json({ error: 'Only citizens can submit feedback' });
      return;
    }

    const complaintId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(complaintId)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
      return;
    }
    if (!comment) {
      res.status(400).json({ error: 'Feedback comment is required' });
      return;
    }

    const complaint = await Complaint.findById(complaintId).select('user_id status feedback_rating');
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const ownerId = complaint.user_id ? complaint.user_id.toString() : null;
    if (ownerId !== req.user.id) {
      res.status(403).json({ error: 'You can only submit feedback for your own complaint' });
      return;
    }
    if (complaint.status !== 'resolved') {
      res.status(400).json({ error: 'Feedback can only be submitted after complaint is solved' });
      return;
    }
    if (complaint.feedback_rating !== null && complaint.feedback_rating !== undefined) {
      res.status(400).json({ error: 'Feedback already submitted for this complaint' });
      return;
    }

    await Complaint.findByIdAndUpdate(complaintId, {
      feedback_rating: rating,
      feedback_comment: comment,
      feedback_submitted_at: new Date(),
    });

    res.status(201).json({ ok: true, rating, comment });
  } catch (e) {
    console.error('[POST /complaints/:id/feedback]', e);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
}

export async function addComplaintComment(req, res) {
  try {
    const complaintId = req.params.id;
    if (!complaintId || !mongoose.Types.ObjectId.isValid(complaintId)) {
      res.status(400).json({ error: 'Invalid complaint id' });
      return;
    }

    const { content, is_internal } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length > 2000) {
      res.status(400).json({ error: 'Comment must be 2000 characters or less' });
      return;
    }

    const complaint = await Complaint.findById(complaintId).select('user_id department_id assigned_to zone_id complaint_number');
    if (!complaint) {
      res.status(404).json({ error: 'Complaint not found' });
      return;
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const isAdmin = userRole === 'admin';
    const isOwner = complaint.user_id && complaint.user_id.toString() === userId;
    const isAssigned = complaint.assigned_to && complaint.assigned_to.toString() === userId;
    const compDeptId = complaint.department_id ? complaint.department_id.toString() : null;
    const userDeptId = req.user?.department_id ? req.user.department_id.toString() : null;
    const isDeptStaff = Boolean(
      (userRole === 'department_head' || userRole === 'officer') &&
      compDeptId &&
      userDeptId &&
      compDeptId === userDeptId
    );
    const isStaff = isAdmin || isDeptStaff || isAssigned;

    // Citizens can only comment on their own complaint
    if (userRole === 'citizen' && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to comment on this complaint' });
      return;
    }
    if (!isAdmin && !isStaff && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to comment on this complaint' });
      return;
    }

    // Only staff can author internal staff notes; citizens cannot
    const canSetInternal = isStaff && (is_internal === true || is_internal === 'true');

    const comment = await ComplaintComment.create({
      complaint_id: complaint._id,
      user_id: new mongoose.Types.ObjectId(req.user.id),
      content: trimmedContent,
      is_internal: canSetInternal,
    });

    // Send comments notifications to participants in background
    try {
      const messageText = `${req.user.full_name} commented: "${trimmedContent.substring(0, 40)}${trimmedContent.length > 40 ? '...' : ''}"`;
      
      if (complaint.user_id && complaint.user_id.toString() !== req.user.id && !canSetInternal) {
        sendNotification({
          recipientId: complaint.user_id.toString(),
          senderId: req.user.id,
          type: 'new_comment',
          title: `New Comment on #${complaint.complaint_number}`,
          message: messageText,
          link: `/complaints/${complaintId}`
        }).catch((err) => console.error('[Notification] Comment notify error:', err));
      }
      
      if (complaint.assigned_to && complaint.assigned_to.toString() !== req.user.id) {
        sendNotification({
          recipientId: complaint.assigned_to.toString(),
          senderId: req.user.id,
          type: 'new_comment',
          title: `New Comment on #${complaint.complaint_number}`,
          message: messageText,
          link: `/complaints/${complaintId}`
        }).catch((err) => console.error('[Notification] Comment notify error:', err));
      }
    } catch (err) {
      console.error('[Notification] Error creating comment notification:', err);
    }

    const populated = await ComplaintComment.findById(comment._id).populate('user_id', 'full_name').lean();
    res.status(201).json({
      id: comment._id.toString(),
      complaint_id: populated.complaint_id.toString(),
      user_id: req.user.id,
      content: populated.content,
      is_internal: populated.is_internal,
      created_at: populated.createdAt ?? populated.created_at,
      profiles: { full_name: req.user.full_name },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}
