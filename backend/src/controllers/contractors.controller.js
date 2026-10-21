import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Complaint } from '../models/Complaint.js';

/**
 * List contractors.
 * - Admins can view all contractors (or filter by ?departmentId=...).
 * - Department Heads see only contractors belonging to their department.
 * - Enriched with active workload count (active non-resolved complaints).
 */
export async function listContractors(req, res) {
  try {
    const userRole = req.user?.role;
    const userDept = req.user?.department_id;
    const queryDept = req.query.departmentId;

    let filter = { role: 'contractor' };

    if (userRole === 'department_head') {
      if (!userDept || !mongoose.Types.ObjectId.isValid(userDept)) {
        res.status(403).json({ error: 'Department head is not assigned to a department' });
        return;
      }
      filter.department_id = new mongoose.Types.ObjectId(userDept);
    } else if (queryDept && mongoose.Types.ObjectId.isValid(queryDept)) {
      filter.department_id = new mongoose.Types.ObjectId(queryDept);
    }

    const contractors = await User.find(filter)
      .select('_id full_name email phone department_id availability contractor_company createdAt')
      .sort({ full_name: 1 })
      .lean();

    const departments = await Department.find().select('_id name code category').lean();
    const deptMap = new Map(departments.map((d) => [d._id.toString(), d]));

    // Calculate active workloads for each contractor
    const contractorIds = contractors.map((c) => c._id);
    const activeComplaints = await Complaint.aggregate([
      {
        $match: {
          assigned_contractor_id: { $in: contractorIds },
          status: { $in: ['pending', 'in_progress', 'on_hold'] },
        },
      },
      {
        $group: {
          _id: '$assigned_contractor_id',
          active_jobs_count: { $sum: 1 },
        },
      },
    ]);

    const workloadMap = new Map(activeComplaints.map((w) => [w._id.toString(), w.active_jobs_count]));

    const result = contractors.map((c) => {
      const cid = c._id.toString();
      const dept = c.department_id ? deptMap.get(c.department_id.toString()) : null;
      return {
        id: cid,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone ?? null,
        department_id: c.department_id ? c.department_id.toString() : null,
        department_name: dept?.name ?? null,
        department_code: dept?.code ?? null,
        department_category: dept?.category ?? null,
        availability: c.availability || 'available',
        contractor_company: c.contractor_company ?? null,
        active_jobs_count: workloadMap.get(cid) || 0,
        created_at: c.createdAt,
      };
    });

    res.json(result);
  } catch (e) {
    console.error('[listContractors]', e);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
}

/**
 * Create a new contractor account (Admin only).
 */
export async function createContractor(req, res) {
  try {
    const { fullName, email, password, phone, departmentId, availability, contractorCompany } = req.body;

    if (!fullName || !email || !password || !departmentId) {
      res.status(400).json({ error: 'fullName, email, password, and departmentId are required' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      res.status(400).json({ error: 'Invalid departmentId' });
      return;
    }

    const dept = await Department.findById(departmentId);
    if (!dept) {
      res.status(404).json({ error: 'Department not found' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long' });
      return;
    }

    const contractor = await User.create({
      full_name: fullName.trim(),
      email: normalizedEmail,
      password,
      phone: phone ? phone.trim() : null,
      role: 'contractor',
      department_id: dept._id,
      availability: availability && ['available', 'busy', 'unavailable'].includes(availability) ? availability : 'available',
      contractor_company: contractorCompany ? contractorCompany.trim() : null,
    });

    res.status(201).json({
      id: contractor._id.toString(),
      full_name: contractor.full_name,
      email: contractor.email,
      phone: contractor.phone,
      role: contractor.role,
      department_id: contractor.department_id.toString(),
      department_name: dept.name,
      availability: contractor.availability,
      contractor_company: contractor.contractor_company,
    });
  } catch (e) {
    console.error('[createContractor]', e);
    res.status(500).json({ error: 'Failed to create contractor' });
  }
}

/**
 * Update contractor availability, phone, or company.
 * Allowed for Admin or the Contractor themselves.
 */
export async function updateContractor(req, res) {
  try {
    const contractorId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(contractorId)) {
      res.status(400).json({ error: 'Invalid contractor id' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === contractorId;

    if (!isAdmin && !isSelf) {
      res.status(403).json({ error: 'Forbidden: you cannot edit another user' });
      return;
    }

    const updates = {};
    const { availability, phone, contractorCompany, fullName, departmentId } = req.body;

    if (availability !== undefined) {
      if (!['available', 'busy', 'unavailable'].includes(availability)) {
        res.status(400).json({ error: 'Invalid availability status. Must be available, busy, or unavailable' });
        return;
      }
      updates.availability = availability;
    }

    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (contractorCompany !== undefined) updates.contractor_company = contractorCompany ? contractorCompany.trim() : null;

    if (isAdmin) {
      if (fullName) updates.full_name = fullName.trim();
      if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
        updates.department_id = new mongoose.Types.ObjectId(departmentId);
      }
    }

    const updated = await User.findByIdAndUpdate(contractorId, updates, { new: true })
      .select('_id full_name email phone department_id availability contractor_company role')
      .populate('department_id', 'name code category')
      .lean();

    if (!updated) {
      res.status(404).json({ error: 'Contractor not found' });
      return;
    }

    res.json({
      id: updated._id.toString(),
      full_name: updated.full_name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      department_id: updated.department_id?._id?.toString() ?? null,
      department_name: updated.department_id?.name ?? null,
      availability: updated.availability,
      contractor_company: updated.contractor_company,
    });
  } catch (e) {
    console.error('[updateContractor]', e);
    res.status(500).json({ error: 'Failed to update contractor' });
  }
}

/**
 * Contractor Dashboard stats.
 */
export async function getContractorStats(req, res) {
  try {
    const contractorId = req.user?.id;
    if (!contractorId || req.user?.role !== 'contractor') {
      res.status(403).json({ error: 'Only contractors can access contractor stats' });
      return;
    }

    const cid = new mongoose.Types.ObjectId(contractorId);

    const [totalAssigned, needsAcceptance, inProgress, completedVerification, resolved, slaBreached] = await Promise.all([
      Complaint.countDocuments({ assigned_contractor_id: cid }),
      Complaint.countDocuments({ assigned_contractor_id: cid, contractor_status: 'assigned' }),
      Complaint.countDocuments({ assigned_contractor_id: cid, contractor_status: { $in: ['accepted', 'in_progress'] } }),
      Complaint.countDocuments({ assigned_contractor_id: cid, contractor_status: 'completed' }),
      Complaint.countDocuments({ assigned_contractor_id: cid, contractor_status: 'verified' }),
      Complaint.countDocuments({ assigned_contractor_id: cid, sla_breached: true, status: { $ne: 'resolved' } }),
    ]);

    res.json({
      total_assigned: totalAssigned,
      needs_acceptance: needsAcceptance,
      in_progress: inProgress,
      completed_verification: completedVerification,
      resolved: resolved,
      sla_breached: slaBreached,
    });
  } catch (e) {
    console.error('[getContractorStats]', e);
    res.status(500).json({ error: 'Failed to fetch contractor stats' });
  }
}
