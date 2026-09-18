import { prisma } from "../../lib/prisma.js";
import { TIMING, SUBJECT_LABELS, BOARDS } from "../config/subjectAssessment.js";
import { buildBlueprint, selectQuestions, scoreSubjectAttempt } from "./subjectGeneration.js";
import { serializeProfile, validationError, syncSkillAssessmentFlag } from "./teacher.service.js";

function conflictError(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

/**
 * Start or resume a dynamic Subject Knowledge Assessment
 * @param {string} userId
 * @returns {Promise<object>} Sanitized attempt session
 */
export async function startSubjectAssessment(userId) {
  // 1. Fetch teacher profile
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw validationError("Teacher profile not found. Please start onboarding first.");
  }

  const openToSubjects = Array.isArray(profile.openToSubjects)
    ? profile.openToSubjects
    : [];
  const openToClasses = Array.isArray(profile.openToClasses)
    ? profile.openToClasses
    : [];
  const openToBoard = profile.openToBoard || "NEUTRAL";

  // Guard: Must have openToSubjects and openToClasses set
  if (openToSubjects.length === 0 || openToClasses.length === 0) {
    throw validationError("Set the subjects and classes you're open to teaching on the Availability step first.");
  }

  // 2. Strict single lifetime attempt
  const existingSubmitted = await prisma.subjectAttempt.findFirst({
    where: {
      userId,
      status: "SUBMITTED",
    },
    orderBy: { submittedAt: "desc" },
  });

  if (existingSubmitted) {
    throw conflictError("You have already completed the subject knowledge assessment.");
  }

  // 3. Resume in-progress attempt if exists
  const existingInProgress = await prisma.subjectAttempt.findFirst({
    where: {
      userId,
      status: "IN_PROGRESS",
    },
    orderBy: { startedAt: "desc" },
  });

  if (existingInProgress && Array.isArray(existingInProgress.questionOrder)) {
    const rawQuestions = await prisma.subjectQuestion.findMany({
      where: {
        id: { in: existingInProgress.questionOrder },
      },
    });

    const questionMap = new Map(rawQuestions.map((q) => [q.id, q]));
    const orderedQuestions = existingInProgress.questionOrder
      .map((id) => questionMap.get(id))
      .filter(Boolean);

    const sanitizedQuestions = orderedQuestions.map((q) => {
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const order = existingInProgress.optionOrders?.[q.id] || rawOptions.map((o) => o.key);
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
        subject: q.subject,
        subjectLabel: SUBJECT_LABELS[q.subject] || q.subject,
        classLevel: q.classLevel,
        topic: q.topic,
        type: q.type,
        prompt: q.prompt,
        options: sanitizedOptions,
      };
    });

    const blueprintSummary = summarizeBlueprint(existingInProgress.blueprint);

    return {
      attemptId: existingInProgress.id,
      durationMinutes: TIMING.durationMinutes,
      softPerQuestionSeconds: TIMING.softPerQuestionSeconds,
      hardPerQuestion: TIMING.hardPerQuestion,
      blueprintSummary,
      questions: sanitizedQuestions,
    };
  }

  // 4. Generate new attempt
  const blueprint = buildBlueprint(openToSubjects, openToClasses);
  if (blueprint.length === 0) {
    throw validationError("Unable to build test blueprint. Please check your subject and class preferences.");
  }

  // Fetch pool of candidate questions from DB
  const candidateQuestions = await prisma.subjectQuestion.findMany({
    where: {
      subject: { in: openToSubjects },
      isActive: true,
    },
  });

  if (!candidateQuestions || candidateQuestions.length === 0) {
    throw validationError("No active subject assessment questions found for your selected subjects.");
  }

  const { selectedQuestions, realizedBlueprint, optionOrders } = selectQuestions(
    blueprint,
    candidateQuestions,
    openToBoard
  );

  if (selectedQuestions.length === 0) {
    throw validationError("No questions could be drawn for your configured subjects and classes.");
  }

  // Persist attempt
  const attempt = await prisma.subjectAttempt.create({
    data: {
      userId,
      status: "IN_PROGRESS",
      blueprint: realizedBlueprint,
      questionOrder: selectedQuestions.map((q) => q.id),
      optionOrders,
    },
  });

  // Prepare sanitized response
  const sanitizedQuestions = selectedQuestions.map((q) => {
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
      subject: q.subject,
      subjectLabel: SUBJECT_LABELS[q.subject] || q.subject,
      classLevel: q.classLevel,
      topic: q.topic,
      type: q.type,
      prompt: q.prompt,
      options: sanitizedOptions,
    };
  });

  const blueprintSummary = summarizeBlueprint(realizedBlueprint);

  return {
    attemptId: attempt.id,
    durationMinutes: TIMING.durationMinutes,
    softPerQuestionSeconds: TIMING.softPerQuestionSeconds,
    hardPerQuestion: TIMING.hardPerQuestion,
    blueprintSummary,
    questions: sanitizedQuestions,
  };
}

/**
 * Summarize realized blueprint into subject-level count overview
 * e.g. [{ subject: "MATH", label: "Mathematics", count: 15 }, ...]
 */
function summarizeBlueprint(blueprint = []) {
  if (!Array.isArray(blueprint)) return [];
  const map = new Map();
  for (const item of blueprint) {
    const s = item.subject;
    const c = item.count || 0;
    map.set(s, (map.get(s) || 0) + c);
  }
  return Array.from(map.entries()).map(([subject, count]) => ({
    subject,
    label: SUBJECT_LABELS[subject] || subject,
    count,
  }));
}

/**
 * Submit a Subject Knowledge Assessment attempt
 * @param {string} userId
 * @param {object} input
 * @returns {Promise<object>} { result, profile }
 */
