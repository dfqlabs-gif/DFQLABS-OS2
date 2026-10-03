import { Router } from "express";
import { RecordOutcomeSchema } from "../../shared/schemas/index.js";
import { OutcomeController } from "../controllers/outcomeController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);

router.post("/", validateRequest(RecordOutcomeSchema), OutcomeController.record);

export default router;
