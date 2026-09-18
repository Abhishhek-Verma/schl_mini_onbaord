import { GEN, SUBJECTS, BOARDS, scoreToSubjectBand } from "../config/subjectAssessment.js";
import { scoreMCQ, scoreMSQ } from "./pedagogyScoring.js";

/**
 * Fisher-Yates shuffle helper
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build blueprint for test generation based on openToSubjects and openToClasses
 * @param {string[]} openToSubjects - e.g. ["MATH", "SCIENCE"]
 * @param {number[]} openToClasses - e.g. [6, 7, 8, 9, 10]
 * @returns {Array<{ subject: string, classLevel: number, count: number }>}
 */
export function buildBlueprint(openToSubjects = [], openToClasses = []) {
  const subjects = Array.isArray(openToSubjects)
    ? openToSubjects.filter((s) => SUBJECTS.includes(s))
    : [];
  const classes = Array.isArray(openToClasses)
    ? [...new Set(openToClasses.map(Number).filter((c) => Number.isInteger(c)))].sort((a, b) => a - b)
    : [];

  if (subjects.length === 0 || classes.length === 0) {
    return [];
  }

  const blueprint = [];
  const k = classes.length;

  for (const subject of subjects) {
    const rawTarget = GEN.perClassPerSubject * k;
    const target = Math.max(GEN.minPerSubject, Math.min(GEN.maxPerSubject, rawTarget));

    const counts = new Array(k).fill(0);

    if (target <= k) {
      // Allocate 1 starting from the highest class downwards
      for (let i = 0; i < target; i++) {
        counts[k - 1 - i] = 1;
      }
    } else {
      // Every open class gets at least 1
      for (let i = 0; i < k; i++) {
        counts[i] = 1;
      }
      let remaining = target - k;

      if (GEN.higherClassWeighting && k > 1) {
        // Linear rank weights (rank 1 for lowest, rank k for highest)
        const weights = classes.map((_, idx) => idx + 1);
        const totalWeight = weights.reduce((acc, w) => acc + w, 0);

        let allocated = 0;
        for (let i = 0; i < k; i++) {
          const share = Math.floor((remaining * weights[i]) / totalWeight);
          counts[i] += share;
          allocated += share;
        }

        let leftOver = remaining - allocated;
        // Distribute remaining from highest class downwards
        let idx = k - 1;
        while (leftOver > 0) {
          counts[idx]++;
          leftOver--;
          idx = (idx - 1 + k) % k;
        }
      } else {
        // Even distribution
        const share = Math.floor(remaining / k);
        let leftOver = remaining % k;
        for (let i = 0; i < k; i++) {
          counts[i] += share;
        }
        let idx = k - 1;
        while (leftOver > 0) {
          counts[idx]++;
          leftOver--;
          idx = (idx - 1 + k) % k;
        }
      }
    }

    for (let i = 0; i < k; i++) {
      if (counts[i] > 0) {
        blueprint.push({
          subject,
          classLevel: classes[i],
          count: counts[i],
        });
      }
    }
  }

  return blueprint;
}

/**
 * Sample questions matching the blueprint from availableQuestions
 * @param {Array<{ subject: string, classLevel: number, count: number }>} blueprint
 * @param {object[]} availableQuestions - Pool of questions from DB
 * @param {string} board - "CBSE" | "ICSE" | "STATE" | "NEUTRAL"
 * @returns {{ selectedQuestions: object[], realizedBlueprint: object[], optionOrders: Record<string, string[]> }}
 */
export function selectQuestions(blueprint = [], availableQuestions = [], board = "NEUTRAL") {
  const selectedQuestions = [];
  const selectedIds = new Set();
  const realizedBlueprint = [];
  const optionOrders = {};

  const activePool = availableQuestions.filter((q) => q && q.isActive !== false);

  for (const item of blueprint) {
    const { subject, classLevel, count } = item;

    // Filter matching bucket: subject, classLevel, board match OR NEUTRAL
    const bucketQuestions = activePool.filter((q) => {
      if (selectedIds.has(q.id)) return false;
      if (q.subject !== subject || q.classLevel !== classLevel) return false;
      return q.board === board || q.board === "NEUTRAL" || !q.board;
    });

    const chosenFromBucket = sampleByDifficulty(bucketQuestions, count);
    for (const q of chosenFromBucket) {
      selectedIds.add(q.id);
    }

    let currentCount = chosenFromBucket.length;

    // Backfill rule: if fewer than count, draw shortfall from nearest adjacent open classes in same subject
    if (currentCount < count) {
      const shortfall = count - currentCount;
      const candidates = activePool
        .filter((q) => {
          if (selectedIds.has(q.id)) return false;
          if (q.subject !== subject) return false;
          return q.board === board || q.board === "NEUTRAL" || !q.board;
        })
        .sort((a, b) => {
          const distA = Math.abs(a.classLevel - classLevel);
          const distB = Math.abs(b.classLevel - classLevel);
          if (distA !== distB) return distA - distB;
          return (b.classLevel || 0) - (a.classLevel || 0);
        });

      const backfilled = candidates.slice(0, shortfall);
      for (const q of backfilled) {
        selectedIds.add(q.id);
        chosenFromBucket.push(q);
      }
      currentCount = chosenFromBucket.length;
    }

    realizedBlueprint.push({
      subject,
      classLevel,
      targetCount: count,
      count: currentCount,
    });

    selectedQuestions.push(...chosenFromBucket);
  }

  // Shuffle option orders for all selected questions and track in optionOrders
  for (const q of selectedQuestions) {
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const shuffledOpts = shuffleArray(rawOptions);
    optionOrders[q.id] = shuffledOpts.map((opt) => opt.key);
  }

  return {
    selectedQuestions,
    realizedBlueprint,
    optionOrders,
  };
}

