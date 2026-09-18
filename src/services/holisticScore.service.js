import { prisma } from "../../lib/prisma.js";
import { computeExperienceScore } from "./experienceScoring.js";
import { computeHolisticScore } from "./holisticScoring.js";

/**
 * Loads all candidate assessment results, calculates experience and holistic score,
 * and persists the results to the TeacherProfile table.
 */
export async function computeAndStoreHolistic(userId) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const error = new Error("Teacher profile not found");
    error.statusCode = 404;
    throw error;
  }

  // 1. Latest submitted Pedagogy Attempt
  const latestPedagogy = await prisma.pedagogyAttempt.findFirst({
    where: { userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
  });

  // 2. Latest submitted Subject Attempt
  const latestSubject = await prisma.subjectAttempt.findFirst({
    where: { userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
  });

  // 3. Demo Evaluation
  const demoEval = await prisma.demoEvaluation.findUnique({
    where: { userId },
  });

  // 4. Live Experience Score from Profile
  const expResult = computeExperienceScore(profile);

  // Prepare input objects for holistic engine
  const pedagogyInput = latestPedagogy
    ? {
        score: latestPedagogy.overallScore ?? 0,
        band: latestPedagogy.band,
        details: {
          sectionScores: latestPedagogy.sectionScores,
          flags: latestPedagogy.flags,
        },
      }
    : null;

  const subjectInput = latestSubject
    ? {
        score: latestSubject.overallScore ?? 0,
        band: latestSubject.band,
        details: {
          sectionScores: latestSubject.sectionScores,
          flags: latestSubject.flags,
        },
      }
    : null;

  const demoInput = demoEval
    ? {
        score: demoEval.demoScore ?? 0,
        band: demoEval.band,
        status: demoEval.status,
        completions: demoEval.completions,
        subScores: demoEval.subScores,
        flags: demoEval.flags,
        extractionMode: demoEval.extractionMode,
      }
    : null;

  const experienceInput = {
    score: expResult.score,
    breakdown: expResult.breakdown,
  };

  // Run holistic scoring engine
  const holistic = computeHolisticScore({
    pedagogy: pedagogyInput,
    subject: subjectInput,
    demo: demoInput,
    experience: experienceInput,
  });

  // Persist score, band, breakdown and timestamp to TeacherProfile
  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: {
      holisticScore: holistic.holisticScore,
      holisticBand: holistic.band,
      holisticBreakdown: holistic,
      holisticComputedAt: new Date(),
    },
  });

  return {
    holisticScore: holistic.holisticScore,
    holisticBand: holistic.band,
    breakdown: holistic,
    computedAt: updated.holisticComputedAt,
  };
}

/**
 * Returns the stored holistic score breakdown for a teacher.
 * Computes live if not yet generated.
 */
export async function getHolisticScore(userId) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: {
      holisticScore: true,
      holisticBand: true,
      holisticBreakdown: true,
      holisticComputedAt: true,
    },
  });

  if (profile?.holisticBreakdown && profile?.holisticScore != null) {
    return {
      holisticScore: profile.holisticScore,
      holisticBand: profile.holisticBand,
      breakdown: profile.holisticBreakdown,
      computedAt: profile.holisticComputedAt,
    };
  }

  return await computeAndStoreHolistic(userId);
}
