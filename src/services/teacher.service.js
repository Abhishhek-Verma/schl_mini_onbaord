import { prisma } from "../../lib/prisma.js";
import { randomUUID } from "node:crypto";
import {
  checkObjectExistsInR2,
  deleteObjectFromR2,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
} from "../utils/r2.js";
import { SUBJECTS, CLASS_MIN, CLASS_MAX, BOARDS } from "../config/subjectAssessment.js";

const EMPLOYMENT_PREFERENCES = ["FULL_TIME", "PART_TIME", "CONTRACT", "SUBSTITUTE", "TEMPORARY"];
const BOARD_EXPERIENCE = ["CBSE", "ICSE", "STATE_BOARD", "IB", "OTHER"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

export function validationError(message) {
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

function localDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function stringList(value, fieldName) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw validationError(`${fieldName} must be a list of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

function requiredText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) throw validationError(`${fieldName} is required`);
  return value.trim();
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
  if (mimeType === "application/pdf" && sizeBytes > MAX_PDF_BYTES) throw validationError("PDF files must be 5 MB or smaller");
  if (mimeType.startsWith("image/") && sizeBytes > MAX_IMAGE_BYTES) throw validationError("Image files must be 2 MB or smaller");
}

function documentStorageKey(userId, documentType, slot, fileName) {
  const safeDocType = documentType.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
  return `teachers/${userId}/documents/${safeDocType}-${slot}-${randomUUID()}-${safeName}`;
}

function serializeDocument(document, downloadUrl) {
  return { ...document, downloadUrl };
}

export async function listTeacherDocuments(userId) {
  const documents = await prisma.teacherDocument.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }] });
  return Promise.all(documents.map(async (document) => serializeDocument(document, await generatePresignedDownloadUrl({ storageKey: document.storageKey }))));
}

export async function createTeacherDocumentUpload(userId, input) {
  validateDocumentInput(input);
  const storageKey = documentStorageKey(userId, input.documentType, input.slot || 1, input.fileName);
  const uploadUrl = await generatePresignedUploadUrl({ storageKey, mimeType: input.mimeType });
  return { uploadUrl, storageKey, expiresInSeconds: 300 };
}

export async function completeTeacherDocumentUpload(userId, input) {
  validateDocumentInput(input);
  if (typeof input.storageKey !== "string" || !input.storageKey.startsWith(`teachers/${userId}/documents/`)) {
    throw validationError("Invalid document upload key");
  }
  const stored = await checkObjectExistsInR2(input.storageKey);
  if (!stored.exists || stored.sizeBytes !== input.sizeBytes) throw validationError("Uploaded document could not be verified");
  const slot = input.slot || 1;
  const docType = input.documentType.trim();
  const docName = (input.documentName && typeof input.documentName === "string" && input.documentName.trim()) || docType;

  const previous = await prisma.teacherDocument.findUnique({
    where: { userId_documentType_slot: { userId, documentType: docType, slot } },
  });

  const document = await prisma.teacherDocument.upsert({
    where: { userId_documentType_slot: { userId, documentType: docType, slot } },
    create: {
      userId,
      documentType: docType,
      documentName: docName,
      slot,
      fileName: input.fileName.trim(),
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
    update: {
      documentName: docName,
      fileName: input.fileName.trim(),
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });

  if (previous?.storageKey && previous.storageKey !== input.storageKey) {
    await deleteObjectFromR2(previous.storageKey);
  }
  return serializeDocument(document, await generatePresignedDownloadUrl({ storageKey: document.storageKey }));
}

export async function deleteTeacherDocument(userId, documentId) {
  const doc = await prisma.teacherDocument.findFirst({ where: { id: documentId, userId } });
  if (!doc) throw validationError("Document not found");
  await prisma.teacherDocument.delete({ where: { id: doc.id } });
  if (doc.storageKey) {
    await deleteObjectFromR2(doc.storageKey).catch(() => {});
  }
  return { success: true };
}

function tryParseJson(val) {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return val;
  try { return JSON.parse(trimmed); } catch { return val; }
}

export function serializeProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    currentLocation: tryParseJson(profile.currentLocation),
    preferredLocations: tryParseJson(profile.preferredLocations) || [],
    education: tryParseJson(profile.education),
    achievements: tryParseJson(profile.achievements),
    awards: tryParseJson(profile.awards),
    openToSubjects: tryParseJson(profile.openToSubjects) || [],
    openToClasses: tryParseJson(profile.openToClasses) || [],
    demoAssignedTopics: tryParseJson(profile.demoAssignedTopics) || null,
    dateOfBirth: profile.dateOfBirth?.toISOString().slice(0, 10) || null,
    expectedJoiningDate: profile.expectedJoiningDate?.toISOString().slice(0, 10) || null,
    availableFrom: profile.availableFrom?.toISOString().slice(0, 10) || null,
  };
}

export async function getTeacherOnboarding(userId) {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
  return { profile: serializeProfile(profile) };
}

export async function saveBasicInformation(userId, input) {
  const dateOfBirth = input.dateOfBirth ? parseDate(input.dateOfBirth, "Date of birth") : null;
  const today = localDateValue();
  if (input.dateOfBirth && input.dateOfBirth > today) {
    throw validationError("Date of birth cannot be in the future");
  }
  if (!input.gender?.trim()) throw validationError("Gender is required");

  // Update user full name if provided (Name + Surname)
  const fullName = [
    input.firstName ?? input.name,
    input.lastName ?? input.surname,
  ]
    .filter((x) => x !== undefined && x !== null && String(x).trim().length > 0)
    .map((x) => String(x).trim())
    .join(" ");

  if (fullName) {
    await prisma.user.update({
      where: { id: userId },
      data: { displayName: fullName },
    });
  }

  const expectedJoiningDate = input.expectedJoiningDate
    ? parseDate(input.expectedJoiningDate, "Expected joining date")
    : null;

  const preferredTeachingLocations = input.preferredTeachingLocations
    ? stringList(input.preferredTeachingLocations, "Preferred teaching locations")
    : null;

  const employmentPreferences = input.employmentPreferences
    ? stringList(input.employmentPreferences, "Employment preferences")
    : null;

  const languages = input.languages
    ? stringList(input.languages, "Languages")
    : null;

  const location = input.location?.trim() || null;
  const preferredSalary = input.preferredSalary === undefined || input.preferredSalary === "" || input.preferredSalary === null
    ? null
    : Number(input.preferredSalary);

  const profile = await prisma.teacherProfile.upsert({
    where: { userId },
    create: {
      userId,
      dateOfBirth,
      gender: input.gender.trim(),
      location,
      contactInformation: input.contactInformation?.trim() || null,
      languages,
      preferredTeachingLocation: preferredTeachingLocations?.[0] || null,
      preferredTeachingLocations,
      preferredSalary: preferredSalary !== null && !Number.isNaN(preferredSalary) ? preferredSalary : null,
      expectedJoiningDate,
      employmentPreference: employmentPreferences?.[0] || null,
      employmentPreferences,
      achievements: "",
      basicInformationCompleted: true,
    },
    update: {
      dateOfBirth,
      gender: input.gender.trim(),
      location,
      contactInformation: input.contactInformation?.trim() || null,
      ...(languages ? { languages } : {}),
      ...(preferredTeachingLocations ? {
        preferredTeachingLocation: preferredTeachingLocations[0] || null,
        preferredTeachingLocations,
      } : {}),
      ...(preferredSalary !== null ? { preferredSalary } : {}),
      ...(expectedJoiningDate ? { expectedJoiningDate } : {}),
      ...(employmentPreferences ? {
        employmentPreference: employmentPreferences[0] || null,
        employmentPreferences,
      } : {}),
      basicInformationCompleted: true,
    },
  });

  return { profile: serializeProfile(profile) };
}

export async function saveProfileCompletion(userId, input) {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
  if (!profile?.basicInformationCompleted) throw validationError("Complete Basic Information first");

  const subjects = stringList(input.subjects, "Subjects");
  const classesTaught = stringList(input.classesTaught, "Classes taught");
  const languages = stringList(input.languages, "Languages");
  const skills = stringList(input.skills, "Skills");
  const boardExperience = stringList(input.boardExperience, "Board experience");

  if (!subjects?.length || !classesTaught?.length || !languages?.length || !skills?.length) {
    throw validationError("Subjects, classes taught, languages, and skills are required");
  }
  if (!boardExperience?.length || boardExperience.some((board) => !BOARD_EXPERIENCE.includes(board))) {
    throw validationError("Choose valid board experience options");
  }

  const aboutMe = requiredText(input.aboutMe, "About me");

  // Handle education: array of objects, JSON string, or string
  let educationStr = "";
  if (Array.isArray(input.education)) {
    if (!input.education.length) throw validationError("At least one education entry is required");
    educationStr = JSON.stringify(input.education);
  } else if (typeof input.education === "string" && input.education.trim()) {
    educationStr = input.education.trim();
  } else {
    throw validationError("Education details are required");
  }

  // Handle previous schools: array of objects or strings
  let previousSchools = input.previousSchools;
  if (typeof previousSchools === "string") {
    try {
      previousSchools = JSON.parse(previousSchools);
    } catch {
      previousSchools = previousSchools.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(previousSchools)) {
    previousSchools = previousSchools ? [previousSchools] : [];
  }

  // Handle achievements: array or string
  let achievements = "";
  if (Array.isArray(input.achievements)) {
    achievements = JSON.stringify(input.achievements);
  } else if (typeof input.achievements === "string") {
    achievements = input.achievements.trim();
  }

  // Handle awards: array or string
  let awards = null;
  if (Array.isArray(input.awards)) {
    awards = JSON.stringify(input.awards);
  } else if (typeof input.awards === "string") {
    awards = input.awards.trim() || null;
  }

  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: {
      aboutMe,
      education: educationStr,
      bed: input.bed?.trim() || null,
      deled: input.deled?.trim() || null,
      otherQualifications: input.otherQualifications?.trim() || null,
      certifications: input.certifications?.trim() || null,
      teachingExperience: input.teachingExperience?.trim() || null,
      previousSchools,
      subjects,
      classesTaught,
      boardExperience,
      teachingMethodology: input.teachingMethodology?.trim() || null,
      languages,
      skills,
      achievements,
      awards,
      profileCompletionCompleted: true,
    },
  });

  return { profile: serializeProfile(updated) };
}

export async function saveDocumentsStep(userId) {
  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: { documentsCompleted: true },
  });
  return { profile: serializeProfile(updated) };
}

export async function saveDemoClass(userId, input) {
  const demoVideoUrl = input.demoVideoUrl?.trim() || null;
  if (!demoVideoUrl) {
    throw validationError("Demo class YouTube video URL is required.");
  }
  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: {
      demoVideoUrl,
      demoClassCompleted: true,
    },
  });
  return { profile: serializeProfile(updated) };
}

export async function saveTeacherPassport(userId, input) {
  const passportScore = Number(input.passportScore) || 80;
  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: {
      passportScore,
      passportScoreCompleted: true,
    },
  });
  return { profile: serializeProfile(updated) };
}

function parseAvailableFrom(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    const now = new Date();
    if (lower === "immediately") return now;
    if (lower.includes("15 day")) {
      const d = new Date(now);
      d.setDate(d.getDate() + 15);
      return d;
    }
    if (lower.includes("30 day") || lower.includes("1 month")) {
      const d = new Date(now);
      d.setDate(d.getDate() + 30);
      return d;
    }
    if (lower.includes("2 month")) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 2);
      return d;
    }
    if (lower.includes("3 month")) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + 3);
      return d;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }
  return null;
}

function normalizeLocationData(item) {
  if (!item) return null;
  const addr = item.address || {};

  const locationName = (
    item.name ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.residential ||
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    (item.display_name ? item.display_name.split(",")[0].trim() : "Unknown Location")
  ).trim();

  const district = (
    addr.state_district ||
    addr.district ||
    addr.county ||
    addr.city_district ||
    addr.city ||
    ""
  ).trim();

  const state = (
    addr.state ||
    addr.province ||
    addr.region ||
    ""
  ).trim();

  const pincode = (
    addr.postcode ||
    addr.postal_code ||
    ""
  ).trim();

  const latitude = Number(item.lat !== undefined ? item.lat : item.latitude);
  const longitude = Number(item.lon !== undefined ? item.lon : item.longitude);

  return {
    locationName,
    district,
    state,
    pincode,
    latitude: !Number.isNaN(latitude) ? latitude : 0,
    longitude: !Number.isNaN(longitude) ? longitude : 0,
    formattedAddress: item.display_name || [locationName, district, state, pincode].filter(Boolean).join(", "),
    addressDetails: addr,
  };
}

const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

export async function searchLocations(query) {
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const words = q.split(/[\s,]+/).filter((w) => w.length >= 2);

  // Generate query variations
  const variants = [q];
  if (words.length > 1) {
    variants.push(words.join(", "));
  }

  const expanded = q
    .replace(
      /([a-z]+)(nagar|ganj|pur|bad|garh|vihar|colony|enclave|kheda|layout|bazaar|chowk)/gi,
      "$1 $2"
    )
    .trim();
  if (expanded.toLowerCase() !== q.toLowerCase()) {
    variants.push(expanded);
    if (words.length > 1) {
      variants.push(expanded.split(/[\s,]+/).filter(Boolean).join(", "));
    }
  }

  // If 2+ words, also query the primary locality word as fallback
  if (words.length > 1) {
    variants.push(words[0]);
  }

  const seen = new Set();
  const rawItems = [];

  for (const searchQuery of variants) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        searchQuery
      )}&countrycodes=in&accept-language=en&addressdetails=1&limit=10`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Schoolmini-LocationService/1.0 (support@schoolmini.com)",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          for (const item of results) {
            if (item.place_id && !seen.has(item.place_id)) {
              seen.add(item.place_id);
              rawItems.push(item);
            }
          }
          // If we already have items matching all user words, we can stop early
          const hasFullMatch = rawItems.some((item) => {
            const full = (item.display_name || "").toLowerCase();
            return words.every((w) => full.includes(w.toLowerCase()));
          });
          if (hasFullMatch && rawItems.length >= 3) break;
        }
      }
    } catch {
      // Continue to next variation
    }
  }

  // Rank results: items matching more query words come first
  rawItems.sort((a, b) => {
    const textA = (a.display_name || "").toLowerCase();
    const textB = (b.display_name || "").toLowerCase();
    const scoreA = words.filter((w) => textA.includes(w.toLowerCase())).length;
    const scoreB = words.filter((w) => textB.includes(w.toLowerCase())).length;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.importance || 0) - (a.importance || 0);
  });

  const normalized = rawItems.map(normalizeLocationData).filter(Boolean);
  searchCache.set(cacheKey, { timestamp: Date.now(), data: normalized });
  return normalized;
}

