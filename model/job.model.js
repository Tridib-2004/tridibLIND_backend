import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  companyName: { type: String, required: true, trim: true, maxlength: 120 },
  companyDescription: { type: String, default: "", trim: true, maxlength: 5000 },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  workMode: { type: String, enum: ["On-site", "Hybrid", "Remote"], required: true },
  jobType: { type: String, enum: ["Full-time", "Part-time", "Internship", "Contract", "Freelance"], required: true },
  experienceLevel: { type: String, enum: ["Fresher", "0-1 years", "1-3 years", "3-5 years", "5+ years"], required: true },
  salaryMin: { type: Number, min: 0, default: null },
  salaryMax: { type: Number, min: 0, default: null },
  skills: { type: [String], default: [] },
  description: { type: String, required: true, trim: true, maxlength: 12000 },
  responsibilities: { type: String, default: "", trim: true, maxlength: 8000 },
  requirements: { type: String, default: "", trim: true, maxlength: 8000 },
  benefits: { type: String, default: "", trim: true, maxlength: 5000 },
  deadline: { type: Date, default: null },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

jobSchema.index({ isActive: 1, createdAt: -1 });
jobSchema.index({ postedBy: 1, isActive: 1, createdAt: -1 });
jobSchema.index({ title: "text", companyName: "text", description: "text", skills: "text" });

export default mongoose.model("Job", jobSchema);
