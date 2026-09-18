import { prisma } from "../../lib/prisma.js";
import { getTranscript } from "./demoTranscript.js";
import { extractFacts } from "./demoExtraction.js";
import { scoreDemo } from "./demoScoring.js";

const activeEvaluationJobs = new Set();

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
      extractionMode: null,
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
  if (activeEvaluationJobs.has(evaluationId)) {
    console.log(`Evaluation ${evaluationId} is already running in-memory. Skipping.`);
    return;
  }

  activeEvaluationJobs.add(evaluationId);

  try {
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
    const extractionMode = facts?.extractionMode || "SIMULATED";

    // Fix 1 Hardening: In production, simulated evaluations must NEVER masquerade as real scores.
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && extractionMode === "SIMULATED") {
      const errorMsg = "AI evaluation not configured — set a valid OPENAI_API_KEY.";
      await prisma.$transaction([
        prisma.demoEvaluation.update({
          where: { id: evaluationId },
          data: {
            status: "FAILED",
            extractionMode,
            facts,
            errorMessage: errorMsg,
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
      return { success: false, error: errorMsg };
    }

    // Step 3: Pure Deterministic Scoring
    const scoringResult = scoreDemo(facts, durationSec);
    const { demoScore, band, subScores, completions, flags } = scoringResult;

    // Step 4: Persist Results
    await prisma.$transaction([
      prisma.demoEvaluation.update({
        where: { id: evaluationId },
        data: {
          status: "PROCESSED",
          extractionMode,
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

    // Auto-recompute holistic score if module is loaded
    try {
      const { computeAndStoreHolistic } = await import("./holisticScore.service.js");
      await computeAndStoreHolistic(evalRow.userId);
    } catch {
      // Best effort until holistic module completes
    }

    console.log(`Demo evaluation ${evaluationId} processed successfully with score: ${demoScore} (${band}) [mode: ${extractionMode}]`);
    return { success: true, demoScore, band, extractionMode };
  } catch (err) {
    console.error(`Error processing demo evaluation ${evaluationId}:`, err.message);

    try {
      const current = await prisma.demoEvaluation.findUnique({
        where: { id: evaluationId },
        select: { userId: true },
      });

      if (current) {
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
            where: { userId: current.userId },
            data: {
              demoEvaluationCompleted: false,
            },
          }),
        ]);
      }
    } catch (dbErr) {
      console.error("Failed to mark evaluation as FAILED:", dbErr.message);
    }

    return { success: false, error: err.message };
  } finally {
    activeEvaluationJobs.delete(evaluationId);
  }
}

/**
 * Fix 2 Hardening: Recover stranded jobs on startup or periodic sweep.
 * Finds PENDING jobs, or PROCESSING jobs stuck for > 15 minutes.
 */
export async function recoverStrandedJobs() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stranded = await prisma.demoEvaluation.findMany({
      where: {
        OR: [
          { status: "PENDING" },
          { status: "PROCESSING", updatedAt: { lt: fifteenMinutesAgo } },
        ],
      },
      select: { id: true, status: true },
    });

    let recoveredCount = 0;
    for (const job of stranded) {
      if (!activeEvaluationJobs.has(job.id)) {
        recoveredCount++;
        console.log(`[DemoEval Recovery] Resuming stranded job ${job.id} (status: ${job.status})`);
        runDemoEvaluationJob(job.id).catch((err) => {
          console.error(`[DemoEval Recovery] Job ${job.id} failed:`, err.message);
        });
      }
    }
    return recoveredCount;
  } catch (err) {
    console.error("[DemoEval Recovery] Error recovering stranded jobs:", err.message);
    return 0;
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
