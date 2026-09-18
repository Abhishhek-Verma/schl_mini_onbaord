import { prisma } from "../../lib/prisma.js";
import { randomUUID } from "node:crypto";
import {
  checkObjectExistsInR2,
  deleteObjectFromR2,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
} from "../utils/r2.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError(`${fieldName} must be a valid date`);
  return date;
}

function validateDocumentInput(input) {
  const { documentType, slot = 1, fileName, mimeType, sizeBytes } = input;
  if (typeof documentType !== "string" || !documentType.trim()) {
    throw validationError("Document type is required");
  }
  if (!Number.isInteger(slot) || slot < 1) {
    throw validationError("Choose a valid document slot");
  }
  if (typeof fileName !== "string" || !fileName.trim()) throw validationError("File name is required");
  if (typeof mimeType !== "string" || (!mimeType.startsWith("image/") && mimeType !== "application/pdf")) {
    throw validationError("Only PDF or image files are allowed");
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) throw validationError("File size is invalid");
  if (mimeType === "application/pdf" && sizeBytes > MAX_PDF_BYTES) throw validationError("PDF files must be 10 MB or smaller");
  if (mimeType.startsWith("image/") && sizeBytes > MAX_IMAGE_BYTES) throw validationError("Image files must be 5 MB or smaller");
}

function documentStorageKey(userId, documentType, slot, fileName) {
  const safeDocType = documentType.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `principals/${userId}/documents/${safeDocType}-${slot}-${randomUUID()}-${safeName}`;
}

function serializeDocument(document, downloadUrl) {
  return { ...document, downloadUrl };
}

function serializeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    profilePhoto: profile.profilePhoto,
    dateOfBirth: profile.dateOfBirth?.toISOString().split("T")[0] || null,
    gender: profile.gender || "",
    contactInformation: profile.contactInformation || "",
    aboutMe: profile.aboutMe || "",
    currentSchoolName: profile.currentSchoolName || "",
    boardAffiliation: profile.boardAffiliation || "",
    schoolAddress: profile.schoolAddress || "",
    schoolContactNumber: profile.schoolContactNumber || "",
    adminExperienceYears: profile.adminExperienceYears || "0",
    education: profile.education || [],
    highestQualification: profile.highestQualification || "",
    previousInstitutions: profile.previousInstitutions || [],
    certifications: profile.certifications || [],
    achievements: profile.achievements || "",
    awards: profile.awards || "",
    basicInformationCompleted: profile.basicInformationCompleted,
    profileCompletionCompleted: profile.profileCompletionCompleted,
    documentsCompleted: profile.documentsCompleted,
    onboardingCompleted: profile.onboardingCompleted,
    verificationStatus: profile.verificationStatus || "PENDING",
    verifiedAt: profile.verifiedAt?.toISOString() || null,
  };
}

async function getOrCreatePrincipalProfile(userId) {
  let profile = await prisma.principalProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.principalProfile.create({
      data: {
        userId,
        verificationStatus: "PENDING",
      },
    });
  }
  return profile;
}

export async function getPrincipalOnboarding(userId) {
  const profile = await getOrCreatePrincipalProfile(userId);
  const documents = await listPrincipalDocuments(userId);
  return {
    profile: serializeProfile(profile),
    documents,
  };
}

