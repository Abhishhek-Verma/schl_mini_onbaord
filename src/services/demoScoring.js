import { DEMO_WEIGHTS, COMPLETES, DEMO, scoreToDemoBand } from "../config/demoEvaluation.js";

/**
 * Pure function to deterministically compute subScores, overall demoScore,
 * band, completion pairings, and review flags from extracted facts.
 *
 * @param {Object} facts - Strict JSON facts extracted from lesson transcript
 * @param {number} durationSec - Total duration of the demo in seconds
 * @returns {Object} { demoScore, band, subScores, completions, flags }
 */
export function scoreDemo(facts = {}, durationSec = 420) {
  // 1. Subject Delivery (Topic coverage: FULL=1, PARTIAL=0.5, NONE=0)
  // Concept accuracy is flagged only, never deducted here.
  let subjectDelivery = 100;
  const coverage = facts.topicCoverage || [];
  if (coverage.length > 0) {
    const totalPoints = coverage.reduce((sum, item) => {
      if (item.covered === "FULL") return sum + 1.0;
      if (item.covered === "PARTIAL") return sum + 0.5;
      return sum;
    }, 0);
    subjectDelivery = (totalPoints / coverage.length) * 100;
  }
  subjectDelivery = Math.max(0, Math.min(100, Math.round(subjectDelivery * 10) / 10));

  // 2. Structure (25 per present element of explanationStructure)
  const es = facts.explanationStructure || {};
  let structurePoints = 0;
  if (es.intro) structurePoints += 25;
  if (es.explanation) structurePoints += 25;
  if (es.example) structurePoints += 25;
  if (es.checkUnderstanding) structurePoints += 25;
  const structure = Math.min(100, structurePoints);

  // 3. Clarity (100 minus filler-rate penalty, dead-air penalty, and out-of-band WPM)
  const clarityFacts = facts.clarity || {};
  const totalWords = Math.max(1, clarityFacts.totalWords || 0);
  const fillerWords = clarityFacts.fillerWords || 0;
  const fillerRate = fillerWords / totalWords;
  const longestDeadAirSec = clarityFacts.longestDeadAirSec || 0;
  const wordsPerMinute = clarityFacts.wordsPerMinute || 130;

  let clarityPenalties = 0;
  if (fillerRate > DEMO.fillerRatePenaltyStart) {
    clarityPenalties += Math.min(35, (fillerRate - DEMO.fillerRatePenaltyStart) * 400);
  }
  if (longestDeadAirSec > DEMO.deadAirSecondsPenaltyStart) {
    clarityPenalties += Math.min(30, (longestDeadAirSec - DEMO.deadAirSecondsPenaltyStart) * 3);
  }
  if (wordsPerMinute < 90) {
    clarityPenalties += Math.min(25, (90 - wordsPerMinute) * 0.5);
  } else if (wordsPerMinute > 200) {
    clarityPenalties += Math.min(25, (wordsPerMinute - 200) * 0.4);
  }
  const clarity = Math.max(0, Math.min(100, Math.round((100 - clarityPenalties) * 10) / 10));

  // 4. Engagement Proxy (from questioning.count & exampleUsage.count vs thresholds)
  const qCount = facts.questioning?.count || 0;
  const exCount = facts.exampleUsage?.count || 0;
  // Thresholds: >= 3 questions -> 50 pts, >= 2 examples -> 50 pts
  const questionScore = Math.min(50, (qCount / 3) * 50);
  const exampleScore = Math.min(50, (exCount / 2) * 50);
  const engagementProxy = Math.max(0, Math.min(100, Math.round((questionScore + exampleScore) * 10) / 10));

  // 5. Professionalism Proxy (target duration, mediaUsable, language appropriate)
  const minTargetSec = DEMO.targetMinMinutes * 60; // 360s
  const maxTargetSec = DEMO.targetMaxMinutes * 60; // 480s
  let profScore = 100;

  if (durationSec < minTargetSec) {
    const minUnder = (minTargetSec - durationSec) / 60;
    profScore -= minUnder * 12; // 12 pts per minute under 6 min
  } else if (durationSec > maxTargetSec) {
    const minOver = (durationSec - maxTargetSec) / 60;
    profScore -= minOver * 8; // 8 pts per minute over 8 min
  }

  profScore = Math.max(40, profScore);

  // Caps for unusable media or inappropriate language
  if (facts.mediaUsable === false) {
    profScore = Math.min(30, profScore);
  }
  if (facts.language?.appropriate === false) {
    profScore = Math.min(20, profScore);
  }
  if (facts.offTopic === true) {
    profScore = Math.min(30, profScore);
  }
  const professionalismProxy = Math.max(0, Math.min(100, Math.round(profScore * 10) / 10));

  const subScores = {
    subjectDelivery,
    clarity,
    structure,
    engagementProxy,      // PROXY
    professionalismProxy, // PROXY
  };

  // Weighted overall score
  const rawScore =
    subScores.subjectDelivery * DEMO_WEIGHTS.subjectDelivery +
    subScores.clarity * DEMO_WEIGHTS.clarity +
    subScores.structure * DEMO_WEIGHTS.structure +
    subScores.engagementProxy * DEMO_WEIGHTS.engagementProxy +
    subScores.professionalismProxy * DEMO_WEIGHTS.professionalismProxy;

  const demoScore = Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
  const band = scoreToDemoBand(demoScore);

  // Completion pairing
  // subjectDeliveryPct = subjectDelivery
  // pedagogyExecutionPct = weighted average of COMPLETES.pedagogy sub-scores
  const pedSubKeys = COMPLETES.pedagogy; // ["structure", "engagementProxy", "clarity"]
  const pedSubTotal = pedSubKeys.reduce((sum, key) => sum + (subScores[key] || 0), 0);
  const pedagogyExecutionPct = Math.round((pedSubTotal / pedSubKeys.length) * 10) / 10;

  const completions = {
    subjectDeliveryPct: subjectDelivery,
    pedagogyExecutionPct,
  };

  // Flags generation (review these — concept errors are flags only, not deductions)
  const flags = [];

  // Concept accuracy flags (MEDIUM or HIGH confidence)
  if (Array.isArray(facts.conceptAccuracy)) {
    for (const ca of facts.conceptAccuracy) {
      if (ca.confidence === "MEDIUM" || ca.confidence === "HIGH") {
        flags.push({
          type: "CONCEPT_ACCURACY_ISSUE",
          detail: ca.issue || "Potential conceptual inconsistency flagged for review.",
          evidence: ca.evidence || ca.statement || "",
          severity: ca.confidence,
        });
      }
    }
  }

  // Media unusable
  if (facts.mediaUsable === false) {
    flags.push({
      type: "MEDIA_UNUSABLE",
      detail: "Video media or audio stream was flagged as degraded or unusable.",
      evidence: "Media analysis check failed.",
      severity: "HIGH",
    });
  }

  // Off-topic
  if (facts.offTopic === true) {
    flags.push({
      type: "OFF_TOPIC",
      detail: "Lesson content was flagged as substantially divergent from assigned curriculum topics.",
      evidence: "Topic divergence detected.",
      severity: "HIGH",
    });
  }

  // None-covered topics
  for (const tc of coverage) {
    if (tc.covered === "NONE") {
      flags.push({
        type: "TOPIC_NOT_COVERED",
        detail: `Assigned topic "${tc.topic}" was not covered in the demo lesson.`,
        evidence: tc.evidence || "No topic reference located in transcript.",
        severity: "MEDIUM",
      });
    }
  }

  return {
    demoScore,
    band,
    subScores,
    completions,
    flags,
  };
}

/**
 * Pure helper to recompute demo score and flags from already-stored facts.
 * Useful when scoring weights change without requiring re-transcription or re-calling AI.
 */
export function recomputeDemoScoreFromFacts(facts, durationSec = 420) {
  return scoreDemo(facts, durationSec);
}
