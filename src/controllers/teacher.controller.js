import {
  getTeacherOnboarding,
  saveBasicInformation,
  saveProfileCompletion,
  listTeacherDocuments,
  createTeacherDocumentUpload,
  completeTeacherDocumentUpload,
  deleteTeacherDocument,
  saveDocumentsStep,
  saveSkillAssessment,
  saveDemoClass,
  saveTeacherPassport,
  saveAvailability,
  searchLocations,
  reverseGeocodeLocation,
} from "../services/teacher.service.js";
import {
  startPedagogyAssessment,
  submitPedagogyAssessment,
  getPedagogyResult,
} from "../services/pedagogy.service.js";

export async function getTeacherOnboardingHandler(req, res, next) {
  try {
    res.json(await getTeacherOnboarding(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function saveBasicInformationHandler(req, res, next) {
  try {
    res.json(await saveBasicInformation(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function saveProfileCompletionHandler(req, res, next) {
  try {
    res.json(await saveProfileCompletion(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function listTeacherDocumentsHandler(req, res, next) {
  try { res.json({ documents: await listTeacherDocuments(req.user.id) }); } catch (error) { next(error); }
}

export async function createTeacherDocumentUploadHandler(req, res, next) {
  try { res.json(await createTeacherDocumentUpload(req.user.id, req.body)); } catch (error) { next(error); }
}

export async function completeTeacherDocumentUploadHandler(req, res, next) {
  try { res.json({ document: await completeTeacherDocumentUpload(req.user.id, req.body) }); } catch (error) { next(error); }
}

export async function deleteTeacherDocumentHandler(req, res, next) {
  try {
    res.json(await deleteTeacherDocument(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function saveDocumentsStepHandler(req, res, next) {
  try {
    res.json(await saveDocumentsStep(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function saveSkillAssessmentHandler(req, res, next) {
  try {
    res.json(await saveSkillAssessment(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function saveDemoClassHandler(req, res, next) {
  try {
    res.json(await saveDemoClass(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function saveTeacherPassportHandler(req, res, next) {
  try {
    res.json(await saveTeacherPassport(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function saveAvailabilityHandler(req, res, next) {
  try {
    const finalize = req.body?.finalize === true;
    res.json(await saveAvailability(req.user.id, req.body, finalize));
  } catch (error) {
    next(error);
  }
}

export async function searchLocationHandler(req, res, next) {
  try {
    const { q } = req.query;
    const locations = await searchLocations(q);
    res.json({ locations });
  } catch (error) {
    next(error);
  }
}

export async function reverseGeocodeHandler(req, res, next) {
  try {
    const { lat, lon, lng } = req.query;
    const location = await reverseGeocodeLocation(lat, lon !== undefined ? lon : lng);
    res.json({ location });
  } catch (error) {
    next(error);
  }
}

export async function startPedagogyAssessmentHandler(req, res, next) {
  try {
    res.json(await startPedagogyAssessment(req.user.id));
  } catch (e) {
    next(e);
  }
}

export async function submitPedagogyAssessmentHandler(req, res, next) {
  try {
    res.json(await submitPedagogyAssessment(req.user.id, req.body));
  } catch (e) {
    next(e);
  }
}

export async function getPedagogyResultHandler(req, res, next) {
  try {
    res.json(await getPedagogyResult(req.user.id));
  } catch (e) {
    next(e);
  }
}

