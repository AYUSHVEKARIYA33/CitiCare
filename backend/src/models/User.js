import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new Schema(
	{
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true, select: false },
		full_name: { type: String, required: true },
		phone: { type: String, default: null },
		address_line: { type: String, default: null },
		avatar_url: { type: String, default: null },
		department_id: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
		zone_id: { type: Schema.Types.ObjectId, ref: 'Zone', default: null },
		ward_id: { type: Schema.Types.ObjectId, ref: 'Ward', default: null },
		role: { type: String, enum: ['admin', 'department_head', 'officer', 'citizen'], default: 'citizen' },
		notification_email: { type: Boolean, default: true },
		notification_push: { type: Boolean, default: true },
		notification_status_updates: { type: Boolean, default: true },
		notification_comments: { type: Boolean, default: true },
		token_version: { type: Number, default: 0 },
		password_changed_at: { type: Date, default: null },
	},
	{ timestamps: true }
);

userSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();
	this.password = await bcrypt.hash(this.password, 12);
	this.token_version = (this.token_version || 0) + 1;
	this.password_changed_at = new Date();
	next();
});

userSchema.methods.comparePassword = async function (candidate) {
	return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
