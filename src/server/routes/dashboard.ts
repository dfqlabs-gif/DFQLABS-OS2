import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(authenticateUser);

router.get("/mission-control", asyncHandler(DashboardController.missionControl));
router.get("/ceo", asyncHandler(DashboardController.ceo));

export default router;
