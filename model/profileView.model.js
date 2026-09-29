import mongoose from "mongoose";

const profileViewSchema = new mongoose.Schema({
  viewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  viewedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  viewedAt: {
    type: Date,
    default: Date.now,
  },
  dayKey: {
    type: String,
    required: true,
  },
});

profileViewSchema.index(
  { viewerId: 1, viewedUserId: 1, dayKey: 1 },
  { unique: true }
);
profileViewSchema.index({ viewedUserId: 1, viewedAt: 1 });

export default mongoose.model("ProfileView", profileViewSchema);