export async function savePrincipalBasicInformation(userId, input) {
  const profile = await getOrCreatePrincipalProfile(userId);

  const firstName = (input.firstName || input.name || "").trim();
  const lastName = (input.lastName || input.surname || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  if (fullName) {
    await prisma.user.update({
      where: { id: userId },
      data: { displayName: fullName },
    });
  }

  const updated = await prisma.principalProfile.update({
    where: { userId },
    data: {
      gender: input.gender?.trim() || profile.gender || null,
      dateOfBirth: input.dateOfBirth ? parseDate(input.dateOfBirth, "Date of birth") : profile.dateOfBirth,
      contactInformation: input.contactInformation?.trim() || profile.contactInformation || null,
      basicInformationCompleted: true,
    },
  });

  return { profile: serializeProfile(updated) };
}

export async function savePrincipalProfileCompletion(userId, input) {
  await getOrCreatePrincipalProfile(userId);

  const updated = await prisma.principalProfile.update({
    where: { userId },
    data: {
      currentSchoolName: input.currentSchoolName?.trim() || null,
      boardAffiliation: input.boardAffiliation?.trim() || null,
      schoolAddress: input.schoolAddress?.trim() || null,
      schoolContactNumber: input.schoolContactNumber?.trim() || null,
      adminExperienceYears: input.adminExperienceYears !== undefined ? String(input.adminExperienceYears) : null,
      education: Array.isArray(input.education) ? input.education : null,
      highestQualification: input.highestQualification?.trim() || null,
      previousInstitutions: Array.isArray(input.previousInstitutions) ? input.previousInstitutions : null,
      certifications: Array.isArray(input.certifications) ? input.certifications : null,
      aboutMe: input.aboutMe?.trim() || null,
      achievements: input.achievements?.trim() || null,
      awards: input.awards?.trim() || null,
      profileCompletionCompleted: true,
    },
  });

  return { profile: serializeProfile(updated) };
}

export async function savePrincipalDocumentsStep(userId, finalize = false) {
  const profile = await getOrCreatePrincipalProfile(userId);

  const docCount = await prisma.principalDocument.count({ where: { userId } });
  const documentsCompleted = docCount > 0;

  const onboardingCompleted = Boolean(
    profile.basicInformationCompleted &&
    (profile.profileCompletionCompleted || finalize) &&
    (documentsCompleted || finalize)
  );

  const updated = await prisma.principalProfile.update({
    where: { userId },
    data: {
      documentsCompleted: true,
      onboardingCompleted: finalize ? true : onboardingCompleted,
      verificationStatus: "PENDING",
    },
  });

  return { profile: serializeProfile(updated) };
}

export async function listPrincipalDocuments(userId) {
  const documents = await prisma.principalDocument.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
  });

  return Promise.all(
    documents.map(async (document) => {
      let downloadUrl = null;
      try {
        downloadUrl = await generatePresignedDownloadUrl({ storageKey: document.storageKey });
      } catch {
        downloadUrl = null;
      }
      return serializeDocument(document, downloadUrl);
    })
  );
}

export async function createPrincipalDocumentUpload(userId, input) {
  validateDocumentInput(input);
  const storageKey = documentStorageKey(userId, input.documentType, input.slot || 1, input.fileName);
  let uploadUrl = "";
  try {
    uploadUrl = await generatePresignedUploadUrl({ storageKey, mimeType: input.mimeType });
  } catch (err) {
    // Fallback if R2 unconfigured in dev
    uploadUrl = `/api/principal/documents/mock-upload?key=${encodeURIComponent(storageKey)}`;
  }
  return { uploadUrl, storageKey, expiresInSeconds: 300 };
}

export async function completePrincipalDocumentUpload(userId, input) {
  validateDocumentInput(input);
  if (typeof input.storageKey !== "string" || !input.storageKey.startsWith(`principals/${userId}/documents/`)) {
    throw validationError("Invalid document upload key");
  }

  // Attempt R2 check if configured
  try {
    const stored = await checkObjectExistsInR2(input.storageKey);
    if (!stored.exists && process.env.R2_BUCKET_NAME) {
      throw validationError("Uploaded document could not be verified in storage");
    }
  } catch (err) {
    if (process.env.R2_BUCKET_NAME) {
      throw err;
    }
  }

  const slot = input.slot || 1;
  const docType = input.documentType.trim();
  const docName = (input.documentName && typeof input.documentName === "string" && input.documentName.trim()) || docType;

  const previous = await prisma.principalDocument.findUnique({
    where: { userId_documentType_slot: { userId, documentType: docType, slot } },
  });

  const document = await prisma.principalDocument.upsert({
    where: { userId_documentType_slot: { userId, documentType: docType, slot } },
    update: {
      fileName: input.fileName.trim(),
      documentName: docName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      verificationStatus: "PENDING_REVIEW",
    },
    create: {
      userId,
      documentType: docType,
      documentName: docName,
      slot,
      fileName: input.fileName.trim(),
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      verificationStatus: "PENDING_REVIEW",
    },
  });

  if (previous && previous.storageKey !== document.storageKey) {
    try {
      await deleteObjectFromR2(previous.storageKey);
    } catch {
      // Best-effort cleanup
    }
  }

  await prisma.principalProfile.update({
    where: { userId },
    data: { documentsCompleted: true },
  });

  let downloadUrl = null;
  try {
    downloadUrl = await generatePresignedDownloadUrl({ storageKey: document.storageKey });
  } catch {
    downloadUrl = null;
  }

  return serializeDocument(document, downloadUrl);
}

export async function deletePrincipalDocument(userId, documentId) {
  const document = await prisma.principalDocument.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  try {
    await deleteObjectFromR2(document.storageKey);
  } catch {
    // Best effort cleanup
  }

  await prisma.principalDocument.delete({ where: { id: document.id } });

  const remaining = await prisma.principalDocument.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.principalProfile.update({
      where: { userId },
      data: { documentsCompleted: false },
    });
  }

  return { message: "Document deleted successfully" };
}
