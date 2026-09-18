import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  getPrincipalOnboardingHandler,
  savePrincipalBasicInformationHandler,
  savePrincipalProfileCompletionHandler,
  savePrincipalDocumentsStepHandler,
  listPrincipalDocumentsHandler,
  createPrincipalDocumentUploadHandler,
  completePrincipalDocumentUploadHandler,
  deletePrincipalDocumentHandler,
} from "../controllers/principal.controller.js";

const router = Router();
const principalOnly = [authenticateToken, authorizeRoles("PRINCIPAL")];

router.get("/onboarding", ...principalOnly, getPrincipalOnboardingHandler);
router.put("/onboarding/basic-information", ...principalOnly, savePrincipalBasicInformationHandler);
router.put("/onboarding/profile-completion", ...principalOnly, savePrincipalProfileCompletionHandler);
router.put("/onboarding/documents-step", ...principalOnly, savePrincipalDocumentsStepHandler);

router.get("/documents", ...principalOnly, listPrincipalDocumentsHandler);
router.post("/documents/upload-url", ...principalOnly, createPrincipalDocumentUploadHandler);
router.post("/documents/complete", ...principalOnly, completePrincipalDocumentUploadHandler);
router.delete("/documents/:id", ...principalOnly, deletePrincipalDocumentHandler);

export default router;
