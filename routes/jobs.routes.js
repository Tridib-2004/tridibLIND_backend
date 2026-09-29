import { Router } from "express";
import {
  createJob,
  getJob,
  getJobApplicants,
  getJobDashboard,
  getMyJobs,
  getSavedJobs,
  listJobs,
  saveJob,
  setJobStatus,
  unsaveJob,
  updateJob,
} from "../controllers/job.controllers.js";
import { applyForJob } from "../controllers/application.controllers.js";
import { requireSession } from "../middlewere/requireSession.js";
import { resumeUpload } from "../utils/upload.js";

const router = Router();
router.use(requireSession);

router.get("/", listJobs);
router.post("/", createJob);
router.get("/mine/dashboard", getJobDashboard);
router.get("/mine", getMyJobs);
router.get("/saved", getSavedJobs);
router.post("/:jobId/save", saveJob);
router.delete("/:jobId/save", unsaveJob);
router.get("/:jobId/applications", getJobApplicants);
router.post("/:jobId/apply", resumeUpload.single("resume"), applyForJob);
router.put("/:jobId", updateJob);
router.patch("/:jobId/status", setJobStatus);
router.get("/:jobId", getJob);

export default router;
