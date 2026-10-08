import { Router } from "express";
import { authenticateUser } from "../middleware/auth.js";
import { requireFounder } from "../middleware/rbac.js";
import { LeadFinderController } from "../controllers/leadFinderController.js";

const router = Router();
router.use(authenticateUser);
router.get("/summary", LeadFinderController.summary);
router.get("/settings", LeadFinderController.settings);
router.get("/history", LeadFinderController.history);
router.post("/run", LeadFinderController.run);
router.put("/settings", requireFounder, LeadFinderController.saveSettings);
export default router;