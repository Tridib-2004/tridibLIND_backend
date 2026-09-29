import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  skills: { type: [String], default: [] },
  resumeFile: { type: String, required: true },
  resumeOriginalName: { type: String, required: true },
  coverLetter: { type: String, required: true, trim: true, maxlength: 5000 },
  status: { type: String, enum: ["Applied", "Reviewing", "Shortlisted", "Rejected", "Hired"], default: "Applied" },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
applicationSchema.index({ applicantId: 1, appliedAt: -1 });
applicationSchema.index({ jobId: 1, status: 1, appliedAt: -1 });

export default mongoose.model("Application", applicationSchema);
