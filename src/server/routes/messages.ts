import { Router } from "express";
import { ConfirmSentSchema, GenerateFirstTouchSchema, InboundReplySchema, SaveDraftEditSchema } from "../../shared/schemas/index.js";
import { MessageController } from "../controllers/messageController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);

router.post("/generate-first-touch", validateRequest(GenerateFirstTouchSchema), MessageController.generateFirstTouch);
router.put("/:id", validateRequest(SaveDraftEditSchema), MessageController.updateDraft);
router.post("/:id/whatsapp-open", MessageController.whatsappOpen);
router.post("/:id/confirm-sent", validateRequest(ConfirmSentSchema), MessageController.confirmSent);
router.post("/conversations/:id/inbound", validateRequest(InboundReplySchema), MessageController.logInboundReply);

export default router;
