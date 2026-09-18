/**
 * Selection formats:
 * MCQ            selected = "B"                (single option key)
 * MSQ            selected = ["A","B","D"]      (array of keys, order irrelevant)
 * SJT            selected = ["A","D","B","C"]  (full ranking, best->worst)
 * CASE (part)    selected = "B"                (single key, one per part)
 */

import {
  SECTION_WEIGHTS,
  SECTION_ORDER,
  SECTION_LABELS,
  SECTION_MIN_THRESHOLD,
  scoreToBand,
} from "../config/pedagogy.js";

/**
 * Score a single Multiple Choice Question (quality-weighted options)
 * @param {object} question
 * @param {string} selectedKey
 * @returns {number} Score in [0, 1]
 */
export function scoreMCQ(question, selectedKey) {
  if (!question || typeof selectedKey !== "string") return 0;
  const options = Array.isArray(question.options) ? question.options : [];
  const matched = options.find((opt) => opt && opt.key === selectedKey);
  if (!matched || typeof matched.score !== "number") return 0;
  return Math.max(0, Math.min(1, matched.score));
}

/**
 * Score a Multiple Select Question
 * formula: Math.max(0, (correctSelected - incorrectSelected) / totalCorrect)
 * @param {object} question
 * @param {string[]} selectedKeys
 * @returns {number} Score in [0, 1]
 */
export function scoreMSQ(question, selectedKeys) {
  if (!question || !Array.isArray(selectedKeys)) return 0;
  const options = Array.isArray(question.options) ? question.options : [];
  const correctOptions = options.filter((opt) => opt && opt.correct === true);
  const totalCorrect = correctOptions.length;
  if (totalCorrect === 0) return 0;

  const correctKeySet = new Set(correctOptions.map((opt) => opt.key));
  const uniqueSelected = Array.from(new Set(selectedKeys));

  let correctSelected = 0;
  let incorrectSelected = 0;

  for (const key of uniqueSelected) {
    if (correctKeySet.has(key)) {
      correctSelected++;
    } else {
      incorrectSelected++;
    }
  }

  const raw = (correctSelected - incorrectSelected) / totalCorrect;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Score a Situational Judgment Question (Rank-Order)
 * formula: 1 - (distance / maxDistance)
 * distance = sum(|candidatePos(key) - expertPos(key)|)
 * @param {object} question
 * @param {string[]} ranking
 * @returns {number} Score in [0, 1]
 */
export function scoreSJT(question, ranking) {
  if (!question || !Array.isArray(ranking)) return 0;
  const expertRanking = Array.isArray(question.expertRanking) ? question.expertRanking : [];
  const N = expertRanking.length;
  if (N === 0 || ranking.length !== N) return 0;

  // Verify that ranking contains exactly all keys in expertRanking
  const rankingSet = new Set(ranking);
  if (rankingSet.size !== N || expertRanking.some((key) => !rankingSet.has(key))) {
    return 0;
  }

  const candidatePos = new Map();
  ranking.forEach((key, idx) => candidatePos.set(key, idx));

  const expertPos = new Map();
  expertRanking.forEach((key, idx) => expertPos.set(key, idx));

  let distance = 0;
  for (const key of expertRanking) {
    distance += Math.abs(candidatePos.get(key) - expertPos.get(key));
  }

  const maxDistance =
    typeof question.maxDistance === "number" && question.maxDistance > 0
      ? question.maxDistance
      : Math.floor((N * N) / 2);

  if (maxDistance <= 0) return 0;
  const score = 1 - distance / maxDistance;
  return Math.max(0, Math.min(1, score));
}

/**
 * Score a linked CASE group
 * Sums MCQ part scores and evaluates orientation consistency for coherence bonus
 * @param {object[]} parts - Array of parts sharing a caseGroup, sorted by casePart
 * @param {Record<string, any>} responsesByQuestionId - Map of questionId -> selection
 * @returns {{ raw: number, max: number }}
 */
export function scoreCaseGroup(parts, responsesByQuestionId = {}) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { raw: 0, max: 0 };
  }

  // Find coherence bonus from any part that defines it
  const coherenceBonus =
    parts.find((p) => typeof p.coherenceBonus === "number" && p.coherenceBonus > 0)?.coherenceBonus || 0;

  let rawPartSum = 0;
  const selectedOrientations = [];

  for (const part of parts) {
    const selected = responsesByQuestionId[part.id];
    rawPartSum += scoreMCQ(part, selected);

    const options = Array.isArray(part.options) ? part.options : [];
    const matchedOption = options.find((opt) => opt && opt.key === selected);
    if (matchedOption && typeof matchedOption.orientation === "string" && matchedOption.orientation.trim()) {
      selectedOrientations.push(matchedOption.orientation.trim());
    } else {
      selectedOrientations.push(null);
    }
  }

  const allPartsHaveOrientation =
    selectedOrientations.length === parts.length && selectedOrientations.every((o) => typeof o === "string" && o.length > 0);

  const isCoherent =
    allPartsHaveOrientation &&
    selectedOrientations.every((o) => o === selectedOrientations[0]);

  const raw = rawPartSum + (isCoherent ? coherenceBonus : 0);
  const max = parts.length + coherenceBonus;

  return { raw, max };
}

