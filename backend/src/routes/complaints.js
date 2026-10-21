import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { upload, authorizeComplaintUpload } from '../middleware/upload.js';
import {
  addComplaintComment,
  createComplaint,
  deleteComplaint,
  getComplaintById,
  getComplaintStats,
  getMonthlyComplaints,
  listComplaintComments,
  listComplaintDepartmentsMeta,
  listComplaints,
  listComplaintsByWard,
  listNearbyComplaints,
  listOfficersMeta,
  listWardNearbyComplaints,
  submitComplaintFeedback,
  updateComplaint,
  uploadComplaintImages,
  upvoteComplaint,
} from '../controllers/complaints.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listComplaints);
router.get('/stats', getComplaintStats);
router.get('/monthly', getMonthlyComplaints);
router.get('/nearby', listNearbyComplaints);
router.get('/nearby/ward', listWardNearbyComplaints);
router.get('/by-ward', listComplaintsByWard);
router.get('/meta/departments', listComplaintDepartmentsMeta);
router.get('/meta/officers', listOfficersMeta);
router.get('/:id/comments', listComplaintComments);
router.get('/:id', getComplaintById);
router.post('/', upload.array('images', 10), createComplaint);
router.patch('/:id', updateComplaint);
router.post('/:id/images', authorizeComplaintUpload, upload.array('images', 10), uploadComplaintImages);
router.delete('/:id', deleteComplaint);
router.post('/:id/upvote', upvoteComplaint);
router.post('/:id/feedback', submitComplaintFeedback);
router.post('/:id/comments', addComplaintComment);

export default router;
