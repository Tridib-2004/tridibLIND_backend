import mongoose from "mongoose";
import Application from "../model/application.model.js";
import Job from "../model/job.model.js";
import User from "../model/user.model.js";

const WORK_MODES = ["On-site", "Hybrid", "Remote"];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance"];
const EXPERIENCE_LEVELS = ["Fresher", "0-1 years", "1-3 years", "3-5 years", "5+ years"];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidId = (value) => mongoose.isValidObjectId(value);
const ownerOf = (job, user) => String(job.postedBy) === String(user._id);

function parseSalary(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
    throw new Error(`${fieldName} must be a valid non-negative amount`);
  }
  return amount;
}

function normalizedSkills(value) {
  if (typeof value === "string") value = value.split(",");
  if (!Array.isArray(value) || value.length > 40 || value.some((skill) => typeof skill !== "string" || skill.length > 60)) {
    throw new Error("Skills must be a list of up to 40 short labels");
  }
  return [...new Set(value.map((skill) => skill.trim()).filter(Boolean))];
}

export function jobFields(input, requireAll = true, allowPastDeadline = false) {
  const fields = {
    title: String(input.title || "").trim(),
    companyName: String(input.companyName || "").trim(),
    companyDescription: String(input.companyDescription || "").trim(),
    location: String(input.location || "").trim(),
    workMode: input.workMode,
    jobType: input.jobType,
    experienceLevel: input.experienceLevel,
    salaryMin: parseSalary(input.salaryMin, "Minimum salary"),
    salaryMax: parseSalary(input.salaryMax, "Maximum salary"),
    skills: normalizedSkills(input.skills ?? []),
    description: String(input.description || "").trim(),
    responsibilities: String(input.responsibilities || "").trim(),
    requirements: String(input.requirements || "").trim(),
    benefits: String(input.benefits || "").trim(),
    deadline: input.deadline ? new Date(input.deadline) : null,
  };

  if (fields.salaryMin !== null && fields.salaryMax !== null && fields.salaryMin > fields.salaryMax) {
    throw new Error("Minimum salary cannot exceed maximum salary");
  }
  if (fields.deadline && Number.isNaN(fields.deadline.getTime())) throw new Error("Application deadline is invalid");
  if (!allowPastDeadline && fields.deadline && fields.deadline.getTime() < Date.now()) throw new Error("Application deadline must be in the future");

  const required = ["title", "companyName", "location", "description"];
  if (requireAll && required.some((field) => !fields[field])) throw new Error("Please fill in all required job fields");
  if (requireAll && !WORK_MODES.includes(fields.workMode)) throw new Error("Choose a valid work mode");
  if (requireAll && !JOB_TYPES.includes(fields.jobType)) throw new Error("Choose a valid job type");
  if (requireAll && !EXPERIENCE_LEVELS.includes(fields.experienceLevel)) throw new Error("Choose a valid experience level");
  if (fields.workMode && !WORK_MODES.includes(fields.workMode)) throw new Error("Choose a valid work mode");
  if (fields.jobType && !JOB_TYPES.includes(fields.jobType)) throw new Error("Choose a valid job type");
  if (fields.experienceLevel && !EXPERIENCE_LEVELS.includes(fields.experienceLevel)) throw new Error("Choose a valid experience level");
  if (fields.title.length > 120 || fields.companyName.length > 120 || fields.location.length > 160 || fields.description.length > 12000) {
    throw new Error("One or more job fields exceed the allowed length");
  }
  return fields;
}

export const listJobs = async (req, res) => {
  try {
    const { search = "", location = "", workMode, jobType, experienceLevel } = req.query;
    if ([search, location, workMode, jobType, experienceLevel].some((value) => value !== undefined && typeof value !== "string")) {
      return res.status(400).json({ message: "Search filters must be single text values" });
    }
    if (search.length > 120 || location.length > 160) return res.status(400).json({ message: "Search filters are too long" });
    if (workMode && !WORK_MODES.includes(workMode)) return res.status(400).json({ message: "Invalid work mode" });
    if (jobType && !JOB_TYPES.includes(jobType)) return res.status(400).json({ message: "Invalid job type" });
    if (experienceLevel && !EXPERIENCE_LEVELS.includes(experienceLevel)) return res.status(400).json({ message: "Invalid experience level" });

    const minSalary = parseSalary(req.query.minSalary, "Minimum salary");
    const maxSalary = parseSalary(req.query.maxSalary, "Maximum salary");
    if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) return res.status(400).json({ message: "Minimum salary cannot exceed maximum salary" });

    const filter = {
      isActive: true,
      $and: [{ $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] }],
    };
    if (minSalary !== null) filter.$and.push({ $or: [{ salaryMax: null }, { salaryMax: { $exists: false } }, { salaryMax: { $gte: minSalary } }] });
    if (maxSalary !== null) filter.$and.push({ $or: [{ salaryMin: null }, { salaryMin: { $exists: false } }, { salaryMin: { $lte: maxSalary } }] });
    if (search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");
      filter.$and.push({ $or: [
        { title: expression }, { companyName: expression }, { description: expression }, { skills: expression },
      ] });
    }
    if (location.trim()) filter.location = new RegExp(escapeRegex(location.trim()), "i");
    if (workMode) filter.workMode = workMode;
    if (jobType) filter.jobType = jobType;
    if (experienceLevel) filter.experienceLevel = experienceLevel;

    const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 20));
    const [jobs, total, user] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("postedBy", "name username profilePicture").lean(),
      Job.countDocuments(filter),
      User.findById(req.user._id).select("savedJobs").lean(),
    ]);
    const savedIds = new Set((user?.savedJobs || []).map(String));
    return res.json({ jobs: jobs.map((job) => ({ ...job, isSaved: savedIds.has(String(job._id)) })), total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to search jobs" });
  }
};