/**
 * Score an entire attempt
 * @param {object[]} questions - Full question records for this attempt
 * @param {Record<string, any>} responses - { questionId: selection }
 * @returns {object} Aggregated attempt scores, band, flags
 */
export function scoreAttempt(questions = [], responses = {}) {
  const safeResponses = responses && typeof responses === "object" ? responses : {};
  const flags = [];

  // Group questions by section
  const sectionQuestionsMap = new Map();
  for (const sec of SECTION_ORDER) {
    sectionQuestionsMap.set(sec, []);
  }

  for (const q of questions) {
    if (!q || !q.section) continue;
    if (!sectionQuestionsMap.has(q.section)) {
      sectionQuestionsMap.set(q.section, []);
    }
    sectionQuestionsMap.get(q.section).push(q);
  }

  const sectionScores = {};

  for (const sec of SECTION_ORDER) {
    const secQuestions = sectionQuestionsMap.get(sec) || [];
    let secRaw = 0;
    let secMax = 0;
    const secFlags = [];

    // Separate CASE questions by caseGroup
    const caseGroups = new Map();
    const standardQuestions = [];

    for (const q of secQuestions) {
      if (q.type === "CASE" && q.caseGroup) {
        if (!caseGroups.has(q.caseGroup)) {
          caseGroups.set(q.caseGroup, []);
        }
        caseGroups.get(q.caseGroup).push(q);
      } else {
        standardQuestions.push(q);
      }
    }

    // Score standard questions
    for (const q of standardQuestions) {
      const response = safeResponses[q.id];
      secMax += 1;

      switch (q.type) {
        case "MCQ":
        case "CASE": // fallback if standalone CASE
          secRaw += scoreMCQ(q, response);
          break;
        case "MSQ":
          secRaw += scoreMSQ(q, response);
          break;
        case "SJT":
          secRaw += scoreSJT(q, response);
          break;
        default:
          flags.push({
            type: "UNKNOWN_QUESTION_TYPE",
            questionId: q.id,
            questionType: q.type,
          });
          break;
      }
    }

    // Score case groups
    for (const [_, parts] of caseGroups.entries()) {
      parts.sort((a, b) => (a.casePart || 0) - (b.casePart || 0));
      const groupScore = scoreCaseGroup(parts, safeResponses);
      secRaw += groupScore.raw;
      secMax += groupScore.max;
    }

    // Calculate normalized percentage (0..100)
    const normalized = secMax > 0 ? Number(((secRaw / secMax) * 100).toFixed(1)) : 0;
    const weight = SECTION_WEIGHTS[sec] ?? 0;
    const weightedRaw = normalized * weight;
    const weighted = Number(weightedRaw.toFixed(1));

    if (secMax > 0 && normalized < SECTION_MIN_THRESHOLD) {
      const belowMinFlag = {
        type: "SECTION_BELOW_MIN",
        section: sec,
        normalized,
      };
      secFlags.push(belowMinFlag);
      flags.push(belowMinFlag);
    }

    sectionScores[sec] = {
      raw: Number(secRaw.toFixed(2)),
      max: Number(secMax.toFixed(2)),
      normalized,
      weight,
      weighted,
      weightedRaw,
      label: SECTION_LABELS[sec] || sec,
      flags: secFlags,
    };
  }

  // Overall score is sum of unrounded weighted section scores, rounded once at the end
  const sumOfWeightedRaw = Object.values(sectionScores).reduce(
    (acc, curr) => acc + (curr.weightedRaw ?? 0),
    0
  );
  const overallScore = Number(sumOfWeightedRaw.toFixed(1));

  // Clean up internal weightedRaw before returning
  for (const sec of Object.keys(sectionScores)) {
    delete sectionScores[sec].weightedRaw;
  }

  const band = scoreToBand(overallScore);
  const sectionMinMet = flags.every((f) => f.type !== "SECTION_BELOW_MIN");

  return {
    overallScore,
    band,
    sectionMinMet,
    sectionScores,
    flags,
  };
}
