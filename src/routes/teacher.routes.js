import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
  getTeacherOnboardingHandler,
  saveBasicInformationHandler,
  saveProfileCompletionHandler,
  listTeacherDocumentsHandler,
  createTeacherDocumentUploadHandler,
  completeTeacherDocumentUploadHandler,
  deleteTeacherDocumentHandler,
  saveDocumentsStepHandler,
  saveSkillAssessmentHandler,
  saveDemoClassHandler,
  saveTeacherPassportHandler,
  saveAvailabilityHandler,
  searchLocationHandler,
  reverseGeocodeHandler,
  startPedagogyAssessmentHandler,
  submitPedagogyAssessmentHandler,
  getPedagogyResultHandler,
} from "../controllers/teacher.controller.js";

const router = Router();
const teacherOnly = [authenticateToken, authorizeRoles("TEACHER")];

router.get("/onboarding", ...teacherOnly, getTeacherOnboardingHandler);
router.put("/onboarding/basic-information", ...teacherOnly, saveBasicInformationHandler);
router.put("/onboarding/profile-completion", ...teacherOnly, saveProfileCompletionHandler);
router.put("/onboarding/documents-step", ...teacherOnly, saveDocumentsStepHandler);
router.put("/onboarding/skill-assessment", ...teacherOnly, saveSkillAssessmentHandler);
router.post("/onboarding/skill-assessment/start", ...teacherOnly, startPedagogyAssessmentHandler);
router.post("/onboarding/skill-assessment/submit", ...teacherOnly, submitPedagogyAssessmentHandler);
router.get("/onboarding/skill-assessment/result", ...teacherOnly, getPedagogyResultHandler);
router.put("/onboarding/demo-class", ...teacherOnly, saveDemoClassHandler);
router.put("/onboarding/passport-score", ...teacherOnly, saveTeacherPassportHandler);
router.put("/onboarding/availability", ...teacherOnly, saveAvailabilityHandler);
router.get("/location/search", searchLocationHandler);
router.get("/location/reverse", reverseGeocodeHandler);

router.get("/documents", ...teacherOnly, listTeacherDocumentsHandler);
router.post("/documents/upload-url", ...teacherOnly, createTeacherDocumentUploadHandler);
router.post("/documents/complete", ...teacherOnly, completeTeacherDocumentUploadHandler);
router.delete("/documents/:id", ...teacherOnly, deleteTeacherDocumentHandler);

export default router;

