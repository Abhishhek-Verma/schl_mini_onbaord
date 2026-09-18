import { prisma } from "../../lib/prisma.js";
import { SECTION_ORDER, SECTION_LABELS, TIMING } from "../config/pedagogy.js";
import { scoreAttempt } from "./pedagogyScoring.js";
import { serializeProfile, validationError } from "./teacher.service.js";

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

/**
 * Fisher-Yates array shuffle utility
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Start a new pedagogy skill assessment attempt
 * Orders questions by section, shuffles non-case questions and options,
 * and returns a strictly sanitized payload (no answer keys or scores).
 */
export async function startPedagogyAssessment(userId) {
  // 1. Strict lifetime single attempt: Check if already submitted
  const alreadySubmitted = await prisma.pedagogyAttempt.findFirst({
    where: {
      userId,
      status: "SUBMITTED",
    },
  });

  if (alreadySubmitted) {
    throw conflictError("You have already completed this pedagogy assessment.");
  }

  // 2. In-progress resumption: Resume existing attempt without re-rolling questions or options
  const existingInProgress = await prisma.pedagogyAttempt.findFirst({
    where: {
      userId,
      status: "IN_PROGRESS",
    },
    orderBy: { startedAt: "desc" },
  });

  if (
    existingInProgress &&
    Array.isArray(existingInProgress.questionOrder) &&
    existingInProgress.questionOrder.length > 0
  ) {
    const rawQuestions = await prisma.pedagogyQuestion.findMany({
      where: {
        id: { in: existingInProgress.questionOrder },
        isActive: true,
      },
    });

    const questionMap = new Map(rawQuestions.map((q) => [q.id, q]));
    const orderedQuestions = existingInProgress.questionOrder
      .map((id) => questionMap.get(id))
      .filter(Boolean);

    const sanitizedQuestions = orderedQuestions.map((q) => {
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const order =
        existingInProgress.optionOrders?.[q.id] || rawOptions.map((o) => o.key);

      const optionMap = new Map(rawOptions.map((o) => [o.key, o]));
      const sanitizedOptions = order
        .map((key) => {
          const opt = optionMap.get(key);
          if (!opt) return null;
          return {
            key: opt.key,
            text: opt.text,
          };
        })
        .filter(Boolean);

      return {
        id: q.id,
        code: q.code,
        section: q.section,
        sectionLabel: SECTION_LABELS[q.section] || q.section,
        type: q.type,
        prompt: q.prompt,
        options: sanitizedOptions,
        caseGroup: q.caseGroup || null,
        casePart: q.casePart || null,
      };
    });

    return {
      attemptId: existingInProgress.id,
      durationMinutes: TIMING.totalMinutes,
      softPerQuestionSeconds: TIMING.softPerQuestionSeconds,
      hardPerQuestion: TIMING.hardPerQuestion,
      questions: sanitizedQuestions,
    };
  }

  // 3. Brand new attempt creation
  const allQuestions = await prisma.pedagogyQuestion.findMany({
    where: { isActive: true },
  });

  if (!allQuestions || allQuestions.length === 0) {
    throw validationError("No active pedagogy assessment questions are currently available.");
  }

  // Group by section
  const sectionMap = new Map();
  for (const sec of SECTION_ORDER) {
    sectionMap.set(sec, []);
  }

  for (const q of allQuestions) {
    if (!sectionMap.has(q.section)) {
      sectionMap.set(q.section, []);
    }
    sectionMap.get(q.section).push(q);
  }

  const orderedQuestions = [];
  const optionOrders = {};

  for (const sec of SECTION_ORDER) {
    const questionsInSec = sectionMap.get(sec) || [];
    if (questionsInSec.length === 0) continue;

    // Group CASE questions by caseGroup
    const caseGroups = new Map();
    const nonCaseQuestions = [];

    for (const q of questionsInSec) {
      if (q.type === "CASE" && q.caseGroup) {
        if (!caseGroups.has(q.caseGroup)) {
          caseGroups.set(q.caseGroup, []);
        }
        caseGroups.get(q.caseGroup).push(q);
      } else {
        nonCaseQuestions.push(q);
      }
    }

    // Sort parts within each case group
    const caseGroupItems = [];
    for (const [_, parts] of caseGroups.entries()) {
      parts.sort((a, b) => (a.casePart || 0) - (b.casePart || 0));
      caseGroupItems.push(parts);
    }

    // Mix non-case questions and case groups (as atomic blocks) and shuffle
    const mixedUnits = shuffle([
      ...nonCaseQuestions.map((q) => [q]),
      ...caseGroupItems,
    ]);

    for (const unit of mixedUnits) {
      for (const q of unit) {
        orderedQuestions.push(q);

        // Shuffle options and record order
        const opts = Array.isArray(q.options) ? [...q.options] : [];
        const shuffledOpts = shuffle(opts);
        optionOrders[q.id] = shuffledOpts.map((o) => o.key);
      }
    }
  }

  const questionOrder = orderedQuestions.map((q) => q.id);

  // Clear any stale in-progress attempts for this user
  await prisma.pedagogyAttempt.deleteMany({
    where: {
      userId,
      status: "IN_PROGRESS",
    },
  });

  // Create attempt in database
  const attempt = await prisma.pedagogyAttempt.create({
    data: {
      userId,
      status: "IN_PROGRESS",
      questionOrder,
      optionOrders,
    },
  });

  // Build sanitized questions payload (strip all scoring/answer fields)
  const sanitizedQuestions = orderedQuestions.map((q) => {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const order = optionOrders[q.id] || rawOptions.map((o) => o.key);

    const optionMap = new Map(rawOptions.map((o) => [o.key, o]));
    const sanitizedOptions = order
      .map((key) => {
        const opt = optionMap.get(key);
        if (!opt) return null;
        return {
          key: opt.key,
          text: opt.text,
        };
      })
      .filter(Boolean);

    return {
      id: q.id,
      code: q.code,
      section: q.section,
      sectionLabel: SECTION_LABELS[q.section] || q.section,
      type: q.type,
      prompt: q.prompt,
      options: sanitizedOptions,
      caseGroup: q.caseGroup || null,
      casePart: q.casePart || null,
    };
  });

  return {
    attemptId: attempt.id,
    durationMinutes: TIMING.totalMinutes,
    softPerQuestionSeconds: TIMING.softPerQuestionSeconds,
    hardPerQuestion: TIMING.hardPerQuestion,
    questions: sanitizedQuestions,
  };
}

