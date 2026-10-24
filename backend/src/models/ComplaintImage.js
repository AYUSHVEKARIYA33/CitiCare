import mongoose, { Schema } from 'mongoose';

const complaintImageSchema = new Schema(
	{
		complaint_id: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
		url: { type: String, required: true },
		public_id: { type: String, default: null, index: true },
		storage_provider: { type: String, enum: ['cloudinary', 'local'], default: 'cloudinary' },
		caption: { type: String, default: null },
		type: { type: String, enum: ['before', 'after', 'general'], default: 'general', index: true },
		uploader_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
		uploader_role: {
			type: String,
			enum: ['citizen', 'contractor', 'officer', 'department_head', 'admin'],
			default: null,
		},
		contractor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
		file_size: { type: Number, default: null },
		mime_type: { type: String, default: null },
		width: { type: Number, default: null },
		height: { type: Number, default: null },
		format: { type: String, default: null },
	},
	{ timestamps: true }
);

export const ComplaintImage = mongoose.model('ComplaintImage', complaintImageSchema);

