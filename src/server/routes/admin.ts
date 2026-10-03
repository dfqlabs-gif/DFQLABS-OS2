import { Router } from "express";
import { ReassignSeatSchema } from "../../shared/schemas/index.js";
import { AdminController } from "../controllers/adminController.js";
import { authenticateUser } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);
router.use(requireRole("FOUNDER"));

router.get("/team", AdminController.getTeam);
router.post("/seats/reassign", validateRequest(ReassignSeatSchema), AdminController.reassignSeat);

export default router;
