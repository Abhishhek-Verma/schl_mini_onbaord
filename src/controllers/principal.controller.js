import {
  getPrincipalOnboarding,
  savePrincipalBasicInformation,
  savePrincipalProfileCompletion,
  savePrincipalDocumentsStep,
  listPrincipalDocuments,
  createPrincipalDocumentUpload,
  completePrincipalDocumentUpload,
  deletePrincipalDocument,
  listCandidates,
  getCandidateEvaluation,
  updateCandidateDecision,
} from "../services/principal.service.js";

export async function getPrincipalOnboardingHandler(req, res, next) {
  try {
    res.json(await getPrincipalOnboarding(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function savePrincipalBasicInformationHandler(req, res, next) {
  try {
    res.json(await savePrincipalBasicInformation(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function savePrincipalProfileCompletionHandler(req, res, next) {
  try {
    res.json(await savePrincipalProfileCompletion(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function savePrincipalDocumentsStepHandler(req, res, next) {
  try {
    const finalize = req.body?.finalize === true;
    res.json(await savePrincipalDocumentsStep(req.user.id, finalize));
  } catch (error) {
    next(error);
  }
}

export async function listPrincipalDocumentsHandler(req, res, next) {
  try {
    res.json({ documents: await listPrincipalDocuments(req.user.id) });
  } catch (error) {
    next(error);
  }
}

export async function createPrincipalDocumentUploadHandler(req, res, next) {
  try {
    res.json(await createPrincipalDocumentUpload(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function completePrincipalDocumentUploadHandler(req, res, next) {
  try {
    res.json({ document: await completePrincipalDocumentUpload(req.user.id, req.body) });
  } catch (error) {
    next(error);
  }
}

export async function deletePrincipalDocumentHandler(req, res, next) {
  try {
    res.json(await deletePrincipalDocument(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function listCandidatesHandler(req, res, next) {
  try {
    const result = await listCandidates(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getCandidateEvaluationHandler(req, res, next) {
  try {
    const { userId } = req.params;
    const result = await getCandidateEvaluation(req.user.id, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function candidateDecisionHandler(req, res, next) {
  try {
    const { userId } = req.params;
    const { decision, remarks } = req.body;
    const result = await updateCandidateDecision(req.user.id, userId, decision, remarks);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