/**
 * Submit a pedagogy skill assessment attempt and calculate scores
 */
export async function submitPedagogyAssessment(userId, input = {}) {
  const { attemptId, responses, perQuestionMs, durationSec } = input;

  if (!attemptId || typeof attemptId !== "string") {
    throw validationError("Attempt ID is required.");
  }

  const attempt = await prisma.pedagogyAttempt.findUnique({
    where: { id: attemptId },
  });

  if (!attempt) {
    throw validationError("Assessment attempt not found.");
  }

  if (attempt.userId !== userId) {
    throw validationError("You do not have permission to submit this assessment attempt.");
  }

  // Idempotent return if already submitted
  if (attempt.status === "SUBMITTED") {
    const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
    return {
      result: {
        overallScore: attempt.overallScore,
        band: attempt.band,
        sectionMinMet: attempt.sectionMinMet,
        sectionScores: attempt.sectionScores,
        flags: attempt.flags,
        submittedAt: attempt.submittedAt,
        durationSec: attempt.durationSec,
      },
      profile: serializeProfile(profile),
    };
  }

  // Reject with 409 if another distinct attempt for this user was already submitted
  const priorSubmitted = await prisma.pedagogyAttempt.findFirst({
    where: {
      userId,
      status: "SUBMITTED",
      id: { not: attemptId },
    },
  });

  if (priorSubmitted) {
    throw conflictError("You have already completed this pedagogy assessment.");
  }

  // Load questions by attempt.questionOrder
  const rawQuestions = await prisma.pedagogyQuestion.findMany({
    where: { id: { in: attempt.questionOrder } },
  });

  const questionMap = new Map(rawQuestions.map((q) => [q.id, q]));
  const questions = attempt.questionOrder.map((id) => questionMap.get(id)).filter(Boolean);

  // Score the attempt
  const scoreResult = scoreAttempt(questions, responses || {});

  // Anti-gaming analysis
  const antiGamingFlags = [];
  const safeDurationSec = typeof durationSec === "number" ? durationSec : 0;
  if (safeDurationSec > 0 && safeDurationSec < 600) {
    antiGamingFlags.push({ type: "RUSHED", durationSec: safeDurationSec });
  }

  if (perQuestionMs && typeof perQuestionMs === "object") {
    for (const [questionId, ms] of Object.entries(perQuestionMs)) {
      if (typeof ms === "number" && ms > 240000) {
        antiGamingFlags.push({ type: "SLOW_QUESTION", questionId, perQuestionMs: ms });
      }
    }
  }

  const combinedFlags = [...(scoreResult.flags || []), ...antiGamingFlags];

  const submittedAt = new Date();

  // Persist attempt results
  await prisma.pedagogyAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      responses: responses || {},
      sectionScores: scoreResult.sectionScores,
      overallScore: scoreResult.overallScore,
      band: scoreResult.band,
      flags: combinedFlags,
      sectionMinMet: scoreResult.sectionMinMet,
      durationSec: safeDurationSec,
      perQuestionMs: perQuestionMs || {},
      submittedAt,
    },
  });

  // Clean up any remaining IN_PROGRESS attempts for this user
  await prisma.pedagogyAttempt.deleteMany({
    where: {
      userId,
      status: "IN_PROGRESS",
    },
  });

  // Mark skillAssessmentCompleted in TeacherProfile
  let updatedProfile;
  try {
    updatedProfile = await prisma.teacherProfile.update({
      where: { userId },
      data: { skillAssessmentCompleted: true },
    });
  } catch (err) {
    throw validationError("Complete your profile before the skill assessment.");
  }

  return {
    result: {
      ...scoreResult,
      submittedAt,
      durationSec: safeDurationSec,
    },
    profile: serializeProfile(updatedProfile),
  };
}

/**
 * Get latest submitted pedagogy assessment result for user
 */
export async function getPedagogyResult(userId) {
  const attempt = await prisma.pedagogyAttempt.findFirst({
    where: {
      userId,
      status: "SUBMITTED",
    },
    orderBy: { submittedAt: "desc" },
  });

  if (!attempt) return null;

  return {
    overallScore: attempt.overallScore,
    band: attempt.band,
    sectionMinMet: attempt.sectionMinMet,
    sectionScores: attempt.sectionScores,
    flags: attempt.flags,
    submittedAt: attempt.submittedAt,
    durationSec: attempt.durationSec,
  };
}
