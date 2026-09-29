import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import Application from "../model/application.model.js";
import Job from "../model/job.model.js";
import { privateResumesDirectory } from "../utils/upload.js";

const ALLOWED_STATUSES = new Set(["Applied", "Reviewing", "Shortlisted", "Rejected", "Hired"]);
const discardUploadedResume = async (req) => {
  if (req.file?.filename) await fs.promises.unlink(path.join(privateResumesDirectory, req.file.filename)).catch(() => {});
};

export const applyForJob = async (req, res) => {
  try {
    const { phone, coverLetter } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.jobId)) {
      await discardUploadedResume(req);
      return res.status(400).json({ message: "Invalid job id" });
    }
    if (typeof phone !== "string" || phone.trim().length < 5 || phone.trim().length > 30) {
      await discardUploadedResume(req);
      return res.status(400).json({ message: "Enter a valid phone number" });
    }
    if (typeof coverLetter !== "string" || !coverLetter.trim() || coverLetter.trim().length > 5000) {
      await discardUploadedResume(req);
      return res.status(400).json({ message: "A cover letter of up to 5000 characters is required" });
    }
    if (!req.file) return res.status(400).json({ message: "Please attach a PDF, DOC, or DOCX resume" });

    const job = await Job.findById(req.params.jobId);
    if (!job) {
      await discardUploadedResume(req);
      return res.status(404).json({ message: "Job not found" });
    }
    if (!job.isActive) {
      await discardUploadedResume(req);
      return res.status(409).json({ message: "This job is closed and no longer accepts applications" });
    }
    if (job.deadline && job.deadline.getTime() < Date.now()) {
      await discardUploadedResume(req);
      return res.status(409).json({ message: "The application deadline has passed" });
    }
    if (String(job.postedBy) === String(req.user._id)) {
      await discardUploadedResume(req);
      return res.status(400).json({ message: "You cannot apply to your own job posting" });
    }

    const existing = await Application.findOne({ jobId: job._id, applicantId: req.user._id }).select("_id").lean();
    if (existing) {
      await discardUploadedResume(req);
      return res.status(409).json({ message: "You have already applied for this job." });
    }

    try {
      const application = await Application.create({
        jobId: job._id,
        applicantId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: phone.trim(),
        skills: req.user.skills || [],
        resumeFile: req.file.filename,
        resumeOriginalName: path.basename(req.file.originalname),
        coverLetter: coverLetter.trim(),
      });
      return res.status(201).json({ application, message: "Application submitted" });
    } catch (error) {
      if (error.code === 11000) {
        await discardUploadedResume(req);
        return res.status(409).json({ message: "You have already applied for this job." });
      }
      throw error;
    }
  } catch (error) {
    await discardUploadedResume(req);
    return res.status(500).json({ message: "Unable to submit your application" });
  }
};

export const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ applicantId: req.user._id })
      .sort({ appliedAt: -1 })
      .populate("jobId", "title companyName location workMode jobType experienceLevel isActive createdAt postedBy");
    return res.json({ applications });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load your applications" });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.applicationId)) return res.status(400).json({ message: "Invalid application id" });
    const { status } = req.body || {};
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ message: "Choose a valid application status" });
    const application = await Application.findById(req.params.applicationId).populate("jobId", "postedBy title");
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (!application.jobId || String(application.jobId.postedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the job poster can update this application" });
    }
    application.status = status;
    await application.save();
    return res.json({ application, message: "Application status updated" });
  } catch (error) {
    return res.status(500).json({ message: "Unable to update application status" });
  }
};

export const downloadApplicationResume = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.applicationId)) return res.status(400).json({ message: "Invalid application id" });
    const application = await Application.findById(req.params.applicationId).populate("jobId", "postedBy");
    if (!application) return res.status(404).json({ message: "Application not found" });
    const applicantCanView = String(application.applicantId) === String(req.user._id);
    const posterCanView = application.jobId && String(application.jobId.postedBy) === String(req.user._id);
    if (!applicantCanView && !posterCanView) return res.status(403).json({ message: "You cannot access this resume" });
    const safeFileName = path.basename(application.resumeFile);
    const resumePath = path.join(privateResumesDirectory, safeFileName);
    if (!fs.existsSync(resumePath)) return res.status(404).json({ message: "Resume file not found" });
    return res.download(resumePath, path.basename(application.resumeOriginalName));
  } catch (error) {
    return res.status(500).json({ message: "Unable to download resume" });
  }
};
