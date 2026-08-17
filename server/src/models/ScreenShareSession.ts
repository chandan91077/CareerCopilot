import mongoose, { Schema, Document } from 'mongoose';

export interface IScreenShareSession extends Document {
  sessionId: string;
  candidateId: mongoose.Types.ObjectId;
  passwordHash: string;
  status: 'active' | 'stopped' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

const ScreenShareSessionSchema = new Schema<IScreenShareSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'stopped', 'expired'],
      default: 'active',
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for session lookup and expiry checks
ScreenShareSessionSchema.index({ sessionId: 1, status: 1 });
ScreenShareSessionSchema.index({ candidateId: 1, status: 1 });

export default mongoose.model<IScreenShareSession>(
  'ScreenShareSession',
  ScreenShareSessionSchema
);