export async function submitSubjectAssessment(userId, input = {}) {
  const { attemptId, responses, durationSec, perQuestionMs } = input;

  if (!attemptId) {
    throw validationError("Attempt ID is required.");
  }

  const attempt = await prisma.subjectAttempt.findUnique({
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
        sectionScores: attempt.sectionScores,
        flags: attempt.flags,
        submittedAt: attempt.submittedAt,
        durationSec: attempt.durationSec,
      },
      profile: serializeProfile(profile),
    };
  }

  // Reject with 409 if another distinct attempt for this user was already submitted
  const priorSubmitted = await prisma.subjectAttempt.findFirst({
    where: {
      userId,
      status: "SUBMITTED",
      id: { not: attemptId },
    },
  });

  if (priorSubmitted) {
    throw conflictError("You have already completed the subject knowledge assessment.");
  }

  // Load questions by attempt.questionOrder
  const rawQuestions = await prisma.subjectQuestion.findMany({
    where: { id: { in: attempt.questionOrder } },
  });

  const questionMap = new Map(rawQuestions.map((q) => [q.id, q]));
  const questions = attempt.questionOrder.map((id) => questionMap.get(id)).filter(Boolean);

  // Score the attempt
  const scoreResult = scoreSubjectAttempt(questions, responses || {});

  // Anti-gaming analysis
  const antiGamingFlags = [];
  const safeDurationSec = typeof durationSec === "number" ? durationSec : 0;
  if (safeDurationSec > 0 && safeDurationSec < 300) {
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
  await prisma.subjectAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      responses: responses || {},
      sectionScores: scoreResult.sectionScores,
      overallScore: scoreResult.overallScore,
      band: scoreResult.band,
      flags: combinedFlags,
      durationSec: safeDurationSec,
      perQuestionMs: perQuestionMs || {},
      submittedAt,
    },
  });

  // Mark subjectAssessmentCompleted in TeacherProfile and sync composite skillAssessmentCompleted
  let updatedProfile;
  try {
    await prisma.teacherProfile.update({
      where: { userId },
      data: { subjectAssessmentCompleted: true },
    });
    await syncSkillAssessmentFlag(userId);
    updatedProfile = await prisma.teacherProfile.findUnique({ where: { userId } });

    // Auto-recompute holistic score
    try {
      const { computeAndStoreHolistic } = await import("./holisticScore.service.js");
      await computeAndStoreHolistic(userId);
    } catch (holisticErr) {
      console.warn("Could not auto-recompute holistic score after subject submit:", holisticErr.message);
    }
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
 * Get latest submitted subject assessment result for user
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getSubjectResult(userId) {
  const attempt = await prisma.subjectAttempt.findFirst({
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
    sectionScores: attempt.sectionScores,
    flags: attempt.flags,
    submittedAt: attempt.submittedAt,
    durationSec: attempt.durationSec,
  };
}

/**
 * Get or assign dynamic topics for Demo Class based on highest open class per subject
 * @param {string} userId
 * @returns {Promise<{ assignedTopics: Array<{ subject: string, subjectLabel: string, classLevel: number, topic: string }> }>}
 */
export async function getSubjectAssignedTopics(userId) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw validationError("Teacher profile not found.");
  }

  // If already assigned and persisted, return stored topics
  if (Array.isArray(profile.demoAssignedTopics) && profile.demoAssignedTopics.length > 0) {
    return { assignedTopics: profile.demoAssignedTopics };
  }

  let openToSubjects = Array.isArray(profile.openToSubjects) ? profile.openToSubjects : [];
  let openToClasses = Array.isArray(profile.openToClasses) ? profile.openToClasses : [];
  const openToBoard = profile.openToBoard || "NEUTRAL";

  // Fallback to subjects / classesTaught if openTo not set yet
  if (openToSubjects.length === 0 && profile.subjects) {
    const s = Array.isArray(profile.subjects) ? profile.subjects : [profile.subjects];
    openToSubjects = s.map((sub) => String(sub).trim().toUpperCase()).filter((sub) => SUBJECTS.includes(sub));
  }
  if (openToClasses.length === 0 && profile.classesTaught) {
    const c = Array.isArray(profile.classesTaught) ? profile.classesTaught : [profile.classesTaught];
    openToClasses = c.map((num) => parseInt(String(num).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n) && n >= 6 && n <= 10);
  }

  if (openToSubjects.length === 0 || openToClasses.length === 0) {
    return { assignedTopics: [] };
  }

  const highestClass = Math.max(...openToClasses);
  const assignedTopics = [];

  for (const subject of openToSubjects) {
    // Find active questions for (subject, highestClass, board)
    const questions = await prisma.subjectQuestion.findMany({
      where: {
        subject,
        classLevel: highestClass,
        isActive: true,
        OR: [
          { board: openToBoard },
          { board: "NEUTRAL" },
        ],
      },
      select: { topic: true },
    });

    const uniqueTopics = [...new Set(questions.map((q) => q.topic).filter(Boolean))];
    let selectedTopic = "General Classroom Demonstration";
    if (uniqueTopics.length > 0) {
      // Pick random topic from available
      const idx = Math.floor(Math.random() * uniqueTopics.length);
      selectedTopic = uniqueTopics[idx];
    }

    assignedTopics.push({
      subject,
      subjectLabel: SUBJECT_LABELS[subject] || subject,
      classLevel: highestClass,
      topic: selectedTopic,
    });
  }

  // Persist on profile so they don't reshuffle
  if (assignedTopics.length > 0) {
    await prisma.teacherProfile.update({
      where: { userId },
      data: { demoAssignedTopics: assignedTopics },
    });
  }

  return { assignedTopics };
}
