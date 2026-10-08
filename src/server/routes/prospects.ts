import { Router } from "express";
import { CreateProspectSchema, DuplicateCheckSchema } from "../../shared/schemas/index.js";
import { ProspectController } from "../controllers/prospectController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);

router.post("/duplicate-check", validateRequest(DuplicateCheckSchema), asyncHandler(ProspectController.duplicateCheck));
router.post("/", validateRequest(CreateProspectSchema), asyncHandler(ProspectController.create));
router.get("/", asyncHandler(ProspectController.list));
router.get("/:id", asyncHandler(ProspectController.getById));
router.post("/:id/briefing", asyncHandler(ProspectController.generateBriefing));

export default router;
