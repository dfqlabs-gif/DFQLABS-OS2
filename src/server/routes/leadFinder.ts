import { Router } from "express";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireRole } from "../middleware/rbac.js";
import { LeadFinderController } from "../controllers/leadFinderController.js";

const router = Router();
router.use(authenticateUser);
router.get("/summary", asyncHandler(LeadFinderController.summary));
router.get("/settings", asyncHandler(LeadFinderController.settings));
router.get("/history", asyncHandler(LeadFinderController.history));
router.post("/run", asyncHandler(LeadFinderController.run));
router.put("/settings", requireRole("FOUNDER"), asyncHandler(LeadFinderController.saveSettings));
export default router;
