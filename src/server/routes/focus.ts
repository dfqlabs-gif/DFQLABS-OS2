import { Router } from "express";
import { FocusController } from "../controllers/focusController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.use(authenticateUser);

router.get("/today", asyncHandler(FocusController.getToday));

export default router;
