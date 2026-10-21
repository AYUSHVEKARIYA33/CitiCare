import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: ['status_change', 'new_comment', 'assignment', 'announcement', 'contractor_assigned', 'estimate_update', 'verification'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    link: { type: String, default: null },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