export const getJob = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    const job = await Job.findById(req.params.jobId).populate("postedBy", "name username profilePicture").lean();
    if (!job) return res.status(404).json({ message: "Job not found" });
    const [user, application] = await Promise.all([
      User.findById(req.user._id).select("savedJobs").lean(),
      Application.findOne({ jobId: job._id, applicantId: req.user._id }).select("_id status appliedAt").lean(),
    ]);
    return res.json({ job: { ...job, isExpired: Boolean(job.deadline && job.deadline.getTime() < Date.now()), isSaved: (user?.savedJobs || []).some((id) => String(id) === String(job._id)), application: application || null } });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load job details" });
  }
};

export const createJob = async (req, res) => {
  try {
    const fields = jobFields(req.body || {});
    const job = await Job.create({ ...fields, postedBy: req.user._id });
    return res.status(201).json({ job, message: "Job posted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to post job" });
  }
};

export const updateJob = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (!ownerOf(job, req.user)) return res.status(403).json({ message: "Only the job poster can edit this job" });
    const fields = jobFields({ ...job.toObject(), ...(req.body || {}) }, true, true);
    Object.assign(job, fields);
    await job.save();
    return res.json({ job, message: "Job updated" });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to update job" });
  }
};

export const setJobStatus = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ message: "isActive must be true or false" });
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (!ownerOf(job, req.user)) return res.status(403).json({ message: "Only the job poster can change this job" });
    job.isActive = req.body.isActive;
    await job.save();
    return res.json({ job, message: job.isActive ? "Job reopened" : "Job closed" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to change job status" });
  }
};

export const getMyJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ postedBy: req.user._id }).sort({ createdAt: -1 }).lean();
    const counts = jobs.length ? await Application.aggregate([
      { $match: { jobId: { $in: jobs.map((job) => job._id) } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]) : [];
    const countByJob = new Map(counts.map((entry) => [String(entry._id), entry.count]));
    return res.json({ jobs: jobs.map((job) => ({ ...job, applicantCount: countByJob.get(String(job._id)) || 0 })) });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load your jobs" });
  }
};

export const getJobDashboard = async (req, res) => {
  try {
    const jobIds = await Job.find({ postedBy: req.user._id }).distinct("_id");
    const [totalJobs, activeJobs, totalApplicants, shortlisted, hired] = await Promise.all([
      Job.countDocuments({ postedBy: req.user._id }),
      Job.countDocuments({ postedBy: req.user._id, isActive: true }),
      Application.countDocuments({ jobId: { $in: jobIds } }),
      Application.countDocuments({ jobId: { $in: jobIds }, status: "Shortlisted" }),
      Application.countDocuments({ jobId: { $in: jobIds }, status: "Hired" }),
    ]);
    return res.json({ totalJobs, activeJobs, totalApplicants, shortlisted, hired });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load job dashboard" });
  }
};

export const getSavedJobs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({ path: "savedJobs", match: { isActive: true }, populate: { path: "postedBy", select: "name username profilePicture" } });
    return res.json({ jobs: (user?.savedJobs || []).filter(Boolean).map((job) => ({ ...job.toObject(), isSaved: true })) });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load saved jobs" });
  }
};

export const saveJob = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    const job = await Job.findOne({ _id: req.params.jobId, isActive: true });
    if (!job) return res.status(404).json({ message: "Active job not found" });
    await User.updateOne({ _id: req.user._id }, { $addToSet: { savedJobs: job._id } });
    return res.json({ saved: true });
  } catch (error) {
    return res.status(500).json({ message: "Unable to save job" });
  }
};

export const unsaveJob = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    await User.updateOne({ _id: req.user._id }, { $pull: { savedJobs: req.params.jobId } });
    return res.json({ saved: false });
  } catch (error) {
    return res.status(500).json({ message: "Unable to remove saved job" });
  }
};

export const getJobApplicants = async (req, res) => {
  try {
    if (!isValidId(req.params.jobId)) return res.status(400).json({ message: "Invalid job id" });
    const job = await Job.findById(req.params.jobId).select("postedBy title").lean();
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (String(job.postedBy) !== String(req.user._id)) return res.status(403).json({ message: "Only the job poster can view applicants" });
    const applications = await Application.find({ jobId: job._id }).sort({ appliedAt: -1 }).populate("applicantId", "name username email phone profilePicture skills").lean();
    return res.json({ job: { _id: job._id, title: job.title }, applications });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load applicants" });
  }
};

export { WORK_MODES, JOB_TYPES, EXPERIENCE_LEVELS };