export async function reverseGeocodeLocation(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    throw validationError("Valid latitude and longitude are required");
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=en`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Schoolmini-LocationService/1.0 (support@schoolmini.com)",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }

  return normalizeLocationData(result);
}

export async function saveAvailability(userId, input, finalize = false) {
  const noticePeriod = input.noticePeriod?.trim() || null;
  let preferredSalary = null;
  if (input.preferredSalary !== undefined && input.preferredSalary !== "" && input.preferredSalary !== null) {
    const num = Number(input.preferredSalary);
    if (!Number.isNaN(num)) preferredSalary = num;
  } else if (input.salaryRange && typeof input.salaryRange === "string") {
    const match = input.salaryRange.replace(/,/g, "").match(/\d+/);
    if (match) preferredSalary = parseInt(match[0], 10);
  }

  const availableWorkingDays = Array.isArray(input.availableWorkingDays)
    ? input.availableWorkingDays
    : null;
  const workingHoursStart = input.workingHoursStart?.trim() || null;
  const workingHoursEnd = input.workingHoursEnd?.trim() || null;
  const availableFrom = parseAvailableFrom(input.availableFrom);

  let currentLocation = undefined;
  if (input.currentLocation !== undefined) {
    if (input.currentLocation && typeof input.currentLocation === "object") {
      const c = input.currentLocation;
      const locName = String(c.locationName || "").trim();
      const dist = String(c.district || "").trim();
      const st = String(c.state || "").trim();
      const pin = String(c.pincode || "").trim();
      currentLocation = {
        locationName: locName,
        district: dist,
        state: st,
        pincode: pin,
        latitude: Number(c.latitude) || 0,
        longitude: Number(c.longitude) || 0,
        formattedAddress: String(c.formattedAddress || [locName, dist, st, pin].filter(Boolean).join(", ")).trim(),
        ...(c.addressDetails ? { addressDetails: c.addressDetails } : {}),
      };
    } else {
      currentLocation = null;
    }
  }

  let preferredLocations = undefined;
  if (input.preferredLocations !== undefined) {
    if (Array.isArray(input.preferredLocations)) {
      preferredLocations = input.preferredLocations
        .filter((loc) => loc && typeof loc === "object")
        .map((loc) => {
          const locName = String(loc.locationName || "").trim();
          const dist = String(loc.district || "").trim();
          const st = String(loc.state || "").trim();
          const pin = String(loc.pincode || "").trim();
          const lat = Number(loc.latitude) || 0;
          const lon = Number(loc.longitude) || 0;
          const rad = Math.max(1, Number(loc.radiusKm) || 10);
          return {
            locationName: locName,
            district: dist,
            state: st,
            pincode: pin,
            latitude: lat,
            longitude: lon,
            radiusKm: rad,
            formattedAddress: String(loc.formattedAddress || [locName, dist, st, pin].filter(Boolean).join(", ")).trim(),
            ...(loc.addressDetails ? { addressDetails: loc.addressDetails } : {}),
          };
        })
        .filter((loc) => loc.locationName || (loc.latitude && loc.longitude));
    } else {
      preferredLocations = [];
    }
  }

  const dataToUpdate = {
    noticePeriod,
    preferredSalary,
    availableWorkingDays,
    workingHoursStart,
    workingHoursEnd,
    availableFrom,
    availabilityCompleted: true,
  };

  if (currentLocation !== undefined) {
    dataToUpdate.currentLocation = currentLocation;
    if (currentLocation?.locationName) {
      dataToUpdate.location = currentLocation.locationName;
    }
  }

  if (preferredLocations !== undefined) {
    dataToUpdate.preferredLocations = preferredLocations;
    if (preferredLocations && preferredLocations.length > 0) {
      dataToUpdate.preferredTeachingLocation = preferredLocations[0].locationName;
      dataToUpdate.preferredTeachingLocations = preferredLocations.map((p) => p.locationName);
    }
  }

  if (input.openToSubjects !== undefined) {
    if (Array.isArray(input.openToSubjects)) {
      const validSubjects = input.openToSubjects
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => SUBJECTS.includes(s));
      dataToUpdate.openToSubjects = validSubjects;
    } else {
      dataToUpdate.openToSubjects = [];
    }
  }

  if (input.openToClasses !== undefined) {
    if (Array.isArray(input.openToClasses)) {
      const validClasses = input.openToClasses
        .map((c) => Number(c))
        .filter((c) => Number.isInteger(c) && c >= CLASS_MIN && c <= CLASS_MAX);
      validClasses.sort((a, b) => a - b);
      dataToUpdate.openToClasses = Array.from(new Set(validClasses));
    } else {
      dataToUpdate.openToClasses = [];
    }
  }

  if (input.openToBoard !== undefined) {
    const boardStr = String(input.openToBoard || "").trim().toUpperCase();
    dataToUpdate.openToBoard = BOARDS.includes(boardStr) ? boardStr : "CBSE";
  }

  if (finalize) {
    dataToUpdate.onboardingCompleted = true;
  }

  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: dataToUpdate,
  });

  return { profile: serializeProfile(updated) };
}

export async function syncSkillAssessmentFlag(userId) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { pedagogyCompleted: true, subjectAssessmentCompleted: true },
  });
  if (!profile) return false;
  const isBothCompleted = Boolean(profile.pedagogyCompleted && profile.subjectAssessmentCompleted);
  await prisma.teacherProfile.update({
    where: { userId },
    data: { skillAssessmentCompleted: isBothCompleted },
  });
  return isBothCompleted;
}
