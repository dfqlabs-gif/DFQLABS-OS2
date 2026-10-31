import { Router } from "express";
import { ConfirmSentSchema, GenerateFirstTouchSchema, GenerateFollowUpSchema, InboundReplySchema, ManualOutboundSchema, ContactIssueSchema, ResolveContactIssueSchema, SaveDraftEditSchema } from "../../shared/schemas/index.js";
import { MessageController } from "../controllers/messageController.js";
import { authenticateUser } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();

router.use(authenticateUser);

router.post("/generate-first-touch", validateRequest(GenerateFirstTouchSchema), MessageController.generateFirstTouch);
router.post("/generate-follow-up", validateRequest(GenerateFollowUpSchema), MessageController.generateFollowUp);
router.put("/:id", validateRequest(SaveDraftEditSchema), MessageController.updateDraft);
router.post("/:id/whatsapp-open", MessageController.whatsappOpen);
router.post("/:id/confirm-sent", validateRequest(ConfirmSentSchema), MessageController.confirmSent);
router.post("/conversations/:id/inbound", validateRequest(InboundReplySchema), MessageController.logInboundReply);
router.post("/leads/:leadId/manual-outbound",validateRequest(ManualOutboundSchema),MessageController.logManualOutbound);
router.post("/leads/:leadId/contact-issues",validateRequest(ContactIssueSchema),MessageController.reportContactIssue);
router.get("/contact-issues",MessageController.listContactIssues);
router.post("/contact-issues/:id/resolve",validateRequest(ResolveContactIssueSchema),MessageController.resolveContactIssue);

export default router;
