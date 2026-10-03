import { Router } from "express";
import { DashboardController } from "../controllers/dashboardController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.use(authenticateUser);

router.get("/mission-control", DashboardController.missionControl);

export default router;
