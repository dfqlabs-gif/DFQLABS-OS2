import { Router } from "express";
import { LoginSchema } from "../../shared/schemas/index.js";
import { AuthController } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.post("/login", validateRequest(LoginSchema), AuthController.login);
router.get("/me", authenticateUser, AuthController.me);

export default router;
