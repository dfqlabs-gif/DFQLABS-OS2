import { Router } from "express";
import { CreateProspectSchema, DuplicateCheckSchema } from "../../shared/schemas/index.js";
import { ProspectController } from "../controllers/prospectController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);

router.post("/duplicate-check", validateRequest(DuplicateCheckSchema), ProspectController.duplicateCheck);
router.post("/", validateRequest(CreateProspectSchema), ProspectController.create);
router.get("/", ProspectController.list);
router.get("/:id", ProspectController.getById);
router.post("/:id/briefing", ProspectController.generateBriefing);

export default router;
