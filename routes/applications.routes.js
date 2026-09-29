import { Router } from "express";
import {
  downloadApplicationResume,
  getMyApplications,
  updateApplicationStatus,
} from "../controllers/application.controllers.js";
import { requireSession } from "../middlewere/requireSession.js";

const router = Router();
router.use(requireSession);

router.get("/me", getMyApplications);
router.patch("/:applicationId/status", updateApplicationStatus);
router.get("/:applicationId/resume", downloadApplicationResume);

export default router;