/**
 * Helper to sample from a pool prioritizing GEN.difficultyMix (EASY 0.3, MEDIUM 0.5, HARD 0.2)
 */
function sampleByDifficulty(pool, count) {
  if (pool.length <= count) {
    return shuffleArray(pool);
  }

  const easy = shuffleArray(pool.filter((q) => q.difficulty === "EASY"));
  const medium = shuffleArray(pool.filter((q) => q.difficulty === "MEDIUM"));
  const hard = shuffleArray(pool.filter((q) => q.difficulty === "HARD"));

  const targetEasy = Math.round(count * (GEN.difficultyMix.EASY || 0.3));
  const targetHard = Math.round(count * (GEN.difficultyMix.HARD || 0.2));
  const targetMed = count - targetEasy - targetHard;

  const selected = [];

  const pickEasy = easy.splice(0, targetEasy);
  const pickMed = medium.splice(0, targetMed);
  const pickHard = hard.splice(0, targetHard);

  selected.push(...pickEasy, ...pickMed, ...pickHard);

  // Fill deficit if any difficulty bucket was short
  if (selected.length < count) {
    const remainingPool = [...easy, ...medium, ...hard];
    const needed = count - selected.length;
    selected.push(...remainingPool.slice(0, needed));
  }

  return shuffleArray(selected);
}

/**
 * Score a Subject Knowledge Assessment attempt
 * @param {object[]} questions - Served questions with full options
 * @param {Record<string, any>} responses - User responses { [questionId]: selectedKey | selectedKeys[] }
 * @returns {object} { overallScore, band, sectionScores, flags }
 */
export function scoreSubjectAttempt(questions = [], responses = {}) {
  const safeResponses = responses && typeof responses === "object" ? responses : {};
  const flags = [];

  // Group by Subject
  const subjectGroups = new Map();
  // Secondary grouping by Class Band (e.g. "CLASS_6_8", "CLASS_9_10")
  const classBandGroups = new Map();

  for (const q of questions) {
    if (!q) continue;
    const subj = q.subject || "GENERAL";
    if (!subjectGroups.has(subj)) subjectGroups.set(subj, []);
    subjectGroups.get(subj).push(q);

    const bandKey = q.classLevel <= 8 ? "Class 6–8" : "Class 9–10";
    if (!classBandGroups.has(bandKey)) classBandGroups.set(bandKey, []);
    classBandGroups.get(bandKey).push(q);
  }

  const sectionScores = {};

  let totalRaw = 0;
  let totalMax = 0;

  // Compute scores per subject
  for (const [subj, subjQuestions] of subjectGroups.entries()) {
    let sRaw = 0;
    let sMax = 0;

    for (const q of subjQuestions) {
      const resp = safeResponses[q.id];
      sMax += 1;

      if (q.type === "MSQ") {
        sRaw += scoreMSQ(q, resp);
      } else {
        // MCQ
        sRaw += scoreMCQ(q, resp);
      }
    }

    const normalized = sMax > 0 ? Number(((sRaw / sMax) * 100).toFixed(1)) : 0;
    sectionScores[subj] = {
      label: subj,
      raw: Number(sRaw.toFixed(2)),
      max: Number(sMax.toFixed(2)),
      normalized,
      count: subjQuestions.length,
    };

    totalRaw += sRaw;
    totalMax += sMax;
  }

  // Compute secondary scores per class band
  const classBandScores = {};
  for (const [bandKey, bandQuestions] of classBandGroups.entries()) {
    let bRaw = 0;
    let bMax = 0;
    for (const q of bandQuestions) {
      const resp = safeResponses[q.id];
      bMax += 1;
      if (q.type === "MSQ") {
        bRaw += scoreMSQ(q, resp);
      } else {
        bRaw += scoreMCQ(q, resp);
      }
    }
    classBandScores[bandKey] = {
      label: bandKey,
      raw: Number(bRaw.toFixed(2)),
      max: Number(bMax.toFixed(2)),
      normalized: bMax > 0 ? Number(((bRaw / bMax) * 100).toFixed(1)) : 0,
      count: bandQuestions.length,
    };
  }

  sectionScores._classBands = classBandScores;

  const overallScore = totalMax > 0 ? Number(((totalRaw / totalMax) * 100).toFixed(1)) : 0;
  const band = scoreToSubjectBand(overallScore);

  return {
    overallScore,
    band,
    sectionScores,
    flags,
  };
}
