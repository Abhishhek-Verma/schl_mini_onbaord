import { prisma } from "../../lib/prisma.js";
import { getTranscript } from "./demoTranscript.js";
import { extractFacts } from "./demoExtraction.js";
import { scoreDemo } from "./demoScoring.js";

/**
 * Enqueues or resets a DemoEvaluation job for a teacher.
 */
export async function enqueueDemoEvaluation(userId, videoUrl, videoId, assignedTopics = []) {
  const normalizedTopics = Array.isArray(assignedTopics)
    ? assignedTopics
    : typeof assignedTopics === "object" && assignedTopics !== null
    ? [assignedTopics]
    : [];

  const evaluation = await prisma.demoEvaluation.upsert({
    where: { userId },
    create: {
      userId,
      videoUrl,
      videoId,
      assignedTopics: normalizedTopics,
      status: "PENDING",
      errorMessage: null,
    },
    update: {
      videoUrl,
      videoId,
      assignedTopics: normalizedTopics,
      status: "PENDING",
      transcriptSource: null,
      transcript: null,
      facts: null,
      subScores: null,
      demoScore: null,
      band: null,
      completions: null,
      flags: null,
      errorMessage: null,
      processedAt: null,
    },
  });

  // Trigger background runner asynchronously
  setImmediate(() => {
    runDemoEvaluationJob(evaluation.id).catch((err) => {
      console.error(`Background demo evaluation failed for ID ${evaluation.id}:`, err);
    });
  });

  return evaluation;
}

/**
 * Durable execution runner for a DemoEvaluation.
 * Transitions: PENDING -> PROCESSING -> PROCESSED (or FAILED).
 */
export async function runDemoEvaluationJob(evaluationId, options = {}) {
  const evalRow = await prisma.demoEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      user: {
        include: {
          teacherProfile: true,
        },
      },
    },
  });

  if (!evalRow) {
    console.error(`Demo evaluation ${evaluationId} not found.`);
    return;
  }

  // Set status to PROCESSING
  await prisma.demoEvaluation.update({
    where: { id: evaluationId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const videoId = evalRow.videoId;
    if (!videoId) {
      throw new Error("Missing YouTube video ID.");
    }

    // Step 1: Acquire Transcript (captions first, audio fallback)
    const transcriptData = await getTranscript(videoId, options);
    const { transcript, durationSec, transcriptSource } = transcriptData;

    await prisma.demoEvaluation.update({
      where: { id: evaluationId },
      data: {
        transcript,
        transcriptSource,
      },
    });

    // Step 2: AI Fact Extraction (facts only, strict JSON)
    const teacherProfile = evalRow.user?.teacherProfile;
    const metadata = {
      durationSec,
      subject: Array.isArray(teacherProfile?.subjects) ? teacherProfile.subjects.join(", ") : "General",
      classLevel: Array.isArray(teacherProfile?.classesTaught) ? teacherProfile.classesTaught.join(", ") : "All",
    };

    const facts = await extractFacts(transcript, evalRow.assignedTopics, metadata);

    // Step 3: Pure Deterministic Scoring
    const scoringResult = scoreDemo(facts, durationSec);
    const { demoScore, band, subScores, completions, flags } = scoringResult;

    // Step 4: Persist Results
    await prisma.$transaction([
      prisma.demoEvaluation.update({
        where: { id: evaluationId },
        data: {
          status: "PROCESSED",
          facts,
          subScores,
          demoScore,
          band,
          completions,
          flags,
          errorMessage: null,
          processedAt: new Date(),
        },
      }),
      prisma.teacherProfile.update({
        where: { userId: evalRow.userId },
        data: {
          demoEvaluationCompleted: true,
        },
      }),
    ]);

    console.log(`Demo evaluation ${evaluationId} processed successfully with score: ${demoScore} (${band})`);
    return { success: true, demoScore, band };
  } catch (err) {
    console.error(`Error processing demo evaluation ${evaluationId}:`, err.message);

    await prisma.$transaction([
      prisma.demoEvaluation.update({
        where: { id: evaluationId },
        data: {
          status: "FAILED",
          errorMessage: err.message || "Evaluation processing failed.",
          processedAt: new Date(),
        },
      }),
      prisma.teacherProfile.update({
        where: { userId: evalRow.userId },
        data: {
          demoEvaluationCompleted: false,
        },
      }),
    ]);

    return { success: false, error: err.message };
  }
}

/**
 * Recomputes demo evaluation score from stored facts without re-calling AI or re-transcribing.
 */
export async function recomputeDemoEvaluation(userId) {
  const evalRow = await prisma.demoEvaluation.findUnique({
    where: { userId },
  });

  if (!evalRow) {
    const error = new Error("Demo evaluation record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!evalRow.facts) {
    const error = new Error("Cannot recompute: No facts found for this evaluation.");
    error.statusCode = 400;
    throw error;
  }

  const scoringResult = scoreDemo(evalRow.facts);
  const { demoScore, band, subScores, completions, flags } = scoringResult;

  const updated = await prisma.demoEvaluation.update({
    where: { userId },
    data: {
      subScores,
      demoScore,
      band,
      completions,
      flags,
      updatedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Retrieves the demo evaluation record for a user.
 */
export async function getDemoEvaluation(userId) {
  const evalRow = await prisma.demoEvaluation.findUnique({
    where: { userId },
  });
  return evalRow;
}
