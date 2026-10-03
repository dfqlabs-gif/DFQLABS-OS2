import { Router } from "express";
import { FocusController } from "../controllers/focusController.js";
import { authenticateUser } from "../middleware/auth.js";

const router = Router();

router.use(authenticateUser);

router.get("/today", FocusController.getToday);

export default router;